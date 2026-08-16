"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Clock, ShieldAlert, LogOut, RefreshCw } from "lucide-react";

interface SessionTimeoutContextType {
  timeoutMinutes: number;
  lastActivity: number;
  resetTimer: () => void;
}

const SessionTimeoutContext =
  createContext<SessionTimeoutContextType | null>(null);

export function useSessionTimeout() {
  return useContext(SessionTimeoutContext);
}

interface SessionTimeoutProviderProps {
  children: React.ReactNode;
}

export function SessionTimeoutProvider({
  children,
}: SessionTimeoutProviderProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState<boolean>(false);
  const [timeoutMinutes, setTimeoutMinutes] = useState<number>(60);
  const [isReady, setIsReady] = useState<boolean>(false);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);

  const lastActivityRef = useRef<number>(Date.now());
  const showModalRef = useRef<boolean>(false);
  const isLoggingOutRef = useRef<boolean>(false);

  // Synchronize ref with showModal state
  showModalRef.current = showModal;

  // Track client mounting to prevent SSR / hydration timer misfires
  useEffect(() => {
    setMounted(true);
    lastActivityRef.current = Date.now();
  }, []);

  const performSignOut = useCallback(async () => {
    if (isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;
    setShowModal(false);

    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch (signOutErr) {
      console.error("[SessionTimeout] SignOut error:", signOutErr);
    }

    try {
      if (typeof window !== "undefined") {
        localStorage.clear();
        sessionStorage.clear();
      }
    } catch {}

    window.location.href = "/login?reason=timeout";
  }, []);

  // ---------------------------------------------------------------------------
  // "Stay Logged In" Reset Handler
  // ---------------------------------------------------------------------------
  const handleStayLoggedIn = useCallback(() => {
    lastActivityRef.current = Date.now();
    setShowModal(false);
    setSecondsLeft(0);
  }, []);

  // ---------------------------------------------------------------------------
  // "Sign Out" Manual Trigger
  // ---------------------------------------------------------------------------
  const handleManualSignOut = async () => {
    await performSignOut();
  };

  const resetTimer = () => {
    handleStayLoggedIn();
  };

  // ---------------------------------------------------------------------------
  // Fetch timeout configuration from user metadata or admin profile
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let isMounted = true;

    async function loadTimeoutPreference() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user || !isMounted) {
          if (isMounted) setIsReady(true);
          return;
        }

        const metadata = user.user_metadata || {};
        const rawTimeout =
          metadata.session_timeout_minutes ??
          metadata.session_timeout ??
          metadata.system_settings?.session_timeout_minutes ??
          metadata.system_settings?.session_timeout;

        let parsed = 60;
        if (rawTimeout === "0" || rawTimeout === 0 || rawTimeout === "Never") {
          parsed = 0;
        } else if (
          rawTimeout === "0.1667" ||
          rawTimeout === "0.16667" ||
          rawTimeout === "0.166" ||
          rawTimeout === 0.1667 ||
          rawTimeout === 0.16667 ||
          rawTimeout === "10s" ||
          rawTimeout === "10 seconds"
        ) {
          parsed = 0.1667;
        } else if (rawTimeout === "15" || rawTimeout === "15 mins") {
          parsed = 15;
        } else if (rawTimeout === "30" || rawTimeout === "30 mins") {
          parsed = 30;
        } else if (rawTimeout === "60" || rawTimeout === "1 hour") {
          parsed = 60;
        } else if (rawTimeout === "120" || rawTimeout === "2 hours") {
          parsed = 120;
        } else if (
          rawTimeout !== undefined &&
          !isNaN(parseFloat(String(rawTimeout)))
        ) {
          parsed = parseFloat(String(rawTimeout));
        }

        if (isMounted) {
          setTimeoutMinutes(parsed);
          setIsReady(true);
        }
      } catch (err) {
        console.warn(
          "[SessionTimeoutProvider] Failed to load timeout config:",
          err
        );
        if (isMounted) {
          setIsReady(true);
        }
      }
    }

    void loadTimeoutPreference();

    return () => {
      isMounted = false;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Activity Listeners & Idle Check Loop (1-second interval)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    // 1. Guard against SSR, hydration, or incomplete metadata loading
    if (!mounted || !isReady) {
      return;
    }

    // 2. Calculate total timeout in milliseconds
    const totalMs = Math.round(
      parseFloat(String(timeoutMinutes || "60")) * 60 * 1000
    );

    // 3. If duration is 0, NaN, or negative (Never mode), completely disable timers
    if (isNaN(totalMs) || totalMs <= 0) {
      setShowModal(false);
      return;
    }

    // 4. Dynamically set warning threshold so it is never negative:
    // - For test modes (totalMs <= 30000ms): trigger modal at halfway mark (e.g. 10s test -> 5s idle + 5s countdown)
    // - For normal modes (totalMs > 30000ms): trigger modal 30 seconds before total timeout
    const warningMs =
      totalMs <= 30000 ? Math.floor(totalMs / 2) : totalMs - 30000;

    // Reset activity timestamp and state on mount / settings change
    lastActivityRef.current = Date.now();
    setShowModal(false);
    setSecondsLeft(0);

    const activityEvents = [
      "mousemove",
      "keydown",
      "click",
      "scroll",
      "touchstart",
    ];

    let lastThrottled = 0;
    const handleUserActivity = () => {
      // If warning modal is open, ignore background activity so accidental movements don't dismiss it
      if (showModalRef.current) return;

      const now = Date.now();
      // Throttle activity updates to at most once per 1 second
      if (now - lastThrottled > 1000) {
        lastThrottled = now;
        lastActivityRef.current = now;
      }
    };

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, handleUserActivity, { passive: true });
    });

    const intervalId = setInterval(() => {
      if (isLoggingOutRef.current) return;

      const idleMs = Date.now() - lastActivityRef.current;

      // 2-second grace period after mount / reset before checking thresholds
      if (idleMs < 2000) return;

      // Check 1: Idle duration reached total allowed timeout
      if (idleMs >= totalMs) {
        void performSignOut();
        return;
      }

      // Check 2: Idle duration reached warning threshold and modal is not yet open
      if (idleMs >= warningMs && !showModalRef.current) {
        setShowModal(true);
        const remainingSec = Math.max(
          1,
          Math.ceil((totalMs - idleMs) / 1000)
        );
        setSecondsLeft(remainingSec);
        return;
      }

      // Check 3: If modal is open, decrement remaining seconds
      if (showModalRef.current) {
        const remainingSec = Math.max(
          0,
          Math.ceil((totalMs - idleMs) / 1000)
        );
        setSecondsLeft(remainingSec);

        if (remainingSec <= 0) {
          void performSignOut();
        }
      }
    }, 1000);

    return () => {
      clearInterval(intervalId);
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, handleUserActivity);
      });
    };
  }, [mounted, isReady, timeoutMinutes, router, performSignOut]);

  return (
    <SessionTimeoutContext.Provider
      value={{
        timeoutMinutes,
        lastActivity: lastActivityRef.current,
        resetTimer,
      }}
    >
      {children}

      {/* ----------------------------------------------------------------- */}
      {/* Sleek, Modern Inactivity Warning Modal                            */}
      {/* ----------------------------------------------------------------- */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl p-6 text-slate-900 dark:text-slate-100">
            {/* Header Icon & Title */}
            <div className="flex items-center gap-3.5 border-b border-slate-100 dark:border-slate-800/80 pb-4 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Session Inactivity Warning
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  You have been inactive for a while
                </p>
              </div>
            </div>

            {/* Countdown Badge & Prompt */}
            <div className="my-5 rounded-lg border border-slate-100 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950/50 p-4 text-center">
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-3 leading-relaxed">
                For your security, your session will automatically terminate in:
              </p>
              <div className="inline-flex items-center justify-center gap-2 font-mono font-bold text-2xl text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 px-4 py-1.5 rounded-lg">
                <Clock className="w-4 h-4 text-amber-500 animate-spin" />
                <span>{secondsLeft}s</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleStayLoggedIn}
                className="bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 font-medium px-4 py-2.5 rounded-lg transition-colors flex-1 text-xs cursor-pointer inline-flex items-center justify-center gap-1.5 shadow-sm"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Stay Logged In</span>
              </button>

              <button
                type="button"
                onClick={handleManualSignOut}
                className="border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium px-4 py-2.5 rounded-lg transition-colors text-xs cursor-pointer inline-flex items-center justify-center gap-1.5"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </SessionTimeoutContext.Provider>
  );
}
