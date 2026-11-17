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
