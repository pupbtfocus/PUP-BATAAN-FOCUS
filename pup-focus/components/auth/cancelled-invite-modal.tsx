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
        className="relative w-full max-w-[420px] bg-white border border-slate-200 rounded-2xl shadow-xl border-t-4 border-[#7A0000] p-6 sm:p-8 text-slate-900 transition-all duration-200 animate-in zoom-in-95 cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top-Right Dismiss 'X' Button */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="flex flex-col items-center text-center">
          {/* Centered soft red alert icon badge */}
          <div className="w-13 h-13 p-3 rounded-full bg-rose-50 text-rose-600 border border-rose-100 mb-4 flex items-center justify-center">
            <AlertCircle className="w-7 h-7" />
          </div>

          {/* Heading */}
          <h2 className="text-xl font-bold tracking-tight text-slate-900 mb-2">
            Invitation Cancelled
          </h2>

          {/* Subtitle Badge */}
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-200/80 text-xs font-semibold text-rose-700 mb-4">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Access Revoked by Administrator</span>
          </span>

          {/* Recipient Details */}
          {(email || fullName) && (
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

          {/* Detailed Message */}
          <div className="w-full rounded-xl border border-rose-100/90 bg-rose-50/70 p-4 text-xs text-rose-900 text-left leading-relaxed space-y-1.5 mb-6">
            <p className="font-medium">
              This account invitation has been cancelled or revoked by the institutional administrator.
            </p>
            <p className="text-rose-800/80">
              The link in your email is no longer active. If you believe this cancellation was made in mistake, please contact your department chairperson or PUP Bataan administrator.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="w-full space-y-2">
            <button
              type="button"
              onClick={handleReturn}
              className="w-full flex items-center justify-center gap-2 bg-[#7A0000] hover:bg-[#5E0000] text-white font-medium text-sm py-2.5 px-4 rounded-xl shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#7A0000]/30 cursor-pointer"
            >
              <span>Return to Sign In</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="w-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 hover:text-slate-900 font-medium text-sm py-2 px-4 rounded-xl transition-all cursor-pointer"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CancelledInviteModal;
