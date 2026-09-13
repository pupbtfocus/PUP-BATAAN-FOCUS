export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { ROLE } from "@/config/roles";
import { logAuditEvent } from "@/features/audit-logs/services/audit-log.service";
import { logger } from "@/lib/observability/logger";

function isAdminRole(role?: string): boolean {
  return role === ROLE.ADMIN || role === ROLE.SUPER_ADMIN;
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

    if (!user || !isAdminRole(requesterRole)) {
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

    if (!user || !isAdminRole(requesterRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { requestId, action, adminRemarks = "" } = body;

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

    // 1. Update in extension_requests table if exists
    try {
      const { data: updatedRow, error: updateError } = await supabase
        .from("extension_requests")
        .update({
          status: newStatus,
          admin_remarks: adminRemarks.trim() || null,
          reviewed_by: user.id,
          reviewed_at: nowIso,
          updated_at: nowIso,
        })
        .eq("id", requestId)
        .select()
        .maybeSingle();

      if (!updateError && updatedRow) {
        facultyUserId = updatedRow.faculty_user_id;
        facultyName = updatedRow.faculty_name;
      }
    } catch {
      // Table may not exist yet
    }

    // 2. Fallback update for notification row
    if (!facultyUserId) {
      let targetNotif: any = null;

      // Try by notification id
      const { data: directNotif } = await supabase
        .from("notifications")
        .select("*")
        .eq("id", requestId)
        .maybeSingle();

      if (directNotif) {
        targetNotif = directNotif;
      } else {
        // Search all EXTENSION_REQUEST notifications for parsed id match
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

    // 3. Notify the faculty member
    if (facultyUserId) {
      const notifTitle = `Extension Request ${action === "approve" ? "Approved" : "Rejected"}`;
      const notifMsg =
        action === "approve"
          ? `Your deadline extension request has been approved by an administrator.${adminRemarks.trim() ? ` Remarks: "${adminRemarks.trim()}"` : ""}`
          : `Your deadline extension request was declined.${adminRemarks.trim() ? ` Reason: "${adminRemarks.trim()}"` : ""}`;

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

    // 4. Log audit event
    await logAuditEvent({
      actorId: user.id,
      action: `submission_window.extension_${action}`,
      entityType: "extension_request",
      entityId: requestId,
      metadata: {
        action,
        status: newStatus,
        faculty_user_id: facultyUserId,
        faculty_name: facultyName,
        admin_remarks: adminRemarks.trim(),
      },
    });

    return NextResponse.json({
      success: true,
      message: `Extension request ${action === "approve" ? "approved" : "rejected"} successfully.`,
      status: newStatus,
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
