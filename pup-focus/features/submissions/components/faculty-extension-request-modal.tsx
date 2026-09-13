"use client";

import React, { useState, useEffect } from "react";
import {
  Calendar,
  CheckCircle,
  Clock,
  InfoCircle,
  SystemRestart,
  WarningCircle,
  WarningTriangle,
  Xmark,
} from "iconoir-react";
import {
  REQUIREMENT_LABEL,
  type RequirementCode,
} from "@/config/compliance";

export interface LackingRequirementItem {
  code: RequirementCode;
  status: "Not Submitted" | "Rejected" | "Pending";
  label?: string;
  adminRemarks?: string | null;
}

export interface FacultyExtensionRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (message: string) => void;
  academicYear: string;
  semester: string;
  lackings: LackingRequirementItem[];
  preSelectedCode?: RequirementCode | null;
}

type ExtensionPreset = "+24 Hours" | "+48 Hours" | "+3 Days" | "+1 Week" | "Custom";

export function FacultyExtensionRequestModal({
  isOpen,
  onClose,
  onSuccess,
  academicYear,
  semester,
  lackings,
  preSelectedCode,
}: FacultyExtensionRequestModalProps) {
  const [selectedCodes, setSelectedCodes] = useState<RequirementCode[]>([]);
  const [preset, setPreset] = useState<ExtensionPreset>("+3 Days");
  const [customDate, setCustomDate] = useState("");
  const [customTime, setCustomTime] = useState("17:00");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successState, setSuccessState] = useState(false);

  // Initialize selected codes when modal opens or lackings change
  useEffect(() => {
    if (isOpen) {
      if (preSelectedCode && lackings.some((l) => l.code === preSelectedCode)) {
        setSelectedCodes([preSelectedCode]);
      } else if (lackings.length > 0) {
        setSelectedCodes(lackings.map((l) => l.code));
      } else {
        setSelectedCodes([]);
      }
      setReason("");
      setPreset("+3 Days");
      setErrorMessage(null);
      setSuccessState(false);

      // Default custom date to 3 days from now
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 3);
      setCustomDate(defaultDate.toISOString().split("T")[0]);
    }
  }, [isOpen, lackings, preSelectedCode]);

  if (!isOpen) return null;

  function toggleCodeSelection(code: RequirementCode) {
    setSelectedCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }

  function selectAllCodes() {
    setSelectedCodes(lackings.map((l) => l.code));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    if (selectedCodes.length === 0) {
      setErrorMessage("Please select at least one requirement to extend.");
      return;
    }

    if (!reason.trim() || reason.trim().length < 5) {
      setErrorMessage(
        "Please provide a clear reason or justification (at least 5 characters).",
      );
      return;
    }

    if (preset === "Custom" && !customDate) {
      setErrorMessage("Please select a target deadline date for the custom extension.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/faculty/submissions/extension-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          academicYear,
          semester,
          requirementCodes: selectedCodes,
          reason: reason.trim(),
          requestedPreset: preset,
          customDate: preset === "Custom" ? customDate : undefined,
          customTime: preset === "Custom" ? customTime : undefined,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setErrorMessage(data.error || "Failed to submit extension request.");
        return;
      }

      setSuccessState(true);
      if (onSuccess) {
        onSuccess(
          data.message ||
            "Your extension request has been submitted to the administration.",
        );
      }

      setTimeout(() => {
        onClose();
      }, 1400);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "An unexpected error occurred.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="extension-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-5 py-4 bg-slate-50/70 dark:bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <h3
                id="extension-modal-title"
                className="text-base font-bold text-slate-900 dark:text-slate-100"
              >
                Request Deadline Extension
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                A.Y. {academicYear} • {semester}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            aria-label="Close modal"
          >
            <Xmark className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        {successState ? (
          <div className="p-8 text-center space-y-3">
            <div className="inline-flex p-3 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="h-10 w-10" />
            </div>
            <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Request Submitted Successfully
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-sm mx-auto">
              Your request for a deadline extension has been forwarded to the academic
              administrators. You will be notified once reviewed.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Error Message */}
            {errorMessage && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-[#780000] dark:text-rose-400">
                <WarningCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Incomplete Requirements Selection */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Select Requirements Needing Extension:
                </label>
                {lackings.length > 1 && (
                  <button
                    type="button"
                    onClick={selectAllCodes}
                    className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                  >
                    Select All ({lackings.length})
                  </button>
                )}
              </div>

              {lackings.length === 0 ? (
                <p className="text-xs text-slate-500 py-2">
                  No incomplete requirements found.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-1">
                  {lackings.map((item) => {
                    const isSelected = selectedCodes.includes(item.code);
                    const label = REQUIREMENT_LABEL[item.code] || item.code;
                    return (
                      <div
                        key={item.code}
                        onClick={() => toggleCodeSelection(item.code)}
                        className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                          isSelected
                            ? "bg-amber-500/10 border-amber-500/40 text-slate-900 dark:text-slate-100 font-medium"
                            : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="rounded border-slate-300 text-amber-500 focus:ring-amber-400 h-3.5 w-3.5"
                          />
                          <span className="truncate">{label}</span>
                        </div>
                        <span
                          className={`shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            item.status === "Rejected"
                              ? "bg-red-500/10 text-[#780000] dark:text-rose-400 border border-red-500/20"
                              : "bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          {item.status === "Rejected" ? "Needs Revision" : item.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Requested Extension Duration */}
            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                Requested Extension Duration:
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                {(["+24 Hours", "+48 Hours", "+3 Days", "+1 Week", "Custom"] as const).map(
                  (p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPreset(p)}
                      className={`py-1.5 px-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer text-center ${
                        preset === p
                          ? "bg-slate-900 text-white border-slate-900 dark:bg-amber-500 dark:text-slate-950 dark:border-amber-500 shadow-xs"
                          : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750"
                      }`}
                    >
                      {p}
                    </button>
                  ),
                )}
              </div>

              {preset === "Custom" && (
                <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      New Target Date:
                    </label>
                    <input
                      type="date"
                      value={customDate}
                      min={new Date().toISOString().split("T")[0]}
                      onChange={(e) => setCustomDate(e.target.value)}
                      className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Target Time:
                    </label>
                    <input
                      type="time"
                      value={customTime}
                      onChange={(e) => setCustomTime(e.target.value)}
                      className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Reason / Justification */}
            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                Reason / Justification <span className="text-red-500">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="State your reason for requesting an extension (e.g. grading system synchronization, medical emergency, syllabus alignment)..."
                rows={3}
                required
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              />
            </div>

            {/* Informational Guidance Note */}
            <div className="flex items-start gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-400">
              <InfoCircle className="h-4 w-4 shrink-0 text-slate-400 mt-0.5" />
              <span>
                Your request will be submitted to the academic administration. You will
                receive an alert when the request is approved or processed.
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-[#780000] text-[#780000] hover:bg-[#780000]/10 dark:border-rose-400 dark:text-rose-400 dark:hover:bg-rose-400/10 transition cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || selectedCodes.length === 0}
                className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs shadow-sm active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <SystemRestart className="h-3.5 w-3.5 animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <Clock className="h-3.5 w-3.5" />
                    <span>Submit Extension Request</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
