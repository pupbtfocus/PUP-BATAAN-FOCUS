"use client";

import { useEffect, useState, type FormEvent } from "react";
import Lottie from "lottie-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { isValidEmailAddress } from "@/lib/validation/email";
import successCheckAnimation from "@/assets/icons animations/lottieflow-checkbox-06-000000-easey.json";
import loadingAnimation from "@/assets/icons animations/lottieflow-loading-08-000000-easey.json";

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
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setResetEmail(initialEmail);
      setResetSuccess(false);
      setResetError(null);
      setIsSendingReset(false);
    }
  }, [isOpen, initialEmail]);

  if (!isOpen) {
    return null;
  }

  async function handleSendResetLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResetError(null);
    setResetSuccess(false);

    const normalizedResetEmail = resetEmail.trim().toLowerCase();

    if (!isValidEmailAddress(normalizedResetEmail)) {
      setResetError("Please enter a valid email address.");
      return;
    }

    setIsSendingReset(true);

    try {
      const supabase = createClient();
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(
        normalizedResetEmail,
        {
          redirectTo: `${window.location.origin}/auth/change-password`,
        },
      );

      if (resetErr) {
        setResetError(resetErr.message);
      } else {
        setResetSuccess(true);
      }
    } catch (err: any) {
      setResetError(
        err?.message || "Failed to send password reset email.",
      );
    } finally {
      setIsSendingReset(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-sm rounded-[2rem] border border-[rgba(255,215,0,0.2)] bg-[#4d0000]/95 p-8 text-[#fff8e7] backdrop-blur-md shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-xl bg-white/5 p-2 text-amber-100/70 backdrop-blur-md transition-all hover:bg-white/10 hover:text-white cursor-pointer"
          aria-label="Close modal"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className="text-center">
          <h3 className="text-xl font-bold uppercase tracking-[0.2em] text-[#ffd700]">
            Reset Password
          </h3>
          <p className="mt-2 text-xs text-[#f3d9b3]/80">
            Enter your institutional email address to receive a link to reset your password.
          </p>
        </div>

        {resetSuccess ? (
          <div className="mt-6 flex flex-col items-center text-center gap-3">
            <div className="relative flex h-14 w-14 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-400/10">
              <Lottie
                animationData={successCheckAnimation}
                loop={false}
                autoplay
                className="relative z-10 h-12 w-12"
              />
            </div>
            <p className="text-sm font-medium text-emerald-300">
              Password reset email sent! Please check your inbox.
            </p>
            <Button
              type="button"
              className="mt-4 h-11 w-full rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 font-extrabold text-[#3d0000] tracking-widest uppercase text-xs transition-all hover:from-amber-300 hover:to-amber-400 active:scale-95 cursor-pointer"
              onClick={onClose}
            >
              Done
            </Button>
          </div>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={handleSendResetLink}>
            <div className="space-y-1.5">
              <label
                className="ml-1 block text-[10px] font-bold uppercase tracking-widest text-[#f3d9b3]/65"
                htmlFor="reset-email"
              >
                Email Address
              </label>
              <input
                id="reset-email"
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
                placeholder="faculty@pup.edu.ph"
                className="w-full rounded-2xl border border-[rgba(255,215,0,0.2)] bg-black/20 px-4 py-3.5 text-sm text-white shadow-inner outline-none ring-amber-400/50 backdrop-blur-sm transition-all duration-300 placeholder:text-amber-200/20 hover:border-[rgba(255,215,0,0.4)] focus:bg-black/40 focus:ring-2"
              />
            </div>

            {resetError ? (
              <p className="text-xs text-rose-300">{resetError}</p>
            ) : null}

            <div className="mt-6 flex gap-2">
              <Button
                type="button"
                variant="ghost"
                className="h-11 flex-1 rounded-2xl border border-white/10 text-amber-100/70 hover:bg-white/5 hover:text-white cursor-pointer"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSendingReset}
                className="h-11 flex-1 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 font-extrabold text-[#3d0000] tracking-widest uppercase text-xs transition-all duration-300 hover:from-amber-300 hover:to-amber-400 active:scale-95 cursor-pointer"
              >
                {isSendingReset ? (
                  <span className="flex items-center justify-center gap-2">
                    <Lottie
                      animationData={loadingAnimation}
                      loop={true}
                      autoplay
                      className="h-4 w-4"
                    />
                    Sending...
                  </span>
                ) : (
                  "Send Link"
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
