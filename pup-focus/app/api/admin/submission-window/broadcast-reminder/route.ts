import { NextRequest, NextResponse } from "next/server";
import { ROLE } from "@/config/roles";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import {
  evaluateSubmissionWindow,
  format24HourTo12Hour,
  getSubmissionWindow,
} from "@/features/submissions/services/submission-window.service";
import { logAuditEvent } from "@/features/audit-logs/services/audit-log.service";
import { logger } from "@/lib/observability/logger";

function isAdminRole(role: string | undefined): boolean {
  return role === ROLE.ADMIN || role === ROLE.SUPER_ADMIN;
}

function formatEndDate(dateStr: string, time24Str?: string | null): string {
  try {
    const timeStr = time24Str ? time24Str.slice(0, 5) : "23:59";
    const dateObj = new Date(`${dateStr}T${timeStr}:00+08:00`);
    if (Number.isNaN(dateObj.getTime())) {
      return dateStr;
    }
    return dateObj.toLocaleString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
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

    if (!user || !isAdminRole(requesterRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = getServiceRoleClient();
    const windowConfig = await getSubmissionWindow(supabase);
    const windowState = evaluateSubmissionWindow(windowConfig);

    if (!windowConfig || !windowState.isConfigured) {
      return NextResponse.json(
        { error: "No submission window is currently configured." },
        { status: 400 },
      );
    }

    const academicYear = windowState.academicYear ?? windowConfig.academicYear ?? "Current AY";
    const semester = windowState.semester ?? windowConfig.semester ?? "Current Semester";
    const endDateStr = windowState.endDate ?? windowConfig.endDate;
    const endTimeStr = windowState.endTime ?? windowConfig.endTime;

    if (!endDateStr) {
      return NextResponse.json(
        { error: "Submission window end date is missing." },
        { status: 400 },
      );
    }

    // Calculate remaining time
    const endIso = `${endDateStr}T${endTimeStr ? endTimeStr.slice(0, 5) : "23:59"}:00+08:00`;
    const endDateTime = new Date(endIso);
    const now = new Date();
    const diffMs = endDateTime.getTime() - now.getTime();

    let remainingText = "0 Hours";
    let daysRemaining = 0;

    if (diffMs > 0) {
      const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
      daysRemaining = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

      if (diffHours >= 48) {
        remainingText = `${daysRemaining} Days`;
      } else if (diffHours >= 24) {
        remainingText = "1 Day";
      } else {
        remainingText = `${diffHours} ${diffHours === 1 ? "Hour" : "Hours"}`;
      }
    }

    const formattedEndDate = formatEndDate(endDateStr, endTimeStr);

    // Retrieve active Faculty user IDs (auth.users.id)
    const facultyUserIds = new Set<string>();

    const { data: appUsers, error: appUsersError } = await supabase
      .from("app_users")
      .select("id, auth_user_id, role")
      .eq("role", "faculty");

    if (!appUsersError && appUsers) {
      for (const userRow of appUsers) {
        const targetId = userRow.auth_user_id || userRow.id;
        if (targetId) {
          facultyUserIds.add(targetId);
        }
      }
    }

    // Fallback search via roles/user_roles/profiles if app_users is empty
    if (facultyUserIds.size === 0) {
      const { data: facultyRole } = await supabase
        .from("roles")
        .select("id")
        .eq("code", "faculty")
        .maybeSingle();

      if (facultyRole?.id) {
        const { data: userRoles } = await supabase
          .from("user_roles")
          .select("profile_id")
          .eq("role_id", facultyRole.id);

        if (userRoles && userRoles.length > 0) {
          const profileIds = userRoles
            .map((ur) => ur.profile_id)
            .filter((id): id is string => Boolean(id));

          const { data: profiles } = await supabase
            .from("profiles")
            .select("user_id")
            .in("id", profileIds);

          if (profiles) {
            for (const profile of profiles) {
              if (profile.user_id) {
                facultyUserIds.add(profile.user_id);
              }
            }
          }
        }
      }
    }

    const targetList = Array.from(facultyUserIds);

    if (targetList.length === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
        message: "No active faculty members found to send reminder notifications.",
      });
    }

    const notificationTitle = "⏰ Submission Deadline Approaching";
    const notificationMessage = `Reminder: Only ${remainingText} left before the ${academicYear} ${semester} Submission Window closes on ${formattedEndDate}. Please review and complete your pending requirements.`;

    const notificationEntries = targetList.map((userId) => ({
      id: crypto.randomUUID(),
      user_id: userId,
      type: "deadline_alert",
      title: notificationTitle,
      message: notificationMessage,
      metadata: {
        window_id: 1,
        end_date: endDateStr,
        days_remaining: daysRemaining,
      },
      is_read: false,
      created_at: new Date().toISOString(),
    }));

    let { error: insertError } = await supabase
      .from("notifications")
      .insert(notificationEntries);

    // Fallback if metadata column is missing
    if (insertError && insertError.message.includes("metadata")) {
      const entriesWithoutMetadata = notificationEntries.map(
        ({ metadata, ...rest }) => rest,
      );
      const retry = await supabase
        .from("notifications")
        .insert(entriesWithoutMetadata);
      insertError = retry.error;
    }

    if (insertError) {
      logger.error("broadcast_reminder_insert_failed", {
        error: insertError.message,
      });
      return NextResponse.json(
        {
          error: "Failed to insert deadline alert notifications",
          details: insertError.message,
        },
        { status: 500 },
      );
    }

    // Log audit event
    try {
      await logAuditEvent({
        actorId: user.id,
        action: "submission_window.broadcast_reminder",
        entityType: "submission_window",
        entityId: user.id,
        metadata: {
          faculty_count: targetList.length,
          academic_year: academicYear,
          semester,
          end_date: endDateStr,
          remaining_text: remainingText,
        },
      });
    } catch (auditErr) {
      logger.error("broadcast_reminder_audit_log_failed", {
        error: auditErr instanceof Error ? auditErr.message : String(auditErr),
      });
    }

    return NextResponse.json({
      success: true,
      count: targetList.length,
      message: `Successfully sent deadline reminders to ${targetList.length} faculty member${targetList.length === 1 ? "" : "s"}.`,
    });
  } catch (error) {
    logger.error("broadcast_reminder_exception", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        error: "Failed to broadcast deadline reminder",
        details: String(error),
      },
      { status: 500 },
    );
  }
}
