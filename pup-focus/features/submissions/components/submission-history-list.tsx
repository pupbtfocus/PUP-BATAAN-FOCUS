"use client";

import React from "react";
import { Eye, Clock3, AlertCircle, FileText, CheckCircle2, FileCheck2, Download } from "lucide-react";
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
      <div className="rounded-xl border border-dashed border-slate-200/80 dark:border-slate-800 bg-white/50 dark:bg-slate-900/30 px-4 py-12 text-center shadow-xs">
        <FileCheck2 className="mx-auto h-8 w-8 text-slate-400 dark:text-slate-600 mb-2" />
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">No Validated Documents Found</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn("w-full space-y-4", className)}>
      {/* ─── Desktop Table View with Horizontal Scroll Container ─── */}
      <div className="hidden md:block overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs transition-colors">
        <div className="w-full overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs min-w-[840px]" aria-label="Validation history table">
            <thead className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90 text-slate-700 dark:text-slate-300 font-semibold">
              <tr>
                <th scope="col" className="px-5 py-3.5 min-w-[220px]">
                  Requirement
                </th>
                <th scope="col" className="px-4 py-3.5 min-w-[140px] whitespace-nowrap">
                  Academic Term
                </th>
                <th scope="col" className="px-4 py-3.5 min-w-[150px] whitespace-nowrap">
                  Date Validated
                </th>
                <th scope="col" className="px-4 py-3.5 min-w-[120px] whitespace-nowrap">
                  Status
                </th>
                <th scope="col" className="px-4 py-3.5 min-w-[200px]">
                  Reviewer Remarks
                </th>
                <th scope="col" className="px-5 py-3.5 text-right min-w-[180px] whitespace-nowrap">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/60">
              {submissions.map((sub) => {
                const title = getFriendlyRequirementName(sub.requirementCode);
                const adminFeedback =
                  sub.adminRemarks || sub.admin_remarks || sub.feedback || sub.remarks;
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
                    <td className="px-5 py-3.5 font-medium text-slate-900 dark:text-slate-100 min-w-[220px]">
                      <div className="flex items-center gap-2">
                        {isUnread && (
                          <span className="relative flex h-2 w-2 shrink-0" title="New feedback">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                          </span>
                        )}
                        <span className="font-semibold text-slate-900 dark:text-slate-100">{title}</span>
                      </div>
                    </td>

                    {/* Academic Term */}
                    <td className="px-4 py-3.5 text-slate-600 dark:text-slate-400 whitespace-nowrap min-w-[140px]">
                      <span className="inline-flex items-center rounded-md border border-slate-200/80 bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:border-slate-700/60 dark:bg-slate-800/60 dark:text-slate-300">
                        {sub.semester} • S.Y. {sub.academicYear}
                      </span>
                    </td>

                    {/* Date Validated */}
                    <td className="px-4 py-3.5 text-slate-600 dark:text-slate-400 whitespace-nowrap min-w-[150px]">
                      {formatDateTime(dateValidated)}
                    </td>

                    {/* Status Badge (Emerald Validated) */}
                    <td className="px-4 py-3.5 whitespace-nowrap min-w-[120px]">
                      <SubmissionStatusBadge status="validated" size="sm" />
                    </td>

                    {/* Reviewer Remarks */}
                    <td className="px-4 py-3.5 text-slate-600 dark:text-slate-400 min-w-[200px]">
                      {adminFeedback ? (
                        <p className="italic text-slate-700 dark:text-slate-300 leading-snug" title={adminFeedback}>
                          &ldquo;{adminFeedback}&rdquo;
                        </p>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500">—</span>
                      )}
                    </td>

                    {/* Action Column */}
                    <td className="px-5 py-3.5 text-right whitespace-nowrap min-w-[180px]">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          aria-label={`View submitted file for ${title}`}
                          onClick={() => onViewFile(sub)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/80 dark:border-slate-700 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                          title="Preview Document"
                        >
                          <Eye className="h-3.5 w-3.5 text-slate-500" />
                          <span>View</span>
                        </button>
                        <button
                          type="button"
                          aria-label={`Download file for ${title}`}
                          onClick={() => handleDownload(sub)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300/80 dark:border-emerald-600/50 bg-emerald-50 hover:bg-emerald-100/80 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 transition cursor-pointer shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                          title="Download File"
                        >
                          <Download className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
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
      <div className="space-y-3 block md:hidden" role="feed" aria-label="Validation history list">
        {submissions.map((sub) => {
          const title = getFriendlyRequirementName(sub.requirementCode);
          const adminFeedback =
            sub.adminRemarks || sub.admin_remarks || sub.feedback || sub.remarks;
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
              className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3 shadow-xs transition hover:border-slate-300 dark:hover:border-slate-700"
            >
              {/* Header: Title & Status Badge */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {isUnread && (
                      <span className="relative flex h-2 w-2 shrink-0" title="New feedback">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                      </span>
                    )}
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {title}
                    </h4>
                  </div>
                  <span className="inline-flex items-center rounded-md border border-slate-200/80 bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700 dark:border-slate-700/60 dark:bg-slate-800/60 dark:text-slate-300 mt-1">
                    {sub.semester} • S.Y. {sub.academicYear}
                  </span>
                </div>

                <SubmissionStatusBadge status="validated" size="sm" />
              </div>

              {/* Date Validated */}
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span>Date Validated: {formatDateTime(dateValidated)}</span>
              </div>

              {/* Reviewer Feedback Callout */}
              {adminFeedback && (
                <div className="rounded-xl border border-emerald-300/80 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 p-2.5 text-xs text-emerald-900 dark:text-emerald-200">
                  <span className="font-semibold block uppercase tracking-wider text-[10px] text-emerald-800 dark:text-emerald-300 mb-0.5">
                    Reviewer Remarks:
                  </span>
                  <p className="italic leading-relaxed">&ldquo;{adminFeedback}&rdquo;</p>
                </div>
              )}

              {/* Footer Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/80 dark:border-slate-800/60">
                <button
                  type="button"
                  aria-label={`View submitted file for ${title}`}
                  onClick={() => onViewFile(sub)}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200/80 dark:border-slate-700 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>View</span>
                </button>
                <button
                  type="button"
                  aria-label={`Download file for ${title}`}
                  onClick={() => handleDownload(sub)}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-300/80 dark:border-emerald-600/50 bg-emerald-50 hover:bg-emerald-100/80 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 transition cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
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
