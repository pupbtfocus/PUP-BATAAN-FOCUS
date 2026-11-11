"use client";

import React, { useState } from "react";
import {
  SystemRestart,
  Refresh,
  Home,
  NavArrowDown,
  NavArrowUp,
  Copy,
  Check,
} from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";
import { Logo } from "@/components/ui/logo";

export interface SystemErrorViewProps {
  error?: (Error & { digest?: string }) | null;
  reset?: () => void;
  isEmbeddedPreview?: boolean;
}

export function SystemErrorView({
  error,
  reset,
  isEmbeddedPreview = false,
}: SystemErrorViewProps) {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [copiedDigest, setCopiedDigest] = useState(false);

  const errorMessage =
    error?.message && error.message.trim() !== ""
      ? error.message
      : "An unexpected client-side exception occurred while rendering this view.";

  const digest = error?.digest;

  const handleCopyDigest = async () => {
    if (!digest) return;
    try {
      await navigator.clipboard.writeText(digest);
      setCopiedDigest(true);
      setTimeout(() => setCopiedDigest(false), 2000);
    } catch {
      // Ignore clipboard write failures
    }
  };

  const handleReload = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  const handleGoDashboard = () => {
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  };

  return (
    <div
      className={`flex flex-col items-center justify-center p-4 sm:p-6 text-slate-900 dark:text-slate-100 ${
        isEmbeddedPreview
          ? "w-full py-8"
          : "min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900"
      }`}
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-xl dark:shadow-2xl transition-all">
        {/* Header Branding */}
        <div className="flex flex-col items-center text-center">
          <div className="mb-3 flex items-center justify-center">
            <Logo size={48} className="drop-shadow-xs" />
          </div>

          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
            Something went wrong!
          </h2>
          <p className="mt-1.5 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-sm">
            We encountered an unexpected issue while loading this page. Your
            saved data remains safe.
          </p>
        </div>

        {/* Error Info Card ("more info but not too much") */}
        <div className="mt-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-4 space-y-3">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Error Summary
            </span>
            <p className="text-xs font-medium text-slate-800 dark:text-slate-200 break-words leading-relaxed font-mono">
              {errorMessage}
            </p>
          </div>

          {digest ? (
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-semibold">Incident Code:</span>
                <code className="rounded bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 text-[11px] font-mono text-slate-700 dark:text-slate-300">
                  {digest}
                </code>
              </div>
              <button
                type="button"
                onClick={() => void handleCopyDigest()}
                className="p-1 rounded text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title={copiedDigest ? "Copied" : "Copy incident code"}
                aria-label={copiedDigest ? "Copied incident code" : "Copy incident code"}
              >
                <AppIcon
                  icon={copiedDigest ? Check : Copy}
                  size="xs"
                  color={copiedDigest ? "success" : "inherit"}
                />
              </button>
            </div>
          ) : null}

          {/* Expandable Technical Details */}
          {error?.stack ? (
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                className="flex w-full items-center justify-between text-left text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                <span>Technical Trace Details</span>
                <AppIcon
                  icon={showTechnicalDetails ? NavArrowUp : NavArrowDown}
                  size="xs"
                  color="inherit"
                />
              </button>

              {showTechnicalDetails ? (
                <pre className="mt-2.5 max-h-40 overflow-auto rounded-lg bg-slate-100 dark:bg-slate-950/80 p-3 text-[11px] font-mono leading-relaxed text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 selection:bg-slate-200 dark:selection:bg-slate-800">
                  {error.stack}
                </pre>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2.5">
          {reset ? (
            <button
              type="button"
              onClick={() => reset()}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#780000] hover:bg-[#5e0000] px-4 py-2.5 text-xs font-bold text-white border border-[#5e0000] transition-all cursor-pointer shadow-sm active:scale-[0.98]"
            >
              <AppIcon icon={SystemRestart} size="sm" color="white" />
              <span>Try Again</span>
            </button>
          ) : null}

          <button
            type="button"
            onClick={handleReload}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 px-4 py-2.5 text-xs font-bold text-slate-950 border border-amber-600 transition-all cursor-pointer shadow-sm active:scale-[0.98]"
          >
            <AppIcon icon={Refresh} size="sm" color="inherit" />
            <span>Reload Application</span>
          </button>

          {!isEmbeddedPreview ? (
            <button
              type="button"
              onClick={handleGoDashboard}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/80 transition-all cursor-pointer shadow-2xs"
            >
              <AppIcon icon={Home} size="sm" color="inherit" />
              <span>Dashboard</span>
            </button>
          ) : null}
        </div>

        {/* Support Help Text */}
        <p className="mt-6 text-center text-[11px] text-slate-400 dark:text-slate-500">
          If this issue continues, contact the PUP FOCUS Administrator with the
          error summary above.
        </p>
      </div>
    </div>
  );
}

