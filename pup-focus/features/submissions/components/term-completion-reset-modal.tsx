"use client";

import React, { useState } from "react";
import {
  Archive,
  Check,
  CheckCircle,
  Eye,
  InfoCircle,
  NavArrowRight,
  Page,
  SystemRestart,
  Xmark,
} from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";
import { ModalHeader } from "@/components/ui/modal-header";
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
        <ModalHeader
          icon={CheckCircle}
          title="Done All for This Semester"
          subtitle={`A.Y. ${academicYear} • ${semester}`}
        />

        {/* Content Body */}
        <div className="p-5 space-y-4">
          {/* 100% Validated Milestone Box */}
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-950/20 p-4 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                <AppIcon icon={CheckCircle} size="md" color="success" />
                Done All for This Semester (100% Validated)
              </span>
              <span className="text-[11px] font-bold text-[#0b5336] dark:text-emerald-400">
                6 of 6 Validated
              </span>
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-300">
              All 6 required faculty documents for this semester have been validated by
              the administration. As long as the school year or term is not changed, all your validated documents remain active and visible in Requirements Management.
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
                        <AppIcon icon={Check} size="md" color="success" strokeWidth={3} />
                      </div>
                      <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                        {label}
                      </span>
                    </div>
                    <span className="shrink-0 text-[10px] font-bold text-[#0b5336] dark:text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                      Done for this sem
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Archival Guarantee Notice */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
            <AppIcon icon={Archive} size="md" color="active" />
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

          {/* Term Status Explanation */}
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-slate-700 dark:text-slate-300">
            <span className="font-bold text-[#0b5336] dark:text-emerald-400 block mb-0.5">
              Current Semester Compliance:
            </span>
            <span>
              If the academic year or semester is not changed by the administration, your submissions remain fully completed, locked in validated status, and visible on your checklist.
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
                <AppIcon icon={Eye} size="sm" color="inherit" />
                <span>View in History</span>
              </button>
            )}

            <div className="w-full sm:w-auto flex items-center justify-end gap-2.5 ml-auto">
              <button
                type="button"
                onClick={onClose}
                disabled={isResetting}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] transition cursor-pointer shadow-xs disabled:opacity-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isResetting}
                className="inline-flex items-center justify-center gap-1.5 bg-[#0b5336] hover:bg-[#083e28] text-white font-bold px-4 py-2 rounded-xl text-xs shadow-sm active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
              >
                {isResetting ? (
                  <>
                    <AppIcon icon={SystemRestart} size="sm" color="inherit" className="animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <AppIcon icon={CheckCircle} size="sm" color="inherit" />
                    <span>Done All for This Semester</span>
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
