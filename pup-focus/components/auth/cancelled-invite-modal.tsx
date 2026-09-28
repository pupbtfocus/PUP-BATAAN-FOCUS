"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Mail, NavArrowRight, WarningTriangle, Xmark } from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";
import failedIcon from "@/assets/icons animations/fail.svg";

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

  const failedSrc =
    typeof failedIcon === "string"
      ? failedIcon
      : (failedIcon as any)?.src ?? "/icons-animations/fail.svg";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[420px] overflow-hidden rounded-[2rem] border border-rose-500/50 bg-gradient-to-b from-[#4e0303] via-[#350000] to-[#200000] p-6 sm:p-8 text-[#fff8e7] backdrop-blur-xl shadow-2xl shadow-black/80 transition-all duration-300 animate-in zoom-in-95 cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top ambient glow accent line */}
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-transparent via-rose-500 to-transparent" />

        {/* Top-Right Dismiss 'X' Button */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 rounded-xl border border-[#5e0000] bg-[#780000] hover:bg-[#5e0000] text-white p-1.5 transition-colors cursor-pointer shadow-xs"
            aria-label="Close modal"
          >
            <AppIcon icon={Xmark} size="md" color="inherit" />
          </button>
        )}

        <div className="flex flex-col items-center text-center">
          {/* Animated Fail / Cancelled Icon Badge */}
          <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-[#180000] border-2 border-rose-500/60 shadow-inner my-2">
            <img
              src={failedSrc}
              alt="Invitation Cancelled"
              className="h-14 w-14 object-contain"
            />
          </div>

          {/* Heading */}
          <h2 className="mt-3 text-2xl font-black uppercase tracking-wider text-rose-200">
            Invitation Cancelled
          </h2>
          <div className="mx-auto my-3 h-0.5 w-16 rounded-full bg-gradient-to-r from-transparent via-rose-500/80 to-transparent shadow-[0_0_8px_rgba(244,63,94,0.6)]" />

          {/* Subtitle Badge */}
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-950/70 border border-rose-500/40 text-xs font-semibold text-rose-300 mb-3 shadow-inner">
            <AppIcon icon={WarningTriangle} size="xs" color="inherit" />
            <span>Access Revoked by Administrator</span>
          </span>

          {/* Recipient Details (if available) */}
          {(email || fullName) && (
            <div className="w-full mb-3 rounded-xl border border-amber-400/30 bg-black/40 p-2.5 text-left text-xs">
              {fullName ? (
                <div className="font-bold text-amber-200 truncate">{fullName}</div>
              ) : null}
              {email ? (
                <div className="text-[11px] text-slate-300 font-mono truncate flex items-center gap-1.5 mt-0.5">
                  <AppIcon icon={Mail} size="xs" color="inherit" />
                  <span>{email}</span>
                </div>
              ) : null}
            </div>
          )}

          {/* Detailed Message */}
          <div className="text-rose-100/90 text-xs sm:text-sm font-medium tracking-wide leading-relaxed space-y-2 max-w-[340px]">
            <p>
              This account invitation has been cancelled or revoked by the institutional administrator.
            </p>
            <p className="text-[11px] sm:text-xs text-rose-200/75 leading-normal">
              The link in your email is no longer active. If you believe this cancellation was made in mistake, please contact your department chairperson or PUP Bataan administrator.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 w-full space-y-2">
            <button
              type="button"
              onClick={handleReturn}
              className="h-11 sm:h-12 w-full rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 font-extrabold text-[#3d0000] tracking-widest uppercase text-xs transition-all duration-300 hover:from-amber-300 hover:to-amber-400 active:scale-95 cursor-pointer shadow-md shadow-black/40 flex items-center justify-center gap-2"
            >
              <span>Return to Sign In</span>
              <AppIcon icon={NavArrowRight} size="sm" color="inherit" />
            </button>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="h-9 w-full rounded-xl border border-[#5e0000] bg-[#780000] hover:bg-[#5e0000] text-white text-xs font-semibold transition cursor-pointer shadow-xs"
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
