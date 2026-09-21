"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { isValidEmailAddress } from "@/lib/validation/email";
import { Logo } from "@/components/ui/logo";
import { AppIcon } from "@/components/ui/app-icon";
import { AlertPopup } from "@/components/ui/alert-popup";
import { Mail, NavArrowRight, SystemRestart, Xmark } from "iconoir-react";

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialEmail?: string;
}

export function ForgotPasswordModal({
  isOpen,
  onClose,
  initialEmail = "",
}: ForgotPasswordModalProps) {
  const [resetEmail, setResetEmail] = useState(initialEmail);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setResetEmail(initialEmail);
      setToast(null);
      setIsSendingReset(false);
    }
  }, [isOpen, initialEmail]);

  if (!isOpen) {
    return null;
  }

  async function handleSendResetLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setToast(null);

    const normalizedResetEmail = resetEmail.trim().toLowerCase();

    if (!isValidEmailAddress(normalizedResetEmail)) {
      setToast({
        type: "error",
        message: "Please enter a valid institutional email address.",
      });
      return;
    }

    setIsSendingReset(true);

    try {
      // 1. Try sending via server API route (bypasses Supabase client rate limits and sends branded email)
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedResetEmail }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setToast({
          type: "success",
          message: "Password reset email sent! Please check your inbox.",
        });
        setTimeout(() => {
          onClose();
        }, 2200);
      } else {
        const rawMsg = data.error || "Failed to send password reset email.";
        if (
          rawMsg.toLowerCase().includes("rate limit") ||
          rawMsg.toLowerCase().includes("over_email_send_rate_limit")
        ) {
          setToast({
            type: "error",
            message:
              "Rate limit reached. You have requested several reset links recently. Please check your inbox or wait a few minutes before trying again.",
          });
        } else {
          // Fallback to client-side resetPasswordForEmail if API fails for non-rate-limit reason
          const supabase = createClient();
          const { error: fallbackErr } =
            await supabase.auth.resetPasswordForEmail(normalizedResetEmail, {
              redirectTo: `${window.location.origin}/auth/change-password`,
            });

          if (fallbackErr) {
            const fallbackMsg = fallbackErr.message;
            if (
              fallbackMsg.toLowerCase().includes("rate limit") ||
              fallbackMsg.toLowerCase().includes("over_email_send_rate_limit")
            ) {
              setToast({
                type: "error",
                message:
                  "Rate limit reached. You have requested several reset links recently. Please check your inbox or wait a few minutes before trying again.",
              });
            } else {
              setToast({
                type: "error",
                message: fallbackMsg,
              });
            }
          } else {
            setToast({
              type: "success",
              message: "Password reset email sent! Please check your inbox.",
            });
            setTimeout(() => {
              onClose();
            }, 2200);
          }
        }
      }
    } catch (err: any) {
      setToast({
        type: "error",
        message:
          err?.message || "Failed to send password reset email. Please try again.",
      });
    } finally {
      setIsSendingReset(false);
    }
  }

  return (
    <>
      {/* Top-Right Floating Solid Alert Toast */}
      {toast && (
        <AlertPopup
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
          position="top-right"
          autoCloseMs={5000}
        />
      )}

      {/* Modal Backdrop */}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-4 backdrop-blur-md animate-in fade-in duration-200">
        <div className="relative w-full max-w-[390px] sm:max-w-md mx-auto drop-shadow-[0_25px_35px_rgba(0,0,0,0.85)] animate-in zoom-in-95 duration-200">
          {/* Curved Card Top Header SVG with 3D Golden Crest Lighting */}
          <div className="relative">
            <svg
              viewBox="0 0 400 64"
              className="w-full h-auto block -mb-1 pointer-events-none overflow-visible"
            >
              <defs>
                <linearGradient id="forgotPassTopGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#8a0c0c" />
                  <stop offset="40%" stopColor="#780000" />
                  <stop offset="85%" stopColor="#680000" />
                  <stop offset="100%" stopColor="#680000" />
                </linearGradient>
                <linearGradient id="forgotPassTopGoldCrest" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#D97706" stopOpacity="0.8" />
                  <stop offset="15%" stopColor="#F59E0B" stopOpacity="0.95" />
                  <stop offset="35%" stopColor="#FDE68A" stopOpacity="1" />
                  <stop offset="50%" stopColor="#FFFBEB" stopOpacity="1" />
                  <stop offset="65%" stopColor="#FDE68A" stopOpacity="1" />
                  <stop offset="85%" stopColor="#F59E0B" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#D97706" stopOpacity="0.8" />
                </linearGradient>
                <linearGradient id="forgotPassTopAmbientSheen" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#FBBF24" stopOpacity="0.65" />
                  <stop offset="60%" stopColor="#F59E0B" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#780000" stopOpacity="0" />
                </linearGradient>
              </defs>

              <path
                d="M 0,64 L 0,20 Q 0,0 20,0 L 142,0 C 158,0 162,37 200,37 C 238,37 242,0 258,0 L 380,0 Q 400,0 400,20 L 400,64 Z"
                fill="url(#forgotPassTopGrad)"
              />
              <path
                d="M 2,20 Q 2,2 20,2 L 142,2 C 158,2 162,37 200,37 C 238,37 242,2 258,2 L 380,2 Q 398,2 398,20"
                fill="none"
                stroke="url(#forgotPassTopAmbientSheen)"
                strokeWidth="5"
                strokeLinecap="round"
              />
              <path
                d="M 1,64 L 1,20 Q 1,1 20,1 L 142,1 C 158,1 162,37 200,37 C 238,37 242,1 258,1 L 380,1 Q 399,1 399,20 L 399,64"
                fill="none"
                stroke="rgba(245, 158, 11, 0.75)"
                strokeWidth="2"
              />
              <path
                d="M 1,20 Q 1,1 20,1 L 142,1 C 158,1 162,37 200,37 C 238,37 242,1 258,1 L 380,1 Q 399,1 399,20"
                fill="none"
                stroke="url(#forgotPassTopGoldCrest)"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>

            {/* Centered Logo Badge */}
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 z-20">
              <Logo size={110} className="mb-0 drop-shadow-[0_10px_20px_rgba(0,0,0,0.9)]" />
            </div>

            {/* Dismiss 'X' Button */}
            <button
              type="button"
              onClick={onClose}
              className="absolute top-2 right-2 rounded-xl border border-amber-400/30 bg-black/40 p-2 text-amber-200 hover:bg-black/60 hover:text-white transition-all cursor-pointer z-30"
              aria-label="Close modal"
            >
              <AppIcon icon={Xmark} size="sm" color="inherit" />
            </button>
          </div>

          {/* Card Body - Vibrant PUP Brand Maroon matching System Aesthetic */}
          <section className="relative rounded-b-[1.75rem] sm:rounded-b-[2rem] border-x-2 border-b-2 border-amber-400/80 bg-gradient-to-b from-[#680000] via-[#5e0000] to-[#4d0000] p-6 pt-7 sm:p-8 sm:pt-8 backdrop-blur-xl text-[#fff8e7]">
            <div className="mt-1 mb-5 sm:mb-6 text-center">
              <h2 className="text-2xl sm:text-3xl font-black tracking-wider text-amber-300 uppercase mb-1 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                Reset Password
              </h2>
              <div className="mx-auto my-2.5 h-0.5 w-14 rounded-full bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
              <p className="text-amber-100/90 text-xs sm:text-sm font-medium tracking-wide leading-relaxed max-w-[320px] mx-auto">
                Enter your institutional email address to receive a secure password recovery link.
              </p>
            </div>

            <form className="space-y-5" onSubmit={handleSendResetLink}>
              <div className="space-y-1.5 text-left">
                <label
                  htmlFor="reset-email"
                  className="text-[11px] uppercase font-bold tracking-wider text-amber-300 flex items-center gap-1.5"
                >
                  <AppIcon icon={Mail} size="sm" color="active" />
                  <span>Institutional Email Address</span>
                </label>
                <div className="relative flex items-center">
                  <input
                    id="reset-email"
                    type="email"
                    name="email"
                    autoComplete="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                    placeholder="e.g. faculty@pup.edu.ph"
                    className="pup-login-input w-full rounded-xl border !border-amber-500/40 !bg-[#2b0000] px-4 py-3 text-xs sm:text-sm !text-amber-50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6),0_1px_0_rgba(255,215,0,0.12)] outline-none transition-all duration-200 placeholder:!text-amber-200/40 hover:!border-amber-400/80 focus:!border-amber-400 focus:!ring-1 focus:!ring-amber-400/50"
                  />
                </div>
              </div>

              <div className="flex gap-2.5 pt-1">
                <Button
                  type="button"
                  onClick={onClose}
                  className="h-11 sm:h-12 flex-1 rounded-2xl border border-amber-400/30 bg-black/30 text-amber-200 font-extrabold uppercase text-xs tracking-wider hover:bg-black/50 hover:text-white transition-all cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSendingReset}
                  className="h-11 sm:h-12 flex-1 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 font-extrabold text-[#3d0000] tracking-widest uppercase text-xs transition-all duration-300 hover:from-amber-300 hover:to-amber-400 active:scale-95 cursor-pointer shadow-md shadow-black/30 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSendingReset ? (
                    <>
                      <AppIcon
                        icon={SystemRestart}
                        size="sm"
                        color="inherit"
                        className="animate-spin"
                      />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <span>Send Link</span>
                      <AppIcon icon={NavArrowRight} size="sm" color="inherit" />
                    </>
                  )}
                </Button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </>
  );
}
