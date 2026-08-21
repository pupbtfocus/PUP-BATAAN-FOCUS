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
  "/program-head/dashboard",
] as const;

export default function Home() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeBanner | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authModal, setAuthModal] = useState<AuthModalState | null>(null);
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);

  useEffect(() => {
    PREFETCH_ROUTES.forEach((route) => {
      router.prefetch(route);
    });

    if (typeof window !== "undefined") {
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
  }, [router]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    const hashParams = new URLSearchParams(hash);
    const hasAuthCallback =
      hashParams.has("access_token") ||
      hashParams.has("token") ||
      hashParams.has("token_type") ||
      hashParams.has("type") ||
      hashParams.has("error");

    if (!hasAuthCallback) {
      return;
    }

    let cancelled = false;

    async function handleAuthCallback() {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();

      if (cancelled) {
        return;
      }

      const user = data.user;

      if (!user) {
        const errorDescription =
          hashParams.get("error_description") ??
          hashParams.get("error") ??
          "Unable to complete sign in.";
        setError(decodeURIComponent(errorDescription));
        return;
      }

      const mustChange =
        (user.user_metadata as any)?.must_change_password === true ||
        (user.user_metadata as any)?.force_password_change === true;
      if (mustChange) {
        window.history.replaceState(
          null,
          "",
          `${window.location.pathname}${window.location.search}`,
        );
        window.location.assign("/auth/change-password");
        return;
      }

      const signedInRole =
        (user.user_metadata?.role as AppRole | undefined) ??
        (user.app_metadata?.role as AppRole | undefined) ??
        ROLE.FACULTY;
      const nextTarget = ROUTE_BY_ROLE[signedInRole];

      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}`,
      );

      window.location.href = nextTarget;
    }

    void handleAuthCallback();

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
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
        title: "Invalid email address or password",
        message: "Invalid email address or password",
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

    setIsSubmitting(false);
    setAuthModal({
      title: "Welcome back",
      message: `You are signed in as ${ROLE_LABEL[signedInRole]}.`,
      actionLabel: "Continue",
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

      <div className="relative z-10 w-full max-w-[390px] sm:max-w-md mx-auto my-auto pt-8 sm:pt-12 pb-16 sm:pb-8">
        <div className="relative w-full mx-auto">
          {/* Curved Card Top Header SVG */}
          <div className="relative">
            <svg
              viewBox="0 0 400 60"
              className="w-full h-auto text-[#4d0000] fill-current stroke-[rgba(255,215,0,0.25)] stroke-[1] block -mb-0.5 pointer-events-none"
            >
              <path d="M 0,60 L 0,20 Q 0,0 20,0 L 130,0 C 150,0 155,45 200,45 C 245,45 250,0 270,0 L 380,0 Q 400,0 400,20 L 400,60 Z" />
            </svg>

            {/* Logo positioned precisely inside the arch */}
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-20">
              <Logo size={145} className="mb-0" />
            </div>
          </div>

          {/* Card Body */}
          <section className="relative rounded-b-[1.75rem] sm:rounded-b-[2rem] border-x border-b border-[rgba(255,215,0,0.25)] bg-[#4d0000] p-6 pt-10 sm:p-8 sm:pt-10 backdrop-blur-md">
            <div className="mt-4 mb-6 sm:mb-8 text-center">
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-wider text-amber-200 drop-shadow-[0_2px_8px_rgba(255,215,0,0.3)] uppercase mb-1">
                Sign In
              </h2>
              <div className="mx-auto my-2.5 h-[2px] w-12 rounded-full bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />
              <p className="text-[9px] sm:text-[10px] text-amber-200/90 font-bold tracking-widest uppercase mb-4 sm:mb-6">
                Enter your institutional credentials to continue
              </p>
            </div>

            <LoginForm
              email={email}
              setEmail={setEmail}
              password={password}
              setPassword={setPassword}
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
