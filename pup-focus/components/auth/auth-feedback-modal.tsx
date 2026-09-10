"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import successfullyIcon from "@/assets/icons animations/successfully.svg";
import failedIcon from "@/assets/icons animations/fail.svg";
import { NavArrowRight, Refresh, SystemRestart, Xmark } from "iconoir-react";

export interface AuthModalState {
  title: string;
  message: string;
  actionLabel: string;
  variant: "success" | "error";
  redirectTo?: string;
}

interface AuthFeedbackModalProps {
  modal: AuthModalState | null;
  onClose: () => void;
}

export function AuthFeedbackModal({ modal, onClose }: AuthFeedbackModalProps) {
  const [animationKey, setAnimationKey] = useState(0);

  useEffect(() => {
    if (modal) {
      setAnimationKey(Date.now());

      // Auto-redirect upon successful login after checkmark animation completes
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
  const successSrc =
    typeof successfullyIcon === "string"
      ? successfullyIcon
      : (successfullyIcon as any)?.src ?? "/icons-animations/successfully.svg";
  const failedSrc =
    typeof failedIcon === "string"
      ? failedIcon
      : (failedIcon as any)?.src ?? "/icons-animations/fail.svg";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200 cursor-pointer"
      onClick={onClose}
    >
      <div
        className={`relative w-full max-w-[360px] sm:max-w-[380px] overflow-hidden rounded-[2rem] border bg-gradient-to-b from-[#4e0303] via-[#350000] to-[#200000] p-6 sm:p-8 text-[#fff8e7] backdrop-blur-xl shadow-2xl shadow-black/50 transition-all duration-300 animate-in zoom-in-95 cursor-default ${
          isSuccess
            ? "border-amber-400/60"
            : "border-rose-500/50"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top ambient glow accent line */}
        <div
          className={`absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-transparent ${
            isSuccess
              ? "via-amber-400 to-transparent"
              : "via-rose-500 to-transparent"
          }`}
        />

        {/* Top-Right Dismiss 'X' Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3.5 right-3.5 p-1.5 rounded-full text-amber-200/40 hover:text-amber-200 hover:bg-white/10 transition-colors cursor-pointer"
          aria-label="Close modal"
        >
          <Xmark className="w-4 h-4" />
        </button>

        <div className="flex flex-col items-center justify-center text-center">
          {/* Circular Icon Container */}
          <div className="relative flex items-center justify-center my-1.5">
            <div
              className={`relative flex items-center justify-center w-20 h-20 sm:w-22 sm:h-22 rounded-full bg-[#180000] border-2 ${
                isSuccess
                  ? "border-emerald-500/50"
                  : "border-rose-500/50"
              }`}
            >
              <img
                key={animationKey}
                src={`${isSuccess ? successSrc : failedSrc}?v=${animationKey}`}
                alt={isSuccess ? "Success" : "Failed"}
                className="h-14 w-14 sm:h-16 sm:w-16 object-contain"
              />
            </div>
          </div>

          {/* Title */}
          <h3
            className={`mt-3 text-xl sm:text-2xl font-black uppercase tracking-wider ${
              isSuccess
                ? "text-amber-300"
                : "text-rose-200"
            }`}
          >
            {isSuccess ? "Login Successful" : (modal.title || "Login Failed")}
          </h3>

          {/* Sleek Golden or Rose Divider */}
          <div
            className={`h-0.5 w-12 rounded-full my-2 ${
              isSuccess
                ? "bg-gradient-to-r from-transparent via-amber-400/70 to-transparent"
                : "bg-gradient-to-r from-transparent via-rose-500/70 to-transparent"
            }`}
          />

          {/* Context Message */}
          <p
            className={`text-xs sm:text-sm font-medium leading-relaxed max-w-[280px] ${
              isSuccess ? "text-amber-100/90" : "text-rose-100/80"
            }`}
          >
            {isSuccess
              ? (modal.message || "Welcome back to PUP FOCUS.")
              : (modal.message && modal.message !== modal.title
                  ? modal.message
                  : "Invalid institutional email address or password. Please verify your credentials and try again.")}
          </p>

          {/* Action Button & Status Indicator */}
          {isSuccess ? (
            <div className="mt-5 w-full flex flex-col items-center gap-2">
              <div className="flex items-center justify-center gap-2 text-xs font-semibold tracking-wide text-amber-300/90 py-0.5">
                <SystemRestart className="w-3.5 h-3.5 animate-spin text-amber-400" />
                <span>Redirecting to your portal...</span>
              </div>
              <Button
                type="button"
                className="mt-1 h-11 w-full rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 font-extrabold text-[#3d0000] tracking-widest uppercase text-xs transition-all duration-300 hover:from-amber-300 hover:to-amber-400 active:scale-95 cursor-pointer shadow-md shadow-black/30 flex items-center justify-center gap-2"
                onClick={onClose}
              >
                <span>Continue</span>
                <NavArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          ) : (
            <div className="mt-5 w-full">
              <Button
                type="button"
                className="h-11 sm:h-12 w-full rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 font-extrabold text-[#3d0000] tracking-widest uppercase text-xs transition-all duration-300 hover:from-amber-300 hover:to-amber-400 active:scale-95 cursor-pointer shadow-md shadow-black/30 flex items-center justify-center gap-2"
                onClick={onClose}
              >
                <Refresh className="w-3.5 h-3.5" />
                <span>{modal.actionLabel || "Try Again"}</span>
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
