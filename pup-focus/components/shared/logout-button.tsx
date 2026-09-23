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
        "inline-flex items-center justify-center rounded-xl border border-amber-500/30 bg-[#7a0000]/70 hover:bg-[#8d0000] hover:border-amber-400/50 text-amber-100 hover:text-white px-3.5 py-1.5 text-xs font-semibold transition-colors shadow-2xs cursor-pointer disabled:opacity-50",
        className,
      )}
    >
      {isLoggingOut ? "Logging out..." : "Logout"}
    </button>
  );
}
