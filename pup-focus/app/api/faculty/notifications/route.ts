import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteAllUserNotifications,
} from "@/features/notifications/services/notification.service";

const ADMIN_ONLY_NOTIFICATION_TYPES = [
  "NEW_SUBMISSION",
  "SUBMISSION_CREATED",
  "FACULTY_SUBMITTED",
  "SUBMISSION_UPLOADED",
  "SUBMISSION_RESUBMITTED",
  "submission_uploaded",
  "new_submission",
  "submission_created",
  "faculty_submitted",
];

/**
 * Checks if a notification is an administrative submission alert intended solely for reviewers.
 * Faculty members should NEVER see alerts about other faculty members' document submissions.
 */
function isReviewerSubmissionAlert(notif: {
  type?: string | null;
  title?: string | null;
  message?: string | null;
  metadata?: Record<string, any> | null;
}): boolean {
  const type = (notif.type ?? "").toUpperCase().trim();
  const title = (notif.title ?? "").toLowerCase().trim();
  const message = (notif.message ?? "").toLowerCase().trim();
  const recipientRole = String(notif.metadata?.recipient_role ?? "").toLowerCase();

  // Explicit admin recipient role tag
  if (recipientRole === "admin" || recipientRole === "super_admin") {
    return true;
  }

  // Known admin-only submission notification types
  if (
    type === "NEW_SUBMISSION" ||
    type === "SUBMISSION_CREATED" ||
    type === "FACULTY_SUBMITTED" ||
    type === "SUBMISSION_UPLOADED" ||
    type === "SUBMISSION_RESUBMITTED" ||
    type === "NEW_SUBMISSION_ALERT"
  ) {
    return true;
  }

  // Titles indicating a submission from another faculty member
  if (
    title.includes("submission from") ||
    title.includes("resubmission from") ||
    title.startsWith("new submission") ||
    title.startsWith("resubmission")
  ) {
    return true;
  }

  // Upload/resubmission activity messages
  if (
    message.startsWith("uploaded ") ||
    message.startsWith("resubmitted ")
  ) {
    return true;
  }

  return false;
}

export async function GET() {
  try {
    const sessionClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Proactively clean up any errant submission alert notifications that were delivered to this faculty user
    void (async () => {
      try {
        const supabase = getServiceRoleClient();
        await supabase
          .from("notifications")
          .delete()
          .eq("user_id", user.id)
          .or(
            "type.in.(NEW_SUBMISSION,SUBMISSION_CREATED,FACULTY_SUBMITTED,SUBMISSION_UPLOADED,SUBMISSION_RESUBMITTED,submission_uploaded,new_submission,submission_created,faculty_submitted),title.ilike.New Submission from%,title.ilike.Resubmission%from%,title.ilike.%submission from%"
          );
      } catch {
        // Non-critical background cleanup
      }
    })();

    const notifications = await getUserNotifications(
      user.id,
      50,
      { excludeTypes: ADMIN_ONLY_NOTIFICATION_TYPES },
    );

    // Strictly filter out any reviewer submission alerts
    const filteredNotifications = notifications.filter(
      (notif) => !isReviewerSubmissionAlert(notif)
    );

    const unreadCount = filteredNotifications.filter((item) => !item.isRead).length;

    return NextResponse.json({
      notifications: filteredNotifications,
      unreadCount,
    });
  } catch (error) {
    console.error("Failed to fetch faculty notifications:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch notifications",
      },
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

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { notificationId, markAll } = body as {
      notificationId?: string;
      markAll?: boolean;
    };

    if (markAll || (!notificationId && markAll !== false)) {
      await markAllNotificationsAsRead(user.id);
    } else if (notificationId) {
      await markNotificationAsRead(notificationId);
    } else {
      return NextResponse.json(
        { error: "Invalid request. Provide notificationId or set markAll to true." },
        { status: 400 },
      );
    }

    const notifications = await getUserNotifications(
      user.id,
      50,
      { excludeTypes: ADMIN_ONLY_NOTIFICATION_TYPES },
    );
    const filteredNotifications = notifications.filter(
      (notif) => !isReviewerSubmissionAlert(notif)
    );
    const unreadCount = filteredNotifications.filter((item) => !item.isRead).length;

    return NextResponse.json({
      success: true,
      unreadCount,
      notifications: filteredNotifications,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update notification status",
      },
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

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const success = await deleteAllUserNotifications(user.id);
    if (!success) {
      return NextResponse.json(
        { error: "Failed to clear notifications" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "All notifications cleared",
      notifications: [],
      unreadCount: 0,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to clear notifications",
      },
      { status: 500 },
    );
  }
}
