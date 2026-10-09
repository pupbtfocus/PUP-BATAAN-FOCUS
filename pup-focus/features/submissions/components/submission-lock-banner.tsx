"use client";

import { Check, Lock, WarningTriangle } from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";

export type SubmissionLockBannerProps = {
  isLocked?: boolean;
  isConfigured?: boolean;
  isOpen?: boolean;
  isPersonalDeadline?: boolean;
  formattedDueAt?: string | null;
  className?: string;
};

export function SubmissionLockBanner({
  isLocked = false,
  isConfigured = true,
  isOpen = false,
  isPersonalDeadline = false,
  formattedDueAt,
  className,
}: SubmissionLockBannerProps) {
  // 1. Personal Deadline Active Banner: Show when faculty has personal due_at
  if (isPersonalDeadline) {
    return (
      <div
        className={`mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-[#08412a] bg-[#0b5336] p-4 text-xs text-white shadow-md ${className || ""}`}
        role="alert"
      >
        <div className="flex items-start sm:items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white border border-white/30 shadow-2xs">
            <AppIcon icon={Check} size="md" color="white" />
          </div>
          <div>
            <div className="text-sm font-bold text-white tracking-wide">
              Personal Deadline Active
            </div>
            <p className="mt-0.5 text-xs text-emerald-100/95 leading-relaxed">
              You have been granted extra time to submit requirements. Your deadline is{" "}
              <strong className="font-bold text-white underline decoration-emerald-300/50 underline-offset-2">
                {formattedDueAt || "approaching"}
              </strong>
              .
            </p>
          </div>
        </div>
        <div className="shrink-0">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/15 text-white border border-white/25 text-[11px] font-bold shadow-2xs">
            <AppIcon icon={Check} size="xs" color="white" />
            <span>Uploads Unlocked</span>
          </span>
        </div>
      </div>
    );
  }

  // 2. If submissions are open globally and not personal deadline, no banner needed
  if (isOpen || !isLocked) {
    return null;
  }

  // 3. Submissions Locked Banner
  return (
    <div
      className={`mb-5 flex items-start gap-3 rounded-xl border border-rose-800/80 bg-rose-950/50 px-4 py-3.5 shadow-sm ${className || ""}`}
      role="alert"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-rose-800/60 bg-rose-900/40">
        <AppIcon icon={Lock} size="md" color="danger" />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <AppIcon icon={WarningTriangle} size="sm" color="danger" />
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-red-400">
            Uploads Locked
          </span>
        </div>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-300">
          {isConfigured
            ? "Submission Window is currently closed. Document uploads are locked for this term. Please contact your Admin for window extension requests."
            : "Submission dates have not been configured yet. Document uploads are locked until the admin opens a submission window."}
        </p>
      </div>
    </div>
  );
}

