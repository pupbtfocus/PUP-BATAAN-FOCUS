"use client";

import { useState, type FormEvent } from "react";
import Lottie from "lottie-react";
import { Button } from "@/components/ui/button";
import loadingAnimation from "@/assets/icons animations/lottieflow-loading-08-000000-easey.json";
import { Clock, AlertCircle, CheckCircle2 } from "lucide-react";

export interface NoticeBanner {
  type: "timeout" | "error" | "success" | "info";
  message: string;
}

interface LoginFormProps {
  email: string;
  setEmail: (email: string) => void;
  password: string;
  setPassword: (password: string) => void;
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

  const isLoading = isSubmitting || Boolean(isPending);

  return (
    <>
      {!publicEnvConfigured ? (
        <div className="mt-4 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and
          NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local before using sign in.
        </div>
      ) : null}

      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        {/* Universal Alert Banner */}
        {notice ? (
          <div
            className={`rounded-xl p-3.5 text-xs flex items-start gap-2.5 border transition-all ${
              notice.type === "timeout"
                ? "bg-amber-500/15 border-amber-400/30 text-amber-200"
                : notice.type === "success"
                ? "bg-emerald-500/15 border-emerald-400/30 text-emerald-200"
                : "bg-rose-500/15 border-rose-500/30 text-rose-200"
            }`}
          >
            {notice.type === "timeout" ? (
              <Clock className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            ) : notice.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
            )}
            <span className="leading-relaxed font-medium">{notice.message}</span>
          </div>
        ) : error ? (
          <div className="rounded-xl p-3.5 text-xs flex items-start gap-2.5 border bg-rose-500/15 border-rose-500/30 text-rose-200 transition-all">
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed font-medium">{error}</span>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <label
            className="ml-1 block text-[10px] font-bold uppercase tracking-widest text-[#f3d9b3]/65"
            htmlFor="email"
          >
            Email Address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            placeholder="faculty@pup.edu.ph"
            className="w-full rounded-2xl border border-[rgba(255,215,0,0.2)] bg-black/20 px-4 py-3.5 text-sm text-white shadow-inner outline-none ring-amber-400/50 backdrop-blur-sm transition-all duration-300 placeholder:text-amber-200/20 hover:border-[rgba(255,215,0,0.4)] focus:bg-black/40 focus:ring-2"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              className="ml-1 block text-[10px] font-bold uppercase tracking-widest text-[#f3d9b3]/65"
              htmlFor="password"
            >
              Password
            </label>
            <button
              type="button"
              onClick={onOpenForgotPassword}
              className="text-[10px] font-semibold text-amber-300/80 hover:text-amber-200 hover:underline transition-colors"
            >
              Forgot Password?
            </button>
          </div>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
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
              className="w-full rounded-2xl border border-[rgba(255,215,0,0.2)] bg-black/20 px-4 py-3.5 pr-12 text-sm text-white shadow-inner outline-none ring-amber-400/50 backdrop-blur-sm transition-all duration-300 placeholder:text-amber-200/20 hover:border-[rgba(255,215,0,0.4)] focus:bg-black/40 focus:ring-2"
            />

            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-white/5 p-2 text-amber-100/70 backdrop-blur-md transition-all hover:bg-white/10 hover:text-white"
            >
              {showPassword ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="#fff"
                  aria-hidden
                >
                  <g clipPath="url(#clip0_4418_8295)">
                    <path
                      d="M21.25 9.14969C18.94 5.51969 15.56 3.42969 12 3.42969C10.22 3.42969 8.49 3.94969 6.91 4.91969C5.33 5.89969 3.91 7.32969 2.75 9.14969C1.75 10.7197 1.75 13.2697 2.75 14.8397C5.06 18.4797 8.44 20.5597 12 20.5597C13.78 20.5597 15.51 20.0397 17.09 19.0697C18.67 18.0897 20.09 16.6597 21.25 14.8397C22.25 13.2797 22.25 10.7197 21.25 9.14969ZM12 16.0397C9.76 16.0397 7.96 14.2297 7.96 11.9997C7.96 9.76969 9.76 7.95969 12 7.95969C14.24 7.95969 16.04 9.76969 16.04 11.9997C16.04 14.2297 14.24 16.0397 12 16.0397Z"
                      fill="white"
                      style={{ fill: "var(--fillg)" }}
                    />
                    <path
                      d="M11.9999 9.14062C10.4299 9.14062 9.1499 10.4206 9.1499 12.0006C9.1499 13.5706 10.4299 14.8506 11.9999 14.8506C13.5699 14.8506 14.8599 13.5706 14.8599 12.0006C14.8599 10.4306 13.5699 9.14062 11.9999 9.14062Z"
                      fill="white"
                      style={{ fill: "var(--fillg)" }}
                    />
                  </g>
                  <defs>
                    <clipPath id="clip0_4418_8295">
                      <rect width="24" height="24" fill="white" />
                    </clipPath>
                  </defs>
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden
                >
                  <g clipPath="url(#clip0_4418_9538)">
                    <path
                      d="M14.53 9.46992L9.47004 14.5299C8.82004 13.8799 8.42004 12.9899 8.42004 11.9999C8.42004 10.0199 10.02 8.41992 12 8.41992C12.99 8.41992 13.88 8.81992 14.53 9.46992Z"
                      stroke="#fff"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M17.82 5.77047C16.07 4.45047 14.07 3.73047 12 3.73047C8.46997 3.73047 5.17997 5.81047 2.88997 9.41047C1.98997 10.8205 1.98997 13.1905 2.88997 14.6005C3.67997 15.8405 4.59997 16.9105 5.59997 17.7705"
                      stroke="#fff"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M8.42004 19.5297C9.56004 20.0097 10.77 20.2697 12 20.2697C15.53 20.2697 18.82 18.1897 21.11 14.5897C22.01 13.1797 22.01 10.8097 21.11 9.39969C20.78 8.87969 20.42 8.38969 20.05 7.92969"
                      stroke="#fff"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M15.5099 12.6992C15.2499 14.1092 14.0999 15.2592 12.6899 15.5192"
                      stroke="#fff"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M9.47 14.5293L2 21.9993"
                      stroke="#fff"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M22 2L14.53 9.47"
                      stroke="#fff"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </g>
                  <defs>
                    <clipPath id="clip0_4418_9538">
                      <rect width="24" height="24" fill="white" />
                    </clipPath>
                  </defs>
                </svg>
              )}
            </button>
          </div>
          {isCapsLockOn && (
            <p className="ml-1 mt-1 flex items-center gap-1.5 text-xs text-amber-300 font-medium">
              <span>⚠️</span>
              <span>Caps Lock is ON</span>
            </p>
          )}
        </div>

        <Button
          className="mt-6 h-13 w-full rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 font-black text-[#3d0000] tracking-widest uppercase text-sm sm:text-base transition-all duration-300 hover:from-amber-300 hover:to-amber-400 active:scale-95 cursor-pointer shadow-lg"
          type="submit"
          disabled={isLoading}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2 text-sm sm:text-base font-black">
              <Lottie
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
