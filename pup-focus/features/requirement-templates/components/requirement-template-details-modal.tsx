"use client";

import React from "react";
import { EditPencil, Eye, EyeClosed, Page } from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";
import { ModalHeader } from "@/components/ui/modal-header";
import {
  ALLOWED_FORMAT_OPTIONS,
  type RequirementTemplate,
} from "@/features/requirement-templates/types/requirement-template.types";
import { FormatIcon } from "./format-icon";

interface RequirementTemplateDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  template: RequirementTemplate | null;
  onEdit?: (template: RequirementTemplate) => void;
  onToggleHide?: (template: RequirementTemplate) => Promise<void> | void;
  isTogglingStatus?: boolean;
}

export function RequirementTemplateDetailsModal({
  isOpen,
  onClose,
  template,
  onEdit,
  onToggleHide,
  isTogglingStatus = false,
}: RequirementTemplateDetailsModalProps) {
  if (!isOpen || !template) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="requirement-details-title"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 p-3 sm:p-4 flex min-h-full items-center justify-center backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-200">
        {/* Header */}
        <ModalHeader
          icon={Page}
          title="Requirement Template Details"
          subtitle="Full specification, compliance rules, and submission settings"
        />

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 text-slate-800 dark:text-slate-200">
          {/* Top Banner Overview Card */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-4 sm:p-5">
            <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shrink-0 flex items-center justify-center">
              <AppIcon icon={Page} size="lg" color="default" />
            </div>

            <div className="flex-1 min-w-0">
              <h3
                id="requirement-details-title"
                className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100"
              >
                {template.title}
              </h3>
            </div>
          </div>

          {/* Specification Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Allowed Formats */}
            <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-800/20 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Allowed File Formats
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {template.allowed_formats.length} format
                  {template.allowed_formats.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {template.allowed_formats.map((fmt) => (
                  <span
                    key={fmt}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-transparent text-slate-800 dark:text-slate-200 border-2 border-slate-300 dark:border-slate-700 shadow-2xs"
                  >
                    <FormatIcon format={fmt} className="h-4 w-4 shrink-0" />
                    <span>{fmt}</span>
                  </span>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Submissions in other file formats will be automatically blocked
                by the validator.
              </p>
            </div>

            {/* Maximum File Size */}
            <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-800/20 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Maximum File Size Limit
                </span>
              </div>
              <div className="pt-1">
                <p className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
                  {template.max_size_mb} MB
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Upload payload ceiling enforced per file submission.
                </p>
              </div>
            </div>

            {/* Compliance Requirement */}
            <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-800/20 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Compliance Requirement
                </span>
              </div>
              <div className="pt-1">
                {template.is_mandatory ? (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-amber-500 text-slate-900 border border-amber-600 shadow-2xs">
                    Mandatory Submission
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-600 text-white border border-slate-700 shadow-2xs">
                    Optional Submission
                  </span>
                )}
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
                  {template.is_mandatory
                    ? "Faculty members are required to submit this document."
                    : "This document submission is optional for faculty."}
                </p>
              </div>
            </div>

            {/* Faculty Visibility Status */}
            <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-800/20 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Faculty Visibility Status
                </span>
              </div>
              <div className="pt-1">
                {template.is_active ? (
                  <span className="bg-[#0b5336] text-white border border-[#08412a] px-2.5 py-1 text-xs font-semibold rounded-md inline-flex items-center gap-1.5 shadow-2xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
                    Active & Visible
                  </span>
                ) : (
                  <span className="bg-[#780000] text-white border border-[#5e0000] px-2.5 py-1 text-xs font-semibold rounded-md inline-flex items-center gap-1.5 shadow-2xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-300" />
                    Hidden from Faculty
                  </span>
                )}
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
                  {template.is_active
                    ? "Template is currently published and visible to faculty."
                    : "Template is archived and hidden from faculty view."}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 px-5 py-3.5 flex flex-wrap items-center justify-between gap-2.5">
          {/* Left Action: Quick Hide/Unhide toggle */}
          <div>
            {onToggleHide && (
              <button
                type="button"
                disabled={isTogglingStatus}
                onClick={() => void onToggleHide(template)}
                className={`text-xs font-semibold rounded-lg px-3 py-2 transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-2xs ${
                  template.is_active
                    ? "bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000]"
                    : "bg-[#0b5336] hover:bg-[#08412a] text-white border border-[#08412a]"
                }`}
              >
                {template.is_active ? (
                  <>
                    <EyeClosed className="h-4 w-4" strokeWidth={2} />
                    <span>Hide Requirement</span>
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4" strokeWidth={2} />
                    <span>Unhide Requirement</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Right Actions: Edit & Close */}
          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(template);
                }}
                className="bg-amber-500 hover:bg-amber-400 text-slate-900 border border-amber-600 text-xs font-semibold rounded-lg px-3.5 py-2 transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
              >
                <EditPencil className="h-4 w-4" strokeWidth={2} />
                <span>Edit Template</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] text-xs font-semibold rounded-lg px-3.5 py-2 transition-colors cursor-pointer shadow-xs"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
