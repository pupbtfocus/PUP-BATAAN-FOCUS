"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  CheckCircle,
  Hourglass,
  Page,
  SystemRestart,
  Trash,
  Upload,
  WarningTriangle,
} from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";
import { ModalHeader } from "@/components/ui/modal-header";
import type { RequirementCode } from "@/config/compliance";

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

export function FacultyExtensionRequestModal({
  isOpen,
  onClose,
  onSuccess,
  academicYear,
  semester,
  lackings,
}: FacultyExtensionRequestModalProps) {
  const [reason, setReason] = useState("");
  const [supportingDocument, setSupportingDocument] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successState, setSuccessState] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevIsOpenRef = useRef(false);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      setReason("");
      setSupportingDocument(null);
      setErrorMessage(null);
      setSuccessState(false);
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    if (!reason.trim()) {
      setErrorMessage("Please state your reason for requesting an extension.");
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("academicYear", academicYear);
      formData.append("semester", semester);
      formData.append("requirementCodes", JSON.stringify(lackings.map((l) => l.code)));
      formData.append("reason", reason.trim());
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
                  className="p-3 rounded-xl bg-[#780000] border border-[#5e0000] text-white text-xs font-semibold flex items-center gap-2 shadow-xs"
                >
                  <AppIcon icon={WarningTriangle} size="sm" color="white" className="shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Reason / Justification */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                    Reason / Justification <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">Select preset or type below</span>
                </div>

                {/* Preset Dropdown */}
                <select
                  value={[
                    "Grading system synchronization",
                    "Medical emergency",
                    "Syllabus alignment",
                    "Technical issue",
                    "Document clearance delay",
                  ].includes(reason) ? reason : ""}
                  onChange={(e) => {
                    if (e.target.value) {
                      setReason(e.target.value);
                    }
                  }}
                  className="w-full mb-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950/60 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition cursor-pointer"
                >
                  <option value="">-- Select a reason preset (or write below) --</option>
                  <option value="Grading system synchronization">Grading system synchronization</option>
                  <option value="Medical emergency">Medical emergency</option>
                  <option value="Syllabus alignment">Syllabus alignment</option>
                  <option value="Technical issue">Technical issue</option>
                  <option value="Document clearance delay">Document clearance delay</option>
                </select>

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
                disabled={isSubmitting || !reason.trim()}
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
