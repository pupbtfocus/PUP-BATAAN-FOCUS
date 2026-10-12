import { getServiceRoleClient } from "@/lib/supabase/service-role";

// Node.js server persistent active sessions map across requests in this server instance
const globalActiveSessions = globalThis as unknown as {
  __pupFocusActiveSessions?: Map<string, string>;
};

if (!globalActiveSessions.__pupFocusActiveSessions) {
  globalActiveSessions.__pupFocusActiveSessions = new Map<string, string>();
}

export const activeSessions = globalActiveSessions.__pupFocusActiveSessions;

/**
 * Registers a new active session ID for a user.
 * Overwrites any previously active session ID.
 */
export async function setActiveSession(
  userId: string,
  sessionId: string,
): Promise<void> {
  if (!userId || !sessionId) return;

  // 1. Update in-memory map for instantaneous (0ms) lookup
  activeSessions.set(userId, sessionId);

  // 2. Persist to Supabase auth user_metadata for cross-process / persistent sync
  try {
    const serviceClient = getServiceRoleClient();
    const { data: userData } = await serviceClient.auth.admin.getUserById(userId);
    const existingMetadata = userData?.user?.user_metadata || {};

    await serviceClient.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...existingMetadata,
        current_session_id: sessionId,
        session_registered_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.warn("[SessionTracker] Could not persist session to user_metadata:", err);
  }
}

/**
 * Retrieves the currently active session ID for a user.
 */
export async function getActiveSession(userId: string): Promise<string | null> {
  if (!userId) return null;

  // Check in-memory first
  const memorySession = activeSessions.get(userId);
  if (memorySession) {
    return memorySession;
  }

  // Fallback to Supabase user_metadata
  try {
    const serviceClient = getServiceRoleClient();
    const { data: userData } = await serviceClient.auth.admin.getUserById(userId);
    const metaSession = userData?.user?.user_metadata?.current_session_id as
      | string
      | undefined;

    if (metaSession) {
      activeSessions.set(userId, metaSession);
      return metaSession;
    }
  } catch (err) {
    console.warn("[SessionTracker] Could not fetch session from user_metadata:", err);
  }

  return null;
}

/**
 * Clears the active session for a user on explicit logout.
 */
export function clearActiveSession(userId: string): void {
  if (userId) {
    activeSessions.delete(userId);
  }
}
