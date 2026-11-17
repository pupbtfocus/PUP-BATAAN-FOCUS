"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { usePathname } from "next/navigation";
import { createClient, clearBrowserSupabaseSession } from "@/lib/supabase/client";
import { ConcurrentSessionModal } from "@/components/auth/concurrent-session-modal";
import { resetDashboardNavigationState, AUTH_ROUTES } from "@/config/routes";

let verificationPausedUntil = 0;

export function pauseSessionVerification(durationMs = 15000) {
  verificationPausedUntil = Date.now() + durationMs;
}

export function resumeSessionVerification() {
  verificationPausedUntil = 0;
}

export function recordActiveSessionLogin(loginTime?: string | null, userId?: string | null) {
  if (typeof window === "undefined") return;
  const timeToSet = loginTime || new Date().toISOString();
  resumeSessionVerification();
  try {
    sessionStorage.setItem("pup_focus_login_time", timeToSet);
    localStorage.setItem("pup_focus_login_time", timeToSet);
    if (userId) {
      sessionStorage.setItem("pup_focus_login_user", userId);
      localStorage.setItem("pup_focus_login_user", userId);
    }
    sessionStorage.removeItem("pup_focus_logged_out");
    window.dispatchEvent(
      new CustomEvent("pup_focus_session_sync", {
        detail: { loginTime: timeToSet, userId },
      })
    );
  } catch (err) {
    console.warn("[SingleSessionEnforcer] Could not record active session login:", err);
  }
}

export function SingleSessionEnforcer() {
  const pathname = usePathname();
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const checkingRef = useRef(false);
  const conflictDetectedRef = useRef(false);
  const myLoginTimeRef = useRef<string | null>(null);
  const lastCheckTimeRef = useRef<number>(0);

  const isPublicAuthPage =
    !pathname ||
    pathname === "/" ||
    pathname === "/login" ||
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/change-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/forgot-password") ||
    AUTH_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));

  const handleLogout = useCallback(async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);

    try {
      if (typeof window !== "undefined") {
        const currentActiveLogin = localStorage.getItem("pup_focus_login_time");
        const isSameBrowserReplaced = Boolean(
          currentActiveLogin &&
            myLoginTimeRef.current &&
            currentActiveLogin !== myLoginTimeRef.current
        );

        // If another session was started in this same browser, DO NOT touch shared cookies or localStorage!
        if (!isSameBrowserReplaced) {
          localStorage.removeItem("pup_focus_login_time");
          localStorage.removeItem("pup_focus_login_user");
          localStorage.removeItem("pup_focus_session_id");
          document.cookie =
            "pup_focus_session_id=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT";
          clearBrowserSupabaseSession();
        }

        sessionStorage.removeItem("pup_focus_login_time");
        sessionStorage.removeItem("pup_focus_login_user");
        sessionStorage.removeItem("pup_focus_session_id");
        sessionStorage.setItem("pup_focus_logged_out", "true");
      }
    } catch {
      // Ignore storage errors
    }

    try {
      resetDashboardNavigationState();
    } catch {
      // Ignore reset error
    }

    // CRITICAL: DO NOT call supabase.auth.signOut() here.
    // supabase.auth.signOut() sends a server request to revoke tokens globally in Supabase,
    // which invalidates the new user's active session on other devices/tabs upon page refresh.
    // The superseded tab's local state is cleanly cleared above.

    if (typeof window !== "undefined") {
      window.location.replace("/login?reason=concurrent_logout");
    }
  }, [isLoggingOut]);

  // Sync listener for local tab changes, storage events, and auth state changes
  useEffect(() => {
    const handleSessionSync = (event: Event) => {
      const customEvent = event as CustomEvent<{ loginTime?: string; userId?: string }>;
      const newTime = customEvent.detail?.loginTime;
      if (newTime) {
        myLoginTimeRef.current = newTime;
        conflictDetectedRef.current = false;
        setConflictModalOpen(false);
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "pup_focus_login_time" && e.newValue) {
        if (
          !myLoginTimeRef.current ||
          new Date(e.newValue).getTime() >= new Date(myLoginTimeRef.current).getTime()
        ) {
          myLoginTimeRef.current = e.newValue;
          conflictDetectedRef.current = false;
          setConflictModalOpen(false);
        }
      }
    };

    window.addEventListener("pup_focus_session_sync", handleSessionSync);
    window.addEventListener("storage", handleStorageChange);

    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      if (session?.user?.last_sign_in_at) {
        const serverSignIn = session.user.last_sign_in_at;
        myLoginTimeRef.current = serverSignIn;
        conflictDetectedRef.current = false;
        setConflictModalOpen(false);
        try {
          sessionStorage.setItem("pup_focus_login_time", serverSignIn);
          sessionStorage.setItem("pup_focus_login_user", session.user.id);
          const currentLocal = localStorage.getItem("pup_focus_login_time");
          if (
            !currentLocal ||
            new Date(serverSignIn).getTime() >= new Date(currentLocal).getTime()
          ) {
            localStorage.setItem("pup_focus_login_time", serverSignIn);
            localStorage.setItem("pup_focus_login_user", session.user.id);
          }
        } catch {}
      }
    });

    return () => {
      window.removeEventListener("pup_focus_session_sync", handleSessionSync);
      window.removeEventListener("storage", handleStorageChange);
      subscription.unsubscribe();
    };
  }, []);

  const verifySession = useCallback(async (force = false) => {
    if (
      isPublicAuthPage ||
      checkingRef.current ||
      conflictDetectedRef.current ||
      Date.now() < verificationPausedUntil
    ) {
      return;
    }

    const now = Date.now();
    // Throttle to at most once per 15s unless explicitly forced (e.g. route change)
    if (!force && now - lastCheckTimeRef.current < 15000) {
      return;
    }
    lastCheckTimeRef.current = now;

    checkingRef.current = true;

    try {
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      const token = sessionData?.session?.access_token;

      if (!user) {
        // Not signed in; nothing to verify
        return;
      }

      const tabUserId = sessionStorage.getItem("pup_focus_login_user");
      const sharedUserId = localStorage.getItem("pup_focus_login_user");
      const sharedLoginTime = localStorage.getItem("pup_focus_login_time");

      // Auth cookies are shared per browser. If another tab signed in with a DIFFERENT account,
      // this tab now belongs to that account: it's an account switch, not a concurrent login.
      if (tabUserId && tabUserId !== user.id) {
        sessionStorage.setItem("pup_focus_login_user", user.id);
        if (sharedUserId === user.id && sharedLoginTime) {
          sessionStorage.setItem("pup_focus_login_time", sharedLoginTime);
        } else {
          sessionStorage.removeItem("pup_focus_login_time");
        }
        myLoginTimeRef.current = null;
        window.location.reload();
        return;
      }

      const sessionLoginTime = sessionStorage.getItem("pup_focus_login_time");
      let localLoginTime: string | null = myLoginTimeRef.current;

      if (
        !localLoginTime ||
        (sessionLoginTime &&
          new Date(sessionLoginTime).getTime() > new Date(localLoginTime).getTime())
      ) {
        localLoginTime = sessionLoginTime;
      }

      // Same account re-signed in or updated from another tab of THIS browser: adopt the newer shared timestamp
      if (
        sharedUserId === user.id &&
        sharedLoginTime &&
        (!localLoginTime ||
          new Date(sharedLoginTime).getTime() > new Date(localLoginTime).getTime())
      ) {
        localLoginTime = sharedLoginTime;
      }

      // If no local login time recorded yet, initialize with current user's last_sign_in_at
      if (!localLoginTime && typeof user.last_sign_in_at === "string") {
        localLoginTime = user.last_sign_in_at;
        localStorage.setItem("pup_focus_login_time", user.last_sign_in_at);
        localStorage.setItem("pup_focus_login_user", user.id);
      }

      if (!localLoginTime) {
        return;
      }

      sessionStorage.setItem("pup_focus_login_time", localLoginTime);
      sessionStorage.setItem("pup_focus_login_user", user.id);
      myLoginTimeRef.current = localLoginTime;

      const res = await fetch("/api/auth/session/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({
          loginTime: localLoginTime,
          userId: user.id,
        }),
      });

      if (!res.ok) {
        return;
      }

      const data = await res.json().catch(() => null);

      if (data && data.valid === false && data.reason === "concurrent_login") {
        conflictDetectedRef.current = true;
        setConflictModalOpen(true);
      } else if (data && data.valid === true && typeof data.lastSignInAt === "string") {
        // Keep client timestamp in sync with server to ensure refresh never triggers a false conflict
        myLoginTimeRef.current = data.lastSignInAt;
        try {
          sessionStorage.setItem("pup_focus_login_time", data.lastSignInAt);
          sessionStorage.setItem("pup_focus_login_user", user.id);
          const currentLocal = localStorage.getItem("pup_focus_login_time");
          const currentLocalUser = localStorage.getItem("pup_focus_login_user");
          if (
            !currentLocal ||
            currentLocalUser !== user.id ||
            new Date(data.lastSignInAt).getTime() >= new Date(currentLocal).getTime()
          ) {
            localStorage.setItem("pup_focus_login_time", data.lastSignInAt);
            localStorage.setItem("pup_focus_login_user", user.id);
          }
        } catch {}
      }
    } catch (err) {
      // Do not block normal use or log noise when in-flight fetch is aborted during page navigation
      const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
      if (!msg.includes("failed to fetch") && !msg.includes("aborted") && !msg.includes("networkerror")) {
        console.warn("[SingleSessionEnforcer] Check failed:", err);
      }
    } finally {
      checkingRef.current = false;
    }
  }, [isPublicAuthPage]);

  // Initial and path-change check
  useEffect(() => {
    if (!isPublicAuthPage) {
      void verifySession(true);
    }
  }, [pathname, isPublicAuthPage, verifySession]);

  // Periodic polling + window focus + visibility listeners
  useEffect(() => {
    if (isPublicAuthPage) {
      return;
    }

    // Only poll periodically if tab is actively visible (2 minutes)
    const intervalId = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        void verifySession();
      }
    }, 120000);

    const onFocus = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        void verifySession();
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void verifySession();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [isPublicAuthPage, verifySession]);

  return (
    <ConcurrentSessionModal
      isOpen={conflictModalOpen}
      isLoggingOut={isLoggingOut}
      onConfirm={handleLogout}
    />
  );
}
