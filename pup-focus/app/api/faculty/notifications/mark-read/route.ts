import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "@/features/notifications/services/notification.service";

async function handleMarkRead(request: NextRequest) {
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
      await markAllNotificationsAsRead(user.id);
    }

    const notifications = await getUserNotifications(user.id, 50);
    const unreadCount = notifications.filter((item) => !item.isRead).length;

    return NextResponse.json({
      success: true,
      unreadCount,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to mark notifications as read",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  return handleMarkRead(request);
}

export async function PATCH(request: NextRequest) {
  return handleMarkRead(request);
}
