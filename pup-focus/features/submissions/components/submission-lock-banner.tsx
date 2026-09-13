"use client";

import { Lock, WarningTriangle } from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";

type SubmissionLockBannerProps = {
  isLocked: boolean;
  isConfigured?: boolean;
};

export function SubmissionLockBanner({
  isLocked,
  isConfigured = true,
}: SubmissionLockBannerProps) {
  if (!isLocked) {
    return null;
  }

  return (
    <div
      className="mb-5 flex items-start gap-3 rounded-xl border border-rose-800/80 bg-rose-950/50 px-4 py-3.5 shadow-sm"
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
