import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { logger } from "@/lib/observability/logger";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function ensureValidUuid(id: string): string {
  if (UUID_REGEX.test(id)) {
    return id;
  }
  return crypto.randomUUID();
}

export type NotificationPayload = {
  userId: string;
  title: string;
  message: string;
  type?: string;
  metadata?: Record<string, any>;
};

export type AppNotification = {
  id: string;
  userId: string;
  title: string;
  message: string;
  type?: string;
  isRead: boolean;
  createdAt: string;
  metadata?: Record<string, any>;
};

/**
 * Creates and persists a notification in Supabase for a specific user.
 * Safe and resilient – returns null on failure without throwing exceptions.
 */
export async function createNotification(
  payload: NotificationPayload,
): Promise<AppNotification | null> {
  const notificationId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const safeUserId = ensureValidUuid(payload.userId);

  try {
    const supabase = getServiceRoleClient();

    const insertData: Record<string, any> = {
      id: notificationId,
      user_id: safeUserId,
      title: payload.title,
      message: payload.message,
      type: payload.type ?? null,
      is_read: false,
      created_at: createdAt,
    };

    if (payload.metadata) {
      insertData.metadata = payload.metadata;
    }

    let { error } = await supabase.from("notifications").insert(insertData);

    // If error occurs due to metadata column not existing in DB schema, retry without metadata
    if (error && payload.metadata && error.message.includes("metadata")) {
      delete insertData.metadata;
      const retry = await supabase.from("notifications").insert(insertData);
      error = retry.error;
    }

    if (error) {
      logger.error("notification_insert_failed", {
        error: error.message,
        userId: payload.userId,
      });
      return null;
    }

    return {
      id: notificationId,
      userId: payload.userId,
      title: payload.title,
      message: payload.message,
      type: payload.type,
      isRead: false,
      createdAt,
      metadata: payload.metadata,
    };
  } catch (err) {
    logger.error("notification_insert_exception", {
      error: err instanceof Error ? err.message : String(err),
      userId: payload.userId,
    });
    return null;
  }
}

/**
 * Queues a notification and persists it in Supabase.
 * Returns a result object compatible with legacy callers.
 */
export async function queueNotification(payload: NotificationPayload) {
  const now = new Date().toISOString();
  const notification = await createNotification(payload);

  return {
    ok: notification !== null,
    queuedAt: now,
    payload,
    notification,
  };
}

/**
 * Fetches notifications for a given user from Supabase, ordered by newest first.
 */
export async function getUserNotifications(
  userId: string,
  limit = 50,
): Promise<AppNotification[]> {
  try {
    const supabase = getServiceRoleClient();
    const safeUserId = ensureValidUuid(userId);

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", safeUserId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      logger.error("get_user_notifications_failed", { error: error.message, userId });
      return [];
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      title: row.title,
      message: row.message,
      type: row.type ?? undefined,
      isRead: Boolean(row.is_read),
      createdAt: row.created_at,
      metadata: row.metadata ?? undefined,
    }));
  } catch (err) {
    logger.error("get_user_notifications_exception", {
      error: err instanceof Error ? err.message : String(err),
      userId,
    });
    return [];
  }
}

/**
 * Marks a specific notification as read.
 */
export async function markNotificationAsRead(
  notificationId: string,
): Promise<boolean> {
  try {
    const supabase = getServiceRoleClient();
    const safeNotificationId = ensureValidUuid(notificationId);

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", safeNotificationId);

    if (error) {
      logger.error("mark_notification_as_read_failed", {
        error: error.message,
        notificationId,
      });
      return false;
    }

    return true;
  } catch (err) {
    logger.error("mark_notification_as_read_exception", {
      error: err instanceof Error ? err.message : String(err),
      notificationId,
    });
    return false;
  }
}

/**
 * Marks all notifications for a specific user as read.
 */
export async function markAllNotificationsAsRead(
  userId: string,
): Promise<boolean> {
  try {
    const supabase = getServiceRoleClient();
    const safeUserId = ensureValidUuid(userId);

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", safeUserId)
      .eq("is_read", false);

    if (error) {
      logger.error("mark_all_notifications_as_read_failed", {
        error: error.message,
        userId,
      });
      return false;
    }

    return true;
  } catch (err) {
    logger.error("mark_all_notifications_as_read_exception", {
      error: err instanceof Error ? err.message : String(err),
      userId,
    });
    return false;
  }
}

/**
 * Deletes all notifications for a specific user from Supabase.
 */
export async function deleteAllUserNotifications(
  userId: string,
): Promise<boolean> {
  try {
    const supabase = getServiceRoleClient();
    const safeUserId = ensureValidUuid(userId);

    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("user_id", safeUserId);

    if (error) {
      logger.error("delete_all_user_notifications_failed", {
        error: error.message,
        userId,
      });
      return false;
    }

    return true;
  } catch (err) {
    logger.error("delete_all_user_notifications_exception", {
      error: err instanceof Error ? err.message : String(err),
      userId,
    });
    return false;
  }
}

