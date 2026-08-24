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
  "submission_uploaded",
  "new_submission",
  "submission_created",
  "faculty_submitted",
];

export async function GET() {
  try {
    const sessionClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const metadataRole =
      (user.user_metadata?.role as string | undefined) ??
      (user.app_metadata?.role as string | undefined);

    let isAdmin = metadataRole === "admin" || metadataRole === "super_admin";

    if (!isAdmin) {
      const supabase = getServiceRoleClient();
      const { data: userRoleRows } = await supabase
        .from("user_roles")
        .select("roles(code), profiles!inner(user_id)")
        .eq("profiles.user_id", user.id);

      if (userRoleRows) {
        for (const r of userRoleRows) {
          const roleCode = Array.isArray(r.roles) ? r.roles[0]?.code : (r.roles as any)?.code;
          if (roleCode === "admin" || roleCode === "super_admin") {
            isAdmin = true;
            break;
          }
        }
      }
    }

    const notifications = await getUserNotifications(
      user.id,
      50,
      isAdmin ? undefined : { excludeTypes: ADMIN_ONLY_NOTIFICATION_TYPES },
    );

    // Filter in-memory for non-admins (faculty)
    const filteredNotifications = notifications.filter((notif) => {
      const isSubmissionAlert =
        notif.type === "NEW_SUBMISSION" ||
        notif.type === "SUBMISSION_CREATED" ||
        notif.type === "FACULTY_SUBMITTED" ||
        notif.type === "SUBMISSION_UPLOADED" ||
        (Boolean(notif.title) &&
          notif.title.toLowerCase().startsWith("new submission from"));

      // If user is non-admin/faculty, strictly reject submission alerts
      if (!isAdmin && isSubmissionAlert) {
        return false;
      }
      return true;
    });

    const unreadCount = filteredNotifications.filter((item) => !item.isRead).length;

    console.log("[NOTIF_FETCH]", {
      currentUserId: user.id,
      isAdmin,
      count: filteredNotifications.length,
      unreadCount,
      data: filteredNotifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        isRead: n.isRead,
      })),
    });

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

    const metadataRole =
      (user.user_metadata?.role as string | undefined) ??
      (user.app_metadata?.role as string | undefined);

    let isAdmin = metadataRole === "admin" || metadataRole === "super_admin";

    if (!isAdmin) {
      const supabase = getServiceRoleClient();
      const { data: userRoleRows } = await supabase
        .from("user_roles")
        .select("roles(code), profiles!inner(user_id)")
        .eq("profiles.user_id", user.id);

      if (userRoleRows) {
        for (const r of userRoleRows) {
          const roleCode = Array.isArray(r.roles) ? r.roles[0]?.code : (r.roles as any)?.code;
          if (roleCode === "admin" || roleCode === "super_admin") {
            isAdmin = true;
            break;
          }
        }
      }
    }

    const notifications = await getUserNotifications(
      user.id,
      50,
      isAdmin ? undefined : { excludeTypes: ADMIN_ONLY_NOTIFICATION_TYPES },
    );
    const filteredNotifications = notifications.filter((notif) => {
      const isSubmissionAlert =
        notif.type === "NEW_SUBMISSION" ||
        notif.type === "SUBMISSION_CREATED" ||
        notif.type === "FACULTY_SUBMITTED" ||
        notif.type === "SUBMISSION_UPLOADED" ||
        (Boolean(notif.title) &&
          notif.title.toLowerCase().startsWith("new submission from"));

      if (!isAdmin && isSubmissionAlert) {
        return false;
      }
      return true;
    });
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

