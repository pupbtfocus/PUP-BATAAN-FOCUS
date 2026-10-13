export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { ROLE } from "@/config/roles";
import { logAuditEvent } from "@/features/audit-logs/services/audit-log.service";
import { logger } from "@/lib/observability/logger";

function isApproverRole(role?: string): boolean {
  if (!role) return false;
  const r = role.toLowerCase().trim();
  return (
    r === "admin" ||
    r === "super_admin" ||
    r === "dean" ||
    r === "department_head" ||
    r === "chairperson" ||
    r === "coordinator" ||
    r === "approver"
  );
}

function normalizeTime24Hour(timeStr?: string | null): string {
  if (!timeStr) return "23:59:59";
  const trimmed = timeStr.trim();
  const match12 = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = match12[2];
    const seconds = match12[3] || "00";
    const period = match12[4].toUpperCase();
    if (period === "PM" && hours < 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;
    return `${hours.toString().padStart(2, "0")}:${minutes}:${seconds}`;
  }
  const match24 = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (match24) {
    const hours = match24[1].padStart(2, "0");
    const minutes = match24[2];
    const seconds = match24[3] || "00";
    return `${hours}:${minutes}:${seconds}`;
  }
  return "23:59:59";
}

export async function GET(request: NextRequest) {
  try {
    const sessionClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();

    const requesterRole =
      (user?.user_metadata?.role as string | undefined) ??
      (user?.app_metadata?.role as string | undefined);

    let hasAccess = isApproverRole(requesterRole);
    if (!hasAccess && user) {
      const supabaseCheck = getServiceRoleClient();
      const { data: prof } = await supabaseCheck
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();
      if (prof?.role && isApproverRole(prof.role)) {
        hasAccess = true;
      }
    }

    if (!user || !hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const academicYear = searchParams.get("academicYear");
    const semester = searchParams.get("semester");
    const statusFilter = searchParams.get("status") || "all"; // 'pending', 'approved', 'rejected', 'all'

    const supabase = getServiceRoleClient();
    let requests: any[] = [];

    // 1. Try querying extension_requests table first
    try {
      let query = supabase
        .from("extension_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (academicYear) query = query.eq("academic_year", academicYear);
      if (semester) query = query.eq("semester", semester);
      if (statusFilter && statusFilter !== "all") query = query.eq("status", statusFilter);

      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        requests = data;
      }
    } catch {
      // Table may not exist yet, use fallback
    }

    // 2. Fallback: Parse from notifications table
    if (requests.length === 0) {
      const { data: notifs } = await supabase
        .from("notifications")
        .select("*")
        .eq("type", "EXTENSION_REQUEST")
        .order("created_at", { ascending: false })
        .limit(50);

      if (Array.isArray(notifs) && notifs.length > 0) {
        requests = notifs
          .map((n) => {
            let parsed: any = {};
            try {
              parsed = JSON.parse(n.message);
            } catch {
              parsed = { reason: n.message };
            }
            return {
              id: parsed.id || n.id,
              faculty_user_id: n.user_id,
              faculty_name: parsed.faculty_name || "Faculty",
              faculty_email: parsed.faculty_email || null,
              department: parsed.department || null,
              academic_year: parsed.academic_year || academicYear || "2026-2027",
              semester: parsed.semester || semester || "1st Semester",
              requirement_codes: parsed.requirement_codes || [],
              reason: parsed.reason || n.message,
              requested_preset: parsed.requested_preset || "+3 Days",
              requested_date: parsed.requested_date || null,
              requested_time: parsed.requested_time || null,
              supporting_document_url: parsed.supporting_document_url || null,
              supporting_document_name: parsed.supporting_document_name || null,
              approved_date: parsed.approved_date || null,
              approved_time: parsed.approved_time || null,
              status: parsed.status || "pending",
              admin_remarks: parsed.admin_remarks || null,
              created_at: parsed.created_at || n.created_at,
            };
          })
          .filter((r) => {
            if (academicYear && r.academic_year !== academicYear) return false;
            if (semester && r.semester !== semester) return false;
            if (statusFilter && statusFilter !== "all" && r.status !== statusFilter) return false;
            return true;
          });
      }
    }

    const pendingCount = requests.filter((r) => r.status === "pending").length;

    return NextResponse.json({
      requests,
      pendingCount,
      totalCount: requests.length,
    });
  } catch (error) {
    logger.error("admin_get_extension_requests_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to load extension requests", details: String(error) },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const sessionClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();

    const requesterRole =
      (user?.user_metadata?.role as string | undefined) ??
      (user?.app_metadata?.role as string | undefined);

    let hasAccess = isApproverRole(requesterRole);
    if (!hasAccess && user) {
      const supabaseCheck = getServiceRoleClient();
      const { data: prof } = await supabaseCheck
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();
      if (prof?.role && isApproverRole(prof.role)) {
        hasAccess = true;
      }
    }

    if (!user || !hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const {
      requestId,
      action,
      approvedDate: bodyApprovedDate,
      approvedTime: bodyApprovedTime,
      adminRemarks = "",
    } = body;

    if (!requestId || !action || !["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { error: "A valid requestId and action ('approve' | 'reject') are required." },
        { status: 400 },
      );
    }

    const supabase = getServiceRoleClient();
    const newStatus = action === "approve" ? "approved" : "rejected";
    const nowIso = new Date().toISOString();

    let facultyUserId: string | null = null;
    let facultyName = "Faculty Member";
    let existingRow: any = null;

    // 1. Fetch current extension request row
    try {
      const { data: fetchedRow } = await supabase
        .from("extension_requests")
        .select("*")
        .eq("id", requestId)
        .maybeSingle();
      if (fetchedRow) {
        existingRow = fetchedRow;
        facultyUserId = fetchedRow.faculty_user_id;
        facultyName = fetchedRow.faculty_name;
      }
    } catch {
      // Table may not exist yet
    }

    // Determine target approved date & time if approving
    let targetApprovedDate: string | null = null;
    let targetApprovedTime: string | null = null;
    let approvedIso: string | null = null;

    if (action === "approve") {
      targetApprovedDate = (bodyApprovedDate || "").trim();
      targetApprovedTime = (bodyApprovedTime || "").trim();

      if (!targetApprovedDate && existingRow?.requested_date) {
        targetApprovedDate = existingRow.requested_date;
      }
      if (!targetApprovedTime && existingRow?.requested_time) {
        targetApprovedTime = existingRow.requested_time;
      }

      if (!targetApprovedDate) {
        const preset = existingRow?.requested_preset || "+3 Days";
        const d = new Date();
        if (preset === "+24 Hours") d.setHours(d.getHours() + 24);
        else if (preset === "+48 Hours") d.setHours(d.getHours() + 48);
        else if (preset === "+3 Days") d.setDate(d.getDate() + 3);
        else if (preset === "+1 Week") d.setDate(d.getDate() + 7);
        else d.setDate(d.getDate() + 3);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        targetApprovedDate = `${yyyy}-${mm}-${dd}`;
      }

      const normalizedTime = normalizeTime24Hour(targetApprovedTime || "23:59:59");
      targetApprovedTime = normalizedTime;
      approvedIso = `${targetApprovedDate}T${normalizedTime}+08:00`;
    }

    // 2. Update in extension_requests table
    try {
      const updateData: Record<string, any> = {
        status: newStatus,
        admin_remarks: adminRemarks.trim() || null,
        reviewed_by: user.id,
        reviewed_at: nowIso,
        updated_at: nowIso,
      };

      if (action === "approve") {
        updateData.approved_date = targetApprovedDate;
        updateData.approved_time = targetApprovedTime;
      }

      const { data: updatedRow, error: updateError } = await supabase
        .from("extension_requests")
        .update(updateData)
        .eq("id", requestId)
        .select()
        .maybeSingle();

      if (!updateError && updatedRow) {
        facultyUserId = updatedRow.faculty_user_id;
        facultyName = updatedRow.faculty_name;
        existingRow = updatedRow;
      }
    } catch {
      // Fallback
    }

    // 3. Fallback update for notification row
    if (!facultyUserId) {
      let targetNotif: any = null;

      const { data: directNotif } = await supabase
        .from("notifications")
        .select("*")
        .eq("id", requestId)
        .maybeSingle();

      if (directNotif) {
        targetNotif = directNotif;
      } else {
        const { data: allNotifs } = await supabase
          .from("notifications")
          .select("*")
          .eq("type", "EXTENSION_REQUEST")
          .order("created_at", { ascending: false })
          .limit(50);

        if (Array.isArray(allNotifs)) {
          targetNotif = allNotifs.find((n) => {
            try {
              const p = JSON.parse(n.message);
              return p.id === requestId || n.id === requestId;
            } catch {
              return n.id === requestId;
            }
          });
        }
      }

      if (targetNotif) {
        facultyUserId = targetNotif.user_id;
        let parsed: any = {};
        try {
          parsed = JSON.parse(targetNotif.message);
        } catch {
          parsed = {
            id: targetNotif.id,
            reason: targetNotif.message,
            faculty_user_id: targetNotif.user_id,
            faculty_name: targetNotif.title?.replace("Extension Request: ", "") || "Faculty Member",
          };
        }

        facultyName = parsed.faculty_name || targetNotif.title?.replace("Extension Request: ", "") || "Faculty Member";
        parsed.status = newStatus;
        parsed.admin_remarks = adminRemarks.trim() || null;
        if (action === "approve") {
          parsed.approved_date = targetApprovedDate;
          parsed.approved_time = targetApprovedTime;
        }
        parsed.reviewed_by = user.id;
        parsed.reviewed_at = nowIso;
        parsed.updated_at = nowIso;

        await supabase
          .from("notifications")
          .update({
            message: JSON.stringify(parsed),
            is_read: true,
          })
          .eq("id", targetNotif.id);
      }
    }

    // 4. ON APPROVAL: Assign approved date as the individual custom due date (submissions.due_at)
    if (action === "approve" && approvedIso && facultyUserId) {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("user_id", facultyUserId)
          .maybeSingle();

        const facultyProfileId = profile?.id || facultyUserId;
        const reqCodes: string[] = Array.isArray(existingRow?.requirement_codes)
          ? existingRow.requirement_codes
          : [];

        // Update due_at for existing submission records
        let updateSubQuery = supabase
          .from("submissions")
          .update({
            due_at: approvedIso,
            updated_at: nowIso,
          })
          .or(`faculty_profile_id.eq.${facultyProfileId},user_id.eq.${facultyUserId}`);

        if (reqCodes.length > 0) {
          updateSubQuery = updateSubQuery.in("requirement_code", reqCodes);
        }
        await updateSubQuery;

        // If no submission row exists yet for requested requirements, insert pending record with due_at
        if (reqCodes.length > 0 && profile?.id) {
          const { data: existingRows } = await supabase
            .from("submissions")
            .select("requirement_code")
            .or(`faculty_profile_id.eq.${profile.id},user_id.eq.${facultyUserId}`)
            .in("requirement_code", reqCodes);

          const existingSet = new Set((existingRows || []).map((r: any) => r.requirement_code));
          const missingCodes = reqCodes.filter((c) => !existingSet.has(c));

          if (missingCodes.length > 0) {
            const { data: curr } = await supabase
              .from("curricula")
              .select("id")
              .limit(1)
              .maybeSingle();

            if (curr?.id) {
              for (const code of missingCodes) {
                try {
                  await supabase.from("submissions").insert({
                    id: crypto.randomUUID(),
                    faculty_profile_id: profile.id,
                    curriculum_id: curr.id,
                    requirement_code: code,
                    status: "pending",
                    due_at: approvedIso,
                    created_at: nowIso,
                    updated_at: nowIso,
                  });
                } catch {
                  // Non-fatal if unique constraint prevents insert
                }
              }
            }
          }
        }
      } catch (subErr) {
        logger.error("assign_custom_due_at_failed", {
          error: subErr instanceof Error ? subErr.message : String(subErr),
          facultyUserId,
          approvedIso,
        });
      }
    }

    // 5. Notify the faculty member
    if (facultyUserId) {
      const notifTitle = `Extension Request ${action === "approve" ? "Approved" : "Rejected"}`;
      const notifMsg =
        action === "approve"
          ? `Your deadline extension request has been approved until ${targetApprovedDate} at ${targetApprovedTime || "11:59 PM"}.${adminRemarks.trim() ? ` Remarks: "${adminRemarks.trim()}"` : ""}`
          : `Your deadline extension request was declined.${adminRemarks.trim() ? ` Feedback remarks: "${adminRemarks.trim()}"` : ""}`;

      await supabase.from("notifications").insert({
        id: crypto.randomUUID(),
        user_id: facultyUserId,
        title: notifTitle,
        message: notifMsg,
        type: action === "approve" ? "EXTENSION_APPROVED" : "EXTENSION_REJECTED",
        is_read: false,
        created_at: nowIso,
      });
    }

    // 6. Log audit event
    await logAuditEvent({
      actorId: user.id,
      action: `submission_window.extension_${action}`,
      entityType: "extension_request",
      entityId: requestId,
      metadata: {
        action,
        status: newStatus,
        approved_date: targetApprovedDate,
        approved_time: targetApprovedTime,
        faculty_user_id: facultyUserId,
        faculty_name: facultyName,
        admin_remarks: adminRemarks.trim(),
      },
    });

    return NextResponse.json({
      success: true,
      message:
        action === "approve"
          ? `Extension request approved until ${targetApprovedDate}. Submission portal unlocked for faculty.`
          : "Extension request declined. Faculty portal remains locked.",
      status: newStatus,
      approvedDate: targetApprovedDate,
      approvedTime: targetApprovedTime,
    });
  } catch (error) {
    logger.error("admin_review_extension_request_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to review extension request", details: String(error) },
      { status: 500 },
    );
  }
}
