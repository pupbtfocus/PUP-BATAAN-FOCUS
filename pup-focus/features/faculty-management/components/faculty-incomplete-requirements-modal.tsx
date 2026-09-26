"use client";

import React from "react";
import { WarningCircle, Xmark } from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";

export interface FacultyIncompleteRequirementsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGoToSubmissions?: () => void;
  notSubmittedCount?: number;
  rejectedCount?: number;
  pendingValidationCount?: number;
  deadlineDisplay?: string | null;
}

export function FacultyIncompleteRequirementsModal({
  isOpen,
  onClose,
  onGoToSubmissions,
  notSubmittedCount = 0,
  rejectedCount = 0,
  pendingValidationCount = 0,
  deadlineDisplay = null,
}: FacultyIncompleteRequirementsModalProps) {
  if (!isOpen) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed top-16 sm:top-20 left-1/2 -translate-x-1/2 z-[9999] w-[calc(100vw-2rem)] max-w-lg md:max-w-xl rounded-2xl border-2 border-amber-400/80 bg-[#780000] text-white p-3.5 sm:p-4 shadow-2xl shadow-black/60 animate-in fade-in slide-in-from-top-3 duration-250"
    >
      {/* Top ambient gold accent line */}
      <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-amber-300 to-transparent rounded-t-2xl" />

      {/* Header row */}
      <div className="flex items-start justify-between gap-2.5 sm:gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <AppIcon icon={WarningCircle} size="lg" color="inherit" className="text-amber-300 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base md:text-lg font-bold text-white tracking-tight leading-snug">
              Requirements Pending Submission & Review
            </h3>
            <p className="text-xs sm:text-sm text-white/85 mt-0.5 leading-relaxed">
              You have compliance documents awaiting submission, revision, or validation for this semester.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-white/15 text-white/80 hover:text-white transition-colors cursor-pointer shrink-0 -mr-1 -mt-0.5"
          aria-label="Dismiss alert"
          title="Dismiss alert"
        >
          <AppIcon icon={Xmark} size="md" color="inherit" />
        </button>
      </div>

      {/* Bottom section: Direct Counts & Actions */}
      <div className="mt-3 pt-3 border-t border-white/15 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {notSubmittedCount > 0 && (
            <span className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-black/25 text-white/95 border border-white/15 text-xs sm:text-sm font-medium">
              <strong className="text-amber-300 font-bold">{notSubmittedCount}</strong> Not Submitted
            </span>
          )}

          {rejectedCount > 0 && (
            <span className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-black/25 text-white/95 border border-white/15 text-xs sm:text-sm font-medium">
              <strong className="text-amber-300 font-bold">{rejectedCount}</strong> Revise
            </span>
          )}

          {pendingValidationCount > 0 && (
            <span className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-black/25 text-white/95 border border-white/15 text-xs sm:text-sm font-medium">
              <strong className="text-amber-300 font-bold">{pendingValidationCount}</strong> Pending for Validation
            </span>
          )}

          {notSubmittedCount === 0 && rejectedCount === 0 && pendingValidationCount === 0 && (
            <span className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-black/25 text-white/95 border border-white/15 text-xs sm:text-sm font-medium">
              All documents up to date
            </span>
          )}

          {deadlineDisplay && (
            <span className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-black/25 text-amber-200 border border-amber-400/30 text-xs sm:text-sm font-medium">
              Due: <span className="text-amber-300 font-semibold">{deadlineDisplay}</span>
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto sm:shrink-0 sm:ml-auto">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto inline-flex items-center justify-center px-3.5 py-2 sm:py-1.5 rounded-lg border border-white/20 bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-semibold cursor-pointer transition active:scale-[0.98]"
          >
            Dismiss
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onGoToSubmissions?.();
            }}
            className="w-full sm:w-auto inline-flex items-center justify-center bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold px-4 py-2 sm:py-1.5 rounded-lg text-xs sm:text-sm shadow-md transition active:scale-[0.98] cursor-pointer whitespace-nowrap"
          >
            Go to Documents
          </button>
        </div>
      </div>
    </div>
  );
}

