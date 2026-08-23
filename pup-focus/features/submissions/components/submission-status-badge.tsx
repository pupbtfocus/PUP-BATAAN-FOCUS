import React from "react";
import { CheckCircle2, AlertCircle, Clock3 } from "lucide-react";
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
        "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300",
      dotClass: "bg-emerald-500 dark:bg-emerald-400",
      icon: <CheckCircle2 className="shrink-0" aria-hidden="true" />,
    },
    "Needs Revision": {
      label: "Needs Revision",
      containerClass:
        "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300",
      dotClass: "bg-amber-500 dark:bg-amber-400",
      icon: <AlertCircle className="shrink-0" aria-hidden="true" />,
    },
    "Pending Review": {
      label: "Pending Review",
      containerClass:
        "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-300",
      dotClass: "bg-blue-500 dark:bg-blue-400",
      icon: <Clock3 className="shrink-0" aria-hidden="true" />,
    },
    "Not Submitted": {
      label: "Not Submitted",
      containerClass:
        "border-slate-300 dark:border-slate-700 bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300",
      dotClass: "bg-slate-400",
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
      {showDot && (
        <span
          className={cn("w-2 h-2 rounded-full shrink-0", config.dotClass)}
          aria-hidden="true"
        />
      )}
      {showIcon && config.icon}
      <span>{config.label}</span>
    </span>
  );
}
