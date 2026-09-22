"use client";

import React from "react";
import { Check, CheckCircle, Download, Eye, Notes, Page, WarningCircle } from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";
import { REQUIREMENT_LABEL, type RequirementCode } from "@/config/compliance";
import { SubmissionStatusBadge } from "./submission-status-badge";
import { cn } from "@/utils/cn";

export type PastSubmissionItem = {
  id: string;
  academicYear: string;
  semester: string;
  requirementCode: RequirementCode | string;
  status: string;
  submittedAt: string;
  updatedAt?: string;
  dateValidated?: string;
  note?: string;
  remarks?: string;
  admin_remarks?: string;
  adminRemarks?: string | null;
  feedback?: string;
  fileName?: string;
  storagePath?: string;
  reviewedAt?: string;
  is_read?: boolean;
  isViewed?: boolean;
  viewed_at?: string;
};

export interface SubmissionHistoryListProps<T extends PastSubmissionItem = PastSubmissionItem> {
  submissions: T[];
  onViewFile: (submission: T) => void;
  onDownloadFile?: (submission: T) => void;
  viewedSubmissionIds?: Set<string>;
  emptyMessage?: string;
  className?: string;
}

export const REQUIREMENT_NAME_MAP: Record<string, string> = {
  grade_sheet: "Grade Sheets",
  grade_sheets: "Grade Sheets",
  gradesheet: "Grade Sheets",
  gradesheets: "Grade Sheets",
  enhanced_syllabus: "Enhanced Course Syllabus",
  syllabus: "Enhanced Course Syllabus",
  class_orientation: "Class Orientation Documentation",
  orientation: "Class Orientation Documentation",
  midterm_package: "Copy of Midterm Examinations with TOS and Answer Key",
  midterm: "Copy of Midterm Examinations with TOS and Answer Key",
  final_package: "Copy of Final Examinations with TOS and Answer Key",
  final: "Copy of Final Examinations with TOS and Answer Key",
  class_records: "Class Records",
  classrecords: "Class Records",
};

export function getFriendlyRequirementName(code?: string): string {
  if (!code) return "Requirement Document";
  if (REQUIREMENT_LABEL[code as RequirementCode]) {
    return REQUIREMENT_LABEL[code as RequirementCode];
  }
  const clean = code.toLowerCase().trim().replace(/[-_\s]+/g, "");
  for (const [key, label] of Object.entries(REQUIREMENT_NAME_MAP)) {
    const cleanKey = key.toLowerCase().replace(/[-_\s]+/g, "");
    if (clean === cleanKey || clean.includes(cleanKey)) {
      return label;
    }
  }
  return code
    .split(/[_-]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatDateTime(value?: string): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDateOnly(value?: string): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTimeOnly(value?: string): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";

  return parsed.toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function SubmissionHistoryList<T extends PastSubmissionItem = PastSubmissionItem>({
  submissions,
  onViewFile,
  onDownloadFile,
  viewedSubmissionIds = new Set(),
  emptyMessage = "No validated documents found for the selected academic term.",
  className = "",
}: SubmissionHistoryListProps<T>) {
  function handleDownload(sub: T) {
    if (onDownloadFile) {
      onDownloadFile(sub);
      return;
    }
    const downloadUrl = `/api/faculty/submissions/view?submissionId=${encodeURIComponent(sub.id)}&download=true`;
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = sub.fileName || `${getFriendlyRequirementName(sub.requirementCode)}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  if (submissions.length === 0) {
    return (
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-10 sm:p-14 text-center shadow-sm max-w-xl mx-auto my-4 space-y-4 animate-in zoom-in-95 duration-200">
        <div className="mx-auto flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-3xl bg-[#0b5336] text-white shadow-xl shadow-[#0b5336]/25 border-2 border-[#08412a] animate-in zoom-in duration-300">
          <CheckCircle className="w-10 h-10 sm:w-12 sm:h-12 stroke-[2.5]" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            No Validated Documents Found
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
            {emptyMessage}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("w-full space-y-4", className)}>
      {/* ─── Desktop Table View with Horizontal Scroll Container ─── */}
      <div className="hidden md:block overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition-colors">
        <div className="w-full overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs min-w-[880px]" aria-label="Validation history table">
            <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/80 text-slate-600 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider">
              <tr>
                <th scope="col" className="w-[34%] px-6 py-4">
                  Requirement
                </th>
                <th scope="col" className="w-[18%] px-5 py-4 whitespace-nowrap">
                  Academic Term
                </th>
                <th scope="col" className="w-[16%] px-5 py-4 whitespace-nowrap">
                  Date Validated
                </th>
                <th scope="col" className="w-[10%] px-4 py-4 text-center whitespace-nowrap">
                  Status
                </th>
                <th scope="col" className="w-[12%] px-4 py-4">
                  Reviewer Remarks
                </th>
                <th scope="col" className="w-[10%] px-6 py-4 text-right whitespace-nowrap">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {submissions.map((sub) => {
                const title = getFriendlyRequirementName(sub.requirementCode);
                const adminFeedback =
                  sub.adminRemarks || sub.admin_remarks || sub.feedback;
                const isUnread = Boolean(
                  adminFeedback &&
                    !viewedSubmissionIds.has(sub.id) &&
                    sub.is_read !== true,
                );
                const dateValidated =
                  sub.dateValidated || sub.updatedAt || sub.reviewedAt || sub.submittedAt;

                return (
                  <tr
                    key={sub.id}
                    className="bg-white dark:bg-slate-900 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    {/* Requirement Name */}
                    <td className="px-6 py-4.5 font-medium text-slate-900 dark:text-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0b5336]/10 text-[#0b5336] dark:bg-[#0b5336]/20 dark:text-emerald-400 border border-[#0b5336]/20 shadow-2xs">
                          <AppIcon icon={Page} size="md" color="inherit" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {isUnread && (
                              <span className="relative flex h-2 w-2 shrink-0" title="New feedback">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                              </span>
                            )}
                            <span className="font-bold text-sm text-slate-900 dark:text-slate-100 leading-snug">
                              {title}
                            </span>
                          </div>
                          {sub.fileName && (
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate block max-w-[260px] mt-0.5" title={sub.fileName}>
                              {sub.fileName}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Academic Term */}
                    <td className="px-5 py-4.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-2xs">
                        {sub.semester} • S.Y. {sub.academicYear}
                      </span>
                    </td>

                    {/* Date Validated */}
                    <td className="px-5 py-4.5 whitespace-nowrap">
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {formatDateOnly(dateValidated)}
                      </div>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                        {formatTimeOnly(dateValidated)}
                      </div>
                    </td>

                    {/* Status Column: Check Icon Only */}
                    <td className="px-4 py-4.5 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center">
                        <SubmissionStatusBadge status="validated" size="md" iconOnly />
                      </div>
                    </td>

                    {/* Reviewer Remarks */}
                    <td className="px-4 py-4.5 text-slate-600 dark:text-slate-400">
                      {adminFeedback ? (
                        <div className="max-w-[240px] rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-2.5 text-xs text-slate-700 dark:text-slate-300 leading-relaxed shadow-2xs" title={adminFeedback}>
                          <span className="font-bold text-[10px] uppercase tracking-wider text-[#0b5336] dark:text-emerald-400 block mb-0.5">Remarks:</span>
                          <p className="italic">&ldquo;{adminFeedback}&rdquo;</p>
                        </div>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-600 text-xs">—</span>
                      )}
                    </td>

                    {/* Action Column */}
                    <td className="px-6 py-4.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          aria-label={`View submitted file for ${title}`}
                          onClick={() => onViewFile(sub)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 transition cursor-pointer shadow-2xs active:scale-95"
                          title="Preview Document"
                        >
                          <AppIcon icon={Eye} size="sm" color="default" />
                          <span>View</span>
                        </button>
                        <button
                          type="button"
                          aria-label={`Download file for ${title}`}
                          onClick={() => handleDownload(sub)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-[#08412a] bg-[#0b5336] hover:bg-[#08412a] text-white px-3 py-1.5 text-xs font-bold transition cursor-pointer shadow-xs active:scale-95"
                          title="Download File"
                        >
                          <AppIcon icon={Download} size="sm" color="white" />
                          <span>Download</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Mobile Stacked Card View (Visible on mobile, hidden on md+) ─── */}
      <div className="space-y-3.5 block md:hidden" role="feed" aria-label="Validation history list">
        {submissions.map((sub) => {
          const title = getFriendlyRequirementName(sub.requirementCode);
          const adminFeedback =
            sub.adminRemarks || sub.admin_remarks || sub.feedback;
          const isUnread = Boolean(
            adminFeedback &&
              !viewedSubmissionIds.has(sub.id) &&
              sub.is_read !== true,
          );
          const dateValidated =
            sub.dateValidated || sub.updatedAt || sub.reviewedAt || sub.submittedAt;

          return (
            <article
              key={sub.id}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-3.5 shadow-sm transition hover:border-slate-300 dark:hover:border-slate-700"
            >
              {/* Header: Title & Status Badge */}
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0b5336]/10 text-[#0b5336] dark:bg-[#0b5336]/20 dark:text-emerald-400 border border-[#0b5336]/20 shadow-2xs mt-0.5">
                  <AppIcon icon={Page} size="md" color="inherit" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {isUnread && (
                      <span className="relative flex h-2 w-2 shrink-0" title="New feedback">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                      </span>
                    )}
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                      {title}
                    </h4>
                  </div>
                  {sub.fileName && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5" title={sub.fileName}>
                      {sub.fileName}
                    </p>
                  )}
                  <span className="bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 px-2.5 py-0.5 text-[10px] font-semibold rounded-md inline-flex items-center mt-1.5 shadow-2xs">
                    {sub.semester} • S.Y. {sub.academicYear}
                  </span>
                </div>

                <SubmissionStatusBadge status="validated" size="md" iconOnly />
              </div>

              {/* Date Validated */}
              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 font-medium pt-1">
                <AppIcon icon={CheckCircle} size="sm" color="success" />
                <span>Validated: {formatDateTime(dateValidated)}</span>
              </div>

              {/* Reviewer Feedback Callout */}
              {adminFeedback && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-800 dark:text-slate-200 p-3 text-xs shadow-2xs">
                  <span className="font-bold uppercase tracking-wider text-[10px] text-[#0b5336] dark:text-emerald-400 mb-1 flex items-center gap-1">
                    <AppIcon icon={Notes} size="xs" color="success" />
                    Reviewer Remarks:
                  </span>
                  <p className="italic leading-relaxed">&ldquo;{adminFeedback}&rdquo;</p>
                </div>
              )}

              {/* Footer Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  aria-label={`View submitted file for ${title}`}
                  onClick={() => onViewFile(sub)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 transition cursor-pointer shadow-2xs active:scale-95"
                >
                  <AppIcon icon={Eye} size="sm" color="default" />
                  <span>View</span>
                </button>
                <button
                  type="button"
                  aria-label={`Download file for ${title}`}
                  onClick={() => handleDownload(sub)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#08412a] bg-[#0b5336] hover:bg-[#08412a] text-white px-3 py-2 text-xs font-bold transition cursor-pointer shadow-xs active:scale-95"
                >
                  <AppIcon icon={Download} size="sm" color="white" />
                  <span>Download</span>
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
