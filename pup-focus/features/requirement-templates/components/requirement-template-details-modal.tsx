"use client";

import React from "react";
import {
  Calendar,
  CheckCircle,
  Clock,
  Database,
  EditPencil,
  Eye,
  EyeClosed,
  InfoCircle,
  Page,
  ShieldCheck,
  Xmark,
} from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";
import { ModalHeader } from "@/components/ui/modal-header";
import {
  ALLOWED_FORMAT_OPTIONS,
  type RequirementTemplate,
} from "@/features/requirement-templates/types/requirement-template.types";

interface RequirementTemplateDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  template: RequirementTemplate | null;
  onEdit?: (template: RequirementTemplate) => void;
  onToggleHide?: (template: RequirementTemplate) => Promise<void> | void;
  isTogglingStatus?: boolean;
}

function formatDate(isoString?: string | null): string {
  if (!isoString) return "Not recorded";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "Invalid date";
  return d.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
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
          onClose={onClose}
        />

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 text-slate-800 dark:text-slate-200">
          {/* Top Banner Overview Card */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-4 sm:p-5">
            <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0 flex items-center justify-center">
              <AppIcon icon={Page} size="lg" color="inherit" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h3
                  id="requirement-details-title"
                  className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100"
                >
                  {template.title}
                </h3>
              </div>

              {/* Status and Configuration Badges */}
              <div className="flex flex-wrap items-center gap-2">
                {template.is_active ? (
                  <span className="bg-[#0b5336] text-white border border-[#08412a] px-2.5 py-0.5 text-xs font-semibold rounded-md inline-flex items-center gap-1.5 shadow-2xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
                    Active & Visible
                  </span>
                ) : (
                  <span className="bg-[#780000] text-white border border-[#5e0000] px-2.5 py-0.5 text-xs font-semibold rounded-md inline-flex items-center gap-1.5 shadow-2xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-300" />
                    Hidden from Faculty
                  </span>
                )}

                {template.is_mandatory ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-amber-500/15 text-amber-900 border border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-400/30">
                    Mandatory Submission
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700">
                    Optional Submission
                  </span>
                )}

                <span className="font-mono text-xs px-2 py-0.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md border border-slate-200 dark:border-slate-700">
                  code: {template.code}
                </span>
              </div>
            </div>
          </div>

          {/* Description & Guidelines Section */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <AppIcon icon={InfoCircle} size="sm" color="default" />
              Description & Faculty Guidelines
            </h4>
            <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/30 p-4">
              {template.description && template.description.trim().length > 0 ? (
                <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {template.description}
                </p>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                  No additional instructions or descriptions configured. Faculty members will see standard submission options for this document.
                </p>
              )}
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
                  {template.allowed_formats.length} format{template.allowed_formats.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {template.allowed_formats.map((fmt) => {
                  const formatOption = ALLOWED_FORMAT_OPTIONS.find((opt) => opt.value === fmt);
                  return (
                    <span
                      key={fmt}
                      className="px-2.5 py-1 text-xs font-bold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 shadow-2xs"
                      title={formatOption?.label || fmt}
                    >
                      {fmt}
                    </span>
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                Submissions in other file formats will be automatically blocked by the validator.
              </p>
            </div>

            {/* Maximum File Size */}
            <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-800/20 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Maximum File Size Limit
                </span>
                <span className="px-2 py-0.5 text-xs font-bold rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                  {template.max_size_mb} MB
                </span>
              </div>
              <div className="pt-1">
                <p className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
                  {template.max_size_mb} Megabytes
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Upload payload ceiling enforced per file submission.
                </p>
              </div>
            </div>

            {/* Compliance Policy */}
            <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-800/20 p-4 space-y-1.5">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Compliance Requirement Policy
              </span>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {template.is_mandatory
                  ? "Mandatory requirement. Faculty cannot achieve complete term clearance without valid approval of this document."
                  : "Optional requirement. Document may be submitted optionally or as supplemental documentation."}
              </p>
            </div>

            {/* Visibility Status */}
            <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-800/20 p-4 space-y-1.5">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Faculty Visibility Status
              </span>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {template.is_active
                  ? "Active and visible. Appears in faculty compliance checklists and submission upload menus."
                  : "Hidden from faculty view. Will not appear in checklists, but prior submissions remain safely archived."}
              </p>
            </div>
          </div>

          {/* System & Audit Information */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <AppIcon icon={Database} size="sm" color="default" />
              System & Audit Metadata
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 text-xs">
              <div>
                <span className="text-slate-500 dark:text-slate-400 block text-[11px]">System Code</span>
                <span className="font-mono font-medium text-slate-800 dark:text-slate-200">{template.code}</span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Template Record ID</span>
                <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400 break-all">{template.id}</span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Date Created</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">{formatDate(template.created_at)}</span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Last Updated</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">{formatDate(template.updated_at)}</span>
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
                className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 dark:border-slate-700 text-xs font-semibold rounded-lg px-3 py-2 transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
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
                className="bg-amber-500 hover:bg-amber-600 text-white dark:bg-amber-600 dark:hover:bg-amber-700 text-xs font-semibold rounded-lg px-3.5 py-2 transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
              >
                <EditPencil className="h-4 w-4" strokeWidth={2} />
                <span>Edit Template</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 dark:border-slate-700 text-xs font-semibold rounded-lg px-3.5 py-2 transition-colors cursor-pointer shadow-2xs"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
