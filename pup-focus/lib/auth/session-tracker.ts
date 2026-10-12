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
export function setActiveSession(
  userId: string,
  sessionId: string,
): void {
  if (!userId || !sessionId) return;
  activeSessions.set(userId, sessionId);
}

/**
 * Retrieves the currently active session ID for a user.
 */
export function getActiveSession(userId: string): string | null {
  if (!userId) return null;
  return activeSessions.get(userId) || null;
}

/**
 * Clears the active session for a user on explicit logout.
 */
export function clearActiveSession(userId: string): void {
  if (userId) {
    activeSessions.delete(userId);
  }
}
