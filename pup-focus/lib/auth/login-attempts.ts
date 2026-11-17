import type { SupabaseClient, User } from "@supabase/supabase-js";
import { findAuthUserByEmail } from "@/lib/auth/admin-security";

export interface LoginAttemptRecord {
  count: number;
  lockedUntil?: number;
}

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

const globalStore = globalThis as typeof globalThis & {
  __pupFocusLoginAttempts?: Map<string, LoginAttemptRecord>;
};

const loginAttempts: Map<string, LoginAttemptRecord> =
  globalStore.__pupFocusLoginAttempts ??
  (globalStore.__pupFocusLoginAttempts = new Map<string, LoginAttemptRecord>());

function normalizeEmailKey(email?: string | null): string {
  return (email || "").trim().toLowerCase();
}

export function getLoginAttemptRecord(
  email?: string | null,
): LoginAttemptRecord | undefined {
  const key = normalizeEmailKey(email);
  if (!key) return undefined;
  return loginAttempts.get(key);
}

export function setLoginAttemptRecord(
  email: string,
  record: LoginAttemptRecord,
): void {
  const key = normalizeEmailKey(email);
  if (!key) return;
  loginAttempts.set(key, record);
}

export function clearLoginLockout(email?: string | null): void {
  const key = normalizeEmailKey(email);
  if (!key) return;
  loginAttempts.delete(key);
}

function readPersistentAttemptFromUser(user?: User | null): LoginAttemptRecord {
  if (!user) return { count: 0 };
  const appMeta = (user.app_metadata ?? {}) as Record<string, unknown>;
  const userMeta = (user.user_metadata ?? {}) as Record<string, unknown>;

  const lockedUntil = Number(
    appMeta.locked_until ?? userMeta.locked_until ?? 0,
  );
  const count = Number(
    appMeta.failed_attempts ?? userMeta.failed_attempts ?? 0,
  );

  return {
    count: Number.isFinite(count) ? count : 0,
    lockedUntil:
      Number.isFinite(lockedUntil) && lockedUntil > 0 ? lockedUntil : undefined,
  };
}

/**
 * Loads login attempt & lockout state using both memory cache and persistent
 * server-only Supabase `app_metadata` across cold starts/instances.
 */
export async function getPersistentLoginAttempt(
  serviceClient: SupabaseClient,
  email: string,
  preloadedUser?: User | null,
): Promise<{ record: LoginAttemptRecord; user: User | null }> {
  const key = normalizeEmailKey(email);
  const memoryRecord = getLoginAttemptRecord(key);
  const user =
    preloadedUser !== undefined
      ? preloadedUser
      : await findAuthUserByEmail(serviceClient, key);

  const persisted = readPersistentAttemptFromUser(user);
  const now = Date.now();

  const effectiveLockedUntil = Math.max(
    memoryRecord?.lockedUntil && memoryRecord.lockedUntil > now
      ? memoryRecord.lockedUntil
      : 0,
    persisted.lockedUntil && persisted.lockedUntil > now
      ? persisted.lockedUntil
      : 0,
  );

  if (effectiveLockedUntil > now) {
    const merged: LoginAttemptRecord = {
      count: Math.max(memoryRecord?.count ?? 0, persisted.count, MAX_FAILED_ATTEMPTS),
      lockedUntil: effectiveLockedUntil,
    };
    setLoginAttemptRecord(key, merged);
    return { record: merged, user };
  }

  const count = Math.max(
    memoryRecord && !memoryRecord.lockedUntil ? memoryRecord.count : 0,
    !persisted.lockedUntil ? persisted.count : 0,
  );

  return { record: { count }, user };
}

/**
 * Persists failed login attempt & optional lockout into memory and `app_metadata`.
 */
export async function persistLoginAttempt(
  serviceClient: SupabaseClient,
  email: string,
  record: LoginAttemptRecord,
  preloadedUser?: User | null,
): Promise<void> {
  const key = normalizeEmailKey(email);
  if (!key) return;

  setLoginAttemptRecord(key, record);

  const user =
    preloadedUser !== undefined
      ? preloadedUser
      : await findAuthUserByEmail(serviceClient, key);

  if (!user?.id) return;

  try {
    await serviceClient.auth.admin.updateUserById(user.id, {
      app_metadata: {
        ...(user.app_metadata ?? {}),
        failed_attempts: record.count,
        locked_until: record.lockedUntil ?? null,
      },
    });
  } catch {
    // Best-effort persistence
  }
}

/**
 * Clears lockout and failed attempt counters in both memory and `app_metadata`.
 */
export async function clearPersistentLoginLockout(
  serviceClient: SupabaseClient,
  email: string,
  user?: User | null,
): Promise<void> {
  const key = normalizeEmailKey(email);
  clearLoginLockout(key);

  const targetUser =
    user !== undefined ? user : await findAuthUserByEmail(serviceClient, key);

  if (!targetUser?.id) return;

  const hasPersistedLock =
    Boolean(targetUser.app_metadata?.failed_attempts) ||
    Boolean(targetUser.app_metadata?.locked_until) ||
    Boolean(targetUser.user_metadata?.failed_attempts) ||
    Boolean(targetUser.user_metadata?.locked_until);

  if (!hasPersistedLock) return;

  try {
    await serviceClient.auth.admin.updateUserById(targetUser.id, {
      app_metadata: {
        ...(targetUser.app_metadata ?? {}),
        failed_attempts: 0,
        locked_until: null,
      },
      user_metadata: {
        ...(targetUser.user_metadata ?? {}),
        failed_attempts: 0,
        locked_until: null,
      },
    });
  } catch {
    // Best-effort cleanup
  }
}
