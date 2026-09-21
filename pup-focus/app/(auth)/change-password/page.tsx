"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ROLE, type AppRole } from "@/config/roles";
import { CampusBackground } from "@/components/shared/campus-background";
import { Logo } from "@/components/ui/logo";
import { PupWebBadge } from "@/components/auth/pup-web-badge";
import { AppIcon } from "@/components/ui/app-icon";
import {
  CheckCircle,
  Eye,
  EyeClosed,
  Key,
  NavArrowRight,
  SystemRestart,
  WarningCircle,
} from "iconoir-react";

const ROUTE_BY_ROLE: Record<AppRole, string> = {
  [ROLE.SUPER_ADMIN]: "/super-admin/dashboard",
  [ROLE.ADMIN]: "/admin/dashboard",
  [ROLE.FACULTY]: "/faculty/dashboard",
};

export default function ChangePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    if (password !== confirm) {
      setError("Password confirmation does not match.");
      return;
    }

    setIsSaving(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password,
      data: {
        must_change_password: false,
        force_password_change: false,
      },
    });

    if (updateError) {
      setError(updateError.message);
      setIsSaving(false);
      return;
    }

    const { data } = await supabase.auth.getUser();
    const signedInRole =
      (data.user?.user_metadata?.role as AppRole | undefined) ??
      (data.user?.app_metadata?.role as AppRole | undefined) ??
      ROLE.ADMIN;

    // After successful password change, navigate to role dashboard
    const nextRoute = ROUTE_BY_ROLE[signedInRole];
    setSuccess("Password updated successfully. Redirecting to your portal...");
    setIsSaving(false);
    window.setTimeout(() => {
      window.location.assign(nextRoute);
    }, 2000);
  }

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
                <linearGradient id="changePassTopGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#8a0c0c" />
                  <stop offset="40%" stopColor="#780000" />
                  <stop offset="85%" stopColor="#680000" />
                  <stop offset="100%" stopColor="#680000" />
                </linearGradient>
                <linearGradient id="changePassTopGoldCrest" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#D97706" stopOpacity="0.8" />
                  <stop offset="15%" stopColor="#F59E0B" stopOpacity="0.95" />
                  <stop offset="35%" stopColor="#FDE68A" stopOpacity="1" />
                  <stop offset="50%" stopColor="#FFFBEB" stopOpacity="1" />
                  <stop offset="65%" stopColor="#FDE68A" stopOpacity="1" />
                  <stop offset="85%" stopColor="#F59E0B" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#D97706" stopOpacity="0.8" />
                </linearGradient>
                <linearGradient id="changePassTopAmbientSheen" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#FBBF24" stopOpacity="0.65" />
                  <stop offset="60%" stopColor="#F59E0B" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#780000" stopOpacity="0" />
                </linearGradient>
              </defs>

              <path
                d="M 0,64 L 0,20 Q 0,0 20,0 L 142,0 C 158,0 162,37 200,37 C 238,37 242,0 258,0 L 380,0 Q 400,0 400,20 L 400,64 Z"
                fill="url(#changePassTopGrad)"
              />
              <path
                d="M 2,20 Q 2,2 20,2 L 142,2 C 158,2 162,37 200,37 C 238,37 242,2 258,2 L 380,2 Q 398,2 398,20"
                fill="none"
                stroke="url(#changePassTopAmbientSheen)"
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
                stroke="url(#changePassTopGoldCrest)"
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
            <div className="mt-2 mb-6 sm:mb-7 text-center">
              <h1 className="text-2xl sm:text-3xl font-black tracking-wider text-amber-300 uppercase mb-1 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                Set New Password
              </h1>
              <div className="mx-auto my-3 h-0.5 w-14 rounded-full bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
              <p className="text-amber-100/90 text-xs sm:text-sm font-medium tracking-wide">
                Create a permanent password to secure your institutional account
              </p>
            </div>

            <form className="space-y-4" onSubmit={onSubmit}>
              {/* New Password Field */}
              <div className="space-y-1.5 text-left">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] uppercase font-bold tracking-wider text-amber-300 flex items-center gap-1.5">
                    <AppIcon icon={Key} size="sm" color="active" />
                    <span>New Password</span>
                  </label>
                  <span className="text-[10px] text-amber-200/70 font-medium">Min. 8 characters</span>
                </div>
                <div className="relative flex items-center">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder="Enter new password"
                    autoComplete="new-password"
                    className="pup-login-input w-full rounded-xl border !border-amber-500/40 !bg-[#2b0000] pl-4 pr-11 py-3 text-xs sm:text-sm !text-amber-50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6),0_1px_0_rgba(255,215,0,0.12)] outline-none transition-all duration-200 placeholder:!text-amber-200/40 hover:!border-amber-400/80 focus:!border-amber-400 focus:!ring-1 focus:!ring-amber-400/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-amber-400/80 hover:text-amber-300 transition-colors cursor-pointer"
                    title={showPassword ? "Hide password" : "Show password"}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <AppIcon icon={EyeClosed} size="sm" color="inherit" />
                    ) : (
                      <AppIcon icon={Eye} size="sm" color="inherit" />
                    )}
                  </button>
                </div>
              </div>

              {/* Confirm Password Field */}
              <div className="space-y-1.5 text-left">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] uppercase font-bold tracking-wider text-amber-300 flex items-center gap-1.5">
                    <AppIcon icon={Key} size="sm" color="active" />
                    <span>Confirm Password</span>
                  </label>
                  <span className="text-[10px] text-amber-200/70 font-medium">Must match</span>
                </div>
                <div className="relative flex items-center">
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    minLength={8}
                    placeholder="Confirm new password"
                    autoComplete="new-password"
                    className="pup-login-input w-full rounded-xl border !border-amber-500/40 !bg-[#2b0000] pl-4 pr-11 py-3 text-xs sm:text-sm !text-amber-50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6),0_1px_0_rgba(255,215,0,0.12)] outline-none transition-all duration-200 placeholder:!text-amber-200/40 hover:!border-amber-400/80 focus:!border-amber-400 focus:!ring-1 focus:!ring-amber-400/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-amber-400/80 hover:text-amber-300 transition-colors cursor-pointer"
                    title={showConfirm ? "Hide password" : "Show password"}
                    aria-label={showConfirm ? "Hide password" : "Show password"}
                  >
                    {showConfirm ? (
                      <AppIcon icon={EyeClosed} size="sm" color="inherit" />
                    ) : (
                      <AppIcon icon={Eye} size="sm" color="inherit" />
                    )}
                  </button>
                </div>
              </div>

              {/* Error Alert */}
              {error && (
                <div className="rounded-xl border border-rose-500/40 bg-rose-950/40 p-3 text-left flex items-start gap-2.5 text-xs text-rose-200">
                  <AppIcon icon={WarningCircle} size="sm" color="danger" className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Success Alert */}
              {success && (
                <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/40 p-3 text-left flex items-start gap-2.5 text-xs text-emerald-200">
                  <AppIcon icon={CheckCircle} size="sm" color="success" className="shrink-0 mt-0.5" />
                  <span>{success}</span>
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isSaving}
                className="mt-2 h-11 sm:h-12 w-full rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 font-extrabold text-[#3d0000] tracking-widest uppercase text-xs transition-all duration-300 hover:from-amber-300 hover:to-amber-400 active:scale-95 cursor-pointer shadow-md shadow-black/30 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <AppIcon icon={SystemRestart} size="sm" color="inherit" className="animate-spin" />
                    <span>Saving Password...</span>
                  </>
                ) : (
                  <>
                    <span>Set Password & Continue</span>
                    <AppIcon icon={NavArrowRight} size="sm" color="inherit" />
                  </>
                )}
              </Button>
            </form>
          </section>
        </div>
      </div>

      <PupWebBadge />
    </main>
  );
}
