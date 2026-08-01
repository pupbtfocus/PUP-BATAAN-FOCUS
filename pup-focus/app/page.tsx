"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/shared/brand-mark";
import { LoginForm } from "@/components/auth/login-form";
import { ForgotPasswordModal } from "@/components/auth/forgot-password-modal";
import {
  AuthFeedbackModal,
  type AuthModalState,
} from "@/components/auth/auth-feedback-modal";
import { PupWebBadge } from "@/components/auth/pup-web-badge";
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authModal, setAuthModal] = useState<AuthModalState | null>(null);
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);

  useEffect(() => {
    PREFETCH_ROUTES.forEach((route) => {
      router.prefetch(route);
    });
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
    setAuthModal(null);

    const normalizedEmail = email.trim().toLowerCase();

    if (!isValidEmailAddress(normalizedEmail)) {
      setError("Please provide a real email address.");
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
      const isInvalidCredentials =
        errorMessage === "Invalid login credentials";

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
      setError(
        "Your account has been deactivated. Contact an administrator.",
      );
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
    <main className="relative min-h-screen flex items-center justify-center px-4 py-8 text-[#fff8e7] overflow-hidden">
      {/* Overlay with Blur on top of the global body background */}
      <div className="absolute inset-0 z-0 bg-transparent backdrop-blur-[6px]" />
      <div className="absolute inset-0 z-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

      <div className="relative z-10 w-full max-w-md max-h-[calc(100vh-64px)] overflow-y-auto px-2 pt-24 pb-8 no-scrollbar">
        <section className="relative rounded-[2rem] border border-[rgba(255,215,0,0.2)] bg-[#4d0000]/95 p-8 backdrop-blur-md">
          {/* Logo container sits on top, with NO border */}
          <div className="absolute -top-14 left-1/2 z-10 flex h-[118px] w-[118px] -translate-x-1/2 items-center justify-center overflow-hidden rounded-full bg-[#4d0000] p-0 shadow-lg">
            <BrandMark
              size={126}
              className="shrink-0 translate-x-[2px] -translate-y-[3px] drop-shadow-[0_0_15px_rgba(255,215,0,0.2)]"
            />
          </div>

          <div className="mt-20 mb-8 text-center">
            <h2 className="bg-gradient-to-r from-amber-200 via-white to-amber-200 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent drop-shadow-[0_2px_8px_rgba(255,215,0,0.15)] uppercase">
              Sign In
            </h2>
            <div className="mx-auto mt-3 h-[2px] w-12 rounded-full bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />
            <p className="mt-4 text-[10px] font-bold uppercase tracking-widest text-[#f3d9b3]/65">
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
            publicEnvConfigured={Boolean(PUBLIC_ENV)}
          />
        </section>
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
