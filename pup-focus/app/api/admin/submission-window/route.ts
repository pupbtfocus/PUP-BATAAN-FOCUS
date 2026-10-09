import { NextRequest, NextResponse } from "next/server";
import { ROLE } from "@/config/roles";
import {
  convert12HourTo24Hour,
  format24HourTo12Hour,
  evaluateSubmissionWindow,
  getSubmissionWindow,
  getTodayInManila,
  getCurrentTimeInManila,
  isAllowedAcademicYear,
  isMissingSubmissionWindowColumnsError,
  normalizeSemester,
  validateSubmissionWindow,
  toManilaIso,
  type SubmissionWindowSemester,
} from "@/features/submissions/services/submission-window.service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { sendSubmissionWindowNotificationEmail } from "@/lib/email/send-invite";
import { logAuditEvent } from "@/features/audit-logs/services/audit-log.service";
import { logger } from "@/lib/observability/logger";

function isAdminRole(role: string | undefined) {
  return role === ROLE.ADMIN || role === ROLE.SUPER_ADMIN;
}

async function resolveActiveAcademicTerm(supabase: any): Promise<{
  academicYear: string;
  semester: SubmissionWindowSemester;
}> {
  try {
    const { data: termRows, error } = await supabase
      .from("academic_terms")
      .select("academic_year, semester, status")
      .order("academic_year", { ascending: false });

    if (!error && Array.isArray(termRows) && termRows.length > 0) {
      const currentTerm = termRows.find(
        (t: any) => (t.status || "").trim().toLowerCase() === "current",
      );
      const row = currentTerm || termRows[0];
      if (row?.academic_year && row?.semester) {
        return {
          academicYear: row.academic_year.trim(),
          semester: normalizeSemester(row.semester),
        };
      }
    }
  } catch (err) {
    console.error("Failed to query academic_terms in submission-window route:", err);
  }

  return {
    academicYear: "2026-2027",
    semester: "1st Semester",
  };
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

    if (!user || !isAdminRole(requesterRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = getServiceRoleClient();
    const activeTerm = await resolveActiveAcademicTerm(supabase);

    let config = await getSubmissionWindow(supabase, activeTerm);
    let status = evaluateSubmissionWindow(
      config,
      undefined,
      undefined,
      activeTerm,
    );

    if (config && status.status === "Closed") {
      try {
        await supabase.from("submission_windows").delete().eq("id", 1);
      } catch (deleteErr) {
        console.error("Failed to auto-reset expired submission window:", deleteErr);
      }
      config = null;
      status = evaluateSubmissionWindow(null, undefined, undefined, activeTerm);
    }

    status.academicYear = activeTerm.academicYear;
    status.semester = activeTerm.semester;

    let usedTerms: Array<{ academicYear: string; semester: string }> = [];
    try {
      const { data: usedTermsData, error: usedTermsError } = await supabase
        .from("submission_window_terms")
        .select("academic_year, semester");

      if (!usedTermsError && Array.isArray(usedTermsData)) {
        usedTerms = usedTermsData.map((term) => ({
          academicYear: term.academic_year,
          semester: term.semester,
        }));
      }
    } catch {
      usedTerms = [];
    }

    return NextResponse.json({
      ...status,
      usedTerms,
      startTimeLabel: status.startTime
        ? format24HourTo12Hour(status.startTime)
        : null,
      endTimeLabel: status.endTime
        ? format24HourTo12Hour(status.endTime)
        : null,
      currentTimeLabel: format24HourTo12Hour(status.currentTime),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load submission window", details: String(error) },
      { status: 500 },
    );
  }
}

type UpdatePayload = {
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
};

export async function PUT(request: NextRequest) {
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

    const payload = (await request.json()) as UpdatePayload;
    const startDate = payload.startDate?.trim() ?? "";
    const endDate = payload.endDate?.trim() ?? "";
    const startTime = payload.startTime?.trim() ?? "";
    const endTime = payload.endTime?.trim() ?? "";
    if (!startDate || !endDate || !startTime || !endTime) {
      return NextResponse.json(
        { error: "Start/end date and time are required." },
        { status: 400 },
      );
    }

    const supabase = getServiceRoleClient();
    const activeTerm = await resolveActiveAcademicTerm(supabase);
    const academicYear = activeTerm.academicYear;
    const semester = activeTerm.semester;

    const validation = validateSubmissionWindow(
      startDate,
      endDate,
      startTime,
      endTime,
      academicYear,
      semester,
    );
    if (!validation.isValid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    if (!isAllowedAcademicYear(academicYear)) {
      return NextResponse.json(
        {
          error:
            "Academic year must start at 2026-2027 and may not advance beyond the current calendar year.",
        },
        { status: 400 },
      );
    }

    const currentWindow = await getSubmissionWindow(supabase, activeTerm);
    const currentTerm = {
      academicYear: activeTerm.academicYear,
      semester: activeTerm.semester,
    };

    let usedTerms: Array<{ academic_year: string; semester: string }> = [];
    try {
      const { data: usedTermsData } = await supabase
        .from("submission_window_terms")
        .select("academic_year, semester");
      usedTerms = Array.isArray(usedTermsData) ? usedTermsData : [];
    } catch {
      usedTerms = [];
    }

    const termAlreadyUsed = usedTerms.some(
      (term) =>
        term.academic_year === academicYear && term.semester === semester,
    );

    const isActiveAcademicTerm =
      activeTerm.academicYear === academicYear &&
      activeTerm.semester === semester;

    const isSameCurrentTerm =
      currentTerm?.academicYear === academicYear &&
      currentTerm?.semester === semester;

    if (termAlreadyUsed && !isActiveAcademicTerm && !isSameCurrentTerm) {
      return NextResponse.json(
        {
          error:
            "The selected academic year and semester have already been used for a submission window.",
        },
        { status: 400 },
      );
    }

    const startTime24 = convert12HourTo24Hour(startTime);
    const endTime24 = convert12HourTo24Hour(endTime);

    const { error } = await supabase.from("submission_windows").upsert(
      {
        id: 1,
        start_date: startDate,
        end_date: endDate,
        start_time: startTime24,
        end_time: endTime24,
        academic_year: academicYear,
        semester,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );

    if (error) {
      if (isMissingSubmissionWindowColumnsError(error)) {
        const { error: fallbackError } = await supabase
          .from("submission_windows")
          .upsert(
            {
              id: 1,
              start_date: startDate,
              end_date: endDate,
              updated_by: user.id,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "id" },
          );

        if (fallbackError) {
          return NextResponse.json(
            {
              error: "Failed to save submission window",
              details: fallbackError.message,
            },
            { status: 500 },
          );
        }

        // Auto-inherit due_at for pending submissions that had no deadline set (zero-history state)
        try {
          const windowDueAtIso = toManilaIso(endDate, "17:00:00");
          await supabase
            .from("submissions")
            .update({
              due_at: windowDueAtIso,
              updated_at: new Date().toISOString(),
            })
            .eq("academic_year", academicYear)
            .eq("semester", semester)
            .in("status", ["pending", "unsubmitted"])
            .is("due_at", null);
        } catch {}

        const fallbackStatus = evaluateSubmissionWindow({
          startDate,
          endDate,
          startTime: "09:00:00",
          endTime: "17:00:00",
        });

        return NextResponse.json({
          ...fallbackStatus,
          warning:
            "Database time columns are missing. Saved dates only with default time 9:00 AM to 5:00 PM. Run migration 0011_submission_window_time.sql.",
          startTimeLabel: format24HourTo12Hour(fallbackStatus.startTime ?? ""),
          endTimeLabel: format24HourTo12Hour(fallbackStatus.endTime ?? ""),
          currentTimeLabel: format24HourTo12Hour(fallbackStatus.currentTime),
        });
      }

      return NextResponse.json(
        {
          error: "Failed to save submission window",
          details: error.message,
          code: error.code,
          hint: error.hint,
        },
        { status: 500 },
      );
    }

    // Auto-inherit due_at for pending standard submissions that had no deadline set (zero-history state)
    try {
      const windowDueAtIso = toManilaIso(endDate, endTime24 || "23:59:59");
      await supabase
        .from("submissions")
        .update({
          due_at: windowDueAtIso,
          updated_at: new Date().toISOString(),
        })
        .eq("academic_year", academicYear)
        .eq("semester", semester)
        .in("status", ["pending", "unsubmitted"])
        .is("due_at", null);
    } catch (inheritErr) {
      logger.warn("pending_submissions_inherit_due_at_failed", {
        error: inheritErr instanceof Error ? inheritErr.message : String(inheritErr),
      });
    }

    const status = evaluateSubmissionWindow({
      startDate,
      endDate,
      startTime: startTime24,
      endTime: endTime24,
      academicYear,
      semester,
    });

    const { data: facultyRoles } = await supabase
      .from("user_roles")
      .select("profiles(id, user_id, email, full_name), roles(code)")
      .eq("roles.code", "faculty");

    const facultyProfiles = (facultyRoles ?? [])
      .map((r: any) => r.profiles)
      .filter((p: any) => Boolean(p && p.email));

    if (facultyProfiles.length > 0) {
      const { error: recordTermError } = await supabase
        .from("submission_window_terms")
        .upsert(
          {
            academic_year: academicYear,
            semester,
            start_date: startDate,
            end_date: endDate,
            start_time: startTime,
            end_time: endTime,
            created_by: user.id,
            created_at: new Date().toISOString(),
          },
          { onConflict: "academic_year,semester" },
        );

      if (!recordTermError) {
        const alreadyRecorded = usedTerms.some(
          (term) =>
            term.academic_year === academicYear && term.semester === semester,
        );

        if (!alreadyRecorded) {
          usedTerms.push({ academic_year: academicYear, semester });
        }
      } else {
        if (recordTermError.code === "PGRST205") {
          console.warn(
            "Notice: 'submission_window_terms' table does not exist in Supabase yet. Run migration 0014_submission_window_used_terms.sql to enable term history tracking.",
          );
        } else {
          console.error(
            "Failed to record submission window term usage",
            recordTermError,
          );
        }
      }

      const appUrl = (
        process.env.APP_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.SITE_URL ||
        process.env.URL ||
        "https://pupfocus.cjaayy.dev"
      ).replace(/\/$/, "");
      const dashboardUrl = `${appUrl}/faculty/dashboard`;
      const notificationTimestamp = new Date().toISOString();

      await Promise.all(
        facultyProfiles.map(async (faculty: any) => {
          try {
            let hasBeenNotified = false;
            let userMeta: Record<string, unknown> = {};

            if (faculty.user_id) {
              const { data: authUserData } =
                await supabase.auth.admin.getUserById(faculty.user_id);
              userMeta = (authUserData?.user?.user_metadata ??
                {}) as Record<string, unknown>;
              hasBeenNotified = Boolean(
                userMeta.submission_window_notification_sent_at,
              );
            }

            if (!faculty.email || hasBeenNotified) {
              return;
            }

            await sendSubmissionWindowNotificationEmail({
              to: faculty.email,
              fullName: faculty.full_name ?? "Faculty Member",
              startDate,
              endDate,
              startTimeLabel: startTime,
              endTimeLabel: endTime,
              actionHref: dashboardUrl,
            });

            if (faculty.user_id) {
              await supabase.auth.admin.updateUserById(faculty.user_id, {
                user_metadata: {
                  ...userMeta,
                  submission_window_notification_sent_at: notificationTimestamp,
                },
              });
            }
          } catch (emailError) {
            console.error(
              "Failed to send submission window notification to faculty",
              faculty.email,
              emailError,
            );
          }
        }),
      );
    }

    // Audit log – fire-and-forget; never blocks the response
    try {
      await logAuditEvent({
        actorId: user.id,
        action: "submission_window.update",
        entityType: "submission_window",
        entityId: user.id,
        metadata: {
          academic_year: academicYear,
          semester,
          start_date: startDate,
          end_date: endDate,
          start_time: startTime24,
          end_time: endTime24,
        },
      });
    } catch (auditError) {
      logger.error("audit_log_submission_window_update_failed", {
        error: auditError instanceof Error ? auditError.message : String(auditError),
      });
    }

    // Direct entry into submission_window_logs table
    try {
      let actorName = "Administrator";
      try {
        const { data: prof } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("user_id", user.id)
          .maybeSingle();
        if (prof?.full_name || prof?.email) {
          actorName = prof.full_name || prof.email;
        }
      } catch {}

      await supabase.from("submission_window_logs").insert({
        submission_window_id: 1,
        action_type: "SCHEDULE_UPDATE",
        extended_by: user.id,
        extended_by_name: actorName,
        old_end_date: null,
        old_end_time: null,
        new_end_date: endDate,
        new_end_time: endTime24,
        scope: "global",
        scope_target: `${academicYear} • ${semester}`,
        reason: "Submission Schedule Configured",
        reason_details: `Window set from ${startDate} ${startTime} to ${endDate} ${endTime}`,
        notified_faculty: true,
      });
    } catch (swlError) {
      logger.warn("submission_window_log_insert_failed", { error: String(swlError) });
    }

    return NextResponse.json({
      ...status,
      startTimeLabel: status.startTime
        ? format24HourTo12Hour(status.startTime)
        : null,
      endTimeLabel: status.endTime
        ? format24HourTo12Hour(status.endTime)
        : null,
      currentTimeLabel: format24HourTo12Hour(status.currentTime),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update submission window", details: String(error) },
      { status: 500 },
    );
  }
}

export async function DELETE() {
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

    const supabase = getServiceRoleClient();
    const activeTerm = await resolveActiveAcademicTerm(supabase);
    const todayManila = getTodayInManila();
    const timeManila = getCurrentTimeInManila();

    // Capture existing window before deleting so term history reflects closure
    const { data: existingWin } = await supabase
      .from("submission_windows")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    const { error } = await supabase
      .from("submission_windows")
      .delete()
      .eq("id", 1);

    if (error) {
      return NextResponse.json(
        {
          error: "Failed to close submission window",
          details: error.message,
        },
        { status: 500 },
      );
    }

    // Clear the active schedule in submission_window_terms while preserving the term record
    try {
      await supabase.from("submission_window_terms").upsert(
        {
          academic_year: existingWin?.academic_year || activeTerm.academicYear,
          semester: existingWin?.semester || activeTerm.semester,
          start_date: null,
          end_date: null,
          start_time: null,
          end_time: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "academic_year,semester" },
      );
    } catch {
      // Best-effort update
    }

    const status = evaluateSubmissionWindow(
      null,
      undefined,
      undefined,
      activeTerm,
    );
    status.academicYear = activeTerm.academicYear;
    status.semester = activeTerm.semester;

    let usedTerms: Array<{ academicYear: string; semester: string }> = [];
    try {
      const { data: usedTermsData, error: usedTermsError } = await supabase
        .from("submission_window_terms")
        .select("academic_year, semester");

      if (!usedTermsError && Array.isArray(usedTermsData)) {
        usedTerms = usedTermsData.map((term) => ({
          academicYear: term.academic_year,
          semester: term.semester,
        }));
      }
    } catch {
      usedTerms = [];
    }

    // Audit log – fire-and-forget; never blocks the response
    try {
      await logAuditEvent({
        actorId: user.id,
        action: "submission_window.close",
        entityType: "submission_window",
        entityId: user.id,
        metadata: {
          academic_year: status.academicYear,
          semester: status.semester,
        },
      });
    } catch (auditError) {
      logger.error("audit_log_submission_window_close_failed", {
        error: auditError instanceof Error ? auditError.message : String(auditError),
      });
    }

    // Direct entry into submission_window_logs table
    try {
      let actorName = "Administrator";
      try {
        const { data: prof } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("user_id", user.id)
          .maybeSingle();
        if (prof?.full_name || prof?.email) {
          actorName = prof.full_name || prof.email;
        }
      } catch {}

      await supabase.from("submission_window_logs").insert({
        submission_window_id: 1,
        action_type: "SCHEDULE_CLOSE",
        extended_by: user.id,
        extended_by_name: actorName,
        old_end_date: existingWin?.end_date || null,
        old_end_time: existingWin?.end_time || null,
        new_end_date: todayManila,
        new_end_time: timeManila,
        scope: "global",
        scope_target: `${status.academicYear} • ${status.semester}`,
        reason: "Submission Window Closed",
        reason_details: "Active submission window was manually closed by administrator",
        notified_faculty: true,
      });
    } catch (swlError) {
      logger.warn("submission_window_close_log_insert_failed", { error: String(swlError) });
    }

    return NextResponse.json({
      ...status,
      usedTerms,
      startTimeLabel: null,
      endTimeLabel: null,
      currentTimeLabel: format24HourTo12Hour(status.currentTime),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to close submission window", details: String(error) },
      { status: 500 },
    );
  }
}
