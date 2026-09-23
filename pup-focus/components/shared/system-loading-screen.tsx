"use client";

import React from "react";
import { Logo } from "@/components/ui/logo";

export interface LoadingScreenProps {
  text?: string;
  subtitle?: string;
  progress?: number;
  fullScreen?: boolean;
  className?: string;
}

export function SystemLoadingScreen({
  text = "Loading PUP FOCUS...",
  subtitle,
  progress,
  fullScreen = true,
  className = "",
}: LoadingScreenProps = {}) {
  const hasProgress = typeof progress === "number" && !Number.isNaN(progress);
  const clampedProgress = hasProgress
    ? Math.min(100, Math.max(0, Math.round(progress)))
    : 0;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={text || "Loading system"}
      className={
        fullScreen
          ? `fixed inset-0 z-[100] flex flex-col items-center justify-center p-4 select-none bg-black/85 backdrop-blur-md bg-[radial-gradient(ellipse_at_center,_rgba(120,0,0,0.4)_0%,_rgba(20,2,2,0.9)_60%,_rgba(10,0,0,0.98)_100%)] animate-in fade-in duration-200 ${className}`
          : `relative flex flex-col items-center justify-center min-h-[280px] w-full p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-[#2a0000]/60 via-[#1a0000]/70 to-[#100000]/80 backdrop-blur-md border border-amber-500/25 shadow-2xl select-none animate-in fade-in duration-200 ${className}`
      }
    >
      {/* Central Identity: Official Logo with Delicate Golden Spinner & Glow */}
      <div className="relative flex items-center justify-center">
        {/* Soft breathing golden ambient halo */}
        <div className="absolute inset-0 -m-5 rounded-full bg-amber-500/20 blur-2xl animate-pulse pointer-events-none" />

        {/* Minimalist spinning golden arc */}
        <div className="absolute -inset-3.5 rounded-full border-2 border-amber-400/20 border-t-amber-400 border-r-amber-400/60 animate-spin pointer-events-none" />

        {/* Outer subtle static golden ring */}
        <div className="absolute -inset-1.5 rounded-full border border-amber-400/30 pointer-events-none" />

        {/* Official Brand Seal Logo */}
        <Logo
          size={fullScreen ? 82 : 68}
          className="relative z-10 drop-shadow-[0_8px_20px_rgba(0,0,0,0.85)]"
        />
      </div>

      {/* Institutional Branding & Loading Status */}
      <div className="mt-5 flex flex-col items-center text-center space-y-2.5 max-w-sm px-4">
        {/* Institutional Title */}
        <div className="space-y-0.5">
          <h2 className="text-xs sm:text-sm font-black uppercase tracking-[0.25em] text-amber-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
            PUP FOCUS
          </h2>
        </div>

        {/* Percentage or Minimalist Indeterminate Progress */}
        {hasProgress ? (
          <div className="space-y-2 w-full flex flex-col items-center">
            {/* Percentage Badge */}
            <div className="flex items-center justify-center">
              <span className="font-mono text-xl sm:text-2xl font-black tracking-tight text-amber-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                {clampedProgress}%
              </span>
            </div>

            {/* Progress Bar Track */}
            <div className="relative w-44 sm:w-56 h-2 rounded-full bg-amber-950/90 overflow-hidden border border-amber-400/35 shadow-[inset_0_1px_3px_rgba(0,0,0,0.8)]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 via-amber-300 to-amber-400 transition-all duration-300 ease-out shadow-[0_0_12px_rgba(251,191,36,0.9)]"
                style={{ width: `${clampedProgress}%` }}
              />
            </div>
          </div>
        ) : (
          /* Minimalist Indeterminate Golden Progress Shimmer Line */
          <div className="relative w-36 sm:w-44 h-1 rounded-full bg-amber-950/80 overflow-hidden border border-amber-400/25 shadow-[inset_0_1px_2px_rgba(0,0,0,0.6)]">
            <div className="absolute inset-y-0 w-2/5 rounded-full bg-gradient-to-r from-amber-500/20 via-amber-300 to-amber-500/20 animate-pup-shimmer shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
          </div>
        )}

        {/* Dynamic Status Text */}
        {text ? (
          <p className="text-xs sm:text-sm font-semibold tracking-wide text-amber-100/90 pt-0.5">
            {text}
          </p>
        ) : null}

        {/* Subtitle / Filename */}
        {subtitle ? (
          <p className="text-[11px] sm:text-xs text-amber-200/70 truncate max-w-[280px] sm:max-w-xs font-medium">
            {subtitle}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default SystemLoadingScreen;
