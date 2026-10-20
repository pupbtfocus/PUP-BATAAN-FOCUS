"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/utils/cn";
import { createClient } from "@/lib/supabase/client";
import { resetDashboardNavigationState } from "@/config/routes";
import { LogOut, Xmark } from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";

export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
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
    <>
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        disabled={isLoggingOut}
        className={cn(
          "inline-flex items-center justify-center shrink-0 rounded-xl border border-amber-400/40 bg-[#650000] hover:bg-[#500000] hover:border-amber-400 text-amber-100 hover:text-white px-3 sm:px-4 py-1.5 text-xs font-bold transition-all shadow-xs cursor-pointer whitespace-nowrap disabled:opacity-50 active:scale-95",
          className,
        )}
      >
        Logout
      </button>

      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-dialog-title"
          onClick={() => {
            if (!isLoggingOut) setIsModalOpen(false);
          }}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-[#800000] border-2 border-amber-400 shadow-[0_20px_50px_rgba(0,0,0,0.6),0_0_30px_rgba(128,0,0,0.4)] overflow-hidden animate-in zoom-in-95 duration-150 text-left text-white"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-amber-400/30 px-5 py-4 bg-[#680000]/70">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-[#650000] text-amber-300 border border-amber-400/40 flex items-center justify-center">
                  <AppIcon icon={LogOut} size="md" color="inherit" />
                </div>
                <div>
                  <h3 id="logout-dialog-title" className="text-base font-bold text-amber-200">
                    Confirm Logout
                  </h3>
                  <p className="text-xs text-amber-100/70">
                    End your active session
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isLoggingOut}
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg border border-[#5e0000] bg-[#780000] hover:bg-[#5e0000] text-white transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                aria-label="Close"
              >
                <AppIcon icon={Xmark} size="sm" color="inherit" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 text-xs sm:text-sm text-amber-50/95 leading-relaxed">
              Are you sure you want to log out of PUP FOCUS? You will need to enter your institutional credentials again to sign back in.
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-amber-400/30 bg-[#680000]/70">
              <button
                type="button"
                disabled={isLoggingOut}
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isLoggingOut}
                onClick={handleLogout}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-600 text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {isLoggingOut ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>Logging out...</span>
                  </>
                ) : (
                  <span>Log Out</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
