import React from "react";
import { CheckCircle, Clock, WarningCircle } from "iconoir-react";
import { cn } from "@/utils/cn";

export type NormalizedSubmissionStatus =
  | "Validated"
  | "Approved"
  | "Rejected"
  | "Needs Revision"
  | "Pending"
  | "Pending Review"
  | "Not Submitted";

interface SubmissionStatusBadgeProps {
  status?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
  showDot?: boolean;
  showIcon?: boolean;
}

export function getNormalizedStatus(
  status?: string | null,
): "Validated" | "Needs Revision" | "Pending Review" | "Not Submitted" {
  if (!status) return "Not Submitted";
  const s = status.toLowerCase().trim();

  if (s === "validated" || s === "approved") return "Validated";
  if (s === "rejected" || s === "needs revision" || s === "needs_revision")
    return "Needs Revision";
  if (
    s === "pending" ||
    s === "pending review" ||
    s === "pending_review" ||
    s === "uploaded" ||
    s === "submitted" ||
    s === "under_review"
  )
    return "Pending Review";
  return "Not Submitted";
}

export function SubmissionStatusBadge({
  status,
  size = "md",
  className,
  showDot = true,
  showIcon = true,
}: SubmissionStatusBadgeProps) {
  const normalized = getNormalizedStatus(status);

  const config = {
    Validated: {
      label: "Validated",
      containerClass:
        "bg-white text-emerald-700 border border-slate-200/90 dark:bg-slate-900 dark:text-emerald-400 dark:border-slate-800",
      dotClass: "bg-emerald-500 dark:bg-emerald-400",
      icon: <CheckCircle className="shrink-0 text-emerald-600 dark:text-emerald-400" strokeWidth={2} aria-hidden="true" />,
    },
    "Needs Revision": {
      label: "Needs Revision",
      containerClass:
        "bg-white text-rose-700 border border-slate-200/90 dark:bg-slate-900 dark:text-rose-400 dark:border-slate-800",
      dotClass: "bg-rose-500 dark:bg-rose-400",
      icon: <WarningCircle className="shrink-0 text-rose-600 dark:text-rose-400" strokeWidth={2} aria-hidden="true" />,
    },
    "Pending Review": {
      label: "Pending Review",
      containerClass:
        "bg-white text-amber-700 border border-slate-200/90 dark:bg-slate-900 dark:text-amber-400 dark:border-slate-800",
      dotClass: "bg-amber-500 dark:bg-amber-400",
      icon: <Clock className="shrink-0 text-amber-600 dark:text-amber-400" strokeWidth={2} aria-hidden="true" />,
    },
    "Not Submitted": {
      label: "Not Submitted",
      containerClass:
        "bg-white text-slate-600 border border-slate-200/90 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800",
      dotClass: "bg-slate-400 dark:bg-slate-500",
      icon: null,
    },
  }[normalized];

  const sizeClasses = {
    sm: "px-2.5 py-0.5 text-[11px] gap-1.5 [&>svg]:h-3 [&>svg]:w-3",
    md: "px-3 py-1 text-xs gap-1.5 [&>svg]:h-3.5 [&>svg]:w-3.5",
    lg: "px-3.5 py-1.5 text-sm gap-2 [&>svg]:h-4 [&>svg]:w-4 font-semibold",
  }[size];

  return (
    <span
      role="status"
      aria-label={`Status: ${config.label}`}
      className={cn(
        "inline-flex items-center rounded-full border font-semibold tracking-wide transition-colors whitespace-nowrap shadow-2xs",
        config.containerClass,
        sizeClasses,
        className,
      )}
    >
      {showDot && (!showIcon || !config.icon) && (
        <span
          className={cn("w-1.5 h-1.5 rounded-full shrink-0", config.dotClass)}
          aria-hidden="true"
        />
      )}
      {showIcon && config.icon}
      <span>{config.label}</span>
    </span>
  );
}
