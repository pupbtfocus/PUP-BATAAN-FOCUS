"use client";

import Lottie from "lottie-react";
import { Button } from "@/components/ui/button";
import successCheckAnimation from "@/assets/icons animations/lottieflow-checkbox-06-000000-easey.json";
import errorAnimation from "@/assets/icons animations/lottieflow-dropdown-07-1-000000-easey.json";

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
  if (!modal) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-[2rem] border border-[rgba(255,215,0,0.2)] bg-gradient-to-b from-[#4d0000]/95 to-[#2a0000]/95 p-8 text-[#fff8e7] shadow-[0_16px_40px_rgba(0,0,0,0.6)] backdrop-blur-xl">
        <div className="flex flex-col items-center text-center gap-3">
          <div
            className={`relative flex h-16 w-16 items-center justify-center rounded-full border ${
              modal.variant === "success"
                ? "border-emerald-400/40 bg-emerald-400/10"
                : "border-rose-400/40 bg-rose-400/10"
            } ${modal.variant === "success" ? "animate-[pulse_1.4s_ease-in-out_infinite]" : ""}`}
          >
            {modal.variant === "success" ? (
              <div className="absolute inset-0 rounded-full border border-emerald-300/30 animate-ping" />
            ) : null}

            {modal.variant === "success" ? (
              <Lottie
                animationData={successCheckAnimation}
                loop={false}
                autoplay
                className="relative z-10 h-14 w-14"
              />
            ) : modal.variant === "error" ? (
              <Lottie
                animationData={errorAnimation}
                loop={true}
                autoplay
                className="relative z-10 h-14 w-14"
              />
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                className="h-7 w-7 text-rose-300"
                aria-hidden
              >
                <path
                  d="M18 6L6 18M6 6L18 18"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-[#ffd700]">
              {modal.variant === "success" ? "Success" : "Failed"}
            </p>
            <h3 className="mt-1 text-2xl font-semibold">{modal.title}</h3>
          </div>
        </div>
        <p className="mt-4 whitespace-pre-wrap text-center text-sm text-[#f3d9b3]">
          {modal.message}
        </p>

        <div className="mt-8 flex justify-center">
          <Button
            type="button"
            className="h-12 w-full rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 font-bold text-[#4d0000] shadow-[0_4px_14px_rgba(255,215,0,0.25)] transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_6px_20px_rgba(255,215,0,0.35)] active:scale-100"
            onClick={onClose}
          >
            {modal.actionLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
