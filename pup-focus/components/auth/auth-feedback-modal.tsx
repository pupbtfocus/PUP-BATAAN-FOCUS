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

  const modalText = isSuccess
    ? "Login Successful"
    : modal.title || modal.message || "Invalid email address or password";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm cursor-pointer"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-[2rem] border border-[rgba(255,215,0,0.2)] bg-[#4d0000]/95 p-8 text-[#fff8e7] backdrop-blur-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center justify-center text-center py-2 gap-4">
          <div className="relative flex items-center justify-center h-24 w-24">
            <img
              key={animationKey}
              src={`${isSuccess ? successSrc : failedSrc}?v=${animationKey}`}
              alt={isSuccess ? "Success" : "Failed"}
              className="h-24 w-24 object-contain"
            />
          </div>

          <h3
            className={`text-base font-semibold ${
              isSuccess ? "text-[#ffd700] uppercase tracking-wider" : "text-rose-100"
            }`}
          >
            {modalText}
          </h3>

          {!isSuccess && (
            <div className="mt-2 flex justify-center w-full">
              <Button
                type="button"
                className="h-12 w-full rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 font-extrabold text-[#3d0000] tracking-widest uppercase text-xs transition-all duration-300 hover:from-amber-300 hover:to-amber-400 active:scale-95 cursor-pointer"
                onClick={onClose}
              >
                {modal.actionLabel || "Try again"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
