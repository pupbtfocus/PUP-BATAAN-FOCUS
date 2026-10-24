import { getServiceRoleClient } from "@/lib/supabase/service-role";
import {
  evaluateSubmissionWindow,
  format24HourTo12Hour,
  getSubmissionWindow,
  normalizeSemester,
} from "@/features/submissions/services/submission-window.service";
import { sendDeadlineReminderEmail } from "@/lib/email/send-invite";
import { logger } from "@/lib/observability/logger";

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

export async function checkAndSend3DayDeadlineReminders(
  customSupabase?: any,
  options?: { force?: boolean }
): Promise<{
  success: boolean;
  sentCount: number;
  totalFaculty: number;
  daysRemaining?: number;
  message: string;
}> {
  try {
    const supabase = customSupabase || getServiceRoleClient();

    // 1. Resolve current active academic term
    const { data: currentTerm } = await supabase
      .from("academic_terms")
      .select("academic_year, semester")
      .eq("status", "Current")
      .maybeSingle();

    const activeAY = currentTerm?.academic_year || "Current AY";
    const activeSem = currentTerm?.semester ? normalizeSemester(currentTerm.semester) : "1st Semester";

    // 2. Fetch and evaluate active submission window
    const windowConfig = await getSubmissionWindow(supabase, {
      academicYear: activeAY,
      semester: activeSem,
    });
    const windowState = evaluateSubmissionWindow(windowConfig, undefined, undefined, {
      academicYear: activeAY,
      semester: activeSem,
    });

    if (!windowConfig || !windowState.isConfigured || !windowState.endDate) {
      return {
        success: true,
        sentCount: 0,
        totalFaculty: 0,
        message: "No active submission window configured.",
      };
    }

    const endDateStr = windowState.endDate;
    const endTimeStr = windowState.endTime ? windowState.endTime.slice(0, 5) : "23:59";
    const endIso = `${endDateStr}T${endTimeStr}:00+08:00`;
    const endDateTime = new Date(endIso);
    const now = new Date();
    const diffMs = endDateTime.getTime() - now.getTime();

    if (diffMs <= 0) {
      return {
        success: true,
        sentCount: 0,
        totalFaculty: 0,
        message: "Submission window is already closed.",
      };
    }

    const diffHours = diffMs / (1000 * 60 * 60);
    const daysRemaining = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

    // 3. Check if within 3 days (<= 72 hours)
    const isWithin3Days = diffHours <= 72;
    if (!isWithin3Days && !options?.force) {
      return {
        success: true,
        sentCount: 0,
        totalFaculty: 0,
        daysRemaining,
        message: `Submission window deadline is ${daysRemaining} days away (not within 3 days).`,
      };
    }

    // 4. Resolve faculty recipients
    const { data: facultyRoles } = await supabase
      .from("user_roles")
      .select("profiles(id, user_id, email, full_name, first_name), roles(code)")
      .eq("roles.code", "faculty");

    const facultyMap = new Map<
      string,
      { id?: string; user_id?: string; email: string; full_name?: string; first_name?: string }
    >();

    if (Array.isArray(facultyRoles)) {
      for (const row of facultyRoles) {
        const p = row.profiles as any;
        if (p?.email && typeof p.email === "string") {
          facultyMap.set(p.email.toLowerCase().trim(), {
            id: p.id,
            user_id: p.user_id || p.id,
            email: p.email.trim(),
            full_name: p.full_name,
            first_name: p.first_name,
          });
        }
      }
    }

    // Fallback lookup from faculty table
    if (facultyMap.size === 0) {
      const { data: directFaculty } = await supabase
        .from("faculty")
        .select("id, user_id, email, full_name, first_name")
        .neq("status", "inactive");

      if (Array.isArray(directFaculty)) {
        for (const f of directFaculty) {
          if (f?.email && typeof f.email === "string") {
            facultyMap.set(f.email.toLowerCase().trim(), {
              id: f.id,
              user_id: f.user_id || f.id,
              email: f.email.trim(),
              full_name: f.full_name,
              first_name: f.first_name,
            });
          }
        }
      }
    }

    const facultyList = Array.from(facultyMap.values());
    if (facultyList.length === 0) {
      return {
        success: true,
        sentCount: 0,
        totalFaculty: 0,
        daysRemaining,
        message: "No active faculty accounts found to notify.",
      };
    }

    // 5. Query recent reminder notifications to prevent sending duplicate emails within 20 hours
    const recentCutoffIso = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString();
    const { data: recentNotifs } = await supabase
      .from("notifications")
      .select("user_id")
      .eq("type", "deadline_reminder_email_3d")
      .gte("created_at", recentCutoffIso);

    const alreadySentUserIds = new Set<string>(
      (recentNotifs || []).map((n: any) => n.user_id).filter(Boolean)
    );

    const appUrl = (
      process.env.APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.SITE_URL ||
      process.env.URL ||
      "https://pupfocus.cjaayy.dev"
    ).replace(/\/$/, "");
    const dashboardUrl = `${appUrl}/faculty/dashboard?view=status`;
    const formattedEndDate = formatEndDate(endDateStr, endTimeStr);
    const endTimeLabel = format24HourTo12Hour(endTimeStr);

    let sentCount = 0;
    const notificationEntries: any[] = [];

    await Promise.all(
      facultyList.map(async (faculty) => {
        const userId = faculty.user_id || faculty.id;
        if (userId && alreadySentUserIds.has(userId) && !options?.force) {
          return;
        }

        try {
          await sendDeadlineReminderEmail({
            to: faculty.email,
            fullName: faculty.full_name || "Faculty Member",
            firstName: faculty.first_name,
            endDate: formattedEndDate,
            endTimeLabel,
            academicYear: activeAY,
            semester: activeSem,
            actionHref: dashboardUrl,
            daysRemaining,
          });

          sentCount++;

          if (userId) {
            notificationEntries.push({
              id: crypto.randomUUID(),
              user_id: userId,
              type: "deadline_reminder_email_3d",
              title: `⏰ Reminder: ${daysRemaining} ${daysRemaining === 1 ? "Day" : "Days"} Left to Submit`,
              message: `Reminder: The submission schedule for ${activeAY} ${activeSem} closes in ${daysRemaining} ${daysRemaining === 1 ? "day" : "days"} on ${formattedEndDate}. Please submit your pending documents.`,
              is_read: false,
              created_at: new Date().toISOString(),
            });
          }
        } catch (err) {
          logger.error("deadline_reminder_email_send_error", {
            email: faculty.email,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      })
    );

    if (notificationEntries.length > 0) {
      try {
        await supabase.from("notifications").insert(notificationEntries);
      } catch (insertErr) {
        logger.warn("deadline_reminder_notification_insert_error", {
          error: insertErr instanceof Error ? insertErr.message : String(insertErr),
        });
      }
    }

    return {
      success: true,
      sentCount,
      totalFaculty: facultyList.length,
      daysRemaining,
      message: `Sent 3-day deadline reminder emails to ${sentCount} faculty member(s).`,
    };
  } catch (error) {
    logger.error("checkAndSend3DayDeadlineReminders_exception", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      sentCount: 0,
      totalFaculty: 0,
      message: error instanceof Error ? error.message : "Internal error processing reminders.",
    };
  }
}

