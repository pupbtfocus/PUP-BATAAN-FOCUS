"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/utils/cn";
import { createClient } from "@/lib/supabase/client";
import { resetDashboardNavigationState } from "@/config/routes";

export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);

    resetDashboardNavigationState();

    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      // Ignore
    }

    const supabase = createClient();
    await supabase.auth.signOut();

    router.replace("/");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isLoggingOut}
      className={cn(
        "inline-flex items-center justify-center shrink-0 rounded-xl border border-amber-400/40 bg-[#650000] hover:bg-[#500000] hover:border-amber-400 text-amber-100 hover:text-white px-3 sm:px-4 py-1.5 text-xs font-bold transition-all shadow-xs cursor-pointer whitespace-nowrap disabled:opacity-50 active:scale-95",
        className,
      )}
    >
      {isLoggingOut ? "Logging out..." : "Logout"}
    </button>
  );
}
