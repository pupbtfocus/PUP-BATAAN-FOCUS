import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { ROLE } from "@/config/roles";
import { logger } from "@/lib/observability/logger";
import { logAuditEvent } from "@/features/audit-logs/services/audit-log.service";
import { createNotification } from "@/features/notifications/services/notification.service";
import {
  convert12HourTo24Hour,
  evaluateSubmissionWindow,
  format24HourTo12Hour,
  getTodayInManila,
  isValid12HourTimeInput,
  isValid24HourTimeInput,
  isValidDateInput,
  normalizeTime24Hour,
} from "@/features/submissions/services/submission-window.service";

type ExtendPayload = {
  scope?: "global" | "program" | "faculty";
  scopeTarget?: string;
  preset?: string;
  newEndDate?: string;
  newEndTime?: string;
  reason?: string;
  reasonDetails?: string;
  notifyFaculty?: boolean;
};

export async function GET() {
  try {
    const sessionClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getServiceRoleClient();

    // Query logs from submission_window_logs table
    const { data: logs, error } = await supabase
      .from("submission_window_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) {
      logger.warn("fetch_submission_window_logs_table_error", {
        error: error.message,
      });

      // Fallback to audit_logs table
      const { data: auditLogs } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("action", "submission_window.extend")
        .order("created_at", { ascending: false })
        .limit(30);

      const mappedAuditLogs = (auditLogs || []).map((log: any) => ({
        id: log.id,
        action_type: "EXTENSION",
        created_at: log.created_at,
        extended_by: log.actor_id,
        extended_by_name: log.metadata?.extended_by_name || "Admin",
        old_end_date: log.metadata?.old_end_date || null,
        old_end_time: log.metadata?.old_end_time || null,
        new_end_date: log.metadata?.new_end_date || log.metadata?.newEndDate || "",
        new_end_time: log.metadata?.new_end_time || log.metadata?.newEndTime || "",
        scope: log.metadata?.scope || "global",
        scope_target: log.metadata?.scope_target || log.metadata?.scopeTarget || null,
        reason: log.metadata?.reason || "Extension",
        reason_details: log.metadata?.reason_details || log.metadata?.reasonDetails || null,
        extension_preset: log.metadata?.extension_preset || log.metadata?.preset || null,
        notified_faculty: log.metadata?.notified_faculty ?? true,
      }));

      return NextResponse.json({ logs: mappedAuditLogs });
    }

    return NextResponse.json({ logs: logs || [] });
  } catch (err) {
    logger.error("get_submission_window_logs_exception", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ logs: [] }, { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const sessionClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();

    const requesterRole =
      (user?.user_metadata?.role as string | undefined) ??
      (user?.app_metadata?.role as string | undefined);

    if (
      !user ||
      (requesterRole !== ROLE.ADMIN &&
        requesterRole !== ROLE.SUPER_ADMIN &&
        requesterRole !== ROLE.PROGRAM_HEAD)
    ) {
      return NextResponse.json(
        { error: "Forbidden - Administrator or Program Head access required" },
        { status: 403 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as ExtendPayload;
    const {
      scope = "global",
      scopeTarget,
      preset = "Custom",
      newEndDate,
      newEndTime,
      reason,
      reasonDetails,
      notifyFaculty = true,
    } = body;

    if (!newEndDate || !isValidDateInput(newEndDate)) {
      return NextResponse.json(
        { error: "Valid new end date in YYYY-MM-DD format is required." },
        { status: 400 },
      );
    }

    if (!newEndTime) {
      return NextResponse.json(
        { error: "New end time is required." },
        { status: 400 },
      );
    }

    if (!reason || !reason.trim()) {
      return NextResponse.json(
        { error: "Reason/Justification for extension is required." },
        { status: 400 },
      );
    }

    let end24h = newEndTime.trim();
    if (isValid12HourTimeInput(end24h)) {
      end24h = convert12HourTo24Hour(end24h);
    }

    if (!isValid24HourTimeInput(end24h)) {
      return NextResponse.json(
        { error: "Invalid end time format." },
        { status: 400 },
      );
    }

    const endTimeLabel = format24HourTo12Hour(end24h);
    const supabase = getServiceRoleClient();

    // 1. Fetch current active academic term
    const { data: currentTermRow } = await supabase
      .from("academic_terms")
      .select("academic_year, semester")
      .eq("status", "Current")
      .limit(1)
      .maybeSingle();

    const activeAcademicYear = currentTermRow?.academic_year || "2026-2027";
    const activeSemester = currentTermRow?.semester || "1st Semester";

    // 2. Fetch latest window record for the active academic term or id = 1, regardless of status
    let latestWindow: any = null;
    if (activeAcademicYear && activeSemester) {
      const { data: windowByTerm } = await supabase
        .from("submission_windows")
        .select("*")
        .eq("academic_year", activeAcademicYear)
        .eq("semester", activeSemester)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      latestWindow = windowByTerm;
    }

    if (!latestWindow) {
      const { data: windowById } = await supabase
        .from("submission_windows")
        .select("*")
        .eq("id", 1)
        .maybeSingle();

      latestWindow = windowById;
    }

    // Fetch user name for display
    const { data: actorProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", user.id)
      .maybeSingle();

    const { data: actorAppUser } = await supabase
      .from("app_users")
      .select("full_name")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    const extendedByName =
      actorProfile?.full_name || actorAppUser?.full_name || "Admin";

    const oldEndDate = latestWindow?.end_date || null;
    const oldEndTime = latestWindow?.end_time
      ? format24HourTo12Hour(latestWindow.end_time)
      : null;

    const todayDate = getTodayInManila();
    const startDateToUse =
      latestWindow?.start_date && latestWindow.start_date <= newEndDate
        ? latestWindow.start_date
        : todayDate <= newEndDate
        ? todayDate
        : newEndDate;

    const startTimeToUse = latestWindow?.start_time || "09:00:00";

    // 3. Upsert / Update active submission_windows record to re-open/extend it
    const upsertPayload = {
      id: 1,
      start_date: startDateToUse,
      start_time: startTimeToUse,
      end_date: newEndDate,
      end_time: normalizeTime24Hour(end24h),
      academic_year: latestWindow?.academic_year || activeAcademicYear,
      semester: latestWindow?.semester || activeSemester,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };

    const { error: upsertError } = await supabase
      .from("submission_windows")
      .upsert(upsertPayload, { onConflict: "id" });

    if (upsertError) {
      logger.error("extend_submission_window_upsert_failed", {
        error: upsertError.message,
      });
      return NextResponse.json(
        { error: "Failed to update submission window deadline in database." },
        { status: 500 },
      );
    }

    // 4. Insert audit log entry into submission_window_logs with action_type = 'EXTENSION'
    const logRecord = {
      submission_window_id: 1,
      action_type: "EXTENSION",
      extended_by: user.id,
      extended_by_name: extendedByName,
      old_end_date: oldEndDate,
      old_end_time: oldEndTime,
      new_end_date: newEndDate,
      new_end_time: endTimeLabel,
      scope,
      scope_target: scopeTarget || (scope === "global" ? "All Faculty" : null),
      reason,
      reason_details: reasonDetails?.trim() || null,
      extension_preset: preset,
      notified_faculty: Boolean(notifyFaculty),
    };

    const { data: insertedLog, error: logError } = await supabase
      .from("submission_window_logs")
      .insert(logRecord)
      .select()
      .maybeSingle();

    if (logError) {
      logger.warn("insert_submission_window_log_failed", {
        error: logError.message,
      });
    }

    // Audit log event
    await logAuditEvent({
      actorId: user.id,
      action: "submission_window.extend",
      entityType: "submission_window",
      entityId: "1",
      metadata: {
        action_type: "EXTENSION",
        extended_by_name: extendedByName,
        old_end_date: oldEndDate,
        old_end_time: oldEndTime,
        new_end_date: newEndDate,
        new_end_time: endTimeLabel,
        scope,
        scope_target: scopeTarget || "All Faculty",
        reason,
        reason_details: reasonDetails?.trim() || null,
        preset,
        notified_faculty: Boolean(notifyFaculty),
      },
    });

    // 5. Notify impacted faculty if enabled
    let notifiedCount = 0;
    if (notifyFaculty) {
      try {
        let facultyAuthUserIds: string[] = [];

        if (scope === "faculty" && scopeTarget) {
          // Find auth user id for specific faculty
          const { data: targetFaculty } = await supabase
            .from("app_users")
            .select("auth_user_id")
            .or(`id.eq.${scopeTarget},profile_id.eq.${scopeTarget},auth_user_id.eq.${scopeTarget}`)
            .limit(1);

          if (targetFaculty && targetFaculty[0]?.auth_user_id) {
            facultyAuthUserIds = [targetFaculty[0].auth_user_id];
          }
        } else if (scope === "program" && scopeTarget) {
          // Look up the program UUID from the programs table by code
          const { data: programRow } = await supabase
            .from("programs")
            .select("id")
            .eq("code", scopeTarget)
            .limit(1)
            .maybeSingle();

          if (programRow?.id) {
            // Find faculty assigned to this program by program_id (UUID)
            const { data: assignments } = await supabase
              .from("faculty_program_assignments")
              .select("faculty_profile_id")
              .eq("program_id", programRow.id);

            if (assignments && assignments.length > 0) {
              const profileIds = assignments.map((a) => a.faculty_profile_id).filter(Boolean);
              const { data: users } = await supabase
                .from("app_users")
                .select("auth_user_id")
                .in("profile_id", profileIds);

              if (users) {
                facultyAuthUserIds = users.map((u) => u.auth_user_id).filter(Boolean) as string[];
              }
            }
          }
        } else {
          // Global scope: all active faculty users
          const { data: allFaculty } = await supabase
            .from("app_users")
            .select("auth_user_id")
            .eq("role", "faculty");

          if (allFaculty) {
            facultyAuthUserIds = allFaculty
              .map((u) => u.auth_user_id)
              .filter(Boolean) as string[];
          }
        }

        const uniqueAuthUserIds = Array.from(new Set(facultyAuthUserIds));

        for (const facultyAuthUserId of uniqueAuthUserIds) {
          await createNotification({
            userId: facultyAuthUserId,
            type: "deadline_alert",
            title: "⏰ Submission Window Extended",
            message: `The submission window has been extended to ${newEndDate} ${endTimeLabel}. Reason: ${reason}`,
            metadata: {
              newEndDate,
              newEndTime: endTimeLabel,
              reason,
              scope,
            },
          });
          notifiedCount++;
        }
      } catch (notifErr) {
        logger.error("extension_notification_creation_failed", {
          error: notifErr instanceof Error ? notifErr.message : String(notifErr),
        });
      }
    }

    // Evaluate new window state
    const { data: updatedRaw } = await supabase
      .from("submission_windows")
      .select("start_date, end_date, start_time, end_time, academic_year, semester")
      .eq("id", 1)
      .maybeSingle();

    const windowState = evaluateSubmissionWindow(
      updatedRaw
        ? {
            startDate: updatedRaw.start_date,
            endDate: updatedRaw.end_date,
            startTime: normalizeTime24Hour(updatedRaw.start_time),
            endTime: normalizeTime24Hour(updatedRaw.end_time),
            academicYear: updatedRaw.academic_year,
            semester: updatedRaw.semester,
          }
        : null,
    );

    return NextResponse.json({
      success: true,
      message: `Submission window successfully extended and re-opened to ${newEndDate} at ${endTimeLabel}.${notifyFaculty ? ` Sent notifications to ${notifiedCount} faculty members.` : ""}`,
      logRecord: insertedLog || logRecord,
      windowState,
    });
  } catch (err) {
    logger.error("extend_submission_window_exception", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Internal server error extending submission window." },
      { status: 500 },
    );
  }
}
