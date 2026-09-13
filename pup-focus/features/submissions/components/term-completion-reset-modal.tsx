"use client";

import React, { useState } from "react";
import {
  Archive,
  Check,
  CheckCircle,
  Clock,
  Eye,
  InfoCircle,
  NavArrowRight,
  Page,
  SystemRestart,
  Xmark,
} from "iconoir-react";
import {
  DEFAULT_REQUIREMENTS,
  REQUIREMENT_LABEL,
  type RequirementCode,
} from "@/config/compliance";

export interface ValidatedRequirementItem {
  code: RequirementCode;
  submittedAt?: string | null;
  reviewedAt?: string | null;
}

export interface TermCompletionResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmReset: () => void;
  onViewHistory?: () => void;
  academicYear: string;
  semester: string;
  requirements?: ValidatedRequirementItem[];
}

export function TermCompletionResetModal({
  isOpen,
  onClose,
  onConfirmReset,
  onViewHistory,
  academicYear,
  semester,
  requirements = [],
}: TermCompletionResetModalProps) {
  const [isResetting, setIsResetting] = useState(false);

  if (!isOpen) return null;

  async function handleConfirm() {
    setIsResetting(true);
    try {
      await onConfirmReset();
      onClose();
    } finally {
      setIsResetting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="term-completion-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-5 py-4 bg-emerald-500/5 dark:bg-emerald-500/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
              <CheckCircle className="h-5 w-5" />
            </div>
            <div>
              <h3
                id="term-completion-title"
                className="text-base font-bold text-slate-900 dark:text-slate-100"
              >
                Term Requirements Completed
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                A.Y. {academicYear} • {semester}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isResetting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            aria-label="Close modal"
          >
            <Xmark className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4">
          {/* 100% Validated Milestone Box */}
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-950/20 p-4 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                100% Compliance Validated
              </span>
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Window Ended
              </span>
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-300">
              All 6 required faculty documents for this semester have been validated by
              the administration. The submission window for this academic term has now
              concluded.
            </p>
          </div>

          {/* Validated Requirements List */}
          <div>
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2">
              Verified Compliance Checklist (6/6):
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-44 overflow-y-auto pr-1">
              {DEFAULT_REQUIREMENTS.map((code) => {
                const label = REQUIREMENT_LABEL[code];
                return (
                  <div
                    key={code}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-4 w-4 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
                        <Check className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400 stroke-[3]" />
                      </div>
                      <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                        {label}
                      </span>
                    </div>
                    <span className="shrink-0 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                      Validated
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Archival Guarantee Notice */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
            <Archive className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                Submissions Permanently Archived in History
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                All 6 uploaded files, timestamps, and review decisions are permanently
                stored in your <strong>Submission History</strong>. You can review or bulk
                download them at any time.
              </p>
            </div>
          </div>

          {/* Reset Explanation */}
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-slate-700 dark:text-slate-300">
            <span className="font-bold text-amber-900 dark:text-amber-400 block mb-0.5">
              Ready for Next Semester:
            </span>
            <span>
              Resetting refreshes your active compliance checklist for the upcoming
              semester. Your portal will show a clean waiting status until the administration
              opens the next submission window.
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
            {onViewHistory && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onViewHistory();
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 transition cursor-pointer"
              >
                <Eye className="h-3.5 w-3.5" />
                <span>View in History</span>
              </button>
            )}

            <div className="w-full sm:w-auto flex items-center justify-end gap-2.5 ml-auto">
              <button
                type="button"
                onClick={onClose}
                disabled={isResetting}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-[#780000] text-[#780000] hover:bg-[#780000]/10 dark:border-rose-400 dark:text-rose-400 dark:hover:bg-rose-400/10 transition cursor-pointer disabled:opacity-50"
              >
                Keep Current View
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isResetting}
                className="inline-flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs shadow-sm active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
              >
                {isResetting ? (
                  <>
                    <SystemRestart className="h-3.5 w-3.5 animate-spin" />
                    <span>Resetting...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-3.5 w-3.5" />
                    <span>Confirm & Reset for Next Semester</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
