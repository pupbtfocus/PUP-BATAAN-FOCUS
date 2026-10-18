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
}: EmailVerificationCardProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);

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
    const textToCopy = `Institutional Email: ${email}${
      temporaryPassword ? `\nTemporary Password: ${temporaryPassword}` : ""
    }`;
    copyToClipboard(textToCopy, "all");
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
        ? `${firstName ? `Welcome back, ${firstName}! ` : ""}Your updated email is verified and all of your existing account records remain intact. Save your new temporary credentials before signing in.`
        : firstName
          ? `Welcome, ${firstName}! We also sent this to your email. Save your temporary credentials before signing in.`
          : "Welcome! We also sent this to your email. Save your temporary credentials before signing in.",
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
    <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-lg overflow-hidden transition-all">
      {/* Email-style Maroon Header Banner (No Logo) */}
      <div className="bg-gradient-to-br from-[#4d0000] to-[#780000] px-6 py-6 sm:px-8 sm:py-7 text-center">
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
              <div className="absolute inset-0 rounded-full border-[3px] border-slate-200 dark:border-slate-800" />
              {/* Spinning brand arc */}
              <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-[#780000] border-r-[#780000] dark:border-t-amber-400 dark:border-r-amber-400 animate-spin" />
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

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs">
              Validating your security token with PUP Bataan directory. Please do not close this window.
            </p>

            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Secure institutional verification session</span>
            </div>
          </div>
        )}

        {/* State 2: Success / Account Ready */}
        {status === "success" && (
          <div className="flex flex-col items-center text-center">
            {/* Credentials Container */}
            <div className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-left space-y-3.5 mb-5">
              {/* Institutional Email Row */}
              <div>
                <span className="block text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-1.5">
                  Institutional Email
                </span>
                <div className="flex items-center justify-between gap-2 bg-white dark:bg-slate-900 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-sm">
                  <span className="font-mono text-slate-800 dark:text-slate-200 text-xs sm:text-sm truncate select-all">
                    {email}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(email, "email")}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-[#780000] dark:hover:text-amber-400 px-2 py-1 rounded transition-colors cursor-pointer shrink-0"
                    aria-label="Copy institutional email"
                  >
                    {copiedEmail ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Copied</span>
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
                  <span className="block text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-1.5">
                    Temporary Password
                  </span>
                  <div className="flex items-center justify-between gap-2 bg-white dark:bg-slate-900 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-sm">
                    <span className="font-mono text-slate-800 dark:text-slate-200 text-xs sm:text-sm select-all truncate">
                      {showPassword ? temporaryPassword : "••••••••••••••••"}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(temporaryPassword, "password")}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-[#780000] dark:hover:text-amber-400 px-2 py-1 rounded transition-colors cursor-pointer"
                        aria-label="Copy temporary password"
                      >
                        {copiedPassword ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Copied</span>
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

            {/* Solid PUP Maroon CTA button */}
            <button
              type="button"
              onClick={onSignIn}
              className="w-full flex items-center justify-center gap-2 bg-[#780000] hover:bg-[#5E0000] text-white font-medium text-sm py-2.5 px-4 rounded-xl shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#780000]/30 cursor-pointer"
            >
              <span>Sign In Now</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {/* Secondary Action Link */}
            <button
              type="button"
              onClick={handleCopyAll}
              className="mt-3.5 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-[#780000] dark:hover:text-amber-400 transition-colors py-1 cursor-pointer"
            >
              {copiedAll ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">All credentials copied to clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy all credentials</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* State 3: Verification Failed / Expired Link */}
        {status === "error" && (
          <div className="flex flex-col items-center text-center">
            <div className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-xs text-slate-700 dark:text-slate-300 text-left leading-relaxed mb-5">
              {errorMessage || defaultErrorMessage}
            </div>

            <button
              type="button"
              onClick={onReturnToSignIn}
              className="w-full flex items-center justify-center gap-2 bg-[#780000] hover:bg-[#5E0000] text-white font-medium text-sm py-2.5 px-4 rounded-xl shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#780000]/30 cursor-pointer"
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
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <AlertTriangle className="w-3.5 h-3.5 text-slate-500" />
                <span>Access Revoked by Administrator</span>
              </span>
            </div>

            {(fullName || email) && (
              <div className="w-full mb-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 text-left">
                {fullName ? (
                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {fullName}
                  </div>
                ) : null}
                {email ? (
                  <div className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate flex items-center gap-1.5 mt-0.5">
                    <Mail className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                    <span>{email}</span>
                  </div>
                ) : null}
              </div>
            )}

            <div className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-xs text-left leading-relaxed space-y-1.5 mb-5">
              <p className="font-medium text-slate-800 dark:text-slate-200">
                This account invitation has been cancelled or revoked by the institutional administrator.
              </p>
              <p className="text-slate-600 dark:text-slate-400">
                The link in your email is no longer active. If you believe this cancellation was made in mistake, please contact your department chairperson or PUP Bataan administrator.
              </p>
            </div>

            <button
              type="button"
              onClick={onReturnToSignIn}
              className="w-full flex items-center justify-center gap-2 bg-[#780000] hover:bg-[#5E0000] text-white font-medium text-sm py-2.5 px-4 rounded-xl shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#780000]/30 cursor-pointer"
            >
              <span>Return to Sign In</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Footer Note with subtle border (matching email footer design) */}
        <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-slate-800 text-center">
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            If you have questions or need assistance, please contact your PUP Bataan campus administrator.
          </p>
        </div>
      </div>
    </div>
  );
}

export default EmailVerificationCard;
