"use client";

import React, { useState } from "react";
import {
  Loader2,
  Check,
  Copy,
  Eye,
  EyeOff,
  AlertCircle,
  AlertTriangle,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  Mail,
} from "lucide-react";

export type VerificationStatus = "loading" | "success" | "error" | "cancelled";

export interface EmailVerificationCardProps {
  status: VerificationStatus;
  email?: string;
  fullName?: string;
  temporaryPassword?: string;
  errorMessage?: string;
  onSignIn?: () => void;
  onReturnToSignIn?: () => void;
}

export function EmailVerificationCard({
  status,
  email = "preview@pupfocus.dev",
  fullName,
  temporaryPassword = "",
  errorMessage,
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

  const defaultErrorMessage =
    "This invitation link was already used or has expired. Please ask an administrator to send a new invite or sign in if your account is already set up.";

  return (
    <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-sm border-t-4 border-[#7A0000] p-6 sm:p-8 transition-all">
      {/* State 1: Loading / Verifying */}
      {status === "loading" && (
        <div className="flex flex-col items-center text-center py-4">
          <div className="w-14 h-14 rounded-full bg-amber-50/80 border border-amber-100 flex items-center justify-center mb-6">
            <Loader2 className="w-7 h-7 text-[#7A0000] animate-spin" />
          </div>

          <h2 className="text-xl font-bold tracking-tight text-slate-900 mb-2">
            Verifying invitation link...
          </h2>
          <p className="text-sm text-slate-500 leading-relaxed mb-8 max-w-sm">
            Please wait, confirming your token with the campus directory.
          </p>

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-xs font-medium text-slate-600">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Secure institutional verification session</span>
          </div>
        </div>
      )}

      {/* State 2: Success / Account Ready */}
      {status === "success" && (
        <div className="flex flex-col items-center text-center">
          <div className="w-13 h-13 p-3 rounded-full bg-amber-50 text-[#7A0000] border border-amber-100/80 mb-5 flex items-center justify-center">
            <CheckCircle2 className="w-7 h-7" />
          </div>

          <h2 className="text-xl font-bold tracking-tight text-slate-900 mb-1.5">
            Account Ready
          </h2>
          <p className="text-sm text-slate-500 mb-6">
            {fullName
              ? `Welcome, ${fullName}! Save your temporary credentials before signing in.`
              : "Welcome! Save your temporary credentials before signing in."}
          </p>

          {/* Clean Credentials Container */}
          <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-left space-y-3.5 mb-6">
            {/* Institutional Email Row */}
            <div>
              <span className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1.5">
                Institutional Email
              </span>
              <div className="flex items-center justify-between gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200/90 text-sm">
                <span className="font-mono text-slate-800 text-xs sm:text-sm truncate select-all">
                  {email}
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(email, "email")}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-[#7A0000] px-2 py-1 rounded transition-colors cursor-pointer shrink-0"
                  aria-label="Copy institutional email"
                >
                  {copiedEmail ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-600 font-semibold">Copied</span>
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
                <span className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1.5">
                  Temporary Password
                </span>
                <div className="flex items-center justify-between gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200/90 text-sm">
                  <span className="font-mono text-slate-800 text-xs sm:text-sm select-all truncate">
                    {showPassword ? temporaryPassword : "••••••••••••••••"}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-1 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(temporaryPassword, "password")}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-[#7A0000] px-2 py-1 rounded transition-colors cursor-pointer"
                      aria-label="Copy temporary password"
                    >
                      {copiedPassword ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-600 font-semibold">Copied</span>
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
            className="w-full flex items-center justify-center gap-2 bg-[#7A0000] hover:bg-[#5E0000] text-white font-medium text-sm py-2.5 px-4 rounded-xl shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#7A0000]/30 cursor-pointer"
          >
            <span>Sign In Now</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          {/* Secondary Action Link */}
          <button
            type="button"
            onClick={handleCopyAll}
            className="mt-3.5 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-[#7A0000] transition-colors py-1 cursor-pointer"
          >
            {copiedAll ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-600 font-medium">All credentials copied to clipboard!</span>
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
          <div className="w-13 h-13 p-3 rounded-full bg-rose-50 text-rose-600 border border-rose-100 mb-5 flex items-center justify-center">
            <AlertCircle className="w-7 h-7" />
          </div>

          <h2 className="text-xl font-bold tracking-tight text-slate-900 mb-2">
            Verification Failed
          </h2>

          <div className="w-full bg-rose-50/70 border border-rose-100/90 rounded-xl p-4 text-xs text-rose-900 text-left leading-relaxed mb-6">
            {errorMessage || defaultErrorMessage}
          </div>

          <button
            type="button"
            onClick={onReturnToSignIn}
            className="w-full flex items-center justify-center gap-2 bg-[#7A0000] hover:bg-[#5E0000] text-white font-medium text-sm py-2.5 px-4 rounded-xl shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#7A0000]/30 cursor-pointer"
          >
            <span>Return to Sign In</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* State 4: Cancelled / Revoked by Admin */}
      {status === "cancelled" && (
        <div className="flex flex-col items-center text-center">
          <div className="w-13 h-13 p-3 rounded-full bg-rose-50 text-rose-600 border border-rose-100 mb-4 flex items-center justify-center">
            <AlertCircle className="w-7 h-7" />
          </div>

          <h2 className="text-xl font-bold tracking-tight text-slate-900 mb-2">
            Invitation Cancelled
          </h2>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-200/80 text-xs font-semibold text-rose-700 mb-4">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Access Revoked by Administrator</span>
          </span>

          {(fullName || email) && (
            <div className="w-full mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-left">
              {fullName ? (
                <div className="text-xs font-semibold text-slate-900 truncate">
                  {fullName}
                </div>
              ) : null}
              {email ? (
                <div className="text-xs font-mono text-slate-500 truncate flex items-center gap-1.5 mt-0.5">
                  <Mail className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                  <span>{email}</span>
                </div>
              ) : null}
            </div>
          )}

          <div className="w-full bg-rose-50/70 border border-rose-100/90 rounded-xl p-4 text-xs text-rose-900 text-left leading-relaxed space-y-1.5 mb-6">
            <p className="font-medium">
              This account invitation has been cancelled or revoked by the institutional administrator.
            </p>
            <p className="text-rose-800/80">
              The link in your email is no longer active. If you believe this cancellation was made in mistake, please contact your department chairperson or PUP Bataan administrator.
            </p>
          </div>

          <button
            type="button"
            onClick={onReturnToSignIn}
            className="w-full flex items-center justify-center gap-2 bg-[#7A0000] hover:bg-[#5E0000] text-white font-medium text-sm py-2.5 px-4 rounded-xl shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#7A0000]/30 cursor-pointer"
          >
            <span>Return to Sign In</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export default EmailVerificationCard;
