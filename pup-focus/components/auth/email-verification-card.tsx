"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  AlertTriangle,
  ShieldCheck,
  ArrowRight,
  Mail,
} from "lucide-react";

export type VerificationStatus = "loading" | "success" | "error" | "cancelled";

export interface EmailVerificationCardProps {
  status: VerificationStatus;
  email?: string;
  fullName?: string;
  temporaryPassword?: string;
  errorMessage?: string;
  isEmailChange?: boolean;
  onSignIn?: () => void;
  onReturnToSignIn?: () => void;
  onRecoverCredentials?: (email: string) => Promise<{ success: boolean; message?: string }>;
}

export function EmailVerificationCard({
  status,
  email = "preview@pupfocus.dev",
  fullName,
  temporaryPassword = "",
  errorMessage,
  isEmailChange = false,
  onSignIn,
  onReturnToSignIn,
  onRecoverCredentials,
}: EmailVerificationCardProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const [recoveryEmailInput, setRecoveryEmailInput] = useState(
    email && email !== "preview@pupfocus.dev" ? email : ""
  );
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  const copyToClipboard = async (text: string, type: "email" | "password" | "all") => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      if (type === "email") {
        setCopiedEmail(true);
        setTimeout(() => setCopiedEmail(false), 2000);
      } else if (type === "password") {
        setCopiedPassword(true);
        setTimeout(() => setCopiedPassword(false), 2000);
      } else if (type === "all") {
        setCopiedAll(true);
        setTimeout(() => setCopiedAll(false), 2500);
      }
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleCopyAll = () => {
    try {
      localStorage.setItem(
        "pup_focus_last_credentials",
        JSON.stringify({
          email: email || "",
          password: temporaryPassword || "",
        })
      );
    } catch {}

    const textToCopy = `Institutional Email: ${email}${
      temporaryPassword ? `\nTemporary Password: ${temporaryPassword}` : ""
    }`;
    copyToClipboard(textToCopy, "all");

    const query = new URLSearchParams();
    if (email) query.set("email", email);
    if (temporaryPassword) query.set("temp", temporaryPassword);
    query.set("copy", "both");
    const targetUrl = `/?${query.toString()}`;

    setTimeout(() => {
      if (typeof window !== "undefined") {
        window.location.assign(targetUrl);
      } else if (onSignIn) {
        onSignIn();
      }
    }, 400);
  };

  const defaultErrorMessage = isEmailChange
    ? "This email change verification link was already used or has expired. Please ask an administrator to resend the email verification link."
    : "This invitation link was already used or has expired. Please ask an administrator to send a new invite or sign in if your account is already set up.";

  const firstName = fullName?.trim().split(/\s+/)[0];

  const headerConfig = {
    loading: {
      title: isEmailChange
        ? "Verifying new email address..."
        : "Verifying invitation link...",
      subtitle: isEmailChange
        ? "Please wait, confirming your updated email and restoring access to your account."
        : "Please wait, confirming your token with the campus directory.",
    },
    success: {
      title: isEmailChange ? "New Email Verified" : "Account Ready",
      subtitle: isEmailChange
        ? `${firstName ? `Welcome back, ${firstName}! ` : ""}Your updated credentials are ready to open directly — no need to copy and paste one by one.`
        : firstName
          ? `Welcome, ${firstName}! Your credentials are ready to open directly — no need to copy and paste one by one.`
          : "Your credentials are ready to open directly — no need to copy and paste one by one.",
    },
    error: {
      title: isEmailChange ? "Email Verification Failed" : "Verification Failed",
      subtitle: isEmailChange
        ? "This email change verification link could not be validated or has expired."
        : "This invitation link could not be validated or has expired.",
    },
    cancelled: {
      title: "Invitation Cancelled",
      subtitle: "This account invitation has been cancelled or revoked by the institutional administrator.",
    },
  }[status];

  return (
    <div className="w-full max-w-md bg-[#800000] border-2 border-amber-400 rounded-2xl shadow-lg overflow-hidden transition-all text-[#fff8e7]">
      {/* Email-style Maroon Header Banner (No Logo) */}
      <div className="bg-gradient-to-br from-[#680000] to-[#800000] border-b border-amber-400/30 px-6 py-6 sm:px-8 sm:py-7 text-center">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#fff8e7]">
          {headerConfig.title}
        </h2>
        <p className="mt-2 text-xs sm:text-sm text-[#f8e3bc] leading-relaxed max-w-sm mx-auto">
          {headerConfig.subtitle}
        </p>
      </div>

      {/* Card Body */}
      <div className="p-6 sm:p-7">
        {/* State 1: Loading / Verifying */}
        {status === "loading" && (
          <div className="flex flex-col items-center text-center py-2 space-y-5">
            <div className="relative w-16 h-16 flex items-center justify-center my-1">
              {/* Outer track */}
              <div className="absolute inset-0 rounded-full border-[3px] border-amber-400/20" />
              {/* Spinning brand arc */}
              <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-amber-400 border-r-amber-400 animate-spin" />
              {/* Center PUP Logo */}
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
              Validating your security token with PUP Bataan directory. Please do not close this window.
            </p>

            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#660000] border border-amber-400/40 text-xs font-medium text-amber-200">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Secure institutional verification session</span>
            </div>
          </div>
        )}

        {/* State 2: Success / Account Ready */}
        {status === "success" && (
          <div className="flex flex-col items-center text-center">
            {/* Credentials Container */}
            <div className="w-full bg-[#660000] border border-amber-400/40 rounded-xl p-4 text-left space-y-3.5 mb-5">
              {/* Institutional Email Row */}
              <div>
                <span className="block text-xs uppercase tracking-wider text-amber-300 font-bold mb-1.5">
                  Institutional Email
                </span>
                <div className="flex items-center justify-between gap-2 bg-[#500000] px-3 py-2 rounded-lg border border-amber-400/30 text-sm">
                  <span className="font-mono text-amber-100 text-xs sm:text-sm truncate select-all">
                    {email}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(email, "email")}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-300 hover:text-white px-2 py-1 rounded transition-colors cursor-pointer shrink-0"
                    aria-label="Copy institutional email"
                  >
                    {copiedEmail ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400 font-semibold">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Password Row */}
              {temporaryPassword && (
                <div>
                  <span className="block text-xs uppercase tracking-wider text-amber-300 font-bold mb-1.5">
                    Temporary Password
                  </span>
                  <div className="flex items-center justify-between gap-2 bg-[#500000] px-3 py-2 rounded-lg border border-amber-400/30 text-sm">
                    <span className="font-mono text-amber-100 text-xs sm:text-sm select-all truncate">
                      {showPassword ? temporaryPassword : "••••••••••••••••"}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="p-1 text-amber-300 hover:text-white transition-colors cursor-pointer"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(temporaryPassword, "password")}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-300 hover:text-white px-2 py-1 rounded transition-colors cursor-pointer"
                        aria-label="Copy temporary password"
                      >
                        {copiedPassword ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400 font-semibold">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Action CTA: Credentials ready to open directly */}
            <button
              type="button"
              onClick={handleCopyAll}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold text-sm py-3 px-4 rounded-xl shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-amber-400/50 cursor-pointer active:scale-[0.99]"
            >
              {copiedAll ? (
                <>
                  <Check className="w-4 h-4 text-emerald-800" />
                  <span>Credentials Ready — Redirecting to Sign In...</span>
                </>
              ) : (
                <>
                  <span>Credentials Ready — Open & Sign In Directly</span>
                  <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                </>
              )}
            </button>

            <p className="mt-3 text-[11px] text-amber-200/80 text-center leading-relaxed">
              Your email and password are ready and will be autofilled directly — no need to copy and paste one by one.
            </p>
          </div>
        )}

        {/* State 3: Verification Failed / Expired Link */}
        {status === "error" && (
          <div className="flex flex-col items-center text-center">
            <div className="w-full bg-[#660000] border border-amber-400/40 rounded-xl p-4 text-xs text-amber-100 text-left leading-relaxed mb-4">
              {errorMessage || defaultErrorMessage}
            </div>

            {onRecoverCredentials && (
              <div className="w-full bg-[#550000] border border-amber-400/30 rounded-xl p-3.5 mb-4 text-left">
                <span className="block text-xs font-bold text-amber-300 uppercase tracking-wider mb-1">
                  Didn't receive your temporary password?
                </span>
                <p className="text-[11px] text-amber-200/80 mb-2.5">
                  Enter your institutional email below to reissue and receive your login credentials.
                </p>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const trimmed = recoveryEmailInput.trim().toLowerCase();
                    if (!trimmed || isRecovering) return;
                    setIsRecovering(true);
                    setRecoveryError(null);
                    const res = await onRecoverCredentials(trimmed);
                    setIsRecovering(false);
                    if (!res.success) {
                      setRecoveryError(res.message || "Failed to recover credentials.");
                    }
                  }}
                  className="space-y-2"
                >
                  <input
                    type="email"
                    value={recoveryEmailInput}
                    onChange={(e) => {
                      setRecoveryError(null);
                      setRecoveryEmailInput(e.target.value);
                    }}
                    placeholder="e.g. yourname@pup.edu.ph"
                    required
                    className="w-full px-3 py-2 text-xs rounded-lg bg-[#3d0000] border border-amber-400/40 text-[#fff8e7] placeholder-amber-200/40 focus:outline-none focus:border-amber-400"
                  />
                  {recoveryError && (
                    <p className="text-[11px] text-red-300 font-medium">{recoveryError}</p>
                  )}
                  <button
                    type="submit"
                    disabled={isRecovering}
                    className="w-full py-2 px-3 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {isRecovering ? "Checking & Sending..." : "Send & Show My Credentials"}
                  </button>
                </form>
              </div>
            )}

            <button
              type="button"
              onClick={onReturnToSignIn}
              className="w-full flex items-center justify-center gap-2 bg-[#660000] hover:bg-[#770000] text-amber-200 border border-amber-400/40 font-bold text-sm py-2.5 px-4 rounded-xl shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-amber-400/50 cursor-pointer"
            >
              <span>Return to Sign In</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* State 4: Cancelled / Revoked by Admin */}
        {status === "cancelled" && (
          <div className="flex flex-col items-center text-center">
            <div className="mb-3.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#660000] border border-amber-400/40 text-xs font-semibold text-amber-200">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-300" />
                <span>Access Revoked by Administrator</span>
              </span>
            </div>

            {(fullName || email) && (
              <div className="w-full mb-3.5 rounded-xl border border-amber-400/40 bg-[#660000] p-3 text-left">
                {fullName ? (
                  <div className="text-xs font-semibold text-white truncate">
                    {fullName}
                  </div>
                ) : null}
                {email ? (
                  <div className="text-xs font-mono text-amber-200/80 truncate flex items-center gap-1.5 mt-0.5">
                    <Mail className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                    <span>{email}</span>
                  </div>
                ) : null}
              </div>
            )}

            <div className="w-full bg-[#660000] border border-amber-400/40 rounded-xl p-4 text-xs text-left leading-relaxed space-y-1.5 mb-5 text-amber-100">
              <p className="font-semibold text-amber-300">
                This account invitation has been cancelled or revoked by the institutional administrator.
              </p>
              <p className="text-amber-200/80">
                The link in your email is no longer active. If you believe this cancellation was made in mistake, please contact your department chairperson or PUP Bataan administrator.
              </p>
            </div>

            <button
              type="button"
              onClick={onReturnToSignIn}
              className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm py-2.5 px-4 rounded-xl shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-amber-400/50 cursor-pointer"
            >
              <span>Return to Sign In</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Footer Note with subtle border (matching email footer design) */}
        <div className="mt-5 pt-3.5 border-t border-amber-400/20 text-center">
          <p className="text-[11px] text-amber-200/70">
            If you have questions or need assistance, please contact your PUP Bataan campus administrator.
          </p>
        </div>
      </div>
    </div>
  );
}

export default EmailVerificationCard;
