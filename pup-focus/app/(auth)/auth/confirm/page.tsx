"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Copy,
  Check,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Mail,
  KeyRound,
  ArrowRight,
} from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { PupWebBadge } from "@/components/auth/pup-web-badge";
import { createClient } from "@/lib/supabase/client";

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
      } else if (!accessToken || !refreshToken) {
        setStatus("error");
        setStatusMessage("Missing invitation token. Please check your invitation email link.");
        return;
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
    <main className="relative min-h-screen flex flex-col items-center justify-center px-3 sm:px-4 py-6 sm:py-10 text-[#fff8e7] overflow-x-hidden">
      {/* Background Overlays with Backdrop Blur */}
      <div className="absolute inset-0 z-0 bg-transparent backdrop-blur-[6px]" />
      <div className="absolute inset-0 z-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

      <div className="relative z-10 w-full max-w-[420px] sm:max-w-lg mx-auto my-auto pt-6 sm:pt-10 pb-12 sm:pb-8">
        <div className="relative w-full mx-auto">
          {/* Curved Card Top Header SVG */}
          <div className="relative">
            <svg
              viewBox="0 0 400 60"
              className="w-full h-auto text-[#4d0000] fill-current stroke-[rgba(255,215,0,0.25)] stroke-[1] block -mb-0.5 pointer-events-none"
            >
              <path d="M 0,60 L 0,20 Q 0,0 20,0 L 130,0 C 150,0 155,45 200,45 C 245,45 250,0 270,0 L 380,0 Q 400,0 400,20 L 400,60 Z" />
            </svg>

            {/* PUP Logo centered inside the arch */}
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-20">
              <Logo size={145} className="mb-0" />
            </div>
          </div>

          {/* Card Body */}
          <section className="relative rounded-b-[1.75rem] sm:rounded-b-[2rem] border-x border-b border-[rgba(255,215,0,0.25)] bg-[#4d0000] p-6 pt-10 sm:p-8 sm:pt-10 backdrop-blur-md shadow-2xl">
            {/* Header / Title Area */}
            <div className="mt-4 mb-5 text-center">
              <p className="text-[10px] sm:text-xs font-bold tracking-[0.25em] text-amber-300 uppercase mb-1 drop-shadow-[0_1px_4px_rgba(255,215,0,0.3)]">
                PUP FOCUS • BATAAN CAMPUS
              </p>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-wider text-amber-200 drop-shadow-[0_2px_8px_rgba(255,215,0,0.3)] uppercase mb-1">
                {status === "loading"
                  ? "Verifying Link"
                  : status === "success"
                  ? "Account Ready"
                  : "Invite Verification"}
              </h1>
              <div className="mx-auto my-2.5 h-[2px] w-14 rounded-full bg-gradient-to-r from-transparent via-amber-400/70 to-transparent" />
              <p className="text-xs sm:text-sm text-amber-100/90 leading-relaxed max-w-sm mx-auto">
                {statusMessage}
              </p>
            </div>

            {/* 1. Loading State */}
            {status === "loading" && (
              <div className="py-8 flex flex-col items-center justify-center gap-4 text-center">
                <div className="relative">
                  <div className="h-14 w-14 rounded-full border-4 border-amber-400/20 border-t-amber-400 animate-spin" />
                  <Loader2 className="absolute inset-0 m-auto h-6 w-6 text-amber-300 animate-spin" />
                </div>
                <p className="text-xs text-amber-200/80 font-medium tracking-wide uppercase">
                  Securing institutional session...
                </p>
              </div>
            )}

            {/* 2. Error State */}
            {status === "error" && (
              <div className="space-y-5 py-2">
                <div className="rounded-xl border border-rose-500/40 bg-rose-950/40 p-4 text-left flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-rose-200/90 leading-relaxed">
                    <p className="font-semibold text-rose-200 mb-1">
                      Verification Notice
                    </p>
                    <p>{statusMessage}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => router.push("/")}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-[0.99] text-slate-950 font-bold text-sm py-3 px-4 shadow-lg transition duration-150"
                >
                  <span>Return to Sign In</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* 3. Success State with Credentials & Copy Buttons */}
            {status === "success" && (
              <div className="space-y-4 pt-1">
                {/* Success Banner */}
                <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-950/40 px-3.5 py-2.5 text-xs text-emerald-200">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span className="font-medium">
                    {userFullName ? `Welcome, ${userFullName}!` : "Credentials issued successfully."}
                  </span>
                </div>

                {/* Email Display Card */}
                {userEmail && (
                  <div className="space-y-1.5 text-left">
                    <label className="text-[10px] uppercase font-bold tracking-wider text-amber-300 flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-amber-400" />
                      <span>Institutional Email</span>
                    </label>
                    <div className="relative flex items-center rounded-xl border border-amber-400/30 bg-black/30 p-1.5 transition focus-within:border-amber-400 focus-within:ring-1 focus-within:ring-amber-400/30">
                      <input
                        type="text"
                        readOnly
                        value={userEmail}
                        className="w-full bg-transparent px-2.5 text-xs sm:text-sm text-slate-100 font-medium outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => copyToClipboard(userEmail, "email")}
                        className="flex items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-400/10 hover:bg-amber-400/20 active:scale-95 px-2.5 py-1.5 text-xs font-semibold text-amber-200 transition shrink-0"
                        title="Copy email"
                      >
                        {copiedField === "email" ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                            <span className="text-emerald-300 text-[11px]">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5 text-amber-300" />
                            <span className="text-[11px]">Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Temporary Password Card */}
                {tempPassword && (
                  <div className="space-y-1.5 text-left">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] uppercase font-bold tracking-wider text-amber-300 flex items-center gap-1.5">
                        <KeyRound className="h-3.5 w-3.5 text-amber-400" />
                        <span>Temporary Password</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="text-[10px] font-semibold text-amber-300/80 hover:text-amber-200 flex items-center gap-1 transition"
                      >
                        {showPassword ? (
                          <>
                            <EyeOff className="h-3 w-3" />
                            <span>Hide</span>
                          </>
                        ) : (
                          <>
                            <Eye className="h-3 w-3" />
                            <span>Reveal</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="relative flex items-center rounded-xl border border-amber-400/30 bg-black/40 p-1.5 transition focus-within:border-amber-400 focus-within:ring-1 focus-within:ring-amber-400/30">
                      <input
                        type={showPassword ? "text" : "password"}
                        readOnly
                        value={tempPassword}
                        className="w-full bg-transparent px-2.5 font-mono text-xs sm:text-sm text-amber-200 tracking-wider outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => copyToClipboard(tempPassword, "password")}
                        className="flex items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-400/10 hover:bg-amber-400/20 active:scale-95 px-2.5 py-1.5 text-xs font-semibold text-amber-200 transition shrink-0"
                        title="Copy password"
                      >
                        {copiedField === "password" ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                            <span className="text-emerald-300 text-[11px]">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5 text-amber-300" />
                            <span className="text-[11px]">Copy</span>
                          </>
                        )}
                      </button>
                    </div>

                    <p className="text-[10px] text-amber-200/70 pt-0.5">
                      💡 Please save or copy this password. You can set your personal password after signing in.
                    </p>
                  </div>
                )}

                {/* Primary Action Button (CTA) */}
                <div className="pt-3 space-y-2">
                  <button
                    type="button"
                    onClick={() => router.push("/")}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-300 hover:to-amber-200 active:scale-[0.99] text-slate-950 font-extrabold text-sm py-3 px-4 shadow-xl shadow-black/30 transition duration-150"
                  >
                    <span>Proceed to Sign In</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>

                  {userEmail && tempPassword && (
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(
                          `Email: ${userEmail}\nTemporary Password: ${tempPassword}`,
                          "all",
                        )
                      }
                      className="w-full text-center text-[11px] font-semibold text-amber-200/80 hover:text-amber-200 transition py-1 flex items-center justify-center gap-1.5"
                    >
                      {copiedField === "all" ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                          <span className="text-emerald-300">All credentials copied to clipboard!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span>Copy both email & password</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
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
