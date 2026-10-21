"use client";

import { useState, useEffect, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ROLE, type AppRole } from "@/config/roles";
import { CampusBackground } from "@/components/shared/campus-background";
import { Logo } from "@/components/ui/logo";
import { AppIcon } from "@/components/ui/app-icon";
import { AlertPopup } from "@/components/ui/alert-popup";
import Image from "next/image";
import { ArrowRight, Eye as EyeIcon, EyeOff as EyeOffIcon } from "lucide-react";
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
import { cn } from "@/utils/cn";
import {
  validatePasswordRequirements,
  formatPasswordError,
} from "@/lib/validation/password";
import { recordActiveSessionLogin } from "@/components/auth/single-session-enforcer";

const ROUTE_BY_ROLE: Record<string, string> = {
  [ROLE.ADMIN]: "/admin/dashboard",
  [ROLE.STAFF]: "/staff/dashboard",
  [ROLE.FACULTY]: "/faculty/dashboard",
  super_admin: "/admin/dashboard",
};

export default function ChangePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const passwordRequirements = validatePasswordRequirements(password);
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

        // 0. Support preview mode for design testing
        const isPreview = params.get("preview") === "true";
        if (isPreview) {
          if (isMounted) {
            setUserEmail(params.get("email") || "faculty.sample@bataan.pup.edu.ph");
            setHasSession(true);
            setIsCheckingSession(false);
          }
          return;
        }

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

    const validation = validatePasswordRequirements(password);
    if (!validation.isValid) {
      setError(
        `Password must include:\n${validation.missingRequirements.map((r) => `• ${r}`).join("\n")}`
      );
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
            const msg = formatPasswordError(resData.error || updateError.message);
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
          setError(formatPasswordError(updateError.message));
          setIsSaving(false);
          return;
        }
      } else {
        const msg = formatPasswordError(updateError.message);
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

      if (data.user) {
        const loginTime = data.user.last_sign_in_at || new Date().toISOString();
        recordActiveSessionLogin(loginTime, data.user.id);
      }

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

      <div className="relative z-10 w-full max-w-[420px] mx-auto my-auto py-3 sm:py-5 px-4">
        <div className="w-full bg-[#800000] border-2 border-amber-400 rounded-2xl shadow-2xl overflow-hidden transition-all text-[#fff8e7]">
          {/* Email-style Maroon Header Banner (No Logo, matching Account Ready) */}
          <div className="bg-gradient-to-br from-[#680000] to-[#800000] border-b border-amber-400/30 px-5 py-4 sm:px-6 sm:py-4.5 text-center">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[#fff8e7]">
              Set New Password
            </h1>
            <p className="mt-1 text-xs text-[#f8e3bc] leading-relaxed max-w-sm mx-auto">
              Create a permanent password to secure your institutional account
            </p>
            {userEmail && (
              <div className="mt-1.5 inline-block">
                <span className="text-[10.5px] font-mono text-[#fff8e7]/90 bg-black/20 px-2.5 py-0.5 rounded-full border border-white/10">
                  {userEmail}
                </span>
              </div>
            )}
          </div>

          {/* Card Body */}
          <div className="p-4 sm:p-5">
            {/* State 1: Checking Session Loading */}
            {isCheckingSession && (
              <div className="flex flex-col items-center text-center py-4 space-y-4">
                <div className="relative w-16 h-16 flex items-center justify-center my-1">
                  <div className="absolute inset-0 rounded-full border-[3px] border-amber-400/20" />
                  <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-amber-400 border-r-amber-400 animate-spin" />
                  <div className="relative w-9 h-9 rounded-full overflow-hidden flex items-center justify-center bg-white shadow-xs p-0.5">
                    <Image
                      src="/icons/pup-seal.png"
                      alt="PUP Logo"
                      width={34}
                      height={34}
                      className="object-contain"
                      priority
                    />
                  </div>
                </div>
                <p className="text-xs text-amber-200/90 leading-relaxed max-w-xs">
                  Verifying your reset session with campus directory...
                </p>
              </div>
            )}

            {/* State 2: Session Missing or Expired */}
            {!isCheckingSession && hasSession === false && (
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="w-full bg-[#660000] border border-amber-400/40 rounded-xl p-3.5 text-xs text-amber-100 text-left leading-relaxed">
                  <p className="font-semibold text-amber-300 mb-1">
                    Password Reset Session Expired
                  </p>
                  <p>
                    {error ||
                      "Your password reset link is invalid, expired, or has already been used. For your security, reset links can only be used once."}
                  </p>
                </div>

                <Link
                  href="/"
                  prefetch={false}
                  className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm py-2 px-4 rounded-xl shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-amber-400/50 cursor-pointer"
                >
                  <span>Return to Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>

                <Link
                  href="/change-password?preview=true"
                  prefetch={false}
                  className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-amber-200/80 hover:text-white transition py-0.5"
                >
                  <span>Preview New Design Form</span>
                </Link>
              </div>
            )}

            {/* State 3: Active Session — Ready to set password */}
            {!isCheckingSession && hasSession === true && (
              <form className="space-y-2.5" onSubmit={onSubmit}>
                {/* New Password Field */}
                <div className="space-y-1 text-left">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] uppercase font-bold tracking-wider text-amber-300">
                      New Password
                    </label>
                    <span className="text-[10px] text-amber-200/70 font-medium">Min. 8 characters</span>
                  </div>
                  <div className="relative flex items-center">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value.replace(/\s/g, ""))}
                      onKeyDown={(e) => {
                        if (e.key === " ") e.preventDefault();
                      }}
                      required
                      minLength={8}
                      placeholder="Enter new password"
                      autoComplete="new-password"
                      className="w-full rounded-xl border border-amber-400/40 bg-[#660000] pl-3.5 pr-10 py-2 text-xs sm:text-sm text-[#fff7ed] placeholder:text-amber-200/50 focus:outline-none focus:ring-2 focus:ring-amber-400/60 focus:border-amber-400 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-amber-300 hover:text-amber-100 transition-colors cursor-pointer"
                      title={showPassword ? "Hide password" : "Show password"}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeIcon className="w-4 h-4" />
                      ) : (
                        <EyeOffIcon className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Organized Password Requirements Checklist */}
                <div className="rounded-lg bg-[#660000] border border-amber-400/30 px-2.5 py-1.5 space-y-1 text-left">
                  <p className="font-semibold text-amber-300 text-[10px] tracking-wider uppercase">
                    Requirements:
                  </p>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10.5px]">
                    {passwordRequirements.requirements.map((req) => (
                      <div
                        key={req.id}
                        className={cn(
                          "flex items-center gap-1 transition-colors duration-150 whitespace-nowrap",
                          req.isValid
                            ? "text-emerald-300 font-medium"
                            : "text-amber-200/60"
                        )}
                      >
                        <span
                          className={cn(
                            "w-3 h-3 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 transition-colors",
                            req.isValid
                              ? "bg-emerald-950 text-emerald-300 border border-emerald-400/60"
                              : "bg-[#500000] text-amber-200/60 border border-amber-400/20"
                          )}
                        >
                          {req.isValid ? "✓" : "•"}
                        </span>
                        <span>{req.shortLabel || req.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Confirm Password Field */}
                <div className="space-y-1 text-left">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] uppercase font-bold tracking-wider text-amber-300">
                      Confirm Password
                    </label>
                    <span className="text-[10px] text-amber-200/70 font-medium">Must match</span>
                  </div>
                  <div className="relative flex items-center">
                    <input
                      type={showConfirm ? "text" : "password"}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value.replace(/\s/g, ""))}
                      onKeyDown={(e) => {
                        if (e.key === " ") e.preventDefault();
                      }}
                      required
                      minLength={8}
                      placeholder="Confirm new password"
                      autoComplete="new-password"
                      className="w-full rounded-xl border border-amber-400/40 bg-[#660000] pl-3.5 pr-10 py-2 text-xs sm:text-sm text-[#fff7ed] placeholder:text-amber-200/50 focus:outline-none focus:ring-2 focus:ring-amber-400/60 focus:border-amber-400 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-amber-300 hover:text-amber-100 transition-colors cursor-pointer"
                      title={showConfirm ? "Hide password" : "Show password"}
                      aria-label={showConfirm ? "Hide password" : "Show password"}
                    >
                      {showConfirm ? (
                        <EyeIcon className="w-4 h-4" />
                      ) : (
                        <EyeOffIcon className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm py-2 px-4 rounded-xl shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-amber-400/50 cursor-pointer disabled:opacity-50 mt-1"
                >
                  {isSaving ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      <span>Saving Password...</span>
                    </>
                  ) : (
                    <>
                      <span>Set Password & Proceed</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Footer Note */}
            <div className="mt-3 pt-2.5 border-t border-amber-400/20 text-center">
              <p className="text-[10px] text-amber-200/70 leading-tight">
                If you have questions or need assistance, please contact your PUP Bataan campus administrator.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

