"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, CheckCircle, Copy, Eye, EyeClosed, Mail, NavArrowRight, SystemRestart } from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";
import { Logo } from "@/components/ui/logo";
import { PupWebBadge } from "@/components/auth/pup-web-badge";
import { CampusBackground } from "@/components/shared/campus-background";
import { createClient } from "@/lib/supabase/client";
import loadingIcon from "@/assets/icons animations/loading.svg";
import successfullyIcon from "@/assets/icons animations/successfully.svg";
import failedIcon from "@/assets/icons animations/fail.svg";

function readHashParams() {
  if (typeof window === "undefined") {
    return new URLSearchParams();
  }

  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;

  return new URLSearchParams(hash);
}

function formatInviteError(message: string) {
  const normalized = message.trim().toLowerCase();

  if (normalized.includes("access_denied")) {
    return "This invite link was already used. Please ask an administrator to send a new invite or sign in if your account is already set up.";
  }

  if (normalized.includes("expired")) {
    return "This invitation link has expired. Please ask an administrator to send a new invite.";
  }

  return message;
}

function AuthConfirmContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [statusMessage, setStatusMessage] = useState("Verifying your invitation link...");
  const [userEmail, setUserEmail] = useState("");
  const [userFullName, setUserFullName] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<"email" | "password" | "all" | null>(null);

  const copyToClipboard = async (text: string, field: "email" | "password" | "all") => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopiedField(field);
      setTimeout(() => {
        setCopiedField((curr) => (curr === field ? null : curr));
      }, 2500);
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function confirmInvite() {
      const hashParams = readHashParams();
      const code = searchParams.get("code");
      const accessToken =
        hashParams.get("access_token") ?? searchParams.get("access_token");
      const refreshToken =
        hashParams.get("refresh_token") ?? searchParams.get("refresh_token");
      const tokenHash =
        hashParams.get("token_hash") ?? searchParams.get("token_hash");
      const token = hashParams.get("token") ?? searchParams.get("token");
      const error = hashParams.get("error") ?? searchParams.get("error");

      if (error) {
        setStatus("error");
        setStatusMessage(formatInviteError(decodeURIComponent(error)));
        return;
      }

      const supabase = createClient();
      const verificationType =
        (searchParams.get("type") as string | null) ||
        (hashParams.get("type") as string | null) ||
        "invite";

      // Force sign-out any existing active session (e.g. Superadmin) BEFORE code exchange
      // to avoid session collision and ensure invite setup belongs purely to the invited account.
      if (
        verificationType === "invite" ||
        code ||
        tokenHash ||
        token ||
        (accessToken && refreshToken)
      ) {
        try {
          await supabase.auth.signOut();
        } catch {
          // Ignore signOut errors
        }
      }

      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (cancelled) return;

        if (sessionError) {
          setStatus("error");
          setStatusMessage(formatInviteError(sessionError.message));
          return;
        }
      }

      if (code) {
        const { error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code);

        if (cancelled) return;

        if (exchangeError) {
          setStatus("error");
          setStatusMessage(formatInviteError(exchangeError.message));
          return;
        }
      } else if (tokenHash) {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: verificationType as any,
        });

        if (cancelled) return;

        if (verifyError) {
          setStatus("error");
          setStatusMessage(formatInviteError(verifyError.message));
          return;
        }
      } else if (token) {
        const verifyParams = {
          token,
          type: verificationType,
        } as Parameters<typeof supabase.auth.verifyOtp>[0];

        const { error: verifyError } =
          await supabase.auth.verifyOtp(verifyParams);

        if (cancelled) return;

        if (verifyError) {
          setStatus("error");
          setStatusMessage(formatInviteError(verifyError.message));
          return;
        }
      } else {
        const { data: userCheck } = await supabase.auth.getUser();
        if (!userCheck?.user) {
          setStatus("error");
          setStatusMessage(
            "Missing invitation token. Please check your invitation email link.",
          );
          return;
        }
      }

      if (cancelled) return;

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const userSession = user ?? (await supabase.auth.getSession()).data.session?.user;

      if (!userSession) {
        setStatus("error");
        setStatusMessage("Could not establish user session. Please try clicking the invitation link again.");
        return;
      }

      const derivedEmail = userSession.email || "";
      setUserEmail(derivedEmail);

      const fullName =
        (userSession.user_metadata && (userSession.user_metadata as any).full_name) ||
        (userSession.user_metadata && (userSession.user_metadata as any).first_name
          ? `${(userSession.user_metadata as any).first_name} ${(userSession.user_metadata as any).last_name || ""}`.trim()
          : undefined);

      if (fullName) {
        setUserFullName(fullName);
      }

      const completeResponse = await fetch("/api/auth/invite/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: userSession.id,
          full_name: fullName,
        }),
      });

      const completeBody = (await completeResponse.json()) as {
        success?: boolean;
        bootstrapped?: boolean;
        tempPasswordIssued?: boolean;
        tempPasswordEmailSent?: boolean;
        tempPasswordError?: string;
        tempPassword?: string;
        email?: string;
        fullName?: string;
        error?: string;
      };

      if (!completeResponse.ok) {
        setStatus("error");
        setStatusMessage(
          completeBody.error ??
            completeBody.tempPasswordError ??
            "Failed to complete invitation setup.",
        );
        return;
      }

      await supabase.auth.signOut();

      if (completeBody.email) {
        setUserEmail(completeBody.email);
      }
      if (completeBody.fullName) {
        setUserFullName(completeBody.fullName);
      }
      if (completeBody.tempPassword) {
        setTempPassword(completeBody.tempPassword);
      }

      setStatus("success");
      setStatusMessage(
        completeBody.tempPasswordEmailSent
          ? "Your institutional account is verified and ready. A copy of your credentials has also been sent to your email."
          : "Your institutional account is verified and ready. Please save your temporary login credentials below.",
      );
    }

    void confirmInvite();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

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
                <linearGradient id="confirmCardTopGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#8a0c0c" />
                  <stop offset="40%" stopColor="#780000" />
                  <stop offset="85%" stopColor="#680000" />
                  <stop offset="100%" stopColor="#680000" />
                </linearGradient>
                <linearGradient id="confirmTopGoldCrest" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#D97706" stopOpacity="0.8" />
                  <stop offset="15%" stopColor="#F59E0B" stopOpacity="0.95" />
                  <stop offset="35%" stopColor="#FDE68A" stopOpacity="1" />
                  <stop offset="50%" stopColor="#FFFBEB" stopOpacity="1" />
                  <stop offset="65%" stopColor="#FDE68A" stopOpacity="1" />
                  <stop offset="85%" stopColor="#F59E0B" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#D97706" stopOpacity="0.8" />
                </linearGradient>
                <linearGradient id="confirmTopAmbientSheen" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#FBBF24" stopOpacity="0.65" />
                  <stop offset="60%" stopColor="#F59E0B" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#780000" stopOpacity="0" />
                </linearGradient>
              </defs>

              <path
                d="M 0,64 L 0,20 Q 0,0 20,0 L 142,0 C 158,0 162,37 200,37 C 238,37 242,0 258,0 L 380,0 Q 400,0 400,20 L 400,64 Z"
                fill="url(#confirmCardTopGrad)"
              />
              <path
                d="M 2,20 Q 2,2 20,2 L 142,2 C 158,2 162,37 200,37 C 238,37 242,2 258,2 L 380,2 Q 398,2 398,20"
                fill="none"
                stroke="url(#confirmTopAmbientSheen)"
                strokeWidth="5"
                strokeLinecap="round"
              />
              <path
                d="M 1,64 L 1,20 Q 1,1 20,1 L 142,1 C 158,1 162,37 200,37 C 238,37 242,1 258,1 L 380,1 Q 399,1 399,20 L 399,64"
                fill="none"
                stroke="rgba(245, 158, 11, 0.75)"
                strokeWidth="2"
              />
              <path
                d="M 1,20 Q 1,1 20,1 L 142,1 C 158,1 162,37 200,37 C 238,37 242,1 258,1 L 380,1 Q 399,1 399,20"
                fill="none"
                stroke="url(#confirmTopGoldCrest)"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <path
                d="M 25,1 L 142,1 C 158,1 162,37 200,37 C 238,37 242,1 258,1 L 375,1"
                fill="none"
                stroke="rgba(255, 255, 255, 0.5)"
                strokeWidth="1"
                strokeLinecap="round"
              />
            </svg>

            <div className="absolute -top-8 left-1/2 -translate-x-1/2 z-20">
              <Logo size={115} className="mb-0 drop-shadow-[0_10px_20px_rgba(0,0,0,0.9)]" />
            </div>
          </div>

          {/* Card Body - Vibrant PUP Brand Maroon matching Login Screen */}
          <section className="relative rounded-b-[1.75rem] sm:rounded-b-[2rem] border-x-2 border-b-2 border-amber-400/80 bg-gradient-to-b from-[#680000] via-[#5e0000] to-[#4d0000] p-6 pt-7 sm:p-8 sm:pt-8 backdrop-blur-xl">
            {/* 1. Loading State */}
            {status === "loading" && (
              <div className="py-4 flex flex-col items-center justify-center text-center">
                <div className="relative flex items-center justify-center my-2">
                  <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-[#180000] border-2 border-amber-400/60 shadow-inner">
                    <div className="absolute inset-2 rounded-full border-2 border-amber-400/20 border-t-amber-400 border-r-amber-400/60 animate-spin" />
                    <Logo size={44} className="relative z-10" />
                  </div>
                </div>
                <h2 className="mt-3 text-2xl font-black uppercase tracking-wider text-amber-300">
                  Verifying Link
                </h2>
                <div className="relative w-36 h-1 rounded-full bg-amber-950/80 overflow-hidden border border-amber-400/25 shadow-[inset_0_1px_2px_rgba(0,0,0,0.6)] my-3">
                  <div className="absolute inset-y-0 w-2/5 rounded-full bg-gradient-to-r from-amber-500/20 via-amber-300 to-amber-500/20 animate-pup-shimmer shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
                </div>
                <p className="text-amber-100/90 text-xs sm:text-sm font-medium tracking-wide max-w-[280px]">
                  {statusMessage || "Verifying your invitation link with campus directory..."}
                </p>
                <div className="mt-5 flex items-center justify-center gap-2 text-xs font-semibold tracking-wide text-amber-300/90 py-1">
                  <AppIcon icon={SystemRestart} size="md" color="active" className="animate-spin" />
                  <span>Securing institutional session...</span>
                </div>
              </div>
            )}

            {/* 2. Error State */}
            {status === "error" && (
              <div className="py-4 flex flex-col items-center justify-center text-center">
                <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-[#180000] border-2 border-rose-500/50 shadow-inner my-2">
                  <img
                    src={
                      typeof failedIcon === "string"
                        ? failedIcon
                        : (failedIcon as any)?.src ?? "/icons-animations/fail.svg"
                    }
                    alt="Verification Failed"
                    className="h-14 w-14 object-contain"
                  />
                </div>
                <h2 className="mt-3 text-2xl font-black uppercase tracking-wider text-rose-200">
                  Verification Notice
                </h2>
                <div className="mx-auto my-3 h-0.5 w-14 rounded-full bg-gradient-to-r from-transparent via-rose-500/70 to-transparent shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
                <p className="text-rose-100/90 text-xs sm:text-sm font-medium tracking-wide leading-relaxed max-w-[300px]">
                  {statusMessage || "This invitation link was already used or has expired. Please request a new invite or sign in."}
                </p>

                <button
                  type="button"
                  onClick={() => router.push("/")}
                  className="mt-6 h-11 sm:h-12 w-full rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 font-extrabold text-[#3d0000] tracking-widest uppercase text-xs transition-all duration-300 hover:from-amber-300 hover:to-amber-400 active:scale-95 cursor-pointer shadow-md shadow-black/30 flex items-center justify-center gap-2"
                >
                  <span>Return to Sign In</span>
                  <AppIcon icon={NavArrowRight} size="sm" color="inherit" />
                </button>
              </div>
            )}

            {/* 3. Success State */}
            {status === "success" && (
              <div className="flex flex-col items-center text-center">
                <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-[#180000] border-2 border-emerald-500/50 shadow-inner my-2">
                  <img
                    src={
                      typeof successfullyIcon === "string"
                        ? successfullyIcon
                        : (successfullyIcon as any)?.src ?? "/icons-animations/successfully.svg"
                    }
                    alt="Success"
                    className="h-14 w-14 object-contain"
                  />
                </div>

                <h2 className="mt-3 text-2xl font-black uppercase tracking-wider text-amber-300">
                  Account Ready
                </h2>
                <div className="mx-auto my-3 h-0.5 w-14 rounded-full bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
                <p className="text-amber-100/90 text-xs sm:text-sm font-medium tracking-wide">
                  {userFullName ? `Welcome, ${userFullName}!` : "Your institutional credentials have been issued:"}
                </p>

                {/* Credentials Box */}
                <div className="mt-4 w-full space-y-2.5 text-left">
                  {/* Email Field */}
                  {userEmail && (
                    <div className="rounded-xl border border-amber-400/40 bg-black/40 p-2.5 flex items-center justify-between gap-2 shadow-inner">
                      <div className="min-w-0 flex-1">
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-amber-300/80">
                          Institutional Email
                        </span>
                        <span className="block text-xs sm:text-sm text-slate-100 font-medium truncate">
                          {userEmail}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(userEmail, "email")}
                        className="rounded-lg border border-amber-400/30 bg-amber-400/10 hover:bg-amber-400/20 px-2.5 py-1.5 text-xs font-semibold text-amber-200 transition shrink-0 cursor-pointer flex items-center gap-1"
                        title="Copy email"
                      >
                        {copiedField === "email" ? (
                          <>
                            <AppIcon icon={Check} size="xs" color="success" />
                            <span className="text-emerald-300 text-[11px]">Copied</span>
                          </>
                        ) : (
                          <>
                            <AppIcon icon={Copy} size="xs" color="inherit" />
                            <span className="text-[11px]">Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Temporary Password Field */}
                  {tempPassword && (
                    <div className="rounded-xl border border-amber-400/40 bg-black/40 p-2.5 flex items-center justify-between gap-2 shadow-inner">
                      <div className="min-w-0 flex-1">
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-amber-300/80">
                          Temporary Password
                        </span>
                        <span className="block text-xs sm:text-sm text-amber-200 font-mono font-bold tracking-wider truncate">
                          {showPassword ? tempPassword : "••••••••••••••••••••"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          className="p-1.5 rounded-lg text-amber-300/80 hover:text-amber-200 hover:bg-amber-400/10 transition cursor-pointer"
                          title={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? (
                            <AppIcon icon={EyeClosed} size="sm" color="inherit" />
                          ) : (
                            <AppIcon icon={Eye} size="sm" color="inherit" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(tempPassword, "password")}
                          className="rounded-lg border border-amber-400/30 bg-amber-400/10 hover:bg-amber-400/20 px-2.5 py-1.5 text-xs font-semibold text-amber-200 transition cursor-pointer flex items-center gap-1"
                          title="Copy password"
                        >
                          {copiedField === "password" ? (
                            <>
                              <AppIcon icon={Check} size="xs" color="success" />
                              <span className="text-emerald-300 text-[11px]">Copied</span>
                            </>
                          ) : (
                            <>
                              <AppIcon icon={Copy} size="xs" color="inherit" />
                              <span className="text-[11px]">Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Email Sent Notice */}
                <div className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl border border-amber-400/30 bg-black/30 px-3 py-2 text-center text-[11px] font-medium text-amber-200/90 shadow-xs">
                  <AppIcon icon={Mail} size="xs" color="active" className="shrink-0" />
                  <span>A copy of your temporary credentials has also been sent to your email.</span>
                </div>

                {/* Primary CTA Button */}
                <button
                  type="button"
                  onClick={() => router.push("/")}
                  className="mt-5 h-11 sm:h-12 w-full rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 font-extrabold text-[#3d0000] tracking-widest uppercase text-xs transition-all duration-300 hover:from-amber-300 hover:to-amber-400 active:scale-95 cursor-pointer shadow-md shadow-black/30 flex items-center justify-center gap-2"
                >
                  <span>Proceed to Sign In</span>
                  <AppIcon icon={NavArrowRight} size="sm" color="inherit" />
                </button>

                {/* Copy both helper */}
                {userEmail && tempPassword && (
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(
                        `Email: ${userEmail}\nTemporary Password: ${tempPassword}`,
                        "all"
                      )
                    }
                    className="mt-2.5 text-center text-[11px] font-semibold text-amber-200/80 hover:text-amber-100 transition py-1 flex items-center justify-center gap-1 cursor-pointer"
                  >
                    {copiedField === "all" ? (
                      <>
                        <AppIcon icon={Check} size="xs" color="success" />
                        <span className="text-emerald-300">All credentials copied to clipboard!</span>
                      </>
                    ) : (
                      <>
                        <AppIcon icon={Copy} size="xs" color="inherit" />
                        <span>Copy both email & password</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </section>
        </div>
      </div>

      <PupWebBadge />
    </main>
  );
}

export default function AuthConfirmPage() {
  return (
    <Suspense
      fallback={
        <main className="relative min-h-screen flex flex-col items-center justify-center px-4 py-8 text-[#fff8e7]">
          <div className="w-full max-w-md mx-auto text-center space-y-4">
            <div className="h-10 w-10 border-4 border-amber-400/20 border-t-amber-400 rounded-full animate-spin mx-auto" />
            <p className="text-sm font-medium text-amber-200">
              Loading verification...
            </p>
          </div>
        </main>
      }
    >
      <AuthConfirmContent />
    </Suspense>
  );
}
