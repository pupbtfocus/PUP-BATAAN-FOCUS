import { getServiceRoleClient } from "@/lib/supabase/service-role";

const globalActiveSessions = globalThis as unknown as {
  __pupFocusActiveSessions?: Map<string, string>;
};

if (!globalActiveSessions.__pupFocusActiveSessions) {
  globalActiveSessions.__pupFocusActiveSessions = new Map<string, string>();
}

export const activeSessions = globalActiveSessions.__pupFocusActiveSessions;

/**
 * Registers a new active session ID for a user in both in-memory cache and
 * persistent server-only Supabase `app_metadata`.
 */
export async function setActiveSession(
  userId: string,
  sessionId: string,
): Promise<void> {
  if (!userId || !sessionId) return;
  activeSessions.set(userId, sessionId);

  try {
    const serviceClient = getServiceRoleClient();
    const { data } = await serviceClient.auth.admin.getUserById(userId);
    const currentAppMeta = (data?.user?.app_metadata ?? {}) as Record<
      string,
      unknown
    >;
    await serviceClient.auth.admin.updateUserById(userId, {
      app_metadata: {
        ...currentAppMeta,
        active_session_id: sessionId,
        active_session_updated_at: new Date().toISOString(),
      },
    });
  } catch {
    // Non-fatal fallback to in-memory store
  }
}

/**
 * Retrieves the currently active session ID, checking memory cache first and
 * falling back to persistent Supabase `app_metadata` across cold starts.
 */
export async function getActiveSession(
  userId: string,
): Promise<string | null> {
  if (!userId) return null;

  const cached = activeSessions.get(userId);
  if (cached) {
    return cached;
  }

  try {
    const serviceClient = getServiceRoleClient();
    const { data } = await serviceClient.auth.admin.getUserById(userId);
    const persisted = data?.user?.app_metadata?.active_session_id;
    if (typeof persisted === "string" && persisted.trim()) {
      activeSessions.set(userId, persisted);
      return persisted;
    }
  } catch {
    // Ignore transient errors
  }

  return null;
}

/**
 * Clears the active session for a user on explicit logout.
 */
export async function clearActiveSession(
  userId: string,
  existingAppMeta?: Record<string, unknown>,
): Promise<void> {
  if (!userId) return;
  activeSessions.delete(userId);

  try {
    const serviceClient = getServiceRoleClient();
    let currentAppMeta = existingAppMeta;
    if (!currentAppMeta) {
      const { data } = await serviceClient.auth.admin.getUserById(userId);
      currentAppMeta = (data?.user?.app_metadata ?? {}) as Record<
        string,
        unknown
      >;
    }
    await serviceClient.auth.admin.updateUserById(userId, {
      app_metadata: {
        ...currentAppMeta,
        active_session_id: null,
        active_session_updated_at: new Date().toISOString(),
      },
    });
  } catch {
    // Ignore transient errors
  }
}
