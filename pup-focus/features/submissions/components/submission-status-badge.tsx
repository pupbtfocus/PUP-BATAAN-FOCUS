import React from "react";
import { Check, Hourglass, Minus, Xmark } from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";
import { cn } from "@/utils/cn";

export type NormalizedSubmissionStatus =
  | "Validated"
  | "Approved"
  | "Rejected"
  | "Needs Revision"
  | "Revision Requested"
  | "Revision Under Review"
  | "Pending"
  | "Pending Review"
  | "Not Submitted";

interface SubmissionStatusBadgeProps {
  status?: string | null;
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  showDot?: boolean;
  showIcon?: boolean;
  iconOnly?: boolean;
}

export function getNormalizedStatus(
  status?: string | null,
): "Validated" | "Needs Revision" | "Revision Requested" | "Revision Under Review" | "Pending Review" | "Not Submitted" {
  if (!status) return "Not Submitted";
  const s = status.toLowerCase().trim();

  if (s === "validated" || s === "approved") return "Validated";
  if (s === "revision requested" || s === "revision_requested") return "Revision Requested";
  if (s === "rejected" || s === "needs revision" || s === "needs_revision")
    return "Needs Revision";
  if (
    s === "revision under review" ||
    s === "revision_under_review" ||
    s === "revision pending review" ||
    s === "revision_pending" ||
    s === "revision_uploaded"
  )
    return "Revision Under Review";
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
  label,
  size = "md",
  className,
  showDot = true,
  showIcon = true,
  iconOnly = false,
}: SubmissionStatusBadgeProps) {
  const normalized = getNormalizedStatus(status);

  const config = {
    Validated: {
      label: "Validated",
      containerClass:
        "bg-[#0b5336] text-white border border-[#08412a]",
      dotClass: "bg-emerald-300",
      icon: <AppIcon icon={Check} color="white" className="shrink-0" strokeWidth={2.5} />,
    },
    "Needs Revision": {
      label: "Needs Revision",
      containerClass:
        "bg-[#780000] text-white border border-[#5e0000]",
      dotClass: "bg-rose-300",
      icon: <AppIcon icon={Xmark} color="white" className="shrink-0" strokeWidth={2.5} />,
    },
    "Revision Requested": {
      label: "Revision Requested",
      containerClass:
        "bg-[#780000] text-white border border-[#5e0000]",
      dotClass: "bg-rose-300",
      icon: <AppIcon icon={Xmark} color="white" className="shrink-0" strokeWidth={2.5} />,
    },
    "Revision Under Review": {
      label: "Revision Under Review",
      containerClass:
        "bg-amber-500 text-slate-950 border border-amber-600 font-bold dark:bg-amber-500 dark:text-slate-950 dark:border-amber-400",
      dotClass: "bg-slate-950",
      icon: <AppIcon icon={Hourglass} color="inherit" className="shrink-0 text-slate-950" strokeWidth={2.2} />,
    },
    "Pending Review": {
      label: status?.toLowerCase().trim() === "pending" ? "Pending" : "Pending Review",
      containerClass:
        "bg-amber-500 text-slate-950 border border-amber-600 font-bold dark:bg-amber-500 dark:text-slate-950 dark:border-amber-400",
      dotClass: "bg-slate-950",
      icon: <AppIcon icon={Hourglass} color="inherit" className="shrink-0 text-slate-950" strokeWidth={2.2} />,
    },
    "Not Submitted": {
      label: "Not Submitted",
      containerClass:
        "bg-slate-100 text-slate-500 border border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
      dotClass: "bg-slate-400 dark:bg-slate-500",
      icon: <AppIcon icon={Minus} color="inherit" className="shrink-0 text-slate-400 dark:text-slate-500" strokeWidth={2.5} />,
    },
  }[normalized];

  if (iconOnly) {
    const iconOnlySizes = {
      sm: "h-6 w-6 [&>svg]:h-3.5 [&>svg]:w-3.5",
      md: "h-7 w-7 [&>svg]:h-4 [&>svg]:w-4",
      lg: "h-8 w-8 [&>svg]:h-4.5 [&>svg]:w-4.5",
    }[size];

    return (
      <span
        role="status"
        title={label || config.label}
        aria-label={`Status: ${label || config.label}`}
        className={cn(
          "inline-flex items-center justify-center rounded-full border font-semibold shrink-0 shadow-2xs transition-transform hover:scale-110 cursor-help",
          config.containerClass,
          iconOnlySizes,
          className,
        )}
      >
        {config.icon}
      </span>
    );
  }

  const sizeClasses = {
    sm: "px-2.5 py-0.5 text-[11px] gap-1.5 [&>svg]:h-3 [&>svg]:w-3",
    md: "px-3 py-1 text-xs gap-1.5 [&>svg]:h-3.5 [&>svg]:w-3.5",
    lg: "px-3.5 py-1.5 text-sm gap-2 [&>svg]:h-4 [&>svg]:w-4 font-semibold",
  }[size];

  return (
    <span
      role="status"
      aria-label={`Status: ${label || config.label}`}
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
      <span>{label || config.label}</span>
    </span>
  );
}
