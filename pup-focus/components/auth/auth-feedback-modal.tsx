"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import successfullyIcon from "@/assets/icons animations/successfully.svg";
import failedIcon from "@/assets/icons animations/fail.svg";

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
    }
  }, [modal]);

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm cursor-pointer"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-[2rem] border border-[rgba(255,215,0,0.2)] bg-gradient-to-b from-[#4d0000]/95 to-[#2a0000]/95 p-8 text-[#fff8e7] shadow-[0_16px_40px_rgba(0,0,0,0.6)] backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {isSuccess ? (
          <div className="flex flex-col items-center justify-center text-center py-4 gap-3">
            <div className="relative flex items-center justify-center h-28 w-28">
              <img
                key={animationKey}
                src={`${successSrc}?v=${animationKey}`}
                alt="Success"
                className="h-28 w-28 object-contain"
              />
            </div>
            <h3 className="text-xl font-extrabold uppercase tracking-[0.2em] text-[#ffd700]">
              Login Successful
            </h3>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center py-2 gap-3">
            <div className="relative flex items-center justify-center h-28 w-28">
              <img
                key={animationKey}
                src={`${failedSrc}?v=${animationKey}`}
                alt="Failed"
                className="h-28 w-28 object-contain"
              />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-[#ffd700]">
                Failed
              </p>
              <h3 className="mt-1.5 text-base font-semibold text-rose-100">
                {modal.title || "Invalid email address or password"}
              </h3>
            </div>

            <div className="mt-6 flex justify-center w-full">
              <Button
                type="button"
                className="h-12 w-full rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 font-bold text-[#4d0000] shadow-[0_4px_14px_rgba(255,215,0,0.25)] transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_6px_20px_rgba(255,215,0,0.35)] active:scale-100"
                onClick={onClose}
              >
                {modal.actionLabel || "Try again"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
