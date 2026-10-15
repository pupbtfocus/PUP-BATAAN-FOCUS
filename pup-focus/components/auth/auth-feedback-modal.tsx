"use client";

import { useEffect } from "react";
import { CheckCircle, Refresh, SystemRestart, WarningCircle, Xmark } from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";
import { Check as LucideCheck, X as LucideX } from "lucide-react";

export interface AuthModalState {
  title: string;
  message: string;
  actionLabel?: string;
  variant: "success" | "error" | "loading";
  redirectTo?: string;
}

interface AuthFeedbackModalProps {
  modal: AuthModalState | null;
  onClose: () => void;
}

export function AuthFeedbackModal({ modal, onClose }: AuthFeedbackModalProps) {
  useEffect(() => {
    if (modal) {
      // Auto-redirect upon successful login
      if (modal.variant === "success") {
        const timer = setTimeout(() => {
          onClose();
        }, 2200);
        return () => clearTimeout(timer);
      }
    }
  }, [modal, onClose]);

  if (!modal) {
    return null;
  }

  const isSuccess = modal.variant === "success";
  const isLoading = modal.variant === "loading";
  const isError = modal.variant === "error";

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200 ${
        isSuccess ? "cursor-default" : "cursor-pointer"
      }`}
      onClick={isSuccess ? undefined : onClose}
    >
      <div
        className="relative w-full max-w-[360px] overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-7 text-slate-900 dark:text-slate-100 shadow-2xl transition-all duration-300 animate-in zoom-in-95 cursor-default text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top-Right Dismiss 'X' Button (hidden on success) */}
        {!isSuccess && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3.5 right-3.5 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <AppIcon icon={Xmark} size="md" color="inherit" />
          </button>
        )}

        <div className="flex flex-col items-center justify-center text-center">
          {/* Circular Icon */}
          {isLoading ? (
            <div className="relative w-16 h-16 flex items-center justify-center my-2">
              <div className="absolute inset-0 rounded-full border-[3px] border-slate-200 dark:border-slate-800" />
              <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-[#780000] border-r-[#780000] dark:border-t-amber-400 dark:border-r-amber-400 animate-spin" />
              <div className="relative w-9 h-9 rounded-full overflow-hidden flex items-center justify-center bg-white shadow-xs p-0.5">
                <img
                  src="/icons/pup-seal.png"
                  alt="PUP Logo"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
          ) : isSuccess ? (
            <div className="relative w-16 h-16 flex items-center justify-center my-2">
              <div className="absolute inset-0 rounded-full border-[3px] border-emerald-300 dark:border-emerald-700 bg-emerald-100/70 dark:bg-emerald-950/50 animate-auth-ring" />
              <div className="relative z-10 w-11 h-11 rounded-full bg-emerald-600 dark:bg-emerald-500 text-white flex items-center justify-center shadow-md animate-auth-success">
                <LucideCheck className="w-7 h-7 stroke-[3.5] animate-auth-check" />
              </div>
            </div>
          ) : (
            <div className="relative w-16 h-16 flex items-center justify-center my-2">
              <div className="absolute inset-0 rounded-full border-[3px] border-rose-300 dark:border-rose-700 bg-rose-100/70 dark:bg-rose-950/50 animate-auth-ring" />
              <div className="relative z-10 w-11 h-11 rounded-full bg-rose-600 dark:bg-rose-500 text-white flex items-center justify-center shadow-md animate-auth-error">
                <LucideX className="w-7 h-7 stroke-[3.5] animate-auth-x" />
              </div>
            </div>
          )}

          {/* Title */}
          <h3 className="mt-3 text-lg font-bold text-slate-900 dark:text-slate-100">
            {isLoading
              ? modal.title || "Authenticating..."
              : isSuccess
              ? modal.title || "Login Successful"
              : modal.title || "Login Failed"}
          </h3>

          {/* Message */}
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-[280px]">
            {modal.message ||
              (isLoading
                ? "Verifying institutional credentials with campus security..."
                : isSuccess
                ? "Welcome back to PUP FOCUS."
                : "Invalid institutional email address or password. Please verify your credentials and try again.")}
          </p>

          {/* Status Indicator & Action Button */}
          {isLoading && (
            <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-600 dark:text-slate-300">
              <AppIcon icon={SystemRestart} size="xs" color="inherit" className="animate-spin text-[#780000] dark:text-amber-400" />
              <span>Securing institutional session...</span>
            </div>
          )}

          {isSuccess && (
            <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
              <AppIcon icon={SystemRestart} size="xs" color="inherit" className="animate-spin" />
              <span>Redirecting to your portal...</span>
            </div>
          )}

          {isError && (
            <button
              type="button"
              onClick={onClose}
              className="mt-5 w-full flex items-center justify-center gap-2 bg-[#780000] hover:bg-[#5E0000] text-white font-medium text-xs py-2.5 px-4 rounded-xl shadow-xs transition cursor-pointer"
            >
              <AppIcon icon={Refresh} size="xs" color="inherit" />
              <span>{modal.actionLabel || "Try Again"}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
