"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
    return "This invite was already used. Please ask an administrator to send a new invite.";
  }

  if (normalized.includes("expired")) {
    return "This invitation link has expired. Please ask an administrator to send a new invite.";
  }

  return message;
}

function AuthConfirmContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Verifying invitation link...");

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
      const next = searchParams.get("next") ?? "/super-admin/dashboard";
      const error = hashParams.get("error") ?? searchParams.get("error");

      if (error) {
        setMessage(formatInviteError(decodeURIComponent(error)));
        return;
      }

      const supabase = createClient();
      // Determine verification type (invite, recovery, etc.) from URL if present
      const verificationType =
        (searchParams.get("type") as string | null) ||
        (hashParams.get("type") as string | null) ||
        "invite";

      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (cancelled) {
          return;
        }

        if (sessionError) {
          setMessage(formatInviteError(sessionError.message));
          return;
        }
      }

      if (code) {
        const { error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code);

        if (cancelled) {
          return;
        }

        if (exchangeError) {
          setMessage(formatInviteError(exchangeError.message));
          return;
        }
      } else if (tokenHash) {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: verificationType as any,
        });

        if (cancelled) {
          return;
        }

        if (verifyError) {
          setMessage(formatInviteError(verifyError.message));
          return;
        }
      } else if (token) {
        const verifyParams = {
          token,
          type: verificationType,
        } as Parameters<typeof supabase.auth.verifyOtp>[0];

        const { error: verifyError } =
          await supabase.auth.verifyOtp(verifyParams);

        if (cancelled) {
          return;
        }

        if (verifyError) {
          setMessage(formatInviteError(verifyError.message));
          return;
        }
      } else if (!accessToken || !refreshToken) {
        setMessage("Missing invitation token.");
        return;
      }

      if (cancelled) {
        return;
      }

      const completeResponse = await fetch("/api/auth/invite/complete", {
        method: "POST",
      });

      const completeBody = (await completeResponse.json()) as {
        success?: boolean;
        bootstrapped?: boolean;
        tempPasswordIssued?: boolean;
        tempPasswordEmailSent?: boolean;
        tempPasswordError?: string;
        error?: string;
      };

      if (!completeResponse.ok) {
        setMessage(
          completeBody.error ??
            completeBody.tempPasswordError ??
            "Failed to complete invite.",
        );
        return;
      }

      await supabase.auth.signOut();

      setMessage(
        completeBody.tempPasswordEmailSent
          ? "Email verified. A temporary password has been emailed to you. Sign in with your email and the temporary password, then change it on first login."
          : `Email verified, but the temporary password could not be emailed automatically.${completeBody.tempPasswordError ? ` ${completeBody.tempPasswordError}` : ""} Please ask an administrator to resend it.`,
      );
    }

    void confirmInvite();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <main className="min-h-screen grid place-items-center px-6 text-[#fff8e7]">
      <section className="w-full max-w-md rounded-3xl border border-[rgba(255,215,0,0.18)] bg-[#4d0000]/80 p-8 shadow-2xl shadow-black/20 backdrop-blur">
        <p className="text-xs uppercase tracking-[0.28em] text-[#ffd700]">
          PUP FOCUS
        </p>
        <h1 className="mt-3 text-2xl font-bold">Confirming invitation</h1>
        <p className="mt-3 text-sm text-[#f3d9b3]">{message}</p>
        <div className="mt-4 flex justify-end">
          <a
            href="/sign-in"
            className="rounded-md bg-amber-400 px-4 py-2 text-sm font-medium text-slate-900"
          >
            Go to sign in
          </a>
        </div>
      </section>
    </main>
  );
}

export default function AuthConfirmPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen grid place-items-center px-6 text-[#fff8e7]">
          <section className="w-full max-w-md rounded-3xl border border-[rgba(255,215,0,0.18)] bg-[#4d0000]/80 p-8 shadow-2xl shadow-black/20 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.28em] text-[#ffd700]">
              PUP FOCUS
            </p>
            <h1 className="mt-3 text-2xl font-bold">Confirming invitation</h1>
            <p className="mt-3 text-sm text-[#f3d9b3]">
              Verifying invitation link...
            </p>
          </section>
        </main>
      }
    >
      <AuthConfirmContent />
    </Suspense>
  );
}
