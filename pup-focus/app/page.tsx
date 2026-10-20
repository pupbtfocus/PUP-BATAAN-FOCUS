"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { TurnstileInstance } from "@/components/auth/turnstile";
import { Logo } from "@/components/ui/logo";
import { LoginForm, type NoticeBanner } from "@/components/auth/login-form";
import { ForgotPasswordModal } from "@/components/auth/forgot-password-modal";
import {
  AuthFeedbackModal,
  type AuthModalState,
} from "@/components/auth/auth-feedback-modal";
import { APP_CONFIG } from "@/config/app";
import { getPublicEnvSafe } from "@/config/env";
import { createClient, clearBrowserSupabaseSession } from "@/lib/supabase/client";
import { ROUTE_BY_ROLE, resetDashboardNavigationState } from "@/config/routes";
import { ROLE, ROLE_LABEL, type AppRole, isQaFaculty } from "@/config/roles";
import { isValidEmailAddress } from "@/lib/validation/email";
import { recordActiveSessionLogin } from "@/components/auth/single-session-enforcer";

const SUPER_ADMIN_EMAIL = APP_CONFIG.superAdminEmail;
const PUBLIC_ENV = getPublicEnvSafe();
const PREFETCH_ROUTES = [
  "/faculty/dashboard",
  "/staff/dashboard",
  "/admin/dashboard",
] as const;

const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000; // 15-minute lockout

function getLoginLockoutKey(email: string) {
  return `pup_auth_lockout_${email.trim().toLowerCase()}`;
}

function checkLoginLockout(email: string): { isLocked: boolean; remainingSeconds: number } {
  if (typeof window === "undefined" || !email) return { isLocked: false, remainingSeconds: 0 };
  try {
    const raw = localStorage.getItem(getLoginLockoutKey(email));
    if (!raw) return { isLocked: false, remainingSeconds: 0 };
    const data = JSON.parse(raw);
    const now = Date.now();
    if (data.lockedUntil && data.lockedUntil > now) {
      return { isLocked: true, remainingSeconds: Math.ceil((data.lockedUntil - now) / 1000) };
    }
  } catch {
    // ignore
  }
  return { isLocked: false, remainingSeconds: 0 };
}

function registerFailedLoginAttempt(email: string): { isLocked: boolean; count: number; remainingSeconds: number } {
  if (typeof window === "undefined" || !email) return { isLocked: false, count: 1, remainingSeconds: 0 };
  try {
    const key = getLoginLockoutKey(email);
    const raw = localStorage.getItem(key);
    let count = 0;
    const now = Date.now();
    if (raw) {
      const data = JSON.parse(raw);
      if (!data.lockedUntil || data.lockedUntil <= now) {
        count = typeof data.count === "number" ? data.count : 0;
      }
    }
    count += 1;
    if (count >= MAX_LOGIN_ATTEMPTS) {
      const lockedUntil = now + LOGIN_LOCKOUT_MS;
      localStorage.setItem(key, JSON.stringify({ count, lockedUntil }));
      return { isLocked: true, count, remainingSeconds: Math.ceil(LOGIN_LOCKOUT_MS / 1000) };
    }
    localStorage.setItem(key, JSON.stringify({ count }));
    return { isLocked: false, count, remainingSeconds: 0 };
  } catch {
    return { isLocked: false, count: 1, remainingSeconds: 0 };
  }
}

function resetLoginAttempts(email: string) {
  if (typeof window === "undefined" || !email) return;
  try {
    localStorage.removeItem(getLoginLockoutKey(email));
  } catch {
    // ignore
  }
}

export default function Home() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeBanner | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authModal, setAuthModal] = useState<AuthModalState | null>(null);
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance | null>(null);
  const pendingCredentialsRef = useRef<{ email: string; password: string; rememberMe: boolean } | null>(null);
  const latestCredentialsRef = useRef({ email, password, rememberMe });

  useEffect(() => {
    latestCredentialsRef.current = { email, password, rememberMe };
  });

  // Load remembered credentials from localStorage
  useEffect(() => {
    try {
      const savedRemember = localStorage.getItem("pup_focus_remember_me");
      const savedEmail = localStorage.getItem("pup_focus_remembered_email");
      if (savedRemember === "true" && savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
      }
    } catch {
      // Ignore storage access errors
    }
  }, []);

  const handleRememberMeChange = (checked: boolean) => {
    setRememberMe(checked);
    if (!checked) {
      try {
        localStorage.removeItem("pup_focus_remember_me");
        localStorage.removeItem("pup_focus_remembered_email");
      } catch {
        // Ignore storage access errors
      }
    }
  };

  useEffect(() => {
    PREFETCH_ROUTES.forEach((route) => {
      router.prefetch(route);
    });

    if (typeof window !== "undefined") {
      const hasInviteHash =
        window.location.hash.includes("access_token") ||
        window.location.hash.includes("type=invite") ||
        window.location.hash.includes("type=recovery");

      if (!hasInviteHash) {
        const searchParams = new URLSearchParams(window.location.search);
        const reason = searchParams.get("reason");
        const urlError = searchParams.get("error");
        const urlMessage = searchParams.get("message");

        if (reason === "timeout") {
          setNotice({
            type: "timeout",
            message: "Your session has expired due to inactivity. Please sign in again.",
          });
        } else if (urlError) {
          setNotice({
            type: "error",
            message: decodeURIComponent(urlError),
          });
        } else if (urlMessage) {
          setNotice({
            type: "success",
            message: decodeURIComponent(urlMessage),
          });
        }
      }
    }
  }, [router]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    // 1. Manual hash token parsing when arriving with #access_token
    if (window.location.hash.includes("access_token")) {
      // Immediately clear/suppress error states and modal alerts
      setError(null);
      setNotice(null);
      setAuthModal(null);

      // Parse hash params
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (accessToken && refreshToken) {
        const supabase = createClient();
        supabase.auth
          .setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          .then(({ data, error: setSessionErr }: { data: any; error: any }) => {
            if (!setSessionErr && data?.session) {
              window.history.replaceState(null, "", window.location.pathname);
              router.replace("/auth/confirm");
            }
          });

        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((_event: unknown, session: unknown) => {
          if (session) {
            window.history.replaceState(null, "", window.location.pathname);
            router.replace("/auth/confirm");
          }
        });

        return () => {
          subscription.unsubscribe();
        };
      }
    }

    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    const hashParams = new URLSearchParams(hash);

    // 2. Handle explicit error from hash without access token (e.g. #error=access_denied&error_description=...)
    if (hashParams.has("error") || hashParams.has("error_description")) {
      const errorDescription =
        hashParams.get("error_description") ??
        hashParams.get("error");
      if (errorDescription) {
        setError(decodeURIComponent(errorDescription));
      }
    }
  }, [router]);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      (window.location.hash.includes("access_token") ||
        window.location.hash.includes("type=invite") ||
        window.location.hash.includes("type=recovery"))
    ) {
      return;
    }

    let cancelled = false;

    async function redirectIfAlreadySignedIn() {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();

      if (cancelled) {
        return;
      }

      const user = data.user;
      if (!user) {
        return;
      }

      // If user was explicitly logged out due to concurrent session, do not auto-redirect
      if (
        typeof window !== "undefined" &&
        sessionStorage.getItem("pup_focus_logged_out") === "true"
      ) {
        return;
      }

      // If active session was superseded by a newer login elsewhere, clear credentials and stay on login page
      const storedLoginUser =
        typeof window !== "undefined"
          ? sessionStorage.getItem("pup_focus_login_user") ||
            localStorage.getItem("pup_focus_login_user")
          : null;
      const localLoginTime =
        typeof window !== "undefined" && storedLoginUser === user.id
          ? sessionStorage.getItem("pup_focus_login_time") ||
            localStorage.getItem("pup_focus_login_time")
          : null;
      if (localLoginTime && user.last_sign_in_at) {
        const clientTime = new Date(localLoginTime).getTime();
        const serverTime = new Date(user.last_sign_in_at).getTime();
        if (serverTime - clientTime > 3000) {
          clearBrowserSupabaseSession();
          sessionStorage.removeItem("pup_focus_login_time");
          localStorage.removeItem("pup_focus_login_time");
          return;
        }
      }

      const mustChange =
        (user.user_metadata as any)?.must_change_password === true ||
        (user.user_metadata as any)?.force_password_change === true;
      if (mustChange) {
        window.location.assign("/auth/change-password");
        return;
      }

      const signedInRole =
        (user.user_metadata?.role as AppRole | undefined) ??
        (user.app_metadata?.role as AppRole | undefined) ??
        ROLE.FACULTY;

      resetDashboardNavigationState();
      window.location.href = ROUTE_BY_ROLE[signedInRole];
    }

    void redirectIfAlreadySignedIn();

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (
      !authModal ||
      authModal.variant !== "success" ||
      !authModal.redirectTo
    ) {
      return;
    }

    const targetRoute = authModal.redirectTo as string;

    const timeoutId = window.setTimeout(() => {
      window.location.href = targetRoute;
    }, 2000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [authModal]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setAuthModal(null);

    const normalizedEmail = email.trim().toLowerCase();

    const lockout = checkLoginLockout(normalizedEmail);
    if (lockout.isLocked) {
      const mins = Math.ceil(lockout.remainingSeconds / 60);
      const lockMsg = `Account temporarily locked due to consecutive failed attempts. Please try again in ${mins} minute${mins > 1 ? "s" : ""}.`;
      setError(lockMsg);
      setNotice({ type: "timeout", message: lockMsg });
      setAuthModal({
        title: "Account Locked",
        message: lockMsg,
        actionLabel: "Understood",
        variant: "error",
      });
      return;
    }

    if (!isValidEmailAddress(normalizedEmail)) {
      const errorMsg = "Please provide a real email address.";
      setError(errorMsg);
      setNotice({ type: "error", message: errorMsg });
      return;
    }

    if (!password) {
      const errorMsg = "Please enter your password.";
      setError(errorMsg);
      setNotice({ type: "error", message: errorMsg });
      return;
    }

    if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !captchaToken) {
      const errorMsg = "Please complete the security check before signing in.";
      setError(errorMsg);
      setNotice({ type: "error", message: errorMsg });
      return;
    }

    pendingCredentialsRef.current = {
      email: normalizedEmail,
      password,
      rememberMe,
    };

    setIsSubmitting(true);
    setAuthModal({
      title: "Authenticating...",
      message: "Verifying institutional credentials with campus security...",
      variant: "loading",
    });
    await performSignIn(captchaToken || undefined);
  }

  function handleTurnstileSuccess(token: string) {
    console.log("[Auth] Turnstile pre-submit verification passed");
    setCaptchaToken(token);
    setError(null);
  }

  function handleTurnstileError(err?: unknown) {
    console.warn("[Auth] Turnstile challenge error:", err);
    setCaptchaToken(null);
    const wasSubmitting = isSubmitting || pendingCredentialsRef.current !== null;
    setIsSubmitting(false);
    pendingCredentialsRef.current = null;

    const isDomainNotAllowed = String(err) === "110200";
    if (isDomainNotAllowed || wasSubmitting) {
      const errorMsg = isDomainNotAllowed
        ? "Turnstile domain not allowed (110200). Add 'localhost' to Cloudflare Allowed Domains or use testing sitekey in .env.local."
        : "Security verification challenge failed. Please try again.";
      setError(errorMsg);
      setNotice({ type: "error", message: errorMsg });
      if (wasSubmitting) {
        setAuthModal({
          title: "Login Failed",
          message: errorMsg,
          actionLabel: "Try Again",
          variant: "error",
        });
      }
    }
  }

  function handleTurnstileExpire() {
    console.warn("[Auth] Turnstile token expired");
    setCaptchaToken(null);
    setIsSubmitting(false);
    pendingCredentialsRef.current = null;
  }

  async function performSignIn(token?: string) {
    const creds = pendingCredentialsRef.current ?? {
      email: latestCredentialsRef.current.email.trim().toLowerCase(),
      password: latestCredentialsRef.current.password,
      rememberMe: latestCredentialsRef.current.rememberMe,
    };
    const normalizedEmail = creds.email;
    const currentPassword = creds.password;
    const activeRememberMe = creds.rememberMe;

    const lockout = checkLoginLockout(normalizedEmail);
    if (lockout.isLocked) {
      const mins = Math.ceil(lockout.remainingSeconds / 60);
      const lockMsg = `Account temporarily locked due to consecutive failed attempts. Please try again in ${mins} minute${mins > 1 ? "s" : ""}.`;
      setError(lockMsg);
      setNotice({ type: "timeout", message: lockMsg });
      setAuthModal({
        title: "Account Locked",
        message: lockMsg,
        actionLabel: "Understood",
        variant: "error",
      });
      setIsSubmitting(false);
      pendingCredentialsRef.current = null;
      return;
    }

    const startTime = Date.now();
    const ensureMinLoadingTime = async () => {
      const elapsed = Date.now() - startTime;
      if (elapsed < 800) {
        await new Promise((resolve) => setTimeout(resolve, 800 - elapsed));
      }
    };

    const supabase = createClient();
    console.log("[Auth] Signing in with password for:", normalizedEmail, { hasCaptcha: Boolean(token) });

    try {
      let signInData: { user: any; session: any } | null = null;
      let signInError: any = null;

      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: normalizedEmail,
            password: currentPassword,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok && json.session && json.user) {
          if (json.session) {
            await supabase.auth.setSession(json.session).catch(() => null);
          }
          signInData = { user: json.user, session: json.session };
          signInError = null;
        } else {
          signInError = new Error(json.error || "Invalid login credentials.");
          (signInError as any).status = res.status;
        }
      } catch (err: unknown) {
        signInError = err instanceof Error ? err : new Error(String(err));
      }

      if (signInError || !signInData?.user) {
        await ensureMinLoadingTime();
        const rawMessage = signInError?.message ?? "Sign in failed";
        const isLockout =
          (signInError as any)?.status === 429 ||
          rawMessage.toLowerCase().includes("locked") ||
          rawMessage.toLowerCase().includes("too many failed");
        const isInvalidCredentials =
          rawMessage.toLowerCase().includes("invalid login credentials") ||
          rawMessage.toLowerCase().includes("invalid credentials");
        const isInvalidSecret = rawMessage.toLowerCase().includes("invalid-input-secret");

        if (isLockout) {
          setError(rawMessage);
          setNotice({ type: "timeout", message: rawMessage });
          setAuthModal({
            title: "Account Locked",
            message: rawMessage,
            actionLabel: "Understood",
            variant: "error",
          });
        } else if (isInvalidCredentials) {
          console.warn("[Auth] Login attempt failed:", rawMessage);
          setError(rawMessage);
          setNotice({ type: "error", message: rawMessage });
          setAuthModal({
            title: "Login Failed",
            message: rawMessage,
            actionLabel: "Try Again",
            variant: "error",
          });
        } else if (isInvalidSecret) {
          console.error("[Auth] Turnstile secret mismatch in Supabase:", rawMessage, signInError);
          const friendlyMsg =
            "Cloudflare Turnstile Secret Key mismatch: The secret key configured in your Supabase Dashboard (Authentication > Attack Protection > Captcha) does not match this production widget. Please update it with your Cloudflare Turnstile Secret Key.";
          setError(friendlyMsg);
          setNotice({ type: "error", message: friendlyMsg });
          setAuthModal({
            title: "Login Failed",
            message: friendlyMsg,
            actionLabel: "Understood",
            variant: "error",
          });
        } else {
          console.error("[Auth] Supabase sign-in error:", rawMessage, signInError);
          setError(rawMessage);
          setNotice({ type: "error", message: rawMessage });
          setAuthModal({
            title: "Login Failed",
            message: rawMessage,
            actionLabel: "Try Again",
            variant: "error",
          });
        }
        turnstileRef.current?.reset();
        setCaptchaToken(null);
        pendingCredentialsRef.current = null;
        setIsSubmitting(false);
        return;
      }

      const user = signInData.user;
      resetLoginAttempts(normalizedEmail);
      console.log("[Auth] Sign in successful for user:", user.id);

      const mustChange =
        (user.user_metadata as any)?.must_change_password === true ||
        (user.user_metadata as any)?.force_password_change === true;
      if (mustChange) {
        await ensureMinLoadingTime();
        setIsSubmitting(false);
        setAuthModal({
          title: "Login Successful",
          message: "First-time login detected. Redirecting to set your password...",
          variant: "success",
          redirectTo: "/auth/change-password",
        });
        return;
      }

      const metadataIsActive =
        (user.user_metadata as any)?.is_active ??
        (user.app_metadata as any)?.is_active;

      let isActive: boolean | null = null;
      if (typeof metadataIsActive === "boolean") {
        isActive = metadataIsActive;
      } else {
        try {
          const resp = await fetch("/api/auth/validate");
          if (resp.ok) {
            const body = (await resp.json()) as { is_active?: boolean };
            if (typeof body.is_active === "boolean") {
              isActive = body.is_active;
            }
          }
        } catch {
          // ignore validation errors and proceed
        }
      }

      if (isActive === false) {
        await ensureMinLoadingTime();
        await supabase.auth.signOut();
        console.warn("[Auth] Account is deactivated:", normalizedEmail);
        const deactMsg = "Your account has been deactivated. Contact an administrator.";
        setError(deactMsg);
        setNotice({ type: "error", message: deactMsg });
        setAuthModal({
          title: "Login Failed",
          message: deactMsg,
          actionLabel: "Understood",
          variant: "error",
        });
        setIsSubmitting(false);
        return;
      }

      const signedInRole =
        (user.user_metadata?.role as AppRole | undefined) ??
        (user.app_metadata?.role as AppRole | undefined) ??
        ROLE.FACULTY;
      const nextTarget = ROUTE_BY_ROLE[signedInRole];

      // Save or clear Remember Me credentials safely in localStorage
      try {
        if (activeRememberMe) {
          localStorage.setItem("pup_focus_remember_me", "true");
          localStorage.setItem("pup_focus_remembered_email", normalizedEmail);
        } else {
          localStorage.removeItem("pup_focus_remember_me");
          localStorage.removeItem("pup_focus_remembered_email");
        }
      } catch {
        // Ignore storage access errors
      }

      // Always reset all role active views/tabs so every new session starts fresh on the Dashboard
      resetDashboardNavigationState();

      // Store this session's sign-in timestamp to enforce single-session concurrency
      let loginTime: string = "";
      try {
        const { data: freshUserData } = await supabase.auth.getUser();
        if (typeof freshUserData?.user?.last_sign_in_at === "string") {
          loginTime = freshUserData.user.last_sign_in_at;
        }
      } catch {
        // Fallback to returned user
      }

      if (!loginTime) {
        loginTime =
          (typeof user.last_sign_in_at === "string" && user.last_sign_in_at) ||
          new Date().toISOString();
      }

      recordActiveSessionLogin(loginTime, user.id);

      await ensureMinLoadingTime();
      setIsSubmitting(false);
      setAuthModal({
        title: "Login Successful",
        message: `Welcome back! You are signed in as ${ROLE_LABEL[signedInRole]}.`,
        variant: "success",
        redirectTo: nextTarget,
      });
    } catch (err: unknown) {
      await ensureMinLoadingTime();
      const rawMsg = err instanceof Error ? err.message : "An unexpected error occurred during sign in.";
      const isFetchError = rawMsg.toLowerCase().includes("failed to fetch") || rawMsg.toLowerCase().includes("network");
      const msg = isFetchError
        ? "Unable to reach the authentication service. Please check your internet connection or ad-blockers and try again."
        : rawMsg;
      console.error("[Auth] Unexpected sign in exception:", rawMsg);
      setError(msg);
      setNotice({ type: "error", message: msg });
      setAuthModal({
        title: "Login Failed",
        message: msg,
        actionLabel: "Try Again",
        variant: "error",
      });
      setIsSubmitting(false);
    } finally {
      // Strictly reset Turnstile widget AFTER the Supabase request finishes
      turnstileRef.current?.reset();
      setCaptchaToken(null);
      pendingCredentialsRef.current = null;
    }
  }

  return (
    <main className="relative min-h-dvh h-auto md:h-screen md:max-h-screen w-full flex flex-col items-center justify-center px-3 sm:px-4 py-2.5 sm:py-4 md:py-2 text-[#fff8e7] overflow-x-hidden overflow-y-auto md:overflow-hidden bg-[#1c0406]">
      {/* Campus Background Photos with Maroon Blur */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -inset-2 bg-cover bg-center scale-105 filter blur-[4px]"
          style={{
            backgroundImage: 'url("/images/attachments/IMG_9399.jpeg")',
            animation: 'backgroundFadeA 16s infinite linear',
          }}
        />
        <div
          className="absolute -inset-2 bg-cover bg-center scale-105 filter blur-[4px]"
          style={{
            backgroundImage: 'url("/images/attachments/IMG_9402.jpeg")',
            animation: 'backgroundFadeB 16s infinite linear',
          }}
        />
        {/* Soft maroon color wash & gentle depth (keeps image visible) */}
        <div className="absolute inset-0 bg-[#6b0d18]/38" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#2a0408]/45 via-transparent to-[#1c0205]/60" />
      </div>

      <div className="relative z-10 w-full max-w-[420px] sm:max-w-[460px] md:max-w-4xl lg:max-w-5xl mx-auto my-auto py-0.5 md:py-3">
        {/* Wide Open-Book Card Container */}
        <div className="relative w-full mx-auto">
          {/* Desktop Curved Card Top Header SVG (>= md) */}
          <div className="hidden md:block relative -mb-[8px] z-10">
            <svg
              viewBox="0 0 900 70"
              className="w-full h-auto block pointer-events-none overflow-visible"
            >
              <defs>
                {/* Official PUP Maroon (#800000) */}
                <linearGradient id="cardTopGradDesktop" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#800000" />
                  <stop offset="100%" stopColor="#800000" />
                </linearGradient>

                {/* Luminous 3D Golden Rim */}
                <linearGradient id="topGoldCrestDesktop" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#D97706" stopOpacity="0.8" />
                  <stop offset="15%" stopColor="#F59E0B" stopOpacity="0.95" />
                  <stop offset="35%" stopColor="#FDE68A" stopOpacity="1" />
                  <stop offset="50%" stopColor="#FFFBEB" stopOpacity="1" />
                  <stop offset="65%" stopColor="#FDE68A" stopOpacity="1" />
                  <stop offset="85%" stopColor="#F59E0B" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#D97706" stopOpacity="0.8" />
                </linearGradient>

                {/* Top ambient golden light sheen */}
                <linearGradient id="topAmbientSheenDesktop" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#FBBF24" stopOpacity="0.75" />
                  <stop offset="60%" stopColor="#F59E0B" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#800000" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* 1. Background Fill Path - extends to y=85 to seamlessly merge into card */}
              <path
                d="M 0,85 L 0,20 Q 0,0 20,0 L 380,0 C 398,0 404,44 450,44 C 496,44 502,0 520,0 L 880,0 Q 900,0 900,20 L 900,85 Z"
                fill="#800000"
              />

              {/* 2. Ambient Golden Light Sheen */}
              <path
                d="M 2,20 Q 2,2 20,2 L 380,2 C 398,2 404,44 450,44 C 496,44 502,2 520,2 L 880,2 Q 898,2 898,20"
                fill="none"
                stroke="url(#topAmbientSheenDesktop)"
                strokeWidth="5"
                strokeLinecap="round"
              />

              {/* 3. Base Golden Border (top curve + sides extending into card) */}
              <path
                d="M 2,86 L 2,20 Q 2,2 20,2 L 380,2 C 398,2 404,44 450,44 C 496,44 502,2 520,2 L 880,2 Q 898,2 898,20 L 898,86"
                fill="none"
                stroke="rgba(245, 158, 11, 1)"
                strokeWidth="4"
              />

              {/* 4. Luminous 3D Golden Crest */}
              <path
                d="M 1,20 Q 1,1 20,1 L 380,1 C 398,1 404,44 450,44 C 496,44 502,1 520,1 L 880,1 Q 899,1 899,20"
                fill="none"
                stroke="url(#topGoldCrestDesktop)"
                strokeWidth="2.5"
                strokeLinecap="round"
              />

              {/* 5. Fine Specular Highlight */}
              <path
                d="M 30,1 L 380,1 C 398,1 404,44 450,44 C 496,44 502,1 520,1 L 870,1"
                fill="none"
                stroke="rgba(255, 255, 255, 0.6)"
                strokeWidth="1"
                strokeLinecap="round"
              />
            </svg>

            {/* Logo of PUP positioned precisely inside the curved arch in top center */}
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-30">
              <Logo size={120} className="mb-0 drop-shadow-[0_12px_24px_rgba(0,0,0,0.7)]" />
            </div>
          </div>

          {/* Continuous Center Spine Separator Line (Desktop) */}
          <div
            className="hidden md:block absolute left-1/2 -translate-x-1/2 w-[2px] bg-amber-400/40 pointer-events-none z-20"
            style={{ top: "90px", bottom: "4px" }}
          />

          {/* Card Body - Official PUP Brand Maroon (#800000) with 2-Sided Open Book Layout */}
          <section className="relative rounded-[1.5rem] sm:rounded-[2rem] md:rounded-t-none md:rounded-b-[2rem] border-3 sm:border-4 md:border-t-0 md:border-x-4 md:border-b-4 border-amber-400 bg-[#800000] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.6),0_0_30px_rgba(128,0,0,0.4)]">
            <div className="grid grid-cols-1 md:grid-cols-12 items-stretch md:min-h-[420px]">
              {/* Left Side (Desktop) / Top (Mobile): Login Form */}
              <div className="md:col-span-6 relative z-10 flex flex-col justify-center px-4 pt-3 pb-1.5 sm:p-6 md:p-8 bg-transparent">
                {/* PUP Seal Logo (Mobile only, centered above SIGN IN) */}
                <div className="flex md:hidden justify-center mb-1">
                  <Logo size={56} className="drop-shadow-[0_6px_16px_rgba(0,0,0,0.6)]" />
                </div>

                {/* Form Header */}
                <div className="mb-1.5 sm:mb-4 text-center">
                  <h2 className="text-xl sm:text-3xl font-black tracking-wider text-amber-300 uppercase mb-0.5 sm:mb-1 drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
                    Sign In
                  </h2>
                  <div className="mx-auto my-1 sm:my-3 h-0.5 w-16 sm:w-20 rounded-full bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_10px_rgba(251,191,36,0.8)]" />
                  <p className="text-amber-100 text-[11px] sm:text-sm font-medium tracking-wide">
                    Enter your institutional credentials to continue
                  </p>
                </div>

                <LoginForm
                  email={email}
                  setEmail={setEmail}
                  password={password}
                  setPassword={setPassword}
                  rememberMe={rememberMe}
                  setRememberMe={handleRememberMeChange}
                  onSubmit={onSubmit}
                  onOpenForgotPassword={() => setIsForgotModalOpen(true)}
                  isSubmitting={isSubmitting}
                  isPending={isPending}
                  error={error}
                  notice={notice}
                  publicEnvConfigured={Boolean(PUBLIC_ENV)}
                  turnstileRef={turnstileRef}
                  captchaToken={captchaToken}
                  onTurnstileSuccess={handleTurnstileSuccess}
                  onTurnstileError={handleTurnstileError}
                  onTurnstileExpire={handleTurnstileExpire}
                />
              </div>

              {/* Right Side (Desktop) / Bottom (Mobile): FOCUS Branding */}
              <div className="md:col-span-6 relative flex flex-col items-center justify-center text-center pt-5 pb-4 px-2 sm:py-6 sm:px-6 md:p-8 min-h-[165px] sm:min-h-[200px] md:min-h-[420px] bg-transparent md:overflow-hidden">
                {/* Pylon Monument Background (pylon.png) */}
                <div className="absolute -top-14 inset-x-0 bottom-0 md:top-0 z-0 pointer-events-none md:overflow-hidden">
                  <Image
                    src="/images/pylon.png"
                    alt="PUP Pylon Monument"
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover object-[55%_bottom] opacity-75 blur-[2.5px] scale-105"
                    priority
                  />
                </div>

                {/* Centered Typography: FOCUS & Faculty Online Compliance and Uploading System */}
                <div className="relative z-10 w-full max-w-md mx-auto flex flex-col items-center justify-center text-center px-3">
                  {/* Title */}
                  <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-[0.2em] pl-[0.2em] bg-gradient-to-b from-[#fff3c4] via-amber-300 to-amber-500 bg-clip-text text-transparent uppercase drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)]">
                    FOCUS
                  </h1>

                  {/* Sleek Golden Divider with Center Diamond */}
                  <div className="flex items-center justify-center gap-2 my-1.5 sm:my-2.5 w-36 sm:w-44">
                    <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-amber-400/90" />
                    <div className="h-1.5 w-1.5 rotate-45 bg-amber-300 shadow-[0_0_8px_rgba(251,191,36,0.9)]" />
                    <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-amber-400/90" />
                  </div>

                  {/* Clean Institutional System Label Pill */}
                  <div className="inline-flex items-center justify-center rounded-full bg-[#3b0000]/65 backdrop-blur-[3px] border border-amber-400/35 px-3.5 sm:px-4 py-1 sm:py-1.5 shadow-[0_4px_14px_rgba(0,0,0,0.55)]">
                    <p className="text-[10.5px] sm:text-xs lg:text-[13px] font-semibold tracking-wide text-amber-50/95 leading-snug">
                      <span className="text-amber-300 font-extrabold">F</span>aculty{" "}
                      <span className="text-amber-300 font-extrabold">O</span>nline{" "}
                      <span className="text-amber-300 font-extrabold">C</span>ompliance &{" "}
                      <span className="text-amber-300 font-extrabold">U</span>ploading{" "}
                      <span className="text-amber-300 font-extrabold">S</span>ystem
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      <AuthFeedbackModal
        modal={authModal}
        onClose={() => {
          if (authModal?.variant === "success" && authModal.redirectTo) {
            window.location.href = authModal.redirectTo;
          } else {
            setAuthModal(null);
          }
        }}
      />

      <ForgotPasswordModal
        isOpen={isForgotModalOpen}
        onClose={() => setIsForgotModalOpen(false)}
        initialEmail={email}
      />
    </main>
  );
}
