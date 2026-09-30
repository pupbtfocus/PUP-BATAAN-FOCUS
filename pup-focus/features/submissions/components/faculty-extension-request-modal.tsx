"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Calendar,
  CheckCircle,
  Hourglass,
  InfoCircle,
  Page,
  SystemRestart,
  Trash,
  Upload,
  WarningCircle,
  WarningTriangle,
  Xmark,
} from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";
import { ModalHeader } from "@/components/ui/modal-header";
import {
  REQUIREMENT_LABEL,
  type RequirementCode,
} from "@/config/compliance";
import { SubmissionStatusBadge } from "./submission-status-badge";

export interface LackingRequirementItem {
  code: RequirementCode | string;
  status: "Not Submitted" | "Rejected" | "Pending" | "Overdue" | "Extended" | string;
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
  preSelectedCode?: RequirementCode | string | null;
}

type ExtensionPreset = "+24 Hours" | "+48 Hours" | "+3 Days" | "+1 Week" | "Custom";

function calculateProposedDeadline(preset: ExtensionPreset, customDate: string, customTime: string): { dateStr: string; displayStr: string } {
  if (preset === "Custom" && customDate) {
    try {
      const d = new Date(`${customDate}T${customTime || "17:00"}:00+08:00`);
      if (!Number.isNaN(d.getTime())) {
        return {
          dateStr: customDate,
          displayStr: d.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
            timeZone: "Asia/Manila",
          }),
        };
      }
    } catch {}
    return { dateStr: customDate, displayStr: `${customDate} at ${customTime || "17:00"}` };
  }

  const d = new Date();
  if (preset === "+24 Hours") d.setDate(d.getDate() + 1);
  else if (preset === "+48 Hours") d.setDate(d.getDate() + 2);
  else if (preset === "+1 Week") d.setDate(d.getDate() + 7);
  else d.setDate(d.getDate() + 3); // +3 Days default

  const dateStr = d.toISOString().split("T")[0];
  const displayStr = d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Manila",
  });

  return { dateStr, displayStr };
}

export function FacultyExtensionRequestModal({
  isOpen,
  onClose,
  onSuccess,
  academicYear,
  semester,
  lackings,
  preSelectedCode,
}: FacultyExtensionRequestModalProps) {
  const [selectedCodes, setSelectedCodes] = useState<(RequirementCode | string)[]>([]);
  const [preset, setPreset] = useState<ExtensionPreset>("+3 Days");
  const [customDate, setCustomDate] = useState("");
  const [customTime, setCustomTime] = useState("17:00");
  const [reason, setReason] = useState("");
  const [supportingDocument, setSupportingDocument] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successState, setSuccessState] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setSupportingDocument(null);
      setErrorMessage(null);
      setSuccessState(false);

      // Default custom date to 3 days from now
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 3);
      setCustomDate(defaultDate.toISOString().split("T")[0]);
    }
  }, [isOpen, lackings, preSelectedCode]);

  if (!isOpen) return null;

  function toggleCodeSelection(code: RequirementCode | string) {
    setSelectedCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }

  function selectAllCodes() {
    setSelectedCodes(lackings.map((l) => l.code));
  }

  const { displayStr: proposedDeadlineDisplay } = calculateProposedDeadline(preset, customDate, customTime);

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
      const formData = new FormData();
      formData.append("academicYear", academicYear);
      formData.append("semester", semester);
      formData.append("requirementCodes", JSON.stringify(selectedCodes));
      formData.append("reason", reason.trim());
      formData.append("requestedPreset", preset);
      if (preset === "Custom") {
        formData.append("customDate", customDate);
        formData.append("customTime", customTime);
      }
      if (supportingDocument) {
        formData.append("supportingDocument", supportingDocument);
      }

      const response = await fetch("/api/faculty/submissions/extension-request", {
        method: "POST",
        body: formData,
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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 p-3 sm:p-4 flex min-h-full items-center justify-center backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="extension-modal-title"
      >
        <ModalHeader
          icon={Hourglass}
          title="Request Submission Extension"
          subtitle={`A.Y. ${academicYear} • ${semester}`}
          onClose={onClose}
          closeAriaLabel="Close extension request modal"
          className="shrink-0"
        />

        {successState ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400">
              <AppIcon icon={CheckCircle} size="lg" color="inherit" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Extension Request Submitted
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 max-w-sm mx-auto leading-relaxed">
              Your extension request has been submitted to the academic administration for review.
              You will receive an alert once approved.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-0">
              {errorMessage && (
                <div
                  role="alert"
                  className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-400 text-xs flex items-start gap-2"
                >
                  <AppIcon icon={WarningTriangle} size="sm" color="inherit" className="shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Requirement Selection Checklist */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Requirements to Extend <span className="text-red-500">*</span>
                  </label>
                  {lackings.length > 1 && (
                    <button
                      type="button"
                      onClick={selectAllCodes}
                      className="text-[11px] font-semibold text-amber-800 dark:text-amber-400 hover:underline cursor-pointer"
                    >
                      Select All ({lackings.length})
                    </button>
                  )}
                </div>

                {lackings.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-500 dark:text-slate-400">
                    No overdue or pending requirements found for this academic term.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {lackings.map((item) => {
                      const isSelected = selectedCodes.includes(item.code);
                      const label = item.label || REQUIREMENT_LABEL[item.code as RequirementCode] || item.code;
                      return (
                        <div
                          key={item.code}
                          onClick={() => toggleCodeSelection(item.code)}
                          className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                            isSelected
                              ? "bg-amber-500/10 border-amber-500/40 text-slate-900 dark:text-slate-100 font-semibold shadow-2xs"
                              : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-amber-500 focus:ring-amber-400 h-4 w-4 cursor-pointer accent-amber-500"
                            />
                            <span className="truncate">{label}</span>
                          </div>
                          <SubmissionStatusBadge
                            status={
                              item.status === "Rejected"
                                ? "Needs Revision"
                                : item.status
                            }
                            size="sm"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Proposed Target Deadline Duration & Presets */}
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                  Proposed Target Deadline <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                  {(["+24 Hours", "+48 Hours", "+3 Days", "+1 Week", "Custom"] as const).map(
                    (p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPreset(p)}
                        className={`py-2 px-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer text-center ${
                          preset === p
                            ? "bg-amber-500 text-slate-950 border-amber-500 font-bold shadow-xs active:scale-[0.98]"
                            : "bg-white dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-700/50 font-medium"
                        }`}
                      >
                        {p}
                      </button>
                    ),
                  )}
                </div>

                {/* Calculated Proposed Target Deadline Display */}
                <div className="mt-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Target Deadline:</span>
                  <span className="font-bold text-amber-800 dark:text-amber-300">
                    {proposedDeadlineDisplay}
                  </span>
                </div>

                {preset === "Custom" && (
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-700/80">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        New Target Date:
                      </label>
                      <input
                        type="date"
                        value={customDate}
                        min={new Date().toISOString().split("T")[0]}
                        onChange={(e) => setCustomDate(e.target.value)}
                        required
                        className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-slate-900 dark:text-slate-100 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30"
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
                        required
                        className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-slate-900 dark:text-slate-100 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30"
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
                  rows={2}
                  required
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950/60 px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition"
                />
              </div>

              {/* Optional Supporting Document Upload */}
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                  Supporting Document <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    if (file && file.size > 10 * 1024 * 1024) {
                      setErrorMessage("Supporting document file size exceeds the 10MB limit.");
                      setSupportingDocument(null);
                      return;
                    }
                    setSupportingDocument(file);
                    setErrorMessage(null);
                  }}
                  className="hidden"
                />

                {supportingDocument ? (
                  <div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <AppIcon icon={Page} size="sm" color="inherit" className="text-amber-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {supportingDocument.name}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {(supportingDocument.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSupportingDocument(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      className="p-1 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer shrink-0"
                      title="Remove file"
                    >
                      <AppIcon icon={Trash} size="sm" color="inherit" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-amber-400 dark:hover:border-amber-500 bg-slate-50 dark:bg-slate-800/30 text-xs font-semibold text-slate-600 dark:text-slate-300 transition cursor-pointer"
                  >
                    <AppIcon icon={Upload} size="sm" color="inherit" />
                    <span>Attach Supporting Document (PDF, Image, DOCX — max 10MB)</span>
                  </button>
                )}
              </div>

              {/* Informational Guidance Note */}
              <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 text-[11px] text-slate-700 dark:text-slate-300">
                <AppIcon icon={InfoCircle} size="md" color="active" />
                <span className="leading-relaxed">
                  Only one pending extension request is permitted per requirement schedule.
                  Once approved, your portal will be unlocked until the approved date.
                </span>
              </div>
            </div>

            {/* Sticky Fixed Action Buttons */}
            <div className="shrink-0 flex items-center justify-end gap-2.5 px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] transition cursor-pointer disabled:opacity-50 shadow-xs"
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
                    <AppIcon icon={SystemRestart} size="sm" color="inherit" className="animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <AppIcon icon={Hourglass} size="sm" color="inherit" />
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
