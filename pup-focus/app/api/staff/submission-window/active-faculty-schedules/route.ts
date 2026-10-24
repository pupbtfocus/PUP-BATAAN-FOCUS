import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { ROLE } from "@/config/roles";
import {
  parseSubmissionOrigin,
  stripOriginTag,
} from "@/features/submissions/services/submission-window.service";

function isAdminRole(role: string | undefined) {
  return role === ROLE.STAFF || role === ROLE.ADMIN || role === ROLE.SUPER_ADMIN || role === "staff";
}

export async function GET() {
  try {
    const sessionClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();

    const requesterRole =
      (user?.user_metadata?.role as string | undefined) ??
      (user?.app_metadata?.role as string | undefined);

    let hasAccess = isAdminRole(requesterRole);
    if (!hasAccess && user) {
      const supabaseCheck = getServiceRoleClient();
      const { data: prof } = await supabaseCheck
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();
      if (prof?.role && isAdminRole(prof.role)) {
        hasAccess = true;
      }
    }

    if (!user || !hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = getServiceRoleClient();
    const nowIso = new Date().toISOString();

    // 1. Query pending submissions that have a future due_at (works whether global window is open or closed)
    let activeSubmissions: any[] = [];

    const { data: subData, error: subError } = await supabase
      .from("submissions")
      .select("id, faculty_profile_id, requirement_code, status, due_at, remarks, academic_year, semester, created_at")
      .not("due_at", "is", null)
      .in("status", ["pending", "unsubmitted"])
      .order("due_at", { ascending: true });

    if (subError) {
      // Fallback with minimal columns if academic_year / semester aren't on submissions
      const { data: fallbackSubData, error: fallbackError } = await supabase
        .from("submissions")
        .select("id, faculty_profile_id, requirement_code, status, due_at, remarks, created_at")
        .not("due_at", "is", null)
        .in("status", ["pending", "unsubmitted"])
        .order("due_at", { ascending: true });

      if (!fallbackError && Array.isArray(fallbackSubData)) {
        activeSubmissions = fallbackSubData;
      }
    } else if (Array.isArray(subData)) {
      activeSubmissions = subData;
    }

    // Filter to ensure due_at is strictly in the future relative to current time and not closed
    const nowMs = Date.now();
    activeSubmissions = activeSubmissions.filter((sub) => {
      if (!sub.due_at) return false;
      const remarksText = typeof sub.remarks === "string" ? sub.remarks : "";
      if (remarksText.includes("[origin:CLOSED]") || remarksText.includes("closed by admin")) {
        return false;
      }
      const dueIso = sub.due_at.includes("T") ? sub.due_at : `${sub.due_at}T23:59:59+08:00`;
      const dueMs = new Date(dueIso).getTime();
      return !Number.isNaN(dueMs) && dueMs > nowMs;
    });

    // 2. Query approved extension requests that are still active (target deadline >= now)
    let approvedExtensions: any[] = [];
    try {
      const { data: extData, error: extError } = await supabase
        .from("extension_requests")
        .select("id, faculty_user_id, faculty_name, faculty_email, department, academic_year, semester, requirement_codes, reason, approved_date, approved_time, requested_date, requested_time, status")
        .eq("status", "approved")
        .not("approved_date", "is", null);

      if (!extError && Array.isArray(extData)) {
        const todayStr = nowIso.slice(0, 10);
        approvedExtensions = extData.filter((ext) => {
          const extDate = ext.approved_date;
          if (!extDate) return false;
          return extDate >= todayStr;
        });
      }
    } catch {
      // Ignore if extension_requests table does not exist
    }

    // Group submissions by faculty profile ID
    const facultyMap = new Map<string, any[]>();
    for (const sub of activeSubmissions) {
      const key = sub.faculty_profile_id;
      if (!key) continue;
      if (!facultyMap.has(key)) {
        facultyMap.set(key, []);
      }
      facultyMap.get(key)!.push(sub);
    }

    const profileKeys = Array.from(facultyMap.keys());
    let profileLookup = new Map<string, any>();

    if (profileKeys.length > 0) {
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name, email, user_id, created_at")
        .in("id", profileKeys);

      const profilesList = profilesData || [];
      for (const p of profilesList) {
        profileLookup.set(p.id, p);
        if (p.user_id) {
          profileLookup.set(p.user_id, p);
        }
      }
    }

    // Program assignments for department labels
    const validProfileIds = Array.from(profileLookup.keys());
    let assignmentMap = new Map<string, string>();
    if (validProfileIds.length > 0) {
      try {
        const { data: assignmentsData } = await supabase
          .from("faculty_program_assignments")
          .select("faculty_profile_id, program_id, programs(name, code)")
          .in("faculty_profile_id", validProfileIds);

        if (Array.isArray(assignmentsData)) {
          for (const a of assignmentsData) {
            const prog = (a as any).programs;
            const progLabel = prog?.name || prog?.code || null;
            if (progLabel && a.faculty_profile_id) {
              assignmentMap.set(a.faculty_profile_id, progLabel);
            }
          }
        }
      } catch {
        // Non-fatal
      }
    }

    const schedules: any[] = [];
    const processedFacultyIds = new Set<string>();

    for (const [key, subs] of facultyMap.entries()) {
      const profile = profileLookup.get(key);
      const facultyName = profile?.full_name || "Faculty Member";
      const facultyEmail = profile?.email || "";
      const department =
        (profile && assignmentMap.get(profile.id)) ||
        "Faculty Member";

      const sortedByDue = [...subs].sort(
        (a, b) => new Date(a.due_at!).getTime() - new Date(b.due_at!).getTime()
      );
      const deadlineIso = sortedByDue[sortedByDue.length - 1].due_at!;
      const deadlineDate = new Date(deadlineIso);

      const msRemaining = Math.max(0, deadlineDate.getTime() - nowMs);
      const days = Math.floor(msRemaining / (1000 * 60 * 60 * 24));
      const hours = Math.floor((msRemaining / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((msRemaining / (1000 * 60)) % 60);

      let timeRemainingLabel = "";
      if (days > 0) {
        timeRemainingLabel = `${days}d ${hours}h remaining`;
      } else if (hours > 0) {
        timeRemainingLabel = `${hours}h ${minutes}m remaining`;
      } else {
        timeRemainingLabel = `${minutes}m remaining`;
      }

      // Tag each faculty based on submission origin:
      // - "New Faculty" for onboarding grace period assignments
      // Active individual submission schedule is an approved extension
      const scheduleType: "extension" = "extension";
      const typeLabel: "Extended" = "Extended";

      const deadlineFormatted = deadlineDate.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });

      const rawOpenIso = subs[0]?.created_at || profile?.created_at || null;
      let openDate = rawOpenIso ? new Date(rawOpenIso) : null;
      if (!openDate || Number.isNaN(openDate.getTime())) {
        openDate = new Date(deadlineDate.getTime() - 7 * 24 * 60 * 60 * 1000);
      }
      const openDateFormatted = openDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });

      const closeDateFormatted = deadlineDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });

      const uniqueCodes = Array.from(
        new Set(subs.map((s) => s.requirement_code).filter(Boolean))
      );

      const academicYear = subs[0]?.academic_year || "Current Term";
      const semester = subs[0]?.semester || "";

      processedFacultyIds.add(profile?.id || key);
      if (profile?.user_id) {
        processedFacultyIds.add(profile.user_id);
      }

      schedules.push({
        facultyProfileId: profile?.id || key,
        facultyName,
        email: facultyEmail,
        department,
        academicYear,
        semester,
        type: scheduleType,
        typeLabel,
        deadline: deadlineIso,
        deadlineFormatted,
        daysRemaining: days,
        timeRemainingLabel,
        openDateFormatted,
        closeDateFormatted,
        unlockedRequirements: uniqueCodes,
        unlockedCount: uniqueCodes.length,
        remarks: stripOriginTag(subs[0]?.remarks) || "Active individual submission schedule",
      });
    }

    // Include approved extensions not already covered by submission due_at
    for (const ext of approvedExtensions) {
      const extUserId = ext.faculty_user_id;
      if (extUserId && processedFacultyIds.has(extUserId)) {
        continue;
      }

      const extDate = ext.approved_date;
      const rawDeadlineTime = ext.approved_time || "23:59";
      
      // Parse extension date & time safely handling 12h/24h formats
      let deadlineDate: Date | null = null;
      let time24 = "23:59";
      const matchAmpm = (rawDeadlineTime || "").trim().match(/^(0?[1-9]|1[0-2]):([0-5][0-9])\s?(AM|PM)$/i);
      if (matchAmpm) {
        let hour = parseInt(matchAmpm[1], 10);
        const minute = matchAmpm[2];
        const period = matchAmpm[3].toUpperCase();
        if (period === "AM" && hour === 12) hour = 0;
        if (period === "PM" && hour < 12) hour += 12;
        time24 = `${hour.toString().padStart(2, "0")}:${minute}`;
      } else if (/^([01]?[0-9]|2[0-3]):([0-5][0-9])$/.test(rawDeadlineTime.trim())) {
        const parts = rawDeadlineTime.trim().split(":");
        time24 = `${parts[0].padStart(2, "0")}:${parts[1]}`;
      }

      if (extDate) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(extDate)) {
          const parsed = new Date(`${extDate}T${time24}:00`);
          if (!isNaN(parsed.getTime())) deadlineDate = parsed;
        }
        if (!deadlineDate) {
          const parsed = new Date(extDate);
          if (!isNaN(parsed.getTime())) {
            const [h, m] = time24.split(":").map(Number);
            parsed.setHours(h || 23, m || 59, 0, 0);
            deadlineDate = parsed;
          }
        }
      }

      if (!deadlineDate || isNaN(deadlineDate.getTime())) {
        deadlineDate = new Date(nowMs + 7 * 24 * 60 * 60 * 1000);
      }

      const deadlineIso = deadlineDate.toISOString();
      const msRemaining = Math.max(0, deadlineDate.getTime() - nowMs);
      const days = Math.floor(msRemaining / (1000 * 60 * 60 * 24));
      const hours = Math.floor((msRemaining / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((msRemaining / (1000 * 60)) % 60);

      let timeRemainingLabel = "";
      if (days > 0) {
        timeRemainingLabel = `${days}d ${hours}h remaining`;
      } else if (hours > 0) {
        timeRemainingLabel = `${hours}h ${minutes}m remaining`;
      } else {
        timeRemainingLabel = `${minutes}m remaining`;
      }

      const deadlineFormatted = deadlineDate.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });

      const openDateFormatted = extDate && !isNaN(new Date(extDate).getTime())
        ? new Date(extDate).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "—";

      const closeDateFormatted = deadlineDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });

      const reqCodes = Array.isArray(ext.requirement_codes)
        ? ext.requirement_codes
        : [];

      schedules.push({
        facultyProfileId: extUserId || ext.id,
        facultyName: ext.faculty_name || "Faculty Member",
        email: ext.faculty_email || "",
        department: ext.department || "Faculty Member",
        academicYear: ext.academic_year || "Current Term",
        semester: ext.semester || "",
        type: "extension",
        typeLabel: "Extended",
        deadline: deadlineIso,
        deadlineFormatted,
        daysRemaining: days,
        timeRemainingLabel,
        openDateFormatted,
        closeDateFormatted,
        unlockedRequirements: reqCodes,
        unlockedCount: reqCodes.length,
        remarks: ext.reason || "Approved deadline extension",
      });
    }

    // Deduplicate schedules by facultyProfileId or email
    const uniqueSchedules: any[] = [];
    const seenIds = new Set<string>();
    for (const s of schedules) {
      const idKey = s.facultyProfileId || s.email;
      if (!seenIds.has(idKey)) {
        seenIds.add(idKey);
        uniqueSchedules.push(s);
      }
    }

    return NextResponse.json({
      count: uniqueSchedules.length,
      schedules: uniqueSchedules,
    });
  } catch (error) {
    console.error("Failed to fetch active faculty schedules:", error);
    return NextResponse.json(
      { error: "Internal Server Error", count: 0, schedules: [] },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const sessionClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();

    const requesterRole =
      (user?.user_metadata?.role as string | undefined) ??
      (user?.app_metadata?.role as string | undefined);

    let hasAccess = isAdminRole(requesterRole);
    if (!hasAccess && user) {
      const supabaseCheck = getServiceRoleClient();
      const { data: prof } = await supabaseCheck
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();
      if (prof?.role && isAdminRole(prof.role)) {
        hasAccess = true;
      }
    }

    if (!user || !hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { facultyProfileId, email: bodyEmail } = body;
    if (!facultyProfileId && !bodyEmail) {
      return NextResponse.json({ error: "facultyProfileId or email is required" }, { status: 400 });
    }

    const supabase = getServiceRoleClient();
    const nowIso = new Date().toISOString();

    // 1. Resolve possible profile ID, user_id, and email
    const queryTerm = facultyProfileId || bodyEmail;
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, user_id, email, full_name")
      .or(`id.eq.${queryTerm},user_id.eq.${queryTerm},email.eq.${queryTerm}`)
      .maybeSingle();

    const targetProfileId = profile?.id || facultyProfileId;
    const targetUserId = profile?.user_id;
    const targetEmail = profile?.email || bodyEmail;

    const targetIds = [
      targetProfileId,
      ...(targetUserId ? [targetUserId] : []),
      ...(facultyProfileId ? [facultyProfileId] : []),
    ];
    const uniqueTargetIds = Array.from(new Set(targetIds.filter(Boolean)));

    // 2. Clear due_at and mark remarks as closed on all submissions for this faculty member (except already validated/approved/exempted)
    const { error: subUpdateErr } = await supabase
      .from("submissions")
      .update({
        due_at: null,
        remarks: "[origin:CLOSED] Individual submission window closed by admin",
        updated_at: nowIso,
      })
      .in("faculty_profile_id", uniqueTargetIds)
      .neq("status", "validated")
      .neq("status", "approved")
      .neq("status", "exempted");

    await supabase
      .from("submissions")
      .update({
        due_at: null,
        remarks: "[origin:CLOSED] Individual submission window closed by admin",
        updated_at: nowIso,
      })
      .in("faculty_id", uniqueTargetIds)
      .neq("status", "validated")
      .neq("status", "approved")
      .neq("status", "exempted");

    if (subUpdateErr) {
      console.error("Failed to close submissions due_at:", subUpdateErr);
    }

    // 3. Clear due_at & grace_period_until in faculty_program_assignments
    try {
      await supabase
        .from("faculty_program_assignments")
        .update({
          due_at: null,
          grace_period_until: null,
          remarks: "[origin:CLOSED] Individual submission window closed by admin",
          updated_at: nowIso,
        })
        .in("faculty_profile_id", uniqueTargetIds);
    } catch (assignErr) {
      console.error("Failed to clear faculty_program_assignments:", assignErr);
    }

    // 4. Close any active extension deadlines for this faculty member
    try {
      if (uniqueTargetIds.length > 0) {
        await supabase
          .from("extension_requests")
          .update({
            status: "closed",
            admin_remarks: "Individual submission window closed by admin",
            approved_date: null,
            approved_time: null,
            updated_at: nowIso,
          })
          .in("faculty_user_id", uniqueTargetIds)
          .eq("status", "approved");

        await supabase
          .from("extension_requests")
          .update({
            status: "closed",
            admin_remarks: "Individual submission window closed by admin",
            approved_date: null,
            approved_time: null,
            updated_at: nowIso,
          })
          .in("id", uniqueTargetIds)
          .eq("status", "approved");
      }

      if (targetEmail) {
        await supabase
          .from("extension_requests")
          .update({
            status: "closed",
            admin_remarks: "Individual submission window closed by admin",
            approved_date: null,
            approved_time: null,
            updated_at: nowIso,
          })
          .eq("faculty_email", targetEmail)
          .eq("status", "approved");
      }
    } catch (extErr) {
      console.error("Failed to close extension_requests deadline:", extErr);
    }

    // 5. Update any notifications for this user that marked an extension as approved
    try {
      if (uniqueTargetIds.length > 0) {
        const { data: notifs } = await supabase
          .from("notifications")
          .select("id, message")
          .eq("type", "EXTENSION_REQUEST")
          .in("user_id", uniqueTargetIds);

        if (Array.isArray(notifs)) {
          for (const notif of notifs) {
            try {
              const parsed = JSON.parse(notif.message);
              if (parsed.status === "approved") {
                parsed.status = "rejected";
                parsed.admin_remarks = "Individual submission window closed by admin";
                await supabase
                  .from("notifications")
                  .update({ message: JSON.stringify(parsed) })
                  .eq("id", notif.id);
              }
            } catch {}
          }
        }
      }
    } catch {
      // Non-fatal
    }

    return NextResponse.json({
      success: true,
      message: "Individual submission window closed successfully.",
    });
  } catch (error) {
    console.error("Error closing active faculty schedule:", error);
    return NextResponse.json(
      { error: "Failed to close faculty submission schedule" },
      { status: 500 }
    );
  }
}
