"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Turnstile, type TurnstileInstance } from "@/components/auth/turnstile";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { isValidEmailAddress } from "@/lib/validation/email";
import { AppIcon } from "@/components/ui/app-icon";
import { AlertPopup } from "@/components/ui/alert-popup";
import { Lock, Mail, NavArrowRight, SystemRestart } from "iconoir-react";

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
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance | null>(null);
  const pendingResetEmailRef = useRef<string | null>(null);
  const latestResetEmailRef = useRef(resetEmail);

  useEffect(() => {
    latestResetEmailRef.current = resetEmail;
  });

  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setResetEmail(initialEmail);
      latestResetEmailRef.current = initialEmail;
      setToast(null);
      setIsSendingReset(false);
      setCaptchaToken(null);
      pendingResetEmailRef.current = null;
      turnstileRef.current?.reset();
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

    if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !captchaToken) {
      setToast({
        type: "error",
        message: "Please complete the security check before requesting a reset link.",
      });
      return;
    }

    pendingResetEmailRef.current = normalizedResetEmail;
    setIsSendingReset(true);
    await performSendReset(captchaToken || undefined);
  }

  function handleTurnstileSuccess(token: string) {
    setCaptchaToken(token);
  }

  function handleTurnstileError(err?: unknown) {
    setIsSendingReset(false);
    setCaptchaToken(null);
    pendingResetEmailRef.current = null;
    turnstileRef.current?.reset();
    const isDomainNotAllowed = String(err) === "110200";
    setToast({
      type: "error",
      message: isDomainNotAllowed
        ? "Turnstile domain not allowed (110200). Add 'localhost' to Cloudflare Allowed Domains or use testing sitekey in .env.local."
        : "Security verification challenge failed. Please try again.",
    });
  }

  async function performSendReset(token?: string) {
    const normalizedResetEmail = (pendingResetEmailRef.current ?? latestResetEmailRef.current).trim().toLowerCase();

    try {
      // 1. Try sending via server API route (bypasses Supabase client rate limits and sends branded email)
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizedResetEmail,
          captchaToken: token,
          "cf-turnstile-response": token,
        }),
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
        console.error("[ForgotPassword] API route failed:", rawMsg);
        if (
          res.status === 403 ||
          rawMsg.toLowerCase().includes("security verification") ||
          rawMsg.toLowerCase().includes("invalid-input-secret")
        ) {
          setToast({
            type: "error",
            message: rawMsg,
          });
          return;
        }
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
              captchaToken: token || undefined,
            });

          if (fallbackErr) {
            console.error("[ForgotPassword] Supabase fallback error:", fallbackErr.message, fallbackErr);
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
            } else if (fallbackMsg.toLowerCase().includes("invalid-input-secret")) {
              setToast({
                type: "error",
                message:
                  "Cloudflare Turnstile Secret Key mismatch in Supabase Dashboard (Authentication > Attack Protection > Captcha). Please update it with your matching Secret Key.",
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
      turnstileRef.current?.reset();
      setCaptchaToken(null);
      pendingResetEmailRef.current = null;
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
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="relative w-full max-w-[400px] sm:max-w-[420px] mx-auto animate-in zoom-in-95 duration-200">
          {/* Main Card Container */}
          <section className="relative rounded-2xl border border-amber-400/40 bg-[#800000] p-6 sm:p-7 text-[#fff8e7] shadow-2xl">
            {/* Header with Centered Lock Badge */}
            <div className="mb-5 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-400/15 border border-amber-400/40 text-amber-300">
                <AppIcon icon={Lock} size="md" color="inherit" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-wider text-amber-300 uppercase mb-1">
                Reset Password
              </h2>
              <p className="text-amber-100/85 text-xs sm:text-sm font-medium leading-relaxed max-w-[320px] mx-auto mt-2">
                Enter your institutional email address to receive a secure password recovery link.
              </p>
            </div>

            <form className="space-y-4" onSubmit={handleSendResetLink}>
              <div className="space-y-1.5 text-left">
                <label
                  htmlFor="reset-email"
                  className="text-[11px] uppercase font-bold tracking-wider text-amber-300 flex items-center gap-1.5"
                >
                  <AppIcon icon={Mail} size="sm" color="inherit" className="!text-amber-300" />
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
                    className="pup-login-input w-full rounded-xl border border-amber-400/50 bg-[#630000] px-4 py-2.5 text-xs sm:text-sm text-amber-50 outline-none transition placeholder:text-amber-200/50 focus:border-amber-400 focus:ring-1 focus:ring-amber-400/50"
                  />
                </div>
              </div>

              {/* Turnstile Widget */}
              {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
                <div className="flex justify-center my-2 min-h-[65px] items-center">
                  <input
                    type="hidden"
                    name="cf-turnstile-response"
                    value={captchaToken ?? ""}
                  />
                  <Turnstile
                    ref={turnstileRef}
                    siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
                    onSuccess={handleTurnstileSuccess}
                    onExpire={handleTurnstileError}
                    onError={handleTurnstileError}
                    options={{
                      theme: "dark",
                      size: "normal",
                      action: "forgot-password",
                      execution: "render",
                    }}
                  />
                </div>
              )}

              <div className="flex gap-2.5 pt-1">
                <Button
                  type="button"
                  onClick={onClose}
                  className="h-11 flex-1 rounded-xl border border-amber-400/50 bg-[#630000] hover:bg-amber-400 hover:text-[#500000] text-amber-200 font-bold uppercase text-xs tracking-wider transition-all cursor-pointer shadow-sm active:scale-95"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSendingReset || (Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) && !captchaToken)}
                  className="h-11 flex-1 rounded-xl bg-amber-400 hover:bg-amber-300 font-extrabold text-[#3d0000] tracking-wider uppercase text-xs transition-all active:scale-95 cursor-pointer shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
