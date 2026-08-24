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
  let safeUserId = ensureValidUuid(payload.userId);

  try {
    const supabase = getServiceRoleClient();

    // If safeUserId is a profile ID rather than an auth user ID, resolve to auth user_id
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("id", safeUserId)
      .maybeSingle();

    if (profileRow?.user_id) {
      safeUserId = profileRow.user_id;
    }

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
      console.error("[NOTIF_DISPATCH_ERROR]", {
        error: error.message,
        recipient: safeUserId,
        title: payload.title,
        type: payload.type,
      });
      logger.error("notification_insert_failed", {
        error: error.message,
        userId: payload.userId,
      });
      return null;
    }

    console.log("[NOTIF_DISPATCH]", {
      notificationId,
      recipient: safeUserId,
      title: payload.title,
      type: payload.type,
      inserted: true,
    });

    return {
      id: notificationId,
      userId: safeUserId,
      title: payload.title,
      message: payload.message,
      type: payload.type,
      isRead: false,
      createdAt,
      metadata: payload.metadata,
    };
  } catch (err) {
    console.error("[NOTIF_DISPATCH_EXCEPTION]", {
      error: err instanceof Error ? err.message : String(err),
      recipient: safeUserId,
      title: payload.title,
    });
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

export type NotificationFilterOptions = {
  excludeTypes?: string[];
  allowedTypes?: string[];
  role?: "faculty" | "admin" | "super_admin";
};

/**
 * Fetches notifications for a given user from Supabase, ordered by newest first.
 */
export async function getUserNotifications(
  userId: string,
  limit = 50,
  options?: NotificationFilterOptions,
): Promise<AppNotification[]> {
  try {
    const supabase = getServiceRoleClient();
    const safeUserId = ensureValidUuid(userId);

    // Look up profile for this user to ensure all matching IDs (user_id and profile_id) are queried
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, user_id")
      .or(`user_id.eq.${safeUserId},id.eq.${safeUserId}`)
      .maybeSingle();

    const authUserId = profile?.user_id || safeUserId;
    const profileId = profile?.id;
    const targetUserIds = Array.from(
      new Set([safeUserId, authUserId, profileId].filter(Boolean) as string[]),
    );

    let query = supabase
      .from("notifications")
      .select("*")
      .in("user_id", targetUserIds)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (options?.excludeTypes && options.excludeTypes.length > 0) {
      const formattedExclude = `(${options.excludeTypes.map((t) => `"${t}"`).join(",")})`;
      query = query.not("type", "in", formattedExclude);
    }

    if (options?.allowedTypes && options.allowedTypes.length > 0) {
      query = query.in("type", options.allowedTypes);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[NOTIF_FETCH_ERROR]", {
        error: error.message,
        userId,
        targetUserIds,
      });
      logger.error("get_user_notifications_failed", { error: error.message, userId });
      return [];
    }

    const excludeSet = new Set(
      (options?.excludeTypes ?? []).map((t) => t.toLowerCase()),
    );

    const results = (data || [])
      .filter((row: any) => {
        if (row.type && excludeSet.has(String(row.type).toLowerCase())) {
          return false;
        }
        return true;
      })
      .map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        title: row.title,
        message: row.message,
        type: row.type ?? undefined,
        isRead: Boolean(row.is_read),
        createdAt: row.created_at,
        metadata: row.metadata ?? undefined,
      }));

    console.log("[NOTIF_FETCH_SERVICE]", {
      userId,
      targetUserIds,
      count: results.length,
    });

    return results;
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

