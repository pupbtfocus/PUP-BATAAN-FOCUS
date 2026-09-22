"use client";

import React from "react";
import { Logo } from "@/components/ui/logo";

export interface LoadingScreenProps {
  text?: string;
  fullScreen?: boolean;
  className?: string;
}

export function SystemLoadingScreen({
  text = "Loading PUP FOCUS...",
  fullScreen = true,
  className = "",
}: LoadingScreenProps = {}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={text || "Loading system"}
      className={
        fullScreen
          ? `fixed inset-0 z-50 flex flex-col items-center justify-center p-4 select-none bg-black/80 backdrop-blur-md bg-[radial-gradient(ellipse_at_center,_rgba(120,0,0,0.35)_0%,_rgba(20,2,2,0.85)_60%,_rgba(10,0,0,0.95)_100%)] animate-in fade-in duration-300 ${className}`
          : `relative flex flex-col items-center justify-center min-h-[40vh] w-full p-8 rounded-2xl bg-gradient-to-b from-[#2a0000]/50 via-[#1a0000]/60 to-[#100000]/70 backdrop-blur-sm border border-amber-500/20 shadow-xl select-none animate-in fade-in duration-300 ${className}`
      }
    >
      {/* Central Identity: Official Logo with Delicate Golden Spinner & Glow */}
      <div className="relative flex items-center justify-center">
        {/* Soft breathing golden ambient halo */}
        <div className="absolute inset-0 -m-5 rounded-full bg-amber-500/15 blur-2xl animate-pulse pointer-events-none" />

        {/* Minimalist spinning golden arc */}
        <div className="absolute -inset-3 rounded-full border-2 border-amber-400/20 border-t-amber-400 border-r-amber-400/60 animate-spin pointer-events-none" />

        {/* Outer subtle static golden ring */}
        <div className="absolute -inset-1 rounded-full border border-amber-400/25 pointer-events-none" />

        {/* Official Brand Seal Logo */}
        <Logo
          size={78}
          className="relative z-10 drop-shadow-[0_8px_20px_rgba(0,0,0,0.85)]"
        />
      </div>

      {/* Institutional Branding & Loading Status */}
      <div className="mt-6 flex flex-col items-center text-center space-y-2.5 max-w-xs">
        {/* Institutional Title */}
        <div className="space-y-0.5">
          <h2 className="text-xs sm:text-sm font-black uppercase tracking-[0.25em] text-amber-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
            PUP FOCUS
          </h2>
        </div>

        {/* Minimalist Indeterminate Golden Progress Shimmer Line */}
        <div className="relative w-36 sm:w-44 h-1 rounded-full bg-amber-950/80 overflow-hidden border border-amber-400/25 shadow-[inset_0_1px_2px_rgba(0,0,0,0.6)]">
          <div className="absolute inset-y-0 w-2/5 rounded-full bg-gradient-to-r from-amber-500/20 via-amber-300 to-amber-500/20 animate-pup-shimmer shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
        </div>

        {/* Dynamic Status Text */}
        {text ? (
          <p className="text-xs font-medium tracking-wide text-amber-100/85 animate-pulse pt-0.5">
            {text}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default SystemLoadingScreen;
