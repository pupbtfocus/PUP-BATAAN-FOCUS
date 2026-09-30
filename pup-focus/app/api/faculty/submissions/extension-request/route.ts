export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { REQUIREMENT_LABEL, type RequirementCode } from "@/config/compliance";
import { logAuditEvent } from "@/features/audit-logs/services/audit-log.service";
import { logger } from "@/lib/observability/logger";
import crypto from "crypto";

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
              supporting_document_url: parsed.supporting_document_url || null,
              supporting_document_name: parsed.supporting_document_name || null,
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

    const contentType = request.headers.get("content-type") || "";
    let academicYear = "2026-2027";
    let semester = "1st Semester";
    let requirementCodes: RequirementCode[] = [];
    let reason = "";
    let requestedPreset = "+3 Days";
    let customDate: string | undefined = undefined;
    let customTime: string | undefined = "17:00";
    let supportingDocFile: File | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      academicYear = (formData.get("academicYear") as string) || academicYear;
      semester = (formData.get("semester") as string) || semester;
      const rawCodes = formData.get("requirementCodes") as string;
      if (rawCodes) {
        try {
          requirementCodes = JSON.parse(rawCodes);
        } catch {
          requirementCodes = [rawCodes as RequirementCode];
        }
      }
      reason = (formData.get("reason") as string) || "";
      requestedPreset = (formData.get("requestedPreset") as string) || requestedPreset;
      customDate = (formData.get("customDate") as string) || undefined;
      customTime = (formData.get("customTime") as string) || "17:00";
      const fileCandidate = formData.get("supportingDocument");
      if (fileCandidate && typeof fileCandidate === "object" && "size" in fileCandidate && (fileCandidate as File).size > 0) {
        supportingDocFile = fileCandidate as File;
      }
    } else {
      const body = await request.json().catch(() => ({}));
      academicYear = body.academicYear || academicYear;
      semester = body.semester || semester;
      requirementCodes = Array.isArray(body.requirementCodes) ? body.requirementCodes : [];
      reason = body.reason || "";
      requestedPreset = body.requestedPreset || requestedPreset;
      customDate = body.customDate;
      customTime = body.customTime || "17:00";
    }

    if (!reason || reason.trim().length < 5) {
      return NextResponse.json(
        { error: "A valid explanation or reason (at least 5 characters) is required." },
        { status: 400 },
      );
    }

    const supabase = getServiceRoleClient();

    // 1. Restrict faculty to a maximum of one pending extension request per requirement schedule
    const { data: existingPending } = await supabase
      .from("extension_requests")
      .select("id, requirement_codes, requested_preset, status")
      .eq("faculty_user_id", user.id)
      .eq("academic_year", academicYear)
      .eq("semester", semester)
      .eq("status", "pending");

    if (existingPending && existingPending.length > 0) {
      const hasOverlap = existingPending.some((ext: any) => {
        const extCodes: string[] = Array.isArray(ext.requirement_codes) ? ext.requirement_codes : [];
        if (extCodes.length === 0 || requirementCodes.length === 0) return true;
        return requirementCodes.some((code) => extCodes.includes(code));
      });

      if (hasOverlap) {
        return NextResponse.json(
          {
            error: "You already have a pending extension request for this requirement schedule. Maximum of one pending extension request is allowed.",
          },
          { status: 400 },
        );
      }
    } else {
      // Check fallback notifications
      const { data: notifPending } = await supabase
        .from("notifications")
        .select("id, message")
        .eq("type", "EXTENSION_REQUEST")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (notifPending) {
        const hasPendingNotif = notifPending.some((n: any) => {
          try {
            const p = JSON.parse(n.message);
            if (p.status !== "pending") return false;
            if (p.academic_year !== academicYear || p.semester !== semester) return false;
            const extCodes: string[] = Array.isArray(p.requirement_codes) ? p.requirement_codes : [];
            if (extCodes.length === 0 || requirementCodes.length === 0) return true;
            return requirementCodes.some((code: string) => extCodes.includes(code));
          } catch {
            return false;
          }
        });
        if (hasPendingNotif) {
          return NextResponse.json(
            {
              error: "You already have a pending extension request for this requirement schedule. Maximum of one pending extension request is allowed.",
            },
            { status: 400 },
          );
        }
      }
    }

    // 2. Check if any requested requirement is marked exempted
    if (requirementCodes && requirementCodes.length > 0) {
      const { data: subData } = await supabase
        .from("submissions")
        .select("requirement_code, status")
        .eq("user_id", user.id)
        .eq("academic_year", academicYear)
        .eq("semester", semester)
        .in("requirement_code", requirementCodes);

      const exemptedCodes = (subData || [])
        .filter((s: any) => {
          const st = (s.status || "").toLowerCase().trim();
          return st === "exempted" || st === "exempt";
        })
        .map((s: any) => s.requirement_code);

      if (exemptedCodes.length > 0) {
        return NextResponse.json(
          {
            error: `Extension requests cannot be submitted for exempted requirements (${exemptedCodes.join(", ")}).`,
          },
          { status: 400 },
        );
      }
    }

    // 3. Compute proposed target deadline date & time based on preset or custom
    let targetDeadlineDate = customDate;
    let targetDeadlineTime = customTime || "17:00";

    if (!targetDeadlineDate || requestedPreset !== "Custom") {
      const target = new Date();
      if (requestedPreset === "+24 Hours") {
        target.setDate(target.getDate() + 1);
      } else if (requestedPreset === "+48 Hours") {
        target.setDate(target.getDate() + 2);
      } else if (requestedPreset === "+1 Week") {
        target.setDate(target.getDate() + 7);
      } else {
        // Default: +3 Days
        target.setDate(target.getDate() + 3);
      }
      targetDeadlineDate = target.toISOString().split("T")[0];
    }

    // 4. Fetch faculty profile details
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

    const requestId = crypto.randomUUID();
    const nowIso = new Date().toISOString();

    // 5. Handle optional supporting document upload
    let supportingDocUrl: string | null = null;
    let supportingDocName: string | null = null;

    if (supportingDocFile) {
      if (supportingDocFile.size > 10 * 1024 * 1024) {
        return NextResponse.json(
          { error: "Supporting document exceeds the 10MB file size limit." },
          { status: 400 },
        );
      }

      const cleanFileName = supportingDocFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const docPath = `extension-documents/${user.id}/${requestId}-${cleanFileName}`;

      const { error: uploadErr } = await supabase.storage
        .from("faculty-submissions")
        .upload(docPath, supportingDocFile, {
          contentType: supportingDocFile.type || "application/octet-stream",
          upsert: true,
        });

      if (!uploadErr) {
        supportingDocUrl = docPath;
        supportingDocName = supportingDocFile.name;
      } else {
        logger.warn("extension_supporting_doc_upload_failed", {
          error: uploadErr.message,
        });
      }
    }

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
      requested_date: targetDeadlineDate,
      requested_time: targetDeadlineTime,
      supporting_document_url: supportingDocUrl,
      supporting_document_name: supportingDocName,
      status: "pending",
      created_at: nowIso,
      updated_at: nowIso,
    };

    // 6. Try to insert into dedicated extension_requests table
    try {
      await supabase.from("extension_requests").insert(requestPayload);
    } catch {
      // Table may not exist yet, fallback will handle it
    }

    // 7. Insert into notifications table with structured JSON message so admin and fallback queries can retrieve it
    const title = `Extension Request: ${facultyName}`;
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

    // 8. Log to audit logs
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
      message: `Extension request for ${requestedPreset} (until ${targetDeadlineDate} ${targetDeadlineTime}) submitted successfully. An administrator will review your request.`,
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
