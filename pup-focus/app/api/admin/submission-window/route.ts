import { NextRequest, NextResponse } from "next/server";
import { ROLE } from "@/config/roles";
import {
  convert12HourTo24Hour,
  format24HourTo12Hour,
  evaluateSubmissionWindow,
  getSubmissionWindow,
  isAllowedAcademicYear,
  isMissingSubmissionWindowColumnsError,
  validateSubmissionWindow,
} from "@/features/submissions/services/submission-window.service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { sendSubmissionWindowNotificationEmail } from "@/lib/email/send-invite";

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

    if (!user || !isAdminRole(requesterRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = getServiceRoleClient();
    const config = await getSubmissionWindow(supabase);
    const status = evaluateSubmissionWindow(config);

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
  academicYear?: string;
  semester?: string;
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
    const academicYear = payload.academicYear?.trim() ?? "";
    const semester = payload.semester?.trim() ?? "";

    if (!startDate || !endDate || !startTime || !endTime) {
      return NextResponse.json(
        { error: "Start/end date and time are required." },
        { status: 400 },
      );
    }

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

    const supabase = getServiceRoleClient();
    const currentWindow = await getSubmissionWindow(supabase);
    const currentTerm =
      currentWindow?.academicYear && currentWindow?.semester
        ? {
            academicYear: currentWindow.academicYear,
            semester: currentWindow.semester,
          }
        : null;

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

    if (termAlreadyUsed) {
      const isSameCurrentTerm =
        currentTerm?.academicYear === academicYear &&
        currentTerm?.semester === semester;

      if (!isSameCurrentTerm) {
        return NextResponse.json(
          {
            error:
              "The selected academic year and semester have already been used for a submission window.",
          },
          { status: 400 },
        );
      }
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

    const status = evaluateSubmissionWindow({
      startDate,
      endDate,
      startTime: startTime24,
      endTime: endTime24,
    });

    const facultyResult = await supabase
      .from("app_users")
      .select("id, email, full_name, metadata")
      .eq("role", "faculty");

    if (!facultyResult.error && facultyResult.data) {
      const { error: recordTermError } = await supabase
        .from("submission_window_terms")
        .upsert(
          {
            academic_year: academicYear,
            semester,
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
        console.error(
          "Failed to record submission window term usage",
          recordTermError,
        );
      }

      const appUrl = (
        process.env.APP_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.SITE_URL ||
        process.env.URL ||
        "https://pup-focus.local"
      ).replace(/\/$/, "");
      const dashboardUrl = `${appUrl}/faculty/dashboard`;
      const notificationTimestamp = new Date().toISOString();

      await Promise.all(
        facultyResult.data.map(async (faculty) => {
          try {
            const hasBeenNotified = Boolean(
              faculty.metadata?.submission_window_notification_sent_at,
            );
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

            const nextMetadata = {
              ...(faculty.metadata ?? {}),
              submission_window_notification_sent_at: notificationTimestamp,
            };

            await supabase
              .from("app_users")
              .update({
                metadata: nextMetadata,
                updated_at: new Date().toISOString(),
              })
              .eq("id", faculty.id);
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

    const status = evaluateSubmissionWindow(null);
    return NextResponse.json({
      ...status,
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
