import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { ROLE } from "@/config/roles";
import {
  parseSubmissionOrigin,
  stripOriginTag,
} from "@/features/submissions/services/submission-window.service";

function isAdminRole(role: string | undefined) {
  return role === ROLE.ADMIN || role === ROLE.SUPER_ADMIN;
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
      .eq("status", "pending")
      .order("due_at", { ascending: true });

    if (subError) {
      // Fallback with minimal columns if academic_year / semester aren't on submissions
      const { data: fallbackSubData, error: fallbackError } = await supabase
        .from("submissions")
        .select("id, faculty_profile_id, requirement_code, status, due_at, remarks, created_at")
        .not("due_at", "is", null)
        .eq("status", "pending")
        .order("due_at", { ascending: true });

      if (!fallbackError && Array.isArray(fallbackSubData)) {
        activeSubmissions = fallbackSubData;
      }
    } else if (Array.isArray(subData)) {
      activeSubmissions = subData;
    }

    // Filter to ensure due_at is strictly in the future relative to current time
    const nowMs = Date.now();
    activeSubmissions = activeSubmissions.filter((sub) => {
      if (!sub.due_at) return false;
      const dueIso = sub.due_at.includes("T") ? sub.due_at : `${sub.due_at}T23:59:59+08:00`;
      const dueMs = new Date(dueIso).getTime();
      return !Number.isNaN(dueMs) && dueMs > nowMs;
    });

    // 2. Query approved extension requests that are still active (target deadline >= now)
    let approvedExtensions: any[] = [];
    try {
      const { data: extData, error: extError } = await supabase
        .from("extension_requests")
        .select("id, faculty_user_id, faculty_name, faculty_email, department, academic_year, semester, requirement_codes, reason, approved_date, approved_time, status")
        .eq("status", "approved");

      if (!extError && Array.isArray(extData)) {
        const todayStr = nowIso.slice(0, 10);
        approvedExtensions = extData.filter((ext) => {
          if (!ext.approved_date) return false;
          return ext.approved_date >= todayStr;
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
      // - "Extended" for individually extended deadlines
      // - "Standard" for active global window schedules
      const isOnboardingSchedule = subs.some((s) => {
        const origin = parseSubmissionOrigin(s.remarks);
        if (
          origin === "NEW_FACULTY_GRACE" ||
          origin === "NEW_FACULTY_CUSTOM" ||
          origin === "NEW_FACULTY"
        ) {
          return true;
        }
        const lower = (s.remarks || "").toLowerCase();
        return (
          lower.includes("onboarding") ||
          lower.includes("grace period") ||
          lower.includes("extra time")
        );
      });

      const isExtensionSchedule = subs.some((s) => {
        const origin = parseSubmissionOrigin(s.remarks);
        if (origin === "EXTENDED") {
          return true;
        }
        const lower = (s.remarks || "").toLowerCase();
        return lower.includes("extension") || lower.includes("extended");
      });

      let scheduleType: "onboarding" | "extension" | "standard" = "standard";
      let typeLabel: "New Faculty" | "Extended" | "Standard" = "Standard";

      if (isOnboardingSchedule) {
        scheduleType = "onboarding";
        typeLabel = "New Faculty";
      } else if (isExtensionSchedule) {
        scheduleType = "extension";
        typeLabel = "Extended";
      } else {
        scheduleType = "standard";
        typeLabel = "Standard";
      }

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

      const deadlineTime = ext.approved_time || "23:59";
      const deadlineIso = `${ext.approved_date}T${deadlineTime}:00`;
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

      const deadlineFormatted = deadlineDate.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });

      const openDateFormatted = ext.approved_date
        ? new Date(`${ext.approved_date}T00:00:00`).toLocaleDateString("en-US", {
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
    const { facultyProfileId } = body;
    if (!facultyProfileId) {
      return NextResponse.json({ error: "facultyProfileId is required" }, { status: 400 });
    }

    const supabase = getServiceRoleClient();
    const nowIso = new Date().toISOString();

    // 1. Resolve possible profile ID and user_id
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, user_id, full_name")
      .or(`id.eq.${facultyProfileId},user_id.eq.${facultyProfileId}`)
      .maybeSingle();

    const targetProfileId = profile?.id || facultyProfileId;
    const targetUserId = profile?.user_id;

    const targetIds = [targetProfileId, ...(targetUserId ? [targetUserId] : []), ...(facultyProfileId ? [facultyProfileId] : [])];
    const uniqueTargetIds = Array.from(new Set(targetIds.filter(Boolean)));

    // 2. Clear due_at on any active pending submissions for this faculty member
    const { error: subUpdateErr } = await supabase
      .from("submissions")
      .update({
        due_at: null,
        remarks: "Individual submission window closed by admin",
      })
      .in("faculty_profile_id", uniqueTargetIds)
      .gt("due_at", nowIso)
      .eq("status", "pending");

    if (subUpdateErr) {
      console.error("Failed to close submissions due_at:", subUpdateErr);
    }

    // 3. Cancel any active extension requests for this faculty member
    try {
      await supabase
        .from("extension_requests")
        .update({
          status: "cancelled",
        })
        .in("faculty_user_id", uniqueTargetIds)
        .eq("status", "approved");
    } catch {
      // Best-effort
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
