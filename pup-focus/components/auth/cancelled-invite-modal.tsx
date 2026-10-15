"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Mail,
  X,
} from "lucide-react";

export interface CancelledInviteModalProps {
  isOpen: boolean;
  email?: string;
  fullName?: string;
  onClose?: () => void;
  onReturnToSignIn?: () => void;
}

export function CancelledInviteModal({
  isOpen,
  email,
  fullName,
  onClose,
  onReturnToSignIn,
}: CancelledInviteModalProps) {
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onClose) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleReturn = () => {
    if (onReturnToSignIn) {
      onReturnToSignIn();
    } else {
      router.push("/");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[420px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden text-slate-900 dark:text-slate-100 transition-all duration-200 animate-in zoom-in-95 cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Email-style Maroon Header Banner (No Logo) */}
        <div className="relative bg-gradient-to-br from-[#4d0000] to-[#780000] px-6 py-6 text-center text-white">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="absolute top-3.5 right-3.5 p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          )}
          <h2 className="text-xl font-bold tracking-tight text-[#fff8e7]">
            Invitation Cancelled
          </h2>
          <p className="mt-1.5 text-xs text-[#f8e3bc] leading-relaxed max-w-xs mx-auto">
            This account invitation has been cancelled or revoked by the institutional administrator.
          </p>
        </div>

        <div className="p-6">
          <div className="flex flex-col items-center text-center">
            {/* Subtitle Badge */}
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs font-semibold text-rose-700 dark:text-rose-300 mb-4">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Access Revoked by Administrator</span>
            </span>

            {/* Recipient Details */}
            {(email || fullName) && (
              <div className="w-full mb-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 text-left">
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

            {/* Detailed Message */}
            <div className="w-full rounded-xl border border-rose-200/80 dark:border-rose-900/60 bg-rose-50/80 dark:bg-rose-950/30 p-4 text-xs text-rose-900 dark:text-rose-200 text-left leading-relaxed space-y-1.5 mb-5">
              <p className="font-medium">
                This account invitation has been cancelled or revoked by the institutional administrator.
              </p>
              <p className="text-rose-800/80 dark:text-rose-300/80">
                The link in your email is no longer active. If you believe this cancellation was made in mistake, please contact your department chairperson or PUP Bataan administrator.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="w-full space-y-2">
              <button
                type="button"
                onClick={handleReturn}
                className="w-full flex items-center justify-center gap-2 bg-[#780000] hover:bg-[#5E0000] text-white font-medium text-sm py-2.5 px-4 rounded-xl shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#780000]/30 cursor-pointer"
              >
                <span>Return to Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium text-sm py-2 px-4 rounded-xl transition-all cursor-pointer"
                >
                  Dismiss
                </button>
              )}
            </div>

            {/* Footer Note */}
            <div className="w-full mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-center">
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                If you have questions or need assistance, please contact your PUP Bataan campus administrator.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CancelledInviteModal;
