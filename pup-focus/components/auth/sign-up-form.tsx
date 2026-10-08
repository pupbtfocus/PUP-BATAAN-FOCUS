"use client";

import { useState, useRef, useEffect, type FormEvent } from "react";
import Link from "next/link";
import { Turnstile, type TurnstileInstance } from "@/components/auth/turnstile";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { isValidEmailAddress } from "@/lib/validation/email";
import { AppIcon } from "@/components/ui/app-icon";
import { AlertPopup } from "@/components/ui/alert-popup";
import {
  Eye,
  EyeClosed,
  Lock,
  Mail,
  NavArrowRight,
  SystemRestart,
  User,
  WarningTriangle,
} from "iconoir-react";

export function SignUpForm() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const turnstileRef = useRef<TurnstileInstance | null>(null);
  const pendingSignUpRef = useRef<{
    fullName: string;
    email: string;
    password: string;
  } | null>(null);
  const latestSignUpRef = useRef({ fullName, email, password });

  useEffect(() => {
    latestSignUpRef.current = { fullName, email, password };
  });

  const handleKeyUp = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setIsCapsLockOn(e.getModifierState("CapsLock"));
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setToast(null);

    const normalizedEmail = email.trim().toLowerCase();
    const cleanFullName = fullName.trim();

    if (!cleanFullName) {
      setToast({ type: "error", message: "Please enter your full name." });
      return;
    }

    if (!isValidEmailAddress(normalizedEmail)) {
      setToast({ type: "error", message: "Please enter a valid institutional email address." });
      return;
    }

    if (password.length < 8) {
      setToast({ type: "error", message: "Password must be at least 8 characters long." });
      return;
    }

    if (password !== confirmPassword) {
      setToast({ type: "error", message: "Password confirmation does not match." });
      return;
    }

    if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !captchaToken) {
      setToast({
        type: "error",
        message: "Please complete the security check before signing up.",
      });
      return;
    }

    pendingSignUpRef.current = {
      fullName: cleanFullName,
      email: normalizedEmail,
      password,
    };

    setIsSubmitting(true);
    await performSignUp(captchaToken || undefined);
  }

  function handleTurnstileSuccess(token: string) {
    setCaptchaToken(token);
  }

  function handleTurnstileError(err?: unknown) {
    setIsSubmitting(false);
    setCaptchaToken(null);
    pendingSignUpRef.current = null;
    turnstileRef.current?.reset();
    const isDomainNotAllowed = String(err) === "110200";
    setToast({
      type: "error",
      message: isDomainNotAllowed
        ? "Turnstile domain not allowed (110200). Add 'localhost' to Cloudflare Allowed Domains or use testing sitekey in .env.local."
        : "Security verification challenge failed. Please try again.",
    });
  }

  async function performSignUp(token?: string) {
    const creds = pendingSignUpRef.current ?? {
      fullName: latestSignUpRef.current.fullName.trim(),
      email: latestSignUpRef.current.email.trim().toLowerCase(),
      password: latestSignUpRef.current.password,
    };
    const normalizedEmail = creds.email;
    const currentPassword = creds.password;
    const currentFullName = creds.fullName;

    try {
      const supabase = createClient();
      console.log("[SignUp] Attempting signUp for:", normalizedEmail, { hasCaptcha: Boolean(token) });
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password: currentPassword,
        options: {
          captchaToken: token || undefined,
          data: {
            full_name: currentFullName,
          },
        },
      });

      if (error) {
        console.error("[SignUp] Supabase signUp error:", error.message, error);
        setToast({
          type: "error",
          message: error.message || "Failed to create account. Please try again.",
        });
        return;
      }

      if (data?.user) {
        console.log("[SignUp] User successfully registered:", data.user.id);
        setToast({
          type: "success",
          message: "Registration successful! Please check your email to confirm your account.",
        });
        setFullName("");
        setEmail("");
        setPassword("");
        setConfirmPassword("");
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred during registration.";
      console.error("[SignUp] Unexpected signUp exception:", message, err);
      setToast({ type: "error", message });
    } finally {
      setIsSubmitting(false);
      turnstileRef.current?.reset();
      setCaptchaToken(null);
      pendingSignUpRef.current = null;
    }
  }

  return (
    <>
      {toast && (
        <AlertPopup
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
          position="top-right"
          autoCloseMs={6000}
        />
      )}

      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        {/* Full Name */}
        <div className="space-y-1 text-left">
          <label
            htmlFor="signup-fullname"
            className="text-[11px] uppercase font-bold tracking-wider text-amber-300 flex items-center gap-1.5"
          >
            <AppIcon icon={User} size="sm" color="active" />
            <span>Full Name</span>
          </label>
          <input
            id="signup-fullname"
            type="text"
            name="fullName"
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            placeholder="e.g. Juan Dela Cruz"
            className="pup-login-input w-full rounded-xl border !border-amber-500/40 !bg-[#2b0000] px-4 py-2.5 text-xs sm:text-sm !text-amber-50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6),0_1px_0_rgba(255,215,0,0.12)] outline-none transition-all duration-200 placeholder:!text-amber-200/40 hover:!border-amber-400/80 focus:!border-amber-400 focus:!ring-1 focus:!ring-amber-400/50"
          />
        </div>

        {/* Email */}
        <div className="space-y-1 text-left">
          <label
            htmlFor="signup-email"
            className="text-[11px] uppercase font-bold tracking-wider text-amber-300 flex items-center gap-1.5"
          >
            <AppIcon icon={Mail} size="sm" color="active" />
            <span>Institutional Email Address</span>
          </label>
          <input
            id="signup-email"
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="e.g. faculty@pup.edu.ph"
            className="pup-login-input w-full rounded-xl border !border-amber-500/40 !bg-[#2b0000] px-4 py-2.5 text-xs sm:text-sm !text-amber-50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6),0_1px_0_rgba(255,215,0,0.12)] outline-none transition-all duration-200 placeholder:!text-amber-200/40 hover:!border-amber-400/80 focus:!border-amber-400 focus:!ring-1 focus:!ring-amber-400/50"
          />
        </div>

        {/* Password */}
        <div className="space-y-1 text-left">
          <label
            htmlFor="signup-password"
            className="text-[11px] uppercase font-bold tracking-wider text-amber-300 flex items-center gap-1.5"
          >
            <AppIcon icon={Lock} size="sm" color="active" />
            <span>Password (min. 8 characters)</span>
          </label>
          <div className="relative flex items-center">
            <input
              id="signup-password"
              type={showPassword ? "text" : "password"}
              name="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyUp={handleKeyUp}
              required
              placeholder="••••••••"
              className="pup-login-input w-full rounded-xl border !border-amber-500/40 !bg-[#2b0000] px-4 py-2.5 pr-10 text-xs sm:text-sm !text-amber-50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6),0_1px_0_rgba(255,215,0,0.12)] outline-none transition-all duration-200 placeholder:!text-amber-200/40 hover:!border-amber-400/80 focus:!border-amber-400 focus:!ring-1 focus:!ring-amber-400/50"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 !text-amber-400/80 hover:!text-amber-300 transition-colors cursor-pointer"
            >
              {showPassword ? (
                <AppIcon icon={EyeClosed} size="sm" color="inherit" />
              ) : (
                <AppIcon icon={Eye} size="sm" color="inherit" />
              )}
            </button>
          </div>
          {isCapsLockOn && (
            <p className="ml-1 mt-0.5 flex items-center gap-1 text-[11px] text-amber-300 font-medium">
              <AppIcon icon={WarningTriangle} size="xs" color="inherit" />
              <span>Caps Lock is ON</span>
            </p>
          )}
        </div>

        {/* Confirm Password */}
        <div className="space-y-1 text-left">
          <label
            htmlFor="signup-confirm-password"
            className="text-[11px] uppercase font-bold tracking-wider text-amber-300 flex items-center gap-1.5"
          >
            <AppIcon icon={Lock} size="sm" color="active" />
            <span>Confirm Password</span>
          </label>
          <div className="relative flex items-center">
            <input
              id="signup-confirm-password"
              type={showConfirmPassword ? "text" : "password"}
              name="confirmPassword"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="pup-login-input w-full rounded-xl border !border-amber-500/40 !bg-[#2b0000] px-4 py-2.5 pr-10 text-xs sm:text-sm !text-amber-50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6),0_1px_0_rgba(255,215,0,0.12)] outline-none transition-all duration-200 placeholder:!text-amber-200/40 hover:!border-amber-400/80 focus:!border-amber-400 focus:!ring-1 focus:!ring-amber-400/50"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 !text-amber-400/80 hover:!text-amber-300 transition-colors cursor-pointer"
            >
              {showConfirmPassword ? (
                <AppIcon icon={EyeClosed} size="sm" color="inherit" />
              ) : (
                <AppIcon icon={Eye} size="sm" color="inherit" />
              )}
            </button>
          </div>
        </div>

        {/* Turnstile Widget */}
        {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
          <div className="flex justify-center my-3 min-h-[65px] items-center">
            <Turnstile
              ref={turnstileRef}
              siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
              onSuccess={handleTurnstileSuccess}
              onExpire={handleTurnstileError}
              onError={handleTurnstileError}
              options={{
                theme: "dark",
                size: "normal",
                execution: "render",
              }}
            />
          </div>
        )}

        {/* Submission Button */}
        <Button
          type="submit"
          disabled={isSubmitting || (Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) && !captchaToken)}
          className="mt-3 h-12 w-full rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-500 font-black text-[#3d0000] tracking-widest uppercase text-sm sm:text-base transition-all duration-300 hover:from-amber-300 hover:to-amber-400 active:scale-[0.98] cursor-pointer shadow-lg shadow-black/50 hover:shadow-black/60 border border-amber-300/30 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <AppIcon icon={SystemRestart} size="sm" color="inherit" className="animate-spin" />
              <span>Creating Account...</span>
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <span>Sign Up</span>
              <AppIcon icon={NavArrowRight} size="sm" color="inherit" />
            </span>
          )}
        </Button>

        {/* Back to Sign In Link */}
        <div className="text-center pt-2">
          <p className="text-xs text-amber-200/80">
            Already have an account?{" "}
            <Link
              href="/"
              className="text-amber-300 hover:text-amber-100 font-bold underline underline-offset-2 transition-colors"
            >
              Sign In
            </Link>
          </p>
        </div>
      </form>
    </>
  );
}
