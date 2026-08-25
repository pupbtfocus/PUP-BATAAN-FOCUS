"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function AuthHashListener() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const hash = window.location.hash;
    if (!hash) return;

    const hasAccessToken = hash.includes("access_token");
    const isInviteOrRecovery =
      hasAccessToken &&
      (hash.includes("type=invite") ||
        hash.includes("type=recovery") ||
        hash.includes("type=signup") ||
        !hash.includes("type="));

    if (isInviteOrRecovery || hasAccessToken) {
      const supabase = createClient();

      // Clear stale local session first if any to prevent session collisions
      supabase.auth.signOut().then(() => {
        const hashParams = new URLSearchParams(
          hash.startsWith("#") ? hash.substring(1) : hash,
        );
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");

        if (accessToken && refreshToken) {
          supabase.auth
            .setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            })
            .then(({ data, error }: { data: any; error: any }) => {
              if (!error && data?.session) {
                window.history.replaceState(null, "", window.location.pathname);
                router.replace("/auth/set-password");
              }
            });
        }
      });
    }
  }, [router]);

  return null;
}
