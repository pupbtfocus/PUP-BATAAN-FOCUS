"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/shared/brand-mark";
import { APP_CONFIG } from "@/config/app";
import { getPublicEnvSafe } from "@/config/env";
import { createClient } from "@/lib/supabase/client";
import { ROUTE_BY_ROLE } from "@/config/routes";
import { ROLE, ROLE_LABEL, type AppRole } from "@/config/roles";
import { isValidEmailAddress } from "@/lib/validation/email";

const SUPER_ADMIN_EMAIL = APP_CONFIG.superAdminEmail;
const PUBLIC_ENV = getPublicEnvSafe();

export default function Home() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authModal, setAuthModal] = useState<{
    title: string;
    message: string;
    actionLabel: string;
    variant: "success" | "error";
    redirectTo?: string;
  } | null>(null);

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

      router.replace(nextTarget);
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

      router.replace(ROUTE_BY_ROLE[signedInRole]);
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

    const timeoutId = window.setTimeout(() => {
      window.location.assign(authModal.redirectTo as string);
    }, 1200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [authModal]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setAuthModal(null);
    setIsSubmitting(true);

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

    let { error: signInError } = await signIn();

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

      ({ error: signInError } = await signIn());
    }

    if (signInError) {
      const isInvalidCredentials =
        signInError.message === "Invalid login credentials";

      setAuthModal({
        title: isInvalidCredentials
          ? "Invalid login credentials"
          : "Sign in failed",
        message: isInvalidCredentials
          ? "The email or password you entered is incorrect. Please try again."
          : signInError.message,
        actionLabel: "Try again",
        variant: "error",
      });
      setIsSubmitting(false);
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    // If the user's metadata requires a forced password change, redirect
    // them to the change-password page instead of the dashboard.
    const mustChange =
      (userData.user?.user_metadata as any)?.force_password_change === true;
    if (mustChange) {
      setIsSubmitting(false);
      window.location.assign("/auth/change-password");
      return;
    }
    try {
      const resp = await fetch("/api/auth/validate");
      if (resp.ok) {
        const body = await resp.json();
        if (body.is_active === false) {
          await supabase.auth.signOut();
          setError(
            "Your account has been deactivated. Contact an administrator.",
          );
          setIsSubmitting(false);
          return;
        }
      }
    } catch {
      // ignore validation errors and proceed
    }

    const signedInRole =
      (userData.user?.user_metadata?.role as AppRole | undefined) ??
      (userData.user?.app_metadata?.role as AppRole | undefined) ??
      ROLE.FACULTY;
    const nextTarget = ROUTE_BY_ROLE[signedInRole];

    setIsSubmitting(false);
    setAuthModal({
      title: "Signed in successfully",
      message: `Signed in successfully as ${ROLE_LABEL[signedInRole]}.`,
      actionLabel: "Continue",
      variant: "success",
      redirectTo: nextTarget,
    });
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-8 text-[#fff8e7]">
      <div className="w-full max-w-md max-h-[calc(100vh-64px)] overflow-y-auto">
        <section className="rounded-3xl border border-[rgba(255,215,0,0.18)] bg-[#4d0000]/80 p-6 shadow-2xl shadow-black/20 backdrop-blur">
          <div className="mb-6 text-center">
            <div className="flex justify-center">
              <BrandMark
                size={80}
                className="rounded-full shadow-lg shadow-black/20"
              />
            </div>
            <p className="mt-3 text-xs uppercase tracking-[0.28em] text-[#ffd700]">
              Polytechnic University of the Philippines - Bataan Campus
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">
              PUP FOCUS
            </h1>
          </div>

          <h2 className="text-xl font-semibold">Sign In</h2>
          <p className="mt-1 text-sm text-[#f3d9b3]">
            Enter your institutional email and password to sign in.
          </p>

          {!PUBLIC_ENV ? (
            <div className="mt-4 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
              Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and
              NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local before using sign in.
            </div>
          ) : null}

          <form className="mt-5 space-y-3" onSubmit={onSubmit}>
            <div>
              <label
                className="block text-sm font-medium text-[#fff8e7]"
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
                className="mt-2 w-full rounded-xl border border-[rgba(255,215,0,0.18)] bg-transparent px-4 py-3 text-sm text-white outline-none ring-[#ffd700]/40 placeholder:text-[#d8b882] focus:ring"
              />
            </div>

            <div>
              <label
                className="block text-sm font-medium text-[#fff8e7]"
                htmlFor="password"
              >
                Password
              </label>
              <div className="mt-2 relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  placeholder="Your password"
                  className="w-full rounded-xl border border-[rgba(255,215,0,0.18)] bg-transparent px-4 pr-12 py-3 text-sm text-white outline-none ring-[#ffd700]/40 placeholder:text-[#d8b882] focus:ring"
                />

                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-[rgba(255,255,255,0.18)] bg-[rgba(255,255,255,0.06)] p-1.5 text-white"
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
            </div>

            {error ? <p className="text-sm text-red-300">{error}</p> : null}

            <Button className="w-full" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Signing in..." : "Continue"}
            </Button>
          </form>
        </section>
      </div>
      {authModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
          <div className="w-full max-w-md rounded-3xl border border-[rgba(255,215,0,0.18)] bg-[#4d0000]/95 p-6 text-[#fff8e7] shadow-2xl shadow-black/30 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.28em] text-[#ffd700]">
              {authModal.variant === "success"
                ? "Sign In Success"
                : "Sign In Error"}
            </p>
            <h3 className="mt-3 text-xl font-semibold">{authModal.title}</h3>
            <p className="mt-3 whitespace-pre-wrap text-sm text-[#f3d9b3]">
              {authModal.message}
            </p>

            {authModal.variant === "error" ? (
              <div className="mt-6 flex justify-end">
                <Button
                  type="button"
                  onClick={() => {
                    setAuthModal(null);
                  }}
                >
                  {authModal.actionLabel}
                </Button>
              </div>
            ) : (
              <p className="mt-6 text-sm text-[#ffd700]">
                Redirecting you now...
              </p>
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}
