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
  text = "Loading...",
  subtitle,
  progress,
  fullScreen = true,
  className = "",
}: LoadingScreenProps = {}) {
  const hasProgress = typeof progress === "number" && !Number.isNaN(progress);
  const clampedProgress = hasProgress
    ? Math.min(100, Math.max(0, Math.round(progress)))
    : 0;

  const ringSize = fullScreen ? 116 : 88;
  const logoSize = fullScreen ? 80 : 60;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={text || "Loading system"}
      className={
        fullScreen
          ? `fixed inset-0 z-[100] flex flex-col items-center justify-center p-6 select-none bg-white/96 dark:bg-slate-950/96 backdrop-blur-md animate-in fade-in duration-150 ${className}`
          : `relative flex flex-col items-center justify-center min-h-[260px] w-full p-8 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 select-none animate-in fade-in duration-150 ${className}`
      }
    >
      {/* Hairline institutional top bar on full-screen view */}
      {fullScreen && (
        <div className="fixed inset-x-0 top-0 h-[3px] bg-[#800000] dark:bg-amber-500">
          <div className="h-full w-32 bg-amber-400/90 dark:bg-[#800000]/80 animate-pup-loader-slide" />
        </div>
      )}

      <div className="flex w-full max-w-sm flex-col items-center text-center">
        {/* Precision SVG Orbital Ring + Official Seal */}
        <div
          className="relative flex items-center justify-center"
          style={{ width: ringSize, height: ringSize }}
        >
          <svg
            viewBox="0 0 100 100"
            className="absolute inset-0 h-full w-full -rotate-90"
            aria-hidden="true"
          >
            {/* Track */}
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              strokeWidth="2.5"
              className="stroke-slate-200 dark:stroke-slate-800"
            />
            {/* Smooth rounded-cap active arc */}
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={hasProgress ? "282.74" : "76 206.74"}
              strokeDashoffset={
                hasProgress
                  ? 282.74 - (282.74 * clampedProgress) / 100
                  : 0
              }
              className={
                hasProgress
                  ? "stroke-[#800000] dark:stroke-amber-400 transition-[stroke-dashoffset] duration-300 ease-out"
                  : "stroke-[#800000] dark:stroke-amber-400 origin-center animate-spin"
              }
              style={hasProgress ? undefined : { animationDuration: "1.15s" }}
            />
          </svg>

          <div className="relative z-10 flex items-center justify-center rounded-full bg-white dark:bg-slate-900 p-1.5">
            <Logo size={logoSize} />
          </div>
        </div>

        {/* Institutional Lockup */}
        <div className="mt-6 flex flex-col items-center">
          <div className="flex items-baseline gap-1.5 text-2xl sm:text-[28px] font-extrabold tracking-tight leading-none">
            <span className="text-[#800000] dark:text-amber-400">PUP</span>
            <span className="text-slate-900 dark:text-slate-50">FOCUS</span>
          </div>
          <span className="mt-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
            Bataan Campus
          </span>
        </div>

        {/* Progress Track & Status */}
        <div className="mt-6 w-full max-w-[280px] sm:max-w-[300px] space-y-3">
          {hasProgress ? (
            <>
              <div className="flex items-center justify-between gap-2 text-xs sm:text-sm">
                <span className="font-medium text-slate-600 dark:text-slate-300 truncate">
                  {text || "Processing..."}
                </span>
                <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100 shrink-0">
                  {clampedProgress}%
                </span>
              </div>
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-[#800000] dark:bg-amber-400 transition-[width] duration-300 ease-out"
                  style={{ width: `${clampedProgress}%` }}
                />
              </div>
            </>
          ) : (
            <>
              <div className="relative h-1 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800">
                <div className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-[#800000] dark:bg-amber-400 animate-pup-loader-slide" />
              </div>

              {text ? (
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 tracking-normal">
                  {text}
                </p>
              ) : null}
            </>
          )}

          {subtitle ? (
            <p className="text-xs text-slate-400 dark:text-slate-500 truncate max-w-full">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default SystemLoadingScreen;
