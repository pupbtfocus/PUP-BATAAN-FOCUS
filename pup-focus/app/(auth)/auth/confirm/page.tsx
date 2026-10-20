"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CampusBackground } from "@/components/shared/campus-background";
import { CancelledInviteModal } from "@/components/auth/cancelled-invite-modal";
import { EmailVerificationCard } from "@/components/auth/email-verification-card";

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

  if (normalized.includes("cancel")) {
    return "This invitation was cancelled by an administrator. Please contact your institution if you need a new invite.";
  }

  if (
    normalized.includes("otp_expired") ||
    normalized.includes("expired") ||
    normalized.includes("invalid") ||
    normalized.includes("access_denied")
  ) {
    return "This invitation link has expired or was already used. If your account is already set up, please sign in. Otherwise, ask an administrator to send a new invite.";
  }

  return message;
}

function AuthConfirmContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [statusMessage, setStatusMessage] = useState("Verifying your invitation link...");
  const [showCancelledModal, setShowCancelledModal] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [userFullName, setUserFullName] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [isEmailChange, setIsEmailChange] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function confirmInvite() {
      const hashParams = readHashParams();
      const modeParam =
        searchParams.get("mode") ?? hashParams.get("mode") ?? "";
      if (modeParam === "email_change") {
        setIsEmailChange(true);
      }
      const code = searchParams.get("code");
      const accessToken =
        hashParams.get("access_token") ?? searchParams.get("access_token");
      const refreshToken =
        hashParams.get("refresh_token") ?? searchParams.get("refresh_token");
      const tokenHash =
        hashParams.get("token_hash") ?? searchParams.get("token_hash");
      const token = hashParams.get("token") ?? searchParams.get("token");
      const error = hashParams.get("error") ?? searchParams.get("error");
      const passedEmail =
        searchParams.get("email") ?? hashParams.get("email") ?? "";

      if (passedEmail) {
        setUserEmail(passedEmail);
      }

      const isExplicitCancelled =
        searchParams.get("cancelled") === "true" ||
        searchParams.get("status") === "cancelled" ||
        error?.toLowerCase().includes("cancel");

      async function checkAndSetError(errorMessage: string) {
        if (cancelled) return;
        let isCancelled = false;
        const checkEmail = userEmail || passedEmail;
        try {
          const checkUrl = checkEmail
            ? `/api/auth/invite/check-cancelled?email=${encodeURIComponent(checkEmail)}`
            : "/api/auth/invite/check-cancelled";
          const checkRes = await fetch(checkUrl);
          if (checkRes.ok) {
            const checkData = await checkRes.json();
            if (checkData.isCancelled) {
              isCancelled = true;
              if (checkData.email) setUserEmail(checkData.email);
              if (checkData.fullName) setUserFullName(checkData.fullName);
            }
          }
        } catch {
          // ignore check error
        }

        // Only genuine admin cancellations open the "Invitation Cancelled" modal.
        // Expired / already-used links (access_denied, otp_expired) get their own message.
        const isCancelledError =
          isCancelled ||
          isExplicitCancelled ||
          errorMessage.toLowerCase().includes("cancel");

        if (isCancelledError) {
          setStatus("error");
          setStatusMessage(
            "This invitation was cancelled by an institutional administrator. The link you clicked is no longer valid."
          );
          setShowCancelledModal(true);
        } else {
          setStatus("error");
          setStatusMessage(formatInviteError(errorMessage));
        }
      }

      if (isExplicitCancelled) {
        await checkAndSetError("cancelled");
        return;
      }

      if (error) {
        await checkAndSetError(decodeURIComponent(error));
        return;
      }

      const supabase = createClient();
      const verificationType =
        (searchParams.get("type") as string | null) ||
        (hashParams.get("type") as string | null) ||
        "invite";

      // Clear local session before exchanging new tokens, using local scope so we never revoke the new token on the server
      if (
        code ||
        tokenHash ||
        token ||
        (accessToken && refreshToken)
      ) {
        try {
          await supabase.auth.signOut({ scope: "local" });
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
          await checkAndSetError(sessionError.message);
          return;
        }
      }

      if (code) {
        const { error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code);

        if (cancelled) return;

        if (exchangeError) {
          await checkAndSetError(exchangeError.message);
          return;
        }
      } else if (tokenHash) {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: verificationType as any,
        });

        if (cancelled) return;

        if (verifyError) {
          await checkAndSetError(verifyError.message);
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
          await checkAndSetError(verifyError.message);
          return;
        }
      } else {
        const { data: userCheck } = await supabase.auth.getUser();
        if (!userCheck?.user) {
          await checkAndSetError(
            "Missing invitation token. Please check your invitation email link."
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
        await checkAndSetError(
          "Could not establish user session. Please try clicking the invitation link again."
        );
        return;
      }

      const derivedEmail = userSession.email || "";
      setUserEmail(derivedEmail);

      const isPendingEmailChangeMeta = Boolean(
        (userSession.user_metadata as any)?.pending_email_change_verification,
      );
      if (isPendingEmailChangeMeta) {
        setIsEmailChange(true);
      }

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
          email: derivedEmail,
          full_name: fullName,
          mode:
            modeParam === "email_change" || isPendingEmailChangeMeta
              ? "email_change"
              : undefined,
        }),
      });

      const completeBody = (await completeResponse.json()) as {
        success?: boolean;
        bootstrapped?: boolean;
        isEmailChange?: boolean;
        tempPasswordIssued?: boolean;
        tempPasswordEmailSent?: boolean;
        tempPasswordError?: string;
        tempPassword?: string;
        email?: string;
        fullName?: string;
        error?: string;
      };

      if (!completeResponse.ok) {
        await checkAndSetError(
          completeBody.error ??
            completeBody.tempPasswordError ??
            "Failed to complete invitation setup."
        );
        return;
      }

      await supabase.auth.signOut({ scope: "local" });

      if (completeBody.isEmailChange) {
        setIsEmailChange(true);
      }
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
    <main className="relative min-h-screen w-full flex flex-col items-center justify-center p-4 text-[#fff8e7] overflow-x-hidden bg-[#1c0406]">
      <CampusBackground />
      {/* Overlay with Blur on top of the global body background */}
      <div className="absolute inset-0 z-0 bg-transparent backdrop-blur-[6px] pointer-events-none" />
      <div className="absolute inset-0 z-0 bg-gradient-to-t from-black/50 via-black/20 to-black/30 pointer-events-none" />

      <div className="relative z-10 w-full max-w-[420px] mx-auto my-auto py-3 sm:py-5 px-4 drop-shadow-2xl">
        <CancelledInviteModal
          isOpen={showCancelledModal}
          email={userEmail || searchParams.get("email") || undefined}
          fullName={userFullName || undefined}
          onClose={() => setShowCancelledModal(false)}
          onReturnToSignIn={() => router.push("/")}
        />

        <EmailVerificationCard
          status={showCancelledModal ? "cancelled" : status}
          email={userEmail || undefined}
          fullName={userFullName || undefined}
          temporaryPassword={tempPassword}
          errorMessage={statusMessage}
          isEmailChange={isEmailChange}
          onSignIn={() => router.push("/")}
          onReturnToSignIn={() => router.push("/")}
        />
      </div>
    </main>
  );
}

export default function AuthConfirmPage() {
  return (
    <Suspense
      fallback={
        <main className="relative min-h-screen w-full flex flex-col items-center justify-center p-4 text-[#fff8e7] overflow-x-hidden bg-[#1c0406]">
          <CampusBackground />
          <div className="absolute inset-0 z-0 bg-transparent backdrop-blur-[6px] pointer-events-none" />
          <div className="absolute inset-0 z-0 bg-gradient-to-t from-black/50 via-black/20 to-black/30 pointer-events-none" />
          <div className="relative z-10 w-full max-w-[420px] mx-auto my-auto py-3 sm:py-5 px-4 drop-shadow-2xl">
            <EmailVerificationCard status="loading" />
          </div>
        </main>
      }
    >
      <AuthConfirmContent />
    </Suspense>
  );
}
