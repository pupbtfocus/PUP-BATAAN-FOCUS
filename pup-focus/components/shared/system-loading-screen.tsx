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

  const content = (
    <div
      className={
        fullScreen
          ? "relative w-full max-w-[340px] sm:max-w-[368px] overflow-hidden rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl shadow-slate-900/10 dark:shadow-black/50"
          : "relative w-full max-w-sm flex flex-col items-center"
      }
    >
      {/* Institutional Maroon & Gold Accent Bar */}
      {fullScreen && (
        <div className="h-1.5 w-full bg-gradient-to-r from-[#580000] via-[#800000] to-amber-500" />
      )}

      <div
        className={
          fullScreen
            ? "flex flex-col items-center px-6 py-8 sm:px-8 sm:py-9 text-center"
            : "flex flex-col items-center px-4 py-4 text-center w-full"
        }
      >
        {/* Official Seal with Precision Maroon & Gold Orbital Ring */}
        <div className="relative flex items-center justify-center">
          {/* Outer subtle track */}
          <div
            className={`absolute rounded-full border border-slate-200 dark:border-slate-700/80 pointer-events-none ${
              fullScreen ? "-inset-3" : "-inset-2.5"
            }`}
          />

          {/* Primary Maroon Spinning Arc */}
          <div
            className={`absolute rounded-full border-[2.5px] border-transparent border-t-[#800000] dark:border-t-amber-400 border-r-[#800000]/35 dark:border-r-amber-400/35 animate-spin pointer-events-none ${
              fullScreen ? "-inset-3" : "-inset-2.5"
            }`}
            style={{ animationDuration: "1.05s" }}
          />

          {/* Secondary Counter-Accent Gold Dot / Arc */}
          <div
            className={`absolute rounded-full border-2 border-transparent border-b-amber-500/85 animate-spin pointer-events-none ${
              fullScreen ? "-inset-1.5" : "-inset-1"
            }`}
            style={{ animationDuration: "1.8s", animationDirection: "reverse" }}
          />

          {/* Clean Circular Seal Plate */}
          <div
            className={`relative z-10 flex items-center justify-center rounded-full bg-white dark:bg-slate-900 ring-1 ring-slate-200/80 dark:ring-slate-700/70 shadow-sm ${
              fullScreen ? "p-1.5" : "p-1"
            }`}
          >
            <Logo size={fullScreen ? 64 : 52} className="relative z-10" />
          </div>
        </div>

        {/* Institutional Wordmark */}
        <div className="mt-6 flex flex-col items-center">
          <div className="flex items-center gap-1.5 text-base sm:text-lg font-black tracking-tight leading-none">
            <span className="text-[#800000] dark:text-amber-400">PUP</span>
            <span className="text-slate-900 dark:text-white">FOCUS</span>
          </div>
          <span className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
            Bataan Campus
          </span>
        </div>

        {/* Progress Indicator */}
        <div className="mt-5 w-full max-w-[240px] space-y-2.5">
          {hasProgress ? (
            <>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-600 dark:text-slate-300 truncate pr-2">
                  {text || "Processing..."}
                </span>
                <span className="font-mono font-bold tabular-nums text-[#800000] dark:text-amber-400 shrink-0">
                  {clampedProgress}%
                </span>
              </div>
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/70">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#580000] via-[#800000] to-amber-500 transition-all duration-300 ease-out"
                  style={{ width: `${clampedProgress}%` }}
                />
              </div>
            </>
          ) : (
            <>
              <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div className="absolute inset-y-0 left-0 w-2/5 rounded-full bg-gradient-to-r from-[#580000] via-[#800000] to-amber-500 animate-pup-loader-slide" />
              </div>

              {text ? (
                <div className="flex items-center justify-center gap-2 pt-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                  <p className="text-xs sm:text-[13px] font-semibold text-slate-700 dark:text-slate-200 tracking-tight">
                    {text}
                  </p>
                </div>
              ) : null}
            </>
          )}

          {subtitle ? (
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate max-w-full">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={text || "Loading system"}
      className={
        fullScreen
          ? `fixed inset-0 z-[100] flex flex-col items-center justify-center p-4 select-none bg-slate-100/90 dark:bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-150 ${className}`
          : `relative flex flex-col items-center justify-center min-h-[240px] w-full p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs select-none animate-in fade-in duration-150 ${className}`
      }
    >
      {content}
    </div>
  );
}

export default SystemLoadingScreen;
