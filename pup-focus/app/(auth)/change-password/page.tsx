"use client";

import { useState, useEffect, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ROLE, type AppRole } from "@/config/roles";
import { CampusBackground } from "@/components/shared/campus-background";
import { Logo } from "@/components/ui/logo";
import { PupWebBadge } from "@/components/auth/pup-web-badge";
import { AppIcon } from "@/components/ui/app-icon";
import { AlertPopup } from "@/components/ui/alert-popup";
import {
  CheckCircle,
  Eye,
  EyeClosed,
  Key,
  NavArrowRight,
  SystemRestart,
  WarningCircle,
} from "iconoir-react";

import { resetDashboardNavigationState } from "@/config/routes";

const ROUTE_BY_ROLE: Record<AppRole, string> = {
  [ROLE.SUPER_ADMIN]: "/super-admin/dashboard",
  [ROLE.ADMIN]: "/admin/dashboard",
  [ROLE.FACULTY]: "/faculty/dashboard",
};

export default function ChangePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Session verification state
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function initSession() {
      try {
        if (typeof window === "undefined") return;

        const params = new URLSearchParams(window.location.search);
        const hash = window.location.hash.startsWith("#")
          ? window.location.hash.slice(1)
          : window.location.hash;
        const hashParams = new URLSearchParams(hash);

        // 1. Check if Supabase passed an error in query parameters or hash fragment
        const urlError =
          params.get("error_description") ||
          params.get("error") ||
          hashParams.get("error_description") ||
          hashParams.get("error");

        if (urlError) {
          if (isMounted) {
            setError(
              urlError.toLowerCase().includes("expired") ||
              urlError.toLowerCase().includes("invalid") ||
              urlError.toLowerCase().includes("access_denied")
                ? "This password reset link has expired or has already been used. Please request a new link."
                : urlError
            );
            setHasSession(false);
            setIsCheckingSession(false);
          }
          return;
        }

        // 2. Check if a PKCE code was passed in the query parameters
        const code = params.get("code") || hashParams.get("code");
        if (code) {
          const { data, error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            if (isMounted) {
              setError(
                exchangeError.message.toLowerCase().includes("expired") ||
                exchangeError.message.toLowerCase().includes("invalid")
                  ? "This password reset link has expired or has already been used. Please request a new link."
                  : exchangeError.message
              );
              setHasSession(false);
              setIsCheckingSession(false);
            }
            return;
          }

          if (isMounted) {
            setUserEmail(data.user?.email || null);
            setHasSession(true);
            setIsCheckingSession(false);
          }
          return;
        }

        // 3. Check if a token_hash was passed
        const tokenHash = params.get("token_hash") || hashParams.get("token_hash");
        const type = params.get("type") || hashParams.get("type");
        if (tokenHash) {
          const { data, error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: (type as any) || "recovery",
          });
          if (verifyError) {
            if (isMounted) {
              setError(
                verifyError.message.toLowerCase().includes("expired") ||
                verifyError.message.toLowerCase().includes("invalid")
                  ? "This password reset link has expired or has already been used. Please request a new link."
                  : verifyError.message
              );
              setHasSession(false);
              setIsCheckingSession(false);
            }
            return;
          }

          if (isMounted) {
            setUserEmail(data.user?.email || null);
            setHasSession(true);
            setIsCheckingSession(false);
          }
          return;
        }

        // 4. Check if tokens are in hash fragment (Supabase recovery implicit flow)
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");

        if (accessToken) {
          setAuthToken(accessToken);
          const { data: sessionData, error: sessionErr } =
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || "",
            });

          if (sessionErr) {
            if (isMounted) {
              setError(
                sessionErr.message.toLowerCase().includes("expired") ||
                sessionErr.message.toLowerCase().includes("invalid")
                  ? "This password reset link has expired or has already been used. Please request a new link."
                  : sessionErr.message
              );
              setHasSession(false);
              setIsCheckingSession(false);
            }
            return;
          }

          if (isMounted) {
            setUserEmail(sessionData.session?.user?.email || null);
            setHasSession(true);
            setIsCheckingSession(false);
          }
          return;
        }

        // 5. Check if there is already an active session
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session) {
          if (session.access_token) {
            setAuthToken(session.access_token);
          }
          if (isMounted) {
            setUserEmail(session.user?.email || null);
            setHasSession(true);
            setIsCheckingSession(false);
          }
          return;
        }

        // 6. No session and no auth tokens found
        if (isMounted) {
          setHasSession(false);
          setIsCheckingSession(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(
            err?.message ||
            "Unable to verify password reset session. Please request a new link."
          );
          setHasSession(false);
          setIsCheckingSession(false);
        }
      }
    }

    initSession();

    return () => {
      isMounted = false;
    };
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    if (password !== confirm) {
      setError("Password confirmation does not match.");
      return;
    }

    setIsSaving(true);
    const supabase = createClient();
    let updateSuccess = false;
    let resolvedRole: AppRole | null = null;

    // 1. Attempt client-side updateUser
    const { error: updateError } = await supabase.auth.updateUser({
      password,
      data: {
        must_change_password: false,
        force_password_change: false,
      },
    });

    if (!updateError) {
      updateSuccess = true;
    } else {
      // 2. Fallback to server-side API route using the recovery access token
      const hash = typeof window !== "undefined"
        ? (window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash)
        : "";
      const hashParams = new URLSearchParams(hash);
      const effectiveToken =
        authToken ||
        hashParams.get("access_token") ||
        (await supabase.auth.getSession()).data.session?.access_token;

      if (effectiveToken) {
        try {
          const res = await fetch("/api/auth/reset-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password, accessToken: effectiveToken }),
          });

          const resData = await res.json().catch(() => ({}));

          if (res.ok && resData.success) {
            updateSuccess = true;
            if (resData.role) {
              resolvedRole = resData.role as AppRole;
            }
          } else {
            const msg = resData.error || updateError.message;
            if (
              msg.toLowerCase().includes("session") ||
              msg.toLowerCase().includes("auth session missing")
            ) {
              setError(
                "Your password reset session has expired or is missing. Please request a new password reset link."
              );
              setHasSession(false);
            } else {
              setError(msg);
            }
            setIsSaving(false);
            return;
          }
        } catch {
          setError(updateError.message);
          setIsSaving(false);
          return;
        }
      } else {
        const msg = updateError.message;
        if (
          msg.toLowerCase().includes("session") ||
          msg.toLowerCase().includes("auth session missing")
        ) {
          setError(
            "Your password reset session has expired or is missing. Please request a new password reset link."
          );
          setHasSession(false);
        } else {
          setError(msg);
        }
        setIsSaving(false);
        return;
      }
    }

    if (updateSuccess) {
      const { data } = await supabase.auth.getUser();
      const signedInRole =
        resolvedRole ??
        (data.user?.user_metadata?.role as AppRole | undefined) ??
        (data.user?.app_metadata?.role as AppRole | undefined) ??
        ROLE.ADMIN;

      const nextRoute = ROUTE_BY_ROLE[signedInRole] || "/sign-in";
      resetDashboardNavigationState();
      setSuccess("Password updated successfully! Redirecting to your portal...");
      setIsSaving(false);
      window.setTimeout(() => {
        window.location.assign(nextRoute);
      }, 2000);
    }
  }

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center px-3 sm:px-4 py-4 sm:py-8 text-[#fff8e7] overflow-x-hidden">
      {/* Top-Right Floating Alert Toasts */}
      {error && (
        <AlertPopup
          type="error"
          message={error}
          onClose={() => setError(null)}
          position="top-right"
          autoCloseMs={5000}
        />
      )}
      {success && (
        <AlertPopup
          type="success"
          message={success}
          onClose={() => setSuccess(null)}
          position="top-right"
          autoCloseMs={5000}
        />
      )}

      <CampusBackground />
      {/* Overlay with Blur on top of the global body background */}
      <div className="absolute inset-0 z-0 bg-transparent backdrop-blur-[6px]" />
      <div className="absolute inset-0 z-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

      <div className="relative z-10 w-full max-w-[390px] sm:max-w-md mx-auto my-auto pt-6 sm:pt-10 pb-14 sm:pb-8">
        <div className="relative w-full mx-auto drop-shadow-[0_25px_35px_rgba(0,0,0,0.85)]">
          {/* Curved Card Top Header SVG with 3D Golden Crest Lighting */}
          <div className="relative">
            <svg
              viewBox="0 0 400 64"
              className="w-full h-auto block -mb-1 pointer-events-none overflow-visible"
            >
              <defs>
                <linearGradient id="changePassTopGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#8a0c0c" />
                  <stop offset="40%" stopColor="#780000" />
                  <stop offset="85%" stopColor="#680000" />
                  <stop offset="100%" stopColor="#680000" />
                </linearGradient>
                <linearGradient id="changePassTopGoldCrest" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#D97706" stopOpacity="0.8" />
                  <stop offset="15%" stopColor="#F59E0B" stopOpacity="0.95" />
                  <stop offset="35%" stopColor="#FDE68A" stopOpacity="1" />
                  <stop offset="50%" stopColor="#FFFBEB" stopOpacity="1" />
                  <stop offset="65%" stopColor="#FDE68A" stopOpacity="1" />
                  <stop offset="85%" stopColor="#F59E0B" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#D97706" stopOpacity="0.8" />
                </linearGradient>
                <linearGradient id="changePassTopAmbientSheen" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#FBBF24" stopOpacity="0.65" />
                  <stop offset="60%" stopColor="#F59E0B" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#780000" stopOpacity="0" />
                </linearGradient>
              </defs>

              <path
                d="M 0,64 L 0,20 Q 0,0 20,0 L 142,0 C 158,0 162,37 200,37 C 238,37 242,0 258,0 L 380,0 Q 400,0 400,20 L 400,64 Z"
                fill="url(#changePassTopGrad)"
              />
              <path
                d="M 2,20 Q 2,2 20,2 L 142,2 C 158,2 162,37 200,37 C 238,37 242,2 258,2 L 380,2 Q 398,2 398,20"
                fill="none"
                stroke="url(#changePassTopAmbientSheen)"
                strokeWidth="5"
                strokeLinecap="round"
              />
              <path
                d="M 1,64 L 1,20 Q 1,1 20,1 L 142,1 C 158,1 162,37 200,37 C 238,37 242,1 258,1 L 380,1 Q 399,1 399,20 L 399,64"
                fill="none"
                stroke="rgba(245, 158, 11, 0.75)"
                strokeWidth="2"
              />
              <path
                d="M 1,20 Q 1,1 20,1 L 142,1 C 158,1 162,37 200,37 C 238,37 242,1 258,1 L 380,1 Q 399,1 399,20"
                fill="none"
                stroke="url(#changePassTopGoldCrest)"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <path
                d="M 25,1 L 142,1 C 158,1 162,37 200,37 C 238,37 242,1 258,1 L 375,1"
                fill="none"
                stroke="rgba(255, 255, 255, 0.5)"
                strokeWidth="1"
                strokeLinecap="round"
              />
            </svg>

            <div className="absolute -top-8 left-1/2 -translate-x-1/2 z-20">
              <Logo size={115} className="mb-0 drop-shadow-[0_10px_20px_rgba(0,0,0,0.9)]" />
            </div>
          </div>

          {/* Card Body - Vibrant PUP Brand Maroon matching Login Screen */}
          <section className="relative rounded-b-[1.75rem] sm:rounded-b-[2rem] border-x-2 border-b-2 border-amber-400/80 bg-gradient-to-b from-[#680000] via-[#5e0000] to-[#4d0000] p-6 pt-7 sm:p-8 sm:pt-8 backdrop-blur-xl">
            <div className="mt-2 mb-6 sm:mb-7 text-center">
              <h1 className="text-2xl sm:text-3xl font-black tracking-wider text-amber-300 uppercase mb-1 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                Set New Password
              </h1>
              <div className="mx-auto my-3 h-0.5 w-14 rounded-full bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
              <p className="text-amber-100/90 text-xs sm:text-sm font-medium tracking-wide">
                Create a permanent password to secure your institutional account
              </p>
              {userEmail && (
                <div className="mt-2.5 inline-block">
                  <span className="text-[11px] font-mono text-amber-200/90 bg-black/40 px-3 py-1 rounded-full border border-amber-400/30">
                    {userEmail}
                  </span>
                </div>
              )}
            </div>

            {/* State 1: Checking Session Loading */}
            {isCheckingSession && (
              <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
                <div className="relative flex items-center justify-center w-16 h-16 rounded-full bg-[#180000] border-2 border-amber-400/60 shadow-inner">
                  <div className="absolute inset-1.5 rounded-full border-2 border-amber-400/20 border-t-amber-400 border-r-amber-400/60 animate-spin" />
                  <Logo size={36} className="relative z-10" />
                </div>
                <p className="text-sm font-bold text-amber-200 tracking-wide uppercase">
                  Verifying Reset Session...
                </p>
                <p className="text-xs text-amber-200/70 max-w-[260px] leading-relaxed">
                  Securing your session with campus directory...
                </p>
              </div>
            )}

            {/* State 2: Session Missing or Expired */}
            {!isCheckingSession && hasSession === false && (
              <div className="py-2 space-y-4 text-center">
                <div className="rounded-xl border border-rose-500/40 bg-rose-950/40 p-4 text-left flex items-start gap-3 text-xs text-rose-100 shadow-inner">
                  <AppIcon icon={WarningCircle} size="md" color="danger" className="shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold text-rose-200 text-sm">
                      Password Reset Session Expired
                    </p>
                    <p className="text-rose-100/90 leading-relaxed">
                      {error ||
                        "Your password reset link is invalid, expired, or has already been used. For your security, reset links can only be used once."}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-amber-100/75 leading-relaxed pt-1">
                  Please return to the sign-in screen and request a new password reset link.
                </p>

                <div className="pt-2">
                  <Link
                    href="/sign-in"
                    className="h-11 sm:h-12 w-full rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 font-extrabold text-[#3d0000] tracking-widest uppercase text-xs transition-all duration-300 hover:from-amber-300 hover:to-amber-400 active:scale-95 cursor-pointer shadow-md shadow-black/30 flex items-center justify-center gap-2"
                  >
                    <span>Return to Sign In</span>
                    <AppIcon icon={NavArrowRight} size="sm" color="inherit" />
                  </Link>
                </div>
              </div>
            )}

            {/* State 3: Active Session — Ready to set password */}
            {!isCheckingSession && hasSession === true && (
              <form className="space-y-4" onSubmit={onSubmit}>
                {/* New Password Field */}
                <div className="space-y-1.5 text-left">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] uppercase font-bold tracking-wider text-amber-300 flex items-center gap-1.5">
                      <AppIcon icon={Key} size="sm" color="active" />
                      <span>New Password</span>
                    </label>
                    <span className="text-[10px] text-amber-200/70 font-medium">Min. 8 characters</span>
                  </div>
                  <div className="relative flex items-center">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      placeholder="Enter new password"
                      autoComplete="new-password"
                      className="pup-login-input w-full rounded-xl border !border-amber-500/40 !bg-[#2b0000] pl-4 pr-11 py-3 text-xs sm:text-sm !text-amber-50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6),0_1px_0_rgba(255,215,0,0.12)] outline-none transition-all duration-200 placeholder:!text-amber-200/40 hover:!border-amber-400/80 focus:!border-amber-400 focus:!ring-1 focus:!ring-amber-400/50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-amber-400/80 hover:text-amber-300 transition-colors cursor-pointer"
                      title={showPassword ? "Hide password" : "Show password"}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <AppIcon icon={EyeClosed} size="sm" color="inherit" />
                      ) : (
                        <AppIcon icon={Eye} size="sm" color="inherit" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Confirm Password Field */}
                <div className="space-y-1.5 text-left">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] uppercase font-bold tracking-wider text-amber-300 flex items-center gap-1.5">
                      <AppIcon icon={Key} size="sm" color="active" />
                      <span>Confirm Password</span>
                    </label>
                    <span className="text-[10px] text-amber-200/70 font-medium">Must match</span>
                  </div>
                  <div className="relative flex items-center">
                    <input
                      type={showConfirm ? "text" : "password"}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      required
                      minLength={8}
                      placeholder="Confirm new password"
                      autoComplete="new-password"
                      className="pup-login-input w-full rounded-xl border !border-amber-500/40 !bg-[#2b0000] pl-4 pr-11 py-3 text-xs sm:text-sm !text-amber-50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6),0_1px_0_rgba(255,215,0,0.12)] outline-none transition-all duration-200 placeholder:!text-amber-200/40 hover:!border-amber-400/80 focus:!border-amber-400 focus:!ring-1 focus:!ring-amber-400/50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-amber-400/80 hover:text-amber-300 transition-colors cursor-pointer"
                      title={showConfirm ? "Hide password" : "Show password"}
                      aria-label={showConfirm ? "Hide password" : "Show password"}
                    >
                      {showConfirm ? (
                        <AppIcon icon={EyeClosed} size="sm" color="inherit" />
                      ) : (
                        <AppIcon icon={Eye} size="sm" color="inherit" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="mt-2 h-11 sm:h-12 w-full rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 font-extrabold text-[#3d0000] tracking-widest uppercase text-xs transition-all duration-300 hover:from-amber-300 hover:to-amber-400 active:scale-95 cursor-pointer shadow-md shadow-black/30 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <AppIcon icon={SystemRestart} size="sm" color="inherit" className="animate-spin" />
                      <span>Saving Password...</span>
                    </>
                  ) : (
                    <>
                      <span>Set Password & Continue</span>
                      <AppIcon icon={NavArrowRight} size="sm" color="inherit" />
                    </>
                  )}
                </Button>
              </form>
            )}
          </section>
        </div>
      </div>

      <PupWebBadge />
    </main>
  );
}

