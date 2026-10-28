"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Turnstile, type TurnstileInstance } from "@/components/auth/turnstile";
import { LazyLottie } from "@/components/ui/lazy-lottie";
import { Button } from "@/components/ui/button";
import loadingAnimation from "@/assets/icons animations/lottieflow-loading-08-000000-easey.json";
import { Check, CheckCircle, Eye, EyeClosed, Hourglass, Lock, Mail, PasteClipboard, WarningCircle, WarningTriangle } from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";

export interface NoticeBanner {
  type: "timeout" | "error" | "success" | "info";
  message: string;
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)));
}

export function parseCombinedCredentials(text: string): { email?: string; password?: string } | null {
  if (!text || typeof text !== "string") return null;
  const decoded = decodeHtmlEntities(text).trim();
  if (!decoded) return null;

  let parsedEmail: string | undefined;
  let parsedPassword: string | undefined;

  // 1. Search for email address anywhere in the text
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
  const emailMatch = decoded.match(emailRegex);
  if (emailMatch) {
    parsedEmail = emailMatch[1].trim();
  }

  // 2. Search for labeled password (handles both single line and multiline, with bullet, comma, or pipe separator)
  const passLabeledRegex = /(?:Temporary\s+Password|Temp\s+Password|New\s+Temp\s+Password|New\s+Temporary\s+Password|Password|Pass)\s*[:=-]\s*([^\r\n•|\t,]+)/i;
  const passMatch = decoded.match(passLabeledRegex);
  if (passMatch) {
    parsedPassword = passMatch[1].trim();
  }

  const lines = decoded.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  // 3. If password wasn't found via labeled separator, check if "Temporary Password" is on its own line followed by the password
  if (!parsedPassword) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^(?:Temporary\s+Password|Temp\s+Password|New\s+Temp\s+Password|Password|Pass)\s*[:=-]?$/i.test(line)) {
        for (let j = i + 1; j < lines.length; j++) {
          const next = lines[j];
          if (
            !/^(?:Copy\s+.*|Sign\s+in.*|Note:.*|Institutional\s+Email|Verified\s+Email|Email|Account)$/i.test(next) &&
            (!parsedEmail || !next.includes(parsedEmail))
          ) {
            parsedPassword = next.trim();
            break;
          }
        }
        if (parsedPassword) break;
      }
    }
  }

  // 4. If still not found and we have lines without labels, look for remaining non-email, non-UI text
  if (!parsedPassword && parsedEmail) {
    const isUiBoilerplate = (l: string) =>
      /^(?:Temporary\s+Credentials|Updated\s+Account\s+Credentials|Institutional\s+Email|Verified\s+Email|Email|Account|Username|Temporary\s+Password|Temp\s+Password|Password|Pass|Copy\s+.*|Sign\s+in.*|Note:.*)$/i.test(
        l
      );

    for (const line of lines) {
      if (!line.includes(parsedEmail) && !isUiBoilerplate(line)) {
        const cleaned = line.replace(/^(?:Temporary\s+Password|Temp\s+Password|Password|Pass)\s*[:=-]?\s*/i, "").trim();
        if (cleaned && !isUiBoilerplate(cleaned)) {
          parsedPassword = cleaned;
          break;
        }
      }
    }
  }

  // 5. Fallback for single line format: email:password or email|password
  if (!parsedPassword && lines.length === 1) {
    const singleLineMatch = decoded.match(/^([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\s*[:|,/]\s*(.+)$/);
    if (singleLineMatch) {
      parsedEmail = singleLineMatch[1].trim();
      parsedPassword = singleLineMatch[2].trim();
    }
  }

  if (parsedEmail) {
    parsedEmail = parsedEmail.replace(/^["'`]|["'`]$/g, "").trim();
  }
  if (parsedPassword) {
    parsedPassword = parsedPassword.replace(/^["'`]|["'`]$/g, "").trim();
  }

  if (parsedEmail || parsedPassword) {
    return { email: parsedEmail, password: parsedPassword };
  }

  return null;
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
  turnstileRef?: React.Ref<TurnstileInstance>;
  captchaToken?: string | null;
  onTurnstileSuccess?: (token: string) => void;
  onTurnstileExpire?: () => void;
  onTurnstileError?: (err?: unknown) => void;
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
  turnstileRef,
  captchaToken = null,
  onTurnstileSuccess,
  onTurnstileExpire,
  onTurnstileError,
}: LoginFormProps) {
  const emailInputRef = useRef<HTMLInputElement>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);
  const [internalRememberMe, setInternalRememberMe] = useState(false);
  const [pastedState, setPastedState] = useState<"idle" | "success" | "no-credentials">("idle");

  const applyCredentials = (text: string): boolean => {
    const parsed = parseCombinedCredentials(text);
    if (parsed && (parsed.email || parsed.password)) {
      if (parsed.email) setEmail(parsed.email);
      if (parsed.password) setPassword(parsed.password);
      setPastedState("success");
      setTimeout(() => setPastedState("idle"), 2500);
      return true;
    }
    return false;
  };

  useEffect(() => {
    const handleGlobalPaste = (event: ClipboardEvent) => {
      const text = event.clipboardData?.getData("text");
      if (!text) return;
      const parsed = parseCombinedCredentials(text);
      if (parsed && (parsed.email || parsed.password)) {
        event.preventDefault();
        if (parsed.email) setEmail(parsed.email);
        if (parsed.password) setPassword(parsed.password);
        setPastedState("success");
        setTimeout(() => setPastedState("idle"), 2500);
      }
    };

    window.addEventListener("paste", handleGlobalPaste);
    return () => window.removeEventListener("paste", handleGlobalPaste);
  }, [setEmail, setPassword]);

  const handlePasteCredentials = async () => {
    // 1. Try reading directly from clipboard
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.readText) {
        const clipText = await navigator.clipboard.readText();
        if (clipText && applyCredentials(clipText)) {
          return;
        }
      }
    } catch {
      // Browser blocked clipboard reading
    }

    // 2. Try cached credentials from recent copy actions in localStorage / sessionStorage
    try {
      if (typeof window !== "undefined") {
        const cached =
          localStorage.getItem("pup_focus_last_credentials") ||
          sessionStorage.getItem("pup_focus_last_credentials");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && (parsed.email || parsed.password)) {
            if (parsed.email) setEmail(parsed.email);
            if (parsed.password) setPassword(parsed.password);
            setPastedState("success");
            setTimeout(() => setPastedState("idle"), 2500);
            return;
          }
        }
      }
    } catch {}

    // 3. Try URL search parameters (e.g. from sign-in link)
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const qEmail = params.get("email");
      const qTemp = params.get("temp") || params.get("password");
      if (qEmail || qTemp) {
        if (qEmail) setEmail(qEmail.trim());
        if (qTemp) setPassword(qTemp.trim());
        setPastedState("success");
        setTimeout(() => setPastedState("idle"), 2500);
        return;
      }
    }

    // 4. Focus email input directly
    emailInputRef.current?.focus();
    setPastedState("no-credentials");
    setTimeout(() => setPastedState("idle"), 2500);
  };

  const handleInputPaste = (event: React.ClipboardEvent<HTMLInputElement | HTMLFormElement>) => {
    const text = event.clipboardData.getData("text");
    const parsed = parseCombinedCredentials(text);
    if (parsed && parsed.email && parsed.password) {
      event.preventDefault();
      setEmail(parsed.email);
      setPassword(parsed.password);
      setPastedState("success");
      setTimeout(() => setPastedState("idle"), 2500);
    }
  };

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
        <div className="mt-4 rounded-2xl border-2 border-amber-400 bg-[#2d1b00] px-4 py-3 text-sm font-semibold text-amber-100 shadow-[0_4px_16px_rgba(0,0,0,0.5),0_0_12px_rgba(251,191,36,0.3)]">
          Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and
          NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local before using sign in.
        </div>
      ) : null}

      <form className="mt-1.5 sm:mt-3 space-y-2 sm:space-y-2.5" onSubmit={onSubmit} onPaste={handleInputPaste}>
        {/* Universal Alert Banner */}
        {notice ? (
          <div
            className={`rounded-xl p-3 text-xs flex items-start gap-2.5 border-2 transition-all shadow-[0_4px_16px_rgba(0,0,0,0.5)] ${
              notice.type === "timeout"
                ? "bg-[#2d1b00] border-amber-400 text-amber-50 shadow-amber-950/40"
                : notice.type === "success"
                ? "bg-[#062c1d] border-emerald-400 text-emerald-50 shadow-emerald-950/40"
                : notice.type === "info"
                ? "bg-[#082845] border-sky-400 text-sky-50 shadow-sky-950/40"
                : "bg-[#3b070c] border-rose-400 text-rose-50 shadow-rose-950/40"
            }`}
          >
            {notice.type === "timeout" ? (
              <AppIcon icon={Hourglass} size="md" color="inherit" className="mt-0.5 !text-amber-300 shrink-0 drop-shadow-[0_0_8px_rgba(251,191,36,0.7)]" />
            ) : notice.type === "success" ? (
              <AppIcon icon={CheckCircle} size="md" color="inherit" className="mt-0.5 !text-emerald-300 shrink-0 drop-shadow-[0_0_8px_rgba(16,185,129,0.7)]" />
            ) : notice.type === "info" ? (
              <AppIcon icon={WarningCircle} size="md" color="inherit" className="mt-0.5 !text-sky-300 shrink-0 drop-shadow-[0_0_8px_rgba(56,189,248,0.7)]" />
            ) : (
              <AppIcon icon={WarningCircle} size="md" color="inherit" className="mt-0.5 !text-rose-300 shrink-0 drop-shadow-[0_0_8px_rgba(244,63,94,0.7)]" />
            )}
            <span className="leading-relaxed font-semibold tracking-wide drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]">{notice.message}</span>
          </div>
        ) : error ? (
          <div className="rounded-xl p-3 text-xs flex items-start gap-2.5 border-2 border-rose-400 bg-[#3b070c] text-rose-50 shadow-[0_4px_16px_rgba(0,0,0,0.5),0_0_12px_rgba(244,63,94,0.3)] transition-all">
            <AppIcon icon={WarningCircle} size="md" color="inherit" className="mt-0.5 !text-rose-300 shrink-0 drop-shadow-[0_0_8px_rgba(244,63,94,0.7)]" />
            <span className="leading-relaxed font-semibold tracking-wide text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]">{error}</span>
          </div>
        ) : null}

        {/* Top Action Row: Quick Credentials Autofill */}
        <div className="flex items-center justify-center pt-0.5 pb-1">
          <button
            type="button"
            onClick={handlePasteCredentials}
            className={`group inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-semibold tracking-wide transition-colors duration-150 cursor-pointer active:scale-95 border ${
              pastedState === "success"
                ? "bg-emerald-950/80 border-emerald-500 text-emerald-200"
                : pastedState === "no-credentials"
                ? "bg-rose-950/80 border-rose-500 text-rose-200"
                : "bg-[#5a0000] hover:bg-[#6e0000] border-amber-400/40 hover:border-amber-400/70 text-amber-200 hover:text-amber-100"
            }`}
            title="Paste copied credentials to autofill both email and password"
          >
            {pastedState === "success" ? (
              <>
                <AppIcon icon={Check} size="xs" color="inherit" className="text-emerald-400 stroke-[3]" />
                <span>Credentials Autofilled!</span>
              </>
            ) : pastedState === "no-credentials" ? (
              <>
                <AppIcon icon={WarningCircle} size="xs" color="inherit" className="text-rose-400" />
                <span>No credentials found</span>
              </>
            ) : (
              <>
                <AppIcon icon={PasteClipboard} size="xs" color="inherit" className="text-amber-400" />
                <span>Paste Credentials (Email & Password)</span>
              </>
            )}
          </button>
        </div>

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
              ref={emailInputRef}
              id="email"
              type="email"
              name="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onPaste={handleInputPaste}
              required
              placeholder="faculty@pup.edu.ph"
              className="pup-login-input w-full rounded-xl border !border-amber-400/50 !bg-[#660000] pl-10 pr-4 py-2 sm:py-2.5 text-sm !text-amber-50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3),0_1px_0_rgba(255,215,0,0.15)] outline-none transition-all duration-200 placeholder:!text-amber-200/50 hover:!border-amber-400 focus:!border-amber-400 focus:!ring-1 focus:!ring-amber-400/50"
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
              onPaste={handleInputPaste}
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
              className="pup-login-input w-full rounded-xl border !border-amber-400/50 !bg-[#660000] pl-10 pr-12 py-2 sm:py-2.5 text-sm !text-amber-50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3),0_1px_0_rgba(255,215,0,0.15)] outline-none transition-all duration-200 placeholder:!text-amber-200/50 hover:!border-amber-400 focus:!border-amber-400 focus:!ring-1 focus:!ring-amber-400/50"
            />

            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 !text-amber-400/80 hover:!text-amber-300 transition-colors cursor-pointer"
            >
              {showPassword ? (
                <AppIcon icon={Eye} size="md" color="inherit" strokeWidth={2.2} />
              ) : (
                <AppIcon icon={EyeClosed} size="md" color="inherit" strokeWidth={2.2} />
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
        <div className="flex items-center justify-between mt-0.5 mb-1.5 sm:mt-1 sm:mb-3 text-xs">
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

        {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
          <div className="flex justify-center my-1 sm:my-2 min-h-[56px] sm:min-h-[65px] items-center scale-[0.9] sm:scale-100 origin-center">
            <Turnstile
              ref={turnstileRef}
              siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
              onSuccess={onTurnstileSuccess}
              onExpire={onTurnstileExpire}
              onError={onTurnstileError}
              options={{
                theme: "dark",
                size: "normal",
                execution: "render",
              }}
            />
          </div>
        )}

        <Button
          className="mt-2 sm:mt-4 h-9.5 sm:h-11 w-full max-w-[200px] sm:max-w-[220px] mx-auto rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-500 font-black text-[#3d0000] tracking-widest uppercase text-xs sm:text-sm transition-all duration-300 hover:from-amber-300 hover:to-amber-400 active:scale-[0.98] cursor-pointer shadow-lg shadow-black/50 hover:shadow-black/60 border border-amber-300/30 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          type="submit"
          disabled={isLoading || (Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) && !captchaToken)}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2 text-xs sm:text-base font-black">
              <LazyLottie
                animationData={loadingAnimation}
                loop={true}
                autoplay
                className="h-5 w-5 sm:h-6 sm:w-6"
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
