"use client";

import React, { useEffect } from "react";
import { CheckCircle, InfoCircle, WarningCircle, Xmark } from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";
import { cn } from "@/utils/cn";

export type AlertType = "success" | "error" | "info" | "warning";

export interface AlertPopupProps {
  type?: AlertType;
  message: string | null | undefined;
  onClose: () => void;
  position?: "top-right" | "top-center" | "inline";
  autoCloseMs?: number; // default 5000ms, 0 to disable
  className?: string;
}

export function AlertPopup({
  type = "info",
  message,
  onClose,
  position = "top-right",
  autoCloseMs = 5000,
  className,
}: AlertPopupProps) {
  useEffect(() => {
    if (!message || !autoCloseMs || autoCloseMs <= 0) return;
    const timer = setTimeout(() => {
      onClose();
    }, autoCloseMs);
    return () => clearTimeout(timer);
  }, [message, autoCloseMs, onClose]);

  if (!message) return null;

  const isSuccess = type === "success";
  const isError = type === "error";
  const isWarning = type === "warning";

  const icon = isSuccess ? CheckCircle : isError ? WarningCircle : InfoCircle;
  const iconColor = isSuccess ? "success" : isError ? "danger" : "active";

  const colorStyles = isSuccess
    ? "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-700/60 dark:bg-emerald-950/85 dark:text-emerald-200 shadow-emerald-950/20"
    : isError
    ? "border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800/60 dark:bg-rose-950/85 dark:text-rose-200 shadow-rose-950/20"
    : isWarning
    ? "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/85 dark:text-amber-200 shadow-amber-950/20"
    : "border-sky-300 bg-sky-50 text-sky-950 dark:border-sky-800/60 dark:bg-sky-950/85 dark:text-sky-200 shadow-sky-950/20";

  const closeButtonHover = isSuccess
    ? "hover:bg-emerald-200/60 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200"
    : isError
    ? "hover:bg-rose-200/60 dark:hover:bg-rose-900/60 text-rose-800 dark:text-rose-200"
    : isWarning
    ? "hover:bg-amber-200/60 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-200"
    : "hover:bg-sky-200/60 dark:hover:bg-sky-900/60 text-sky-800 dark:text-sky-200";

  const positionStyles =
    position === "top-right"
      ? "fixed top-5 right-5 sm:right-6 z-[100] max-w-md w-[calc(100vw-2.5rem)] sm:w-auto shadow-2xl animate-in fade-in slide-in-from-top-3 duration-200"
      : position === "top-center"
      ? "fixed top-5 left-1/2 -translate-x-1/2 z-[100] max-w-md w-[calc(100vw-2.5rem)] sm:w-auto shadow-2xl animate-in fade-in slide-in-from-top-3 duration-200"
      : "w-full animate-in fade-in zoom-in-98 duration-150";

  return (
    <div className={positionStyles}>
      <div
        role="alert"
        className={cn(
          "flex items-center justify-between gap-3 px-4 py-3 rounded-xl border backdrop-blur-md text-xs sm:text-sm font-medium shadow-lg transition-all",
          colorStyles,
          className,
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <AppIcon icon={icon} size="md" color={iconColor} className="shrink-0" />
          <span className="leading-snug break-words">{message}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className={cn(
            "p-1 rounded-lg transition-colors cursor-pointer shrink-0 border border-transparent hover:border-black/10 dark:hover:border-white/10",
            closeButtonHover,
          )}
          aria-label="Close alert"
        >
          <AppIcon icon={Xmark} size="sm" color="inherit" />
        </button>
      </div>
    </div>
  );
}
