"use client";

import React from "react";
import { Calendar, Folder, WarningCircle, Xmark } from "iconoir-react";
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

  const hasPendingItems =
    notSubmittedCount > 0 || rejectedCount > 0 || pendingValidationCount > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pending-requirements-modal-title"
      className="fixed inset-0 z-[9999] h-dvh overflow-hidden overscroll-none flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Blurred system backdrop to spotlight the modal */}
      <div
        className="fixed inset-0 h-lvh bg-slate-950/65 backdrop-blur-sm touch-none overscroll-none"
        aria-hidden="true"
      />

      {/* Centered System-Matched Modal Card */}
      <div
        className="relative z-10 w-full max-w-md sm:max-w-lg max-h-[90dvh] overflow-y-auto overflow-x-hidden overscroll-contain rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-5 sm:p-6 space-y-5 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-100 dark:bg-slate-800 text-[#800000] dark:text-amber-400">
              <AppIcon icon={WarningCircle} size="md" color="inherit" />
            </div>
            <div className="min-w-0">
              <h3
                id="pending-requirements-modal-title"
                className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 leading-snug"
              >
                Requirements Pending Submission &amp; Review
              </h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                You have compliance documents awaiting submission, revision, or validation for this semester.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
            aria-label="Dismiss alert"
            title="Dismiss"
          >
            <AppIcon icon={Xmark} size="sm" color="inherit" />
          </button>
        </div>

        {/* Structured Status Breakdown Card */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 divide-y divide-slate-200/80 dark:divide-slate-800 text-xs sm:text-[13px]">
          {notSubmittedCount > 0 && (
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <span className="font-medium text-slate-600 dark:text-slate-300">
                Not Submitted
              </span>
              <span className="inline-flex items-center rounded-full border border-[#5e0000] bg-[#780000] px-2.5 py-0.5 text-[11px] font-bold text-white tabular-nums">
                {notSubmittedCount} {notSubmittedCount === 1 ? "Item" : "Items"}
              </span>
            </div>
          )}

          {rejectedCount > 0 && (
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <span className="font-medium text-slate-600 dark:text-slate-300">
                Needs Revision
              </span>
              <span className="inline-flex items-center rounded-full border border-[#5e0000] bg-[#780000] px-2.5 py-0.5 text-[11px] font-bold text-white tabular-nums">
                {rejectedCount} {rejectedCount === 1 ? "Item" : "Items"}
              </span>
            </div>
          )}

          {pendingValidationCount > 0 && (
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <span className="font-medium text-slate-600 dark:text-slate-300">
                Pending Validation
              </span>
              <span className="inline-flex items-center rounded-full border border-amber-600 bg-amber-500 px-2.5 py-0.5 text-[11px] font-bold text-amber-950 tabular-nums">
                {pendingValidationCount}{" "}
                {pendingValidationCount === 1 ? "Item" : "Items"}
              </span>
            </div>
          )}

          {!hasPendingItems && (
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <span className="font-medium text-slate-600 dark:text-slate-300">
                Compliance Status
              </span>
              <span className="inline-flex items-center rounded-full border border-[#08412a] bg-[#0b5336] px-2.5 py-0.5 text-[11px] font-bold text-white">
                All Up to Date
              </span>
            </div>
          )}

          {deadlineDisplay && (
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <span className="inline-flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-300">
                <AppIcon
                  icon={Calendar}
                  size="xs"
                  color="inherit"
                  className="text-slate-400"
                />
                <span>Submission Deadline</span>
              </span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {deadlineDisplay}
              </span>
            </div>
          )}
        </div>

        {/* Footer Actions matching PUP FOCUS Modal Buttons */}
        <div className="grid grid-cols-2 sm:flex sm:items-center sm:justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] shadow-xs transition cursor-pointer active:scale-[0.98] text-center"
          >
            Dismiss
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onGoToSubmissions?.();
            }}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-600/40 text-xs font-bold shadow-xs transition cursor-pointer active:scale-[0.98] whitespace-nowrap"
          >
            <AppIcon icon={Folder} size="xs" color="inherit" />
            <span>Go to Documents</span>
          </button>
        </div>
      </div>
    </div>
  );
}

