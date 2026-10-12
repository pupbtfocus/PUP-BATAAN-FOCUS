"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { WarningTriangle, LogOut } from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";
import { resetDashboardNavigationState } from "@/config/routes";

export function SingleSessionEnforcer() {
  const pathname = usePathname();
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const checkingRef = useRef(false);
  const conflictDetectedRef = useRef(false);

  const isPublicAuthPage =
    !pathname ||
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/sign-in" ||
    pathname.startsWith("/auth/callback") ||
    pathname.startsWith("/auth/confirm");

  const handleLogout = useCallback(async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);

    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("pup_focus_session_id");
        sessionStorage.removeItem("pup_focus_session_id");
        document.cookie =
          "pup_focus_session_id=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      }
    } catch {
      // Ignore storage errors
    }

    try {
      resetDashboardNavigationState();
    } catch {
      // Ignore reset error
    }

    try {
      const supabase = createClient();
      await supabase.auth.signOut().catch(() => null);
    } catch {
      // Ignore auth error
    }

    if (typeof window !== "undefined") {
      window.location.replace("/");
    }
  }, [isLoggingOut]);

  const verifySession = useCallback(async () => {
    if (isPublicAuthPage || checkingRef.current || conflictDetectedRef.current) {
      return;
    }

    checkingRef.current = true;

    try {
      let localSessionId =
        typeof window !== "undefined"
          ? localStorage.getItem("pup_focus_session_id")
          : null;

      // If user is authenticated in Supabase but lacks a local sessionId, claim one
      if (!localSessionId) {
        const supabase = createClient();
        const { data } = await supabase.auth.getSession();
        if (data?.session?.user) {
          const newId = crypto.randomUUID();
          localStorage.setItem("pup_focus_session_id", newId);
          localSessionId = newId;

          await fetch("/api/auth/session/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId: newId }),
          }).catch(() => null);
        } else {
          // Unauthenticated, nothing to enforce
          return;
        }
      }

      const res = await fetch("/api/auth/session/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: localSessionId }),
      });

      if (!res.ok) {
        return;
      }

      const data = await res.json().catch(() => null);

      if (data && data.valid === false && data.reason === "concurrent_login") {
        conflictDetectedRef.current = true;
        setConflictModalOpen(true);
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
      void verifySession();
    }
  }, [pathname, isPublicAuthPage, verifySession]);

  // Periodic polling + window focus + visibility listeners
  useEffect(() => {
    if (isPublicAuthPage) {
      return;
    }

    const intervalId = setInterval(() => {
      void verifySession();
    }, 4000);

    const onFocus = () => {
      void verifySession();
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
