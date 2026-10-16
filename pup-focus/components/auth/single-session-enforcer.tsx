"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { usePathname } from "next/navigation";
import { createClient, clearBrowserSupabaseSession } from "@/lib/supabase/client";
import { WarningTriangle, LogOut } from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";
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
      // Do not block normal use on network hiccups
      console.warn("[SingleSessionEnforcer] Check failed:", err);
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

    // Only poll periodically if tab is actively visible (30 seconds)
    const intervalId = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        void verifySession();
      }
    }, 30000);

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

  if (!conflictModalOpen) {
    return null;
  }

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="concurrent-modal-title"
      aria-describedby="concurrent-modal-desc"
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200 select-none"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border-2 border-amber-500/60 bg-gradient-to-b from-[#4a0000] via-[#350000] to-[#200000] p-6 sm:p-8 text-[#fff8e7] shadow-2xl shadow-black/80 transition-all animate-in zoom-in-95">
        {/* Top gold accent line */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent" />

        {/* Header Icon & Title */}
        <div className="flex items-center gap-4 border-b border-amber-500/30 pb-4 mb-4">
          <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-300 border border-amber-400/40 shadow-inner shrink-0 flex items-center justify-center">
            <AppIcon icon={WarningTriangle} size="xl" color="active" />
          </div>
          <div>
            <h2
              id="concurrent-modal-title"
              className="text-lg font-bold text-white tracking-tight"
            >
              Account Logged In Elsewhere
            </h2>
            <p className="text-xs font-semibold text-amber-300/90 tracking-wide mt-0.5 uppercase">
              Single Active Session
            </p>
          </div>
        </div>

        {/* Message Content */}
        <div className="my-5 rounded-xl border border-amber-500/30 bg-[#250000]/70 p-4">
          <p
            id="concurrent-modal-desc"
            className="text-sm text-amber-100/90 leading-relaxed"
          >
            Your account is currently in use or has just been logged into from
            another device or browser. Only <strong className="text-amber-300 font-bold">1 user</strong> is
            allowed to access this account at a time.
          </p>
          <p className="text-xs text-amber-200/70 mt-2.5 leading-normal">
            Your current session has been ended. Please click <strong>Okay</strong> to proceed.
          </p>
        </div>

        {/* Okay Action Button */}
        <div className="pt-2">
          <button
            type="button"
            autoFocus
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-amber-400/80 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-500 hover:from-amber-400 hover:to-amber-500 text-amber-950 font-bold px-5 py-3 text-sm shadow-lg shadow-amber-950/40 hover:shadow-amber-500/30 transition-all duration-200 cursor-pointer disabled:opacity-50"
          >
            <AppIcon icon={LogOut} size="md" color="inherit" />
            <span>{isLoggingOut ? "Logging out..." : "Okay"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
