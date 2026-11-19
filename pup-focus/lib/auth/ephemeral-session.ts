import { createClient, clearBrowserSupabaseSession } from "@/lib/supabase/client";
import { resetDashboardNavigationState } from "@/config/routes";

export const SESSION_MODE_COOKIE = "pup_focus_session_mode";
const EPHEMERAL_STORAGE_KEY = "pup_focus_ephemeral_auth";
const OPEN_TABS_KEY = "pup_focus_open_tabs";
const TAB_ID_KEY = "pup_focus_tab_id";
const TAB_ALIVE_KEY = "pup_focus_tab_alive";
const LEFT_SITE_AT_KEY = "pup_focus_left_site_at";
const JUST_AUTHED_AT_KEY = "pup_focus_just_authed_at";
const OPEN_TAB_TTL_MS = 35000;
const JUST_AUTHED_GRACE_MS = 15000;

function getOrCreateTabId(): string {
  if (typeof window === "undefined") return "";
  try {
    let tabId = sessionStorage.getItem(TAB_ID_KEY);
    if (!tabId) {
      tabId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(TAB_ID_KEY, tabId);
    }
    return tabId;
  } catch {
    return "";
  }
}

function readOpenTabsMap(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(OPEN_TABS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const now = Date.now();
    const cleaned: Record<string, number> = {};
    for (const [id, ts] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof ts === "number" && now - ts < OPEN_TAB_TTL_MS) {
        cleaned[id] = ts;
      }
    }
    return cleaned;
  } catch {
    return {};
  }
}

function writeOpenTabsMap(map: Record<string, number>) {
  if (typeof window === "undefined") return;
  try {
    if (Object.keys(map).length === 0) {
      localStorage.removeItem(OPEN_TABS_KEY);
    } else {
      localStorage.setItem(OPEN_TABS_KEY, JSON.stringify(map));
    }
  } catch {
    // Ignore storage errors
  }
}

function getCookieValue(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  const parts = document.cookie.split(";");
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      return decodeURIComponent(trimmed.slice(prefix.length));
    }
  }
  return null;
}

export function enforceEphemeralBrowserCookies() {
  if (typeof document === "undefined" || typeof window === "undefined") return;
  const secureAttr = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie.split(";").forEach((rawCookie) => {
    const eqIdx = rawCookie.indexOf("=");
    if (eqIdx === -1) return;
    const name = rawCookie.slice(0, eqIdx).trim();
    const rawValue = rawCookie.slice(eqIdx + 1).trim();
    if (!name.startsWith("sb-") && name !== SESSION_MODE_COOKIE) return;
    if (!rawValue) return;
    // Re-write without Max-Age/Expires so the browser treats it as a session cookie
    document.cookie = `${name}=${rawValue}; path=/; SameSite=Lax${secureAttr}`;
  });
}

export function isEphemeralSessionActive(): boolean {
  if (typeof window === "undefined") return false;
  const cookieMode = getCookieValue(SESSION_MODE_COOKIE);
  if (cookieMode === "persistent") return false;
  if (cookieMode === "ephemeral") return true;
  try {
    return localStorage.getItem(EPHEMERAL_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markLoginPersistence(rememberMe: boolean) {
  if (typeof window === "undefined") return;
  const secureAttr = window.location.protocol === "https:" ? "; Secure" : "";
  try {
    sessionStorage.removeItem(LEFT_SITE_AT_KEY);
    sessionStorage.setItem(JUST_AUTHED_AT_KEY, String(Date.now()));
    sessionStorage.setItem(TAB_ALIVE_KEY, "1");
    registerActiveTab();

    if (rememberMe) {
      localStorage.removeItem(EPHEMERAL_STORAGE_KEY);
      document.cookie = `${SESSION_MODE_COOKIE}=persistent; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax${secureAttr}`;
    } else {
      localStorage.setItem(EPHEMERAL_STORAGE_KEY, "1");
      document.cookie = `${SESSION_MODE_COOKIE}=ephemeral; path=/; SameSite=Lax${secureAttr}`;
      enforceEphemeralBrowserCookies();
    }
  } catch {
    // Ignore storage errors
  }
}

export function registerActiveTab() {
  if (typeof window === "undefined") return;
  const tabId = getOrCreateTabId();
  if (!tabId) return;
  try {
    sessionStorage.setItem(TAB_ALIVE_KEY, "1");
    sessionStorage.removeItem(LEFT_SITE_AT_KEY);
  } catch {
    // Ignore storage errors
  }
  const map = readOpenTabsMap();
  map[tabId] = Date.now();
  writeOpenTabsMap(map);
}

export function unregisterActiveTab() {
  if (typeof window === "undefined") return;
  const tabId = getOrCreateTabId();
  if (!tabId) return;
  const map = readOpenTabsMap();
  if (tabId in map) {
    delete map[tabId];
    writeOpenTabsMap(map);
  }
}

export function markSiteLeft() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(LEFT_SITE_AT_KEY, String(Date.now()));
  } catch {
    // Ignore storage errors
  }
  unregisterActiveTab();
}

export function hasLiveOtherTab(): boolean {
  if (typeof window === "undefined") return false;
  const myTabId = getOrCreateTabId();
  const map = readOpenTabsMap();
  const now = Date.now();
  return Object.entries(map).some(
    ([id, ts]) => id !== myTabId && now - ts < OPEN_TAB_TTL_MS,
  );
}

export function clearEphemeralSessionState() {
  if (typeof window === "undefined") return;
  unregisterActiveTab();
  try {
    localStorage.removeItem(EPHEMERAL_STORAGE_KEY);
    localStorage.removeItem(OPEN_TABS_KEY);
    sessionStorage.removeItem(TAB_ALIVE_KEY);
    sessionStorage.removeItem(LEFT_SITE_AT_KEY);
    sessionStorage.removeItem(JUST_AUTHED_AT_KEY);
  } catch {
    // Ignore storage errors
  }
  if (typeof document !== "undefined") {
    document.cookie = `${SESSION_MODE_COOKIE}=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  }
}

export function shouldAutoLogoutOnVisit(): boolean {
  if (typeof window === "undefined") return false;
  if (!isEphemeralSessionActive()) return false;

  try {
    const justAuthedAt = Number(sessionStorage.getItem(JUST_AUTHED_AT_KEY) || "0");
    if (justAuthedAt > 0 && Date.now() - justAuthedAt < JUST_AUTHED_GRACE_MS) {
      sessionStorage.removeItem(JUST_AUTHED_AT_KEY);
      sessionStorage.removeItem(LEFT_SITE_AT_KEY);
      return false;
    }

    const navEntry = performance.getEntriesByType?.("navigation")?.[0] as
      | PerformanceNavigationTiming
      | undefined;
    const navType = navEntry?.type ?? "navigate";

    if (navType === "reload") {
      sessionStorage.removeItem(LEFT_SITE_AT_KEY);
      return false;
    }

    let hasSameOriginReferrer = false;
    try {
      hasSameOriginReferrer = Boolean(
        document.referrer &&
          new URL(document.referrer).origin === window.location.origin,
      );
    } catch {
      hasSameOriginReferrer = false;
    }

    if (hasSameOriginReferrer) {
      sessionStorage.removeItem(LEFT_SITE_AT_KEY);
      return false;
    }

    const hasTabMarker = sessionStorage.getItem(TAB_ALIVE_KEY) === "1";
    const leftSiteAt = Number(sessionStorage.getItem(LEFT_SITE_AT_KEY) || "0");

    // 1. New tab or browser reopen after leaving site (no active other tab)
    if (!hasTabMarker) {
      return !hasLiveOtherTab();
    }

    // 2. Returned in the same tab after navigating away to an external URL or pressing Back
    if (leftSiteAt > 0 || navType === "back_forward") {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

export async function performEphemeralAutoLogout(options?: {
  skipRedirect?: boolean;
}) {
  if (typeof window === "undefined") return;

  let accessToken: string | null = null;
  try {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    accessToken = session?.access_token ?? null;
    void supabase.auth.signOut({ scope: "local" }).catch(() => null);
  } catch {
    // Ignore client signout errors
  }

  try {
    void fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
      keepalive: true,
      headers: accessToken
        ? { Authorization: `Bearer ${accessToken}` }
        : undefined,
    }).catch(() => null);
  } catch {
    // Ignore logout logging errors
  }

  clearEphemeralSessionState();
  resetDashboardNavigationState();
  clearBrowserSupabaseSession();

  if (!options?.skipRedirect) {
    window.location.replace("/");
  }
}
