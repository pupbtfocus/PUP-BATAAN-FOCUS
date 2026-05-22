"use client";

import { useEffect, useState } from "react";
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

export default function AuthConfirmPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Verifying invitation link...");

  useEffect(() => {
    let cancelled = false;

    async function confirmInvite() {
      const hashParams = readHashParams();
      const code = searchParams.get("code");
      const tokenHash =
        hashParams.get("token_hash") ?? searchParams.get("token_hash");
      const token = hashParams.get("token") ?? searchParams.get("token");
      const next = searchParams.get("next") ?? "/super-admin/admin";
      const error = hashParams.get("error") ?? searchParams.get("error");

      if (error) {
        setMessage(decodeURIComponent(error));
        return;
      }

      const supabase = createClient();
      // Determine verification type (invite, recovery, etc.) from URL if present
      const verificationType =
        (searchParams.get("type") as string | null) ||
        (hashParams.get("type") as string | null) ||
        "invite";

      if (code) {
        const { error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code);

        if (cancelled) {
          return;
        }

        if (exchangeError) {
          setMessage(exchangeError.message);
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
          setMessage(verifyError.message);
          return;
        }
      } else if (token) {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token,
          type: verificationType as any,
        });

        if (cancelled) {
          return;
        }

        if (verifyError) {
          setMessage(verifyError.message);
          return;
        }
      } else {
        setMessage("Missing invitation token.");
        return;
      }

      if (cancelled) {
        return;
      }

      const completeResponse = await fetch("/api/auth/invite/complete", {
        method: "POST",
      });

      if (!completeResponse.ok) {
        try {
          const body = (await completeResponse.json()) as { error?: string };
          setMessage(body.error ?? "Failed to complete invite.");
        } catch {
          setMessage("Failed to complete invite.");
        }
        return;
      }

      router.replace(next);
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
      </section>
    </main>
  );
}
