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
  const iconColor = isSuccess ? "white" : isError ? "white" : isWarning ? "inherit" : "white";

  const colorStyles = isSuccess
    ? "bg-[#0b5336] text-white border-2 border-emerald-400/90 shadow-2xl shadow-black/50 font-semibold tracking-wide"
    : isError
    ? "bg-[#780000] text-white border-2 border-amber-400/80 shadow-2xl shadow-black/50 font-semibold tracking-wide"
    : isWarning
    ? "bg-amber-500 text-slate-950 border-2 border-amber-600 font-bold shadow-2xl shadow-amber-500/30"
    : "bg-slate-900 text-white border-2 border-slate-700 shadow-2xl";

  const closeButtonHover = isSuccess || isError || !isWarning
    ? "hover:bg-white/20 text-white/90 hover:text-white"
    : "hover:bg-black/15 text-slate-950/80 hover:text-slate-950";

  const positionStyles =
    position === "top-right"
      ? "fixed top-5 right-5 sm:right-6 z-[9999] max-w-md w-[calc(100vw-2.5rem)] sm:w-auto shadow-2xl animate-in fade-in slide-in-from-top-3 duration-200"
      : position === "top-center"
      ? "fixed top-5 left-1/2 -translate-x-1/2 z-[9999] max-w-md w-[calc(100vw-2.5rem)] sm:w-auto shadow-2xl animate-in fade-in slide-in-from-top-3 duration-200"
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
          className="p-1 rounded-lg border border-[#5e0000] bg-[#780000] hover:bg-[#5e0000] text-white transition-colors cursor-pointer shrink-0 shadow-xs"
          aria-label="Close alert"
        >
          <AppIcon icon={Xmark} size="sm" color="inherit" />
        </button>
      </div>
    </div>
  );
}
