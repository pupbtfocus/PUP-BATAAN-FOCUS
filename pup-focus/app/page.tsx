"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/ui/logo";
import { LoginForm, type NoticeBanner } from "@/components/auth/login-form";
import { ForgotPasswordModal } from "@/components/auth/forgot-password-modal";
import {
  AuthFeedbackModal,
  type AuthModalState,
} from "@/components/auth/auth-feedback-modal";
import { PupWebBadge } from "@/components/auth/pup-web-badge";
import { CampusBackground } from "@/components/shared/campus-background";
import { APP_CONFIG } from "@/config/app";
import { getPublicEnvSafe } from "@/config/env";
import { createClient } from "@/lib/supabase/client";
import { ROUTE_BY_ROLE } from "@/config/routes";
import { ROLE, ROLE_LABEL, type AppRole } from "@/config/roles";
import { isValidEmailAddress } from "@/lib/validation/email";

const SUPER_ADMIN_EMAIL = APP_CONFIG.superAdminEmail;
const PUBLIC_ENV = getPublicEnvSafe();
const PREFETCH_ROUTES = [
  "/faculty/dashboard",
  "/admin/dashboard",
  "/super-admin/dashboard",
] as const;

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
    setIsSubmitting(true);
    setError(null);
    setNotice(null);
    setAuthModal(null);

    const normalizedEmail = email.trim().toLowerCase();

    if (!isValidEmailAddress(normalizedEmail)) {
      const errorMsg = "Please provide a real email address.";
      setError(errorMsg);
      setNotice({ type: "error", message: errorMsg });
      setIsSubmitting(false);
      return;
    }

    const supabase = createClient();
    const signIn = () =>
      supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

    let { data: signInData, error: signInError } = await signIn();

    if (signInError && normalizedEmail === SUPER_ADMIN_EMAIL) {
      const bootstrapResponse = await fetch("/api/bootstrap/super-admin", {
        method: "POST",
      });

      if (!bootstrapResponse.ok) {
        try {
          const body = (await bootstrapResponse.json()) as { error?: string };
          setError(
            body.error ?? "Unable to initialize the super admin account.",
          );
        } catch {
          setError("Unable to initialize the super admin account.");
        }
        setIsSubmitting(false);
        return;
      }

      ({ data: signInData, error: signInError } = await signIn());
    }

    if (signInError || !signInData?.user) {
      const errorMessage = signInError?.message ?? "Sign in failed";
      const isInvalidCredentials = errorMessage === "Invalid login credentials";

      setAuthModal({
        title: "Invalid Credentials",
        message: "The email address or password you entered is incorrect. Please try again.",
        actionLabel: "Try again",
        variant: "error",
      });
      setIsSubmitting(false);
      return;
    }

    const user = signInData.user;
    const mustChange =
      (user.user_metadata as any)?.must_change_password === true ||
      (user.user_metadata as any)?.force_password_change === true;
    if (mustChange) {
      setIsSubmitting(false);
      window.location.assign("/auth/change-password");
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
      await supabase.auth.signOut();
      setError("Your account has been deactivated. Contact an administrator.");
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
      if (rememberMe) {
        localStorage.setItem("pup_focus_remember_me", "true");
        localStorage.setItem("pup_focus_remembered_email", normalizedEmail);
      } else {
        localStorage.removeItem("pup_focus_remember_me");
        localStorage.removeItem("pup_focus_remembered_email");
      }
    } catch {
      // Ignore storage access errors
    }

    setIsSubmitting(false);
    setAuthModal({
      title: "Login Successful",
      message: `Welcome back! You are signed in as ${ROLE_LABEL[signedInRole]}.`,
      variant: "success",
      redirectTo: nextTarget,
    });
  }

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center px-3 sm:px-4 py-4 sm:py-8 text-[#fff8e7] overflow-x-hidden">
      <CampusBackground />
      {/* Overlay with Blur on top of the global body background */}
      <div className="absolute inset-0 z-0 bg-transparent backdrop-blur-[6px]" />
      <div className="absolute inset-0 z-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

      <div className="relative z-10 w-full max-w-[390px] sm:max-w-md mx-auto my-auto pt-6 sm:pt-10 pb-14 sm:pb-8">
        <div className="relative w-full mx-auto drop-shadow-[0_25px_35px_rgba(0,0,0,0.85)]">
          {/* Curved Card Top Header SVG with 3D Golden Crest Lighting */}
          <div className="relative">
            <svg
              viewBox="0 0 400 64"
              className="w-full h-auto block -mb-1 pointer-events-none overflow-visible"
            >
              <defs>
                {/* Authentic PUP Maroon Gradient (#8a0c0c -> #780000 -> #680000) */}
                <linearGradient id="cardTopGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#8a0c0c" />
                  <stop offset="40%" stopColor="#780000" />
                  <stop offset="85%" stopColor="#680000" />
                  <stop offset="100%" stopColor="#680000" />
                </linearGradient>

                {/* 3D Specular Golden Rim along the curved crest */}
                <linearGradient id="topGoldCrest" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#D97706" stopOpacity="0.8" />
                  <stop offset="15%" stopColor="#F59E0B" stopOpacity="0.95" />
                  <stop offset="35%" stopColor="#FDE68A" stopOpacity="1" />
                  <stop offset="50%" stopColor="#FFFBEB" stopOpacity="1" />
                  <stop offset="65%" stopColor="#FDE68A" stopOpacity="1" />
                  <stop offset="85%" stopColor="#F59E0B" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#D97706" stopOpacity="0.8" />
                </linearGradient>

                {/* Top ambient golden light sheen tracing beneath the curve */}
                <linearGradient id="topAmbientSheen" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#FBBF24" stopOpacity="0.65" />
                  <stop offset="60%" stopColor="#F59E0B" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#780000" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* 1. Background Fill Path - extends to y=64 to overlap section seamlessly */}
              <path
                d="M 0,64 L 0,20 Q 0,0 20,0 L 142,0 C 158,0 162,37 200,37 C 238,37 242,0 258,0 L 380,0 Q 400,0 400,20 L 400,64 Z"
                fill="url(#cardTopGrad)"
              />

              {/* 2. Ambient Golden Light Sheen tracing the inner curve (3D light reflection) */}
              <path
                d="M 2,20 Q 2,2 20,2 L 142,2 C 158,2 162,37 200,37 C 238,37 242,2 258,2 L 380,2 Q 398,2 398,20"
                fill="none"
                stroke="url(#topAmbientSheen)"
                strokeWidth="5"
                strokeLinecap="round"
              />

              {/* 3. Base Golden Border along the curve and sides - extends down to y=64 */}
              <path
                d="M 1,64 L 1,20 Q 1,1 20,1 L 142,1 C 158,1 162,37 200,37 C 238,37 242,1 258,1 L 380,1 Q 399,1 399,20 L 399,64"
                fill="none"
                stroke="rgba(245, 158, 11, 0.75)"
                strokeWidth="2"
              />

              {/* 4. Luminous 3D Golden Crest (Top Highlight Bevel) */}
              <path
                d="M 1,20 Q 1,1 20,1 L 142,1 C 158,1 162,37 200,37 C 238,37 242,1 258,1 L 380,1 Q 399,1 399,20"
                fill="none"
                stroke="url(#topGoldCrest)"
                strokeWidth="2.5"
                strokeLinecap="round"
              />

              {/* 5. Fine Specular Reflection along the center curve */}
              <path
                d="M 25,1 L 142,1 C 158,1 162,37 200,37 C 238,37 242,1 258,1 L 375,1"
                fill="none"
                stroke="rgba(255, 255, 255, 0.5)"
                strokeWidth="1"
                strokeLinecap="round"
              />
            </svg>

            {/* Logo positioned precisely inside the curved arch */}
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 z-20">
              <Logo size={115} className="mb-0 drop-shadow-[0_10px_20px_rgba(0,0,0,0.9)]" />
            </div>
          </div>

          {/* Card Body - Vibrant PUP Brand Maroon (#680000 -> #5e0000 -> #4d0000) with no horizontal seam */}
          <section className="relative rounded-b-[1.75rem] sm:rounded-b-[2rem] border-x-2 border-b-2 border-amber-400/80 bg-gradient-to-b from-[#680000] via-[#5e0000] to-[#4d0000] p-6 pt-7 sm:p-8 sm:pt-8 backdrop-blur-xl">
            <div className="mt-2 mb-6 sm:mb-7 text-center">
              <h2 className="text-2xl sm:text-3xl font-black tracking-wider text-amber-300 uppercase mb-1 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                Sign In
              </h2>
              {/* Sleek Golden Divider matching the 3D modal */}
              <div className="mx-auto my-3 h-0.5 w-14 rounded-full bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
              <p className="text-amber-100/90 text-xs sm:text-sm font-medium tracking-wide">
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
            />
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

      <PupWebBadge />
    </main>
  );
}
