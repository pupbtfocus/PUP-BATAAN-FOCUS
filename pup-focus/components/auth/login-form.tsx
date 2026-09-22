"use client";

import { useState, type FormEvent } from "react";
import { LazyLottie } from "@/components/ui/lazy-lottie";
import { Button } from "@/components/ui/button";
import loadingAnimation from "@/assets/icons animations/lottieflow-loading-08-000000-easey.json";
import { Check, CheckCircle, Eye, EyeClosed, Hourglass, Lock, Mail, WarningCircle, WarningTriangle } from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";

export interface NoticeBanner {
  type: "timeout" | "error" | "success" | "info";
  message: string;
}

interface LoginFormProps {
  email: string;
  setEmail: (email: string) => void;
  password: string;
  setPassword: (password: string) => void;
  rememberMe?: boolean;
  setRememberMe?: (remember: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onOpenForgotPassword: () => void;
  isSubmitting: boolean;
  isPending?: boolean;
  error?: string | null;
  notice?: NoticeBanner | null;
  publicEnvConfigured: boolean;
}

export function LoginForm({
  email,
  setEmail,
  password,
  setPassword,
  rememberMe = false,
  setRememberMe,
  onSubmit,
  onOpenForgotPassword,
  isSubmitting,
  isPending,
  error,
  notice,
  publicEnvConfigured,
}: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);
  const [internalRememberMe, setInternalRememberMe] = useState(false);

  const activeRememberMe = setRememberMe ? rememberMe : internalRememberMe;
  const handleToggleRememberMe = (checked: boolean) => {
    if (setRememberMe) {
      setRememberMe(checked);
    } else {
      setInternalRememberMe(checked);
    }
  };

  const isLoading = isSubmitting || Boolean(isPending);

  return (
    <>
      <style>{`
        .pup-login-input {
          background-color: #660000 !important;
          color: #fff7ed !important;
          -webkit-text-fill-color: #fff7ed !important;
          caret-color: #f59e0b !important;
          color-scheme: dark;
        }

        .pup-login-input::placeholder,
        .pup-login-input::-webkit-input-placeholder {
          color: rgba(254, 240, 138, 0.55) !important;
          -webkit-text-fill-color: rgba(254, 240, 138, 0.55) !important;
          opacity: 1 !important;
        }

        .pup-login-input::selection {
          background-color: #800000 !important;
          color: #fef3c7 !important;
          -webkit-text-fill-color: #fef3c7 !important;
        }

        .pup-login-input::-ms-reveal,
        .pup-login-input::-ms-clear {
          display: none !important;
        }

        .pup-login-input:-webkit-autofill,
        .pup-login-input:-webkit-autofill:hover,
        .pup-login-input:-webkit-autofill:focus,
        .pup-login-input:-webkit-autofill:active,
        .dark .pup-login-input:-webkit-autofill,
        .dark .pup-login-input:-webkit-autofill:hover,
        .dark .pup-login-input:-webkit-autofill:focus,
        .dark .pup-login-input:-webkit-autofill:active,
        .pup-login-input:autofill,
        .pup-login-input:autofill:hover,
        .pup-login-input:autofill:focus,
        .pup-login-input:autofill:active,
        .dark .pup-login-input:autofill,
        .dark .pup-login-input:autofill:hover,
        .dark .pup-login-input:autofill:focus,
        .dark .pup-login-input:autofill:active {
          -webkit-box-shadow: 0 0 0 1000px #660000 inset !important;
          box-shadow: 0 0 0 1000px #660000 inset !important;
          -webkit-text-fill-color: #fff7ed !important;
          caret-color: #f59e0b !important;
          color: #fff7ed !important;
          background-color: #660000 !important;
          transition: background-color 999999s ease-in-out 0s !important;
        }

        .pup-login-input:-webkit-autofill::first-line,
        .dark .pup-login-input:-webkit-autofill::first-line {
          color: #fff7ed !important;
          -webkit-text-fill-color: #fff7ed !important;
        }

        .pup-login-input:-moz-autofill,
        .pup-login-input:-moz-autofill:focus,
        .dark .pup-login-input:-moz-autofill,
        .dark .pup-login-input:-moz-autofill:focus {
          box-shadow: 0 0 0 1000px #660000 inset !important;
          background-color: #660000 !important;
          color: #fff7ed !important;
          -webkit-text-fill-color: #fff7ed !important;
        }
      `}</style>

      {!publicEnvConfigured ? (
        <div className="mt-4 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and
          NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local before using sign in.
        </div>
      ) : null}

      <form className="mt-3 space-y-2.5" onSubmit={onSubmit}>
        {/* Universal Alert Banner */}
        {notice ? (
          <div
            className={`rounded-xl p-3 text-xs flex items-start gap-2.5 border transition-all ${
              notice.type === "timeout"
                ? "bg-amber-500/15 border-amber-500/30 text-amber-200"
                : notice.type === "success"
                ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-200"
                : "bg-rose-500/15 border-rose-500/30 text-rose-200"
            }`}
          >
            {notice.type === "timeout" ? (
              <AppIcon icon={Hourglass} size="md" color="active" className="mt-0.5" />
            ) : notice.type === "success" ? (
              <AppIcon icon={CheckCircle} size="md" color="success" className="mt-0.5" />
            ) : (
              <AppIcon icon={WarningCircle} size="md" color="danger" className="mt-0.5" />
            )}
            <span className="leading-relaxed font-medium">{notice.message}</span>
          </div>
        ) : error ? (
          <div className="rounded-xl p-3 text-xs flex items-start gap-2.5 border bg-rose-500/15 border-rose-500/30 text-rose-200 transition-all">
            <AppIcon icon={WarningCircle} size="md" color="danger" className="mt-0.5" />
            <span className="leading-relaxed font-medium">{error}</span>
          </div>
        ) : null}

        <div className="space-y-1">
          <label
            className="ml-1 block text-[10px] font-bold uppercase tracking-widest text-[#f3d9b3]/85"
            htmlFor="email"
          >
            Email Address
          </label>
          <div className="relative flex items-center">
            <AppIcon
              icon={Mail}
              size="md"
              color="inherit"
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 !text-amber-400/80 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
            />
            <input
              id="email"
              type="email"
              name="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              placeholder="faculty@pup.edu.ph"
              className="pup-login-input w-full rounded-xl border !border-amber-400/50 !bg-[#660000] pl-10 pr-4 py-2.5 text-sm !text-amber-50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3),0_1px_0_rgba(255,215,0,0.15)] outline-none transition-all duration-200 placeholder:!text-amber-200/50 hover:!border-amber-400 focus:!border-amber-400 focus:!ring-1 focus:!ring-amber-400/50"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label
            className="ml-1 block text-[10px] font-bold uppercase tracking-widest text-[#f3d9b3]/85"
            htmlFor="password"
          >
            Password
          </label>
          <div className="relative flex items-center">
            <AppIcon
              icon={Lock}
              size="md"
              color="inherit"
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 !text-amber-400/80 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
            />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) =>
                setIsCapsLockOn(event.getModifierState("CapsLock"))
              }
              onKeyUp={(event) =>
                setIsCapsLockOn(event.getModifierState("CapsLock"))
              }
              onFocus={(event) => {
                const nativeEv = event.nativeEvent as any;
                if (typeof nativeEv?.getModifierState === "function") {
                  setIsCapsLockOn(
                    Boolean(nativeEv.getModifierState("CapsLock")),
                  );
                }
              }}
              onBlur={() => setIsCapsLockOn(false)}
              required
              placeholder="Your password"
              className="pup-login-input w-full rounded-xl border !border-amber-400/50 !bg-[#660000] pl-10 pr-12 py-2.5 text-sm !text-amber-50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3),0_1px_0_rgba(255,215,0,0.15)] outline-none transition-all duration-200 placeholder:!text-amber-200/50 hover:!border-amber-400 focus:!border-amber-400 focus:!ring-1 focus:!ring-amber-400/50"
            />

            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 !text-amber-400/80 hover:!text-amber-300 transition-colors cursor-pointer"
            >
              {showPassword ? (
                <AppIcon icon={EyeClosed} size="md" color="inherit" strokeWidth={2.2} />
              ) : (
                <AppIcon icon={Eye} size="md" color="inherit" strokeWidth={2.2} />
              )}
            </button>
          </div>
          {isCapsLockOn && (
            <p className="ml-1 mt-1 flex items-center gap-1.5 text-xs text-amber-300 font-medium">
              <AppIcon icon={WarningTriangle} size="sm" color="inherit" />
              <span>Caps Lock is ON</span>
            </p>
          )}
        </div>

        {/* Remember me & Forgot password row */}
        <div className="flex items-center justify-between mt-1 mb-3 text-xs">
          <label className="flex items-center gap-2 cursor-pointer group select-none">
            <div className="relative flex items-center justify-center">
              <input
                type="checkbox"
                id="remember-me"
                name="remember-me"
                checked={activeRememberMe}
                onChange={(e) => handleToggleRememberMe(e.target.checked)}
                className="sr-only"
              />
              <div
                className={`w-4 h-4 rounded border transition-all flex items-center justify-center shadow-xs ${
                  activeRememberMe
                    ? "bg-amber-500 border-amber-400 shadow-xs"
                    : "bg-[#660000] border-amber-400/60 group-hover:border-amber-400 shadow-inner"
                }`}
              >
                {activeRememberMe && (
                  <AppIcon icon={Check} size="xs" color="inherit" className="text-[#360000] stroke-[3.5] transition-transform duration-150 scale-100" />
                )}
              </div>
            </div>
            <span className="text-amber-200/80 group-hover:text-amber-100 text-xs transition-colors">
              Remember me
            </span>
          </label>
          <button
            type="button"
            onClick={onOpenForgotPassword}
            className="text-amber-400 hover:text-amber-300 font-medium transition-colors cursor-pointer"
          >
            Forgot Password?
          </button>
        </div>

        <Button
          className="mt-6 h-12 sm:h-13 w-full rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-500 font-black text-[#3d0000] tracking-widest uppercase text-sm sm:text-base transition-all duration-300 hover:from-amber-300 hover:to-amber-400 active:scale-[0.98] cursor-pointer shadow-lg shadow-black/50 hover:shadow-black/60 border border-amber-300/30 flex items-center justify-center gap-2"
          type="submit"
          disabled={isLoading}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2 text-sm sm:text-base font-black">
              <LazyLottie
                animationData={loadingAnimation}
                loop={true}
                autoplay
                className="h-6 w-6"
              />
              Signing in...
            </span>
          ) : (
            "Sign In"
          )}
        </Button>
      </form>
    </>
  );
}
