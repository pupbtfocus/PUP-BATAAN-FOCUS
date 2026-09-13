export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { REQUIREMENT_LABEL, type RequirementCode } from "@/config/compliance";
import { logAuditEvent } from "@/features/audit-logs/services/audit-log.service";
import { logger } from "@/lib/observability/logger";

type ExtensionRequestBody = {
  academicYear?: string;
  semester?: string;
  requirementCodes?: RequirementCode[];
  reason: string;
  requestedPreset?: string;
  customDate?: string;
  customTime?: string;
};

export async function GET(request: NextRequest) {
  try {
    const sessionClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const academicYear = searchParams.get("academicYear");
    const semester = searchParams.get("semester");

    const supabase = getServiceRoleClient();

    let requests: any[] = [];

    // 1. Try querying dedicated extension_requests table first
    try {
      let query = supabase
        .from("extension_requests")
        .select("*")
        .eq("faculty_user_id", user.id)
        .order("created_at", { ascending: false });

      if (academicYear) query = query.eq("academic_year", academicYear);
      if (semester) query = query.eq("semester", semester);

      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        requests = data;
      }
    } catch {
      // Table may not exist yet, proceed to fallback
    }

    // 2. Fallback: Query from notifications table if extension_requests was empty or table not migrated
    if (requests.length === 0) {
      const { data: notifs } = await supabase
        .from("notifications")
        .select("*")
        .eq("type", "EXTENSION_REQUEST")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(15);

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
              faculty_email: parsed.faculty_email,
              department: parsed.department,
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
            if (!academicYear && !semester) return true;
            const matchYear = !academicYear || r.academic_year === academicYear;
            const matchSem = !semester || r.semester === semester;
            return matchYear && matchSem;
          });
      }
    }

    const pendingRequest = requests.find((r) => r.status === "pending") || null;
    const latestApprovedRequest = requests.find((r) => r.status === "approved") || null;
    const latestRequest = requests[0] || null;

    return NextResponse.json({
      hasPendingRequest: Boolean(pendingRequest),
      isApproved: Boolean(latestApprovedRequest),
      pendingRequest,
      latestApprovedRequest,
      latestRequest,
      requests,
    });
  } catch (err) {
    logger.warn("faculty_extension_request_get_exception", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ hasPendingRequest: false, pendingRequest: null, requests: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    const sessionClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as ExtensionRequestBody;
    const {
      academicYear = "2026-2027",
      semester = "1st Semester",
      requirementCodes = [],
      reason,
      requestedPreset = "+3 Days",
      customDate,
      customTime,
    } = body;

    if (!reason || reason.trim().length < 5) {
      return NextResponse.json(
        { error: "A valid explanation or reason (at least 5 characters) is required." },
        { status: 400 },
      );
    }

    const supabase = getServiceRoleClient();

    // Fetch faculty profile details
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name, email, department")
      .eq("user_id", user.id)
      .maybeSingle();

    const facultyName =
      profile?.full_name ||
      (user.user_metadata?.full_name as string | undefined) ||
      user.email ||
      "Faculty Member";

    const reqNames =
      requirementCodes.length > 0
        ? requirementCodes.map((c) => REQUIREMENT_LABEL[c] || c).join(", ")
        : "All Pending Requirements";

    const title = `Extension Request: ${facultyName}`;
    const requestId = crypto.randomUUID();
    const nowIso = new Date().toISOString();

    const requestPayload = {
      id: requestId,
      faculty_user_id: user.id,
      faculty_name: facultyName,
      faculty_email: profile?.email || user.email,
      department: profile?.department || null,
      academic_year: academicYear,
      semester: semester,
      requirement_codes: requirementCodes,
      reason: reason.trim(),
      requested_preset: requestedPreset,
      requested_date: customDate || null,
      requested_time: customTime || null,
      status: "pending",
      created_at: nowIso,
      updated_at: nowIso,
    };

    // 1. Try to insert into dedicated extension_requests table
    try {
      await supabase.from("extension_requests").insert(requestPayload);
    } catch {
      // Table may not exist yet, fallback will handle it
    }

    // 2. Insert into notifications table with structured JSON message so admin and fallback queries can retrieve it
    const notificationInsert = {
      id: requestId,
      user_id: user.id,
      title,
      message: JSON.stringify(requestPayload),
      type: "EXTENSION_REQUEST",
      is_read: false,
      created_at: nowIso,
    };

    const { error: notifError } = await supabase
      .from("notifications")
      .insert(notificationInsert);

    if (notifError) {
      logger.warn("extension_request_notification_insert_warning", {
        error: notifError.message,
      });
    }

    // 3. Log to audit logs
    try {
      await logAuditEvent({
        actorId: user.id,
        action: "submission_window.extension_request",
        entityType: "extension_request",
        entityId: requestId,
        metadata: requestPayload,
      });
    } catch (auditErr) {
      logger.warn("extension_request_audit_log_warning", {
        error: String(auditErr),
      });
    }

    return NextResponse.json({
      success: true,
      message: `Extension request for ${requestedPreset} submitted successfully. An administrator will review your request.`,
      request: requestPayload,
    });
  } catch (error) {
    logger.error("submit_extension_request_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to submit extension request. Please try again." },
      { status: 500 },
    );
  }
}
