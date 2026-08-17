import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { deleteAllUserNotifications } from "@/features/notifications/services/notification.service";

export async function POST() {
  return handleClearAll();
}

export async function DELETE() {
  return handleClearAll();
}

async function handleClearAll() {
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
