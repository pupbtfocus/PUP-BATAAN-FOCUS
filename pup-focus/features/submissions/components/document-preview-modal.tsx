"use client";

import React from "react";
import {
  Calendar,
  ChatBubble,
  CheckCircle,
  Download,
  Notes,
  OpenNewWindow,
  Page,
} from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";
import { ModalHeader } from "@/components/ui/modal-header";
import { SubmissionStatusBadge } from "@/features/submissions/components/submission-status-badge";
import {
  getFileType,
  getFileBrand,
} from "@/features/faculty-management/components/faculty-submission-panel";
import { OnlineDocumentPreview } from "@/features/submissions/components/online-document-preview";
import { REQUIREMENT_LABEL, type RequirementCode } from "@/config/compliance";

export interface DocumentPreviewSubmission {
  code?: RequirementCode | string;
  title?: string;
  fileName?: string;
  storagePath?: string;
  submittedAt?: string;
  note?: string | null;
  notes?: string | null;
  remarks?: string | null;
  feedback?: string | null;
  admin_remarks?: string | null;
  adminRemarks?: string | null;
  reviewedAt?: string | null;
  latestSubmissionId?: string | null;
  status?: string | null;
  academicYear?: string | null;
  semester?: string | null;
  hasPriorRevision?: boolean | null;
  isRevision?: boolean | null;
}

export interface DocumentPreviewModalProps {
  submission: DocumentPreviewSubmission | null;
  isOpen: boolean;
  onClose: () => void;
  getPreviewUrl?: (submissionId: string) => string;
  onDownload?: (submission: DocumentPreviewSubmission) => void;
}

function defaultGetPreviewUrl(submissionId: string): string {
  return `/api/faculty/submissions/view?submissionId=${encodeURIComponent(submissionId)}`;
}

function formatSubmittedDateTime(value?: string | null): string | null {
  if (!value) return null;
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

export function DocumentPreviewModal({
  submission,
  isOpen,
  onClose,
  getPreviewUrl = defaultGetPreviewUrl,
  onDownload,
}: DocumentPreviewModalProps) {
  if (!isOpen || !submission) {
    return null;
  }

  const title =
    submission.title ||
    (submission.code
      ? REQUIREMENT_LABEL[submission.code as RequirementCode]
      : null) ||
    "Document Preview";

  const fileUrl = submission.latestSubmissionId
    ? getPreviewUrl(submission.latestSubmissionId)
    : "";
  const fileIdentifier = submission.fileName || submission.storagePath || title;
  const { isPdf, isImage, isExcel, isWord, extension } =
    getFileType(fileIdentifier);
  const fileExtension = extension || "file";

  const adminFeedback =
    submission.adminRemarks ||
    submission.admin_remarks ||
    submission.feedback ||
    null;

  const userNote =
    (submission.note && submission.note !== adminFeedback
      ? submission.note
      : null) ||
    (submission.notes && submission.notes !== adminFeedback
      ? submission.notes
      : null) ||
    (submission.remarks && submission.remarks !== adminFeedback
      ? submission.remarks
      : null) ||
    null;

  const normalizedStatus =
    submission.status === "Pending" &&
    (submission.hasPriorRevision || submission.isRevision)
      ? "Revision Under Review"
      : submission.status || (submission.reviewedAt ? "Validated" : "Pending");

  function handleDownload() {
    if (!submission) return;
    if (onDownload) {
      onDownload(submission);
      return;
    }
    const downloadUrl = `${fileUrl}&download=true`;
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = submission.fileName || `${title}.${fileExtension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="document-preview-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl max-h-[92vh] flex flex-col rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-200"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <ModalHeader
          icon={Page}
          title={title}
          subtitle="Document Preview & Verification Details"
          titleId="document-preview-modal-title"
          onClose={onClose}
          closeAriaLabel="Close preview"
        />

        {/* Subheader Metadata Bar (Matches Validation History design) */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 px-6 py-3">
          <div className="flex flex-wrap items-center gap-2.5">
            {(submission.semester || submission.academicYear) && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-2xs">
                {submission.semester ? `${submission.semester} • ` : ""}
                S.Y. {submission.academicYear || "Current Term"}
              </span>
            )}
            <SubmissionStatusBadge status={normalizedStatus} size="md" />
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 max-w-xs sm:max-w-md truncate shadow-2xs" title={fileIdentifier}>
            <AppIcon icon={Page} size="xs" color="default" />
            <span className="truncate">{fileIdentifier}</span>
          </div>
        </div>

        {/* Content Body */}
        <div className="grid gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)] flex-1 overflow-y-auto min-h-0">
          {/* Main Viewer Area */}
          <div className="min-h-[500px] lg:min-h-[580px] overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-950 shadow-inner flex items-center justify-center p-2 sm:p-3 relative">
            {isImage ? (
              <img
                src={fileUrl}
                alt={title}
                className="max-h-[70vh] max-w-full rounded-xl object-contain shadow-md"
              />
            ) : isExcel || isWord || (!isPdf && !isImage && fileIdentifier.includes(".")) ? (
              <OnlineDocumentPreview
                fileName={fileIdentifier}
                fileUrl={fileUrl}
                storagePath={submission.storagePath}
                submissionId={submission.latestSubmissionId}
                fileExtension={fileExtension}
                isExcel={isExcel}
                isWord={isWord}
                brand={getFileBrand(fileExtension, isExcel, isWord)}
                onDownload={handleDownload}
              />
            ) : (
              <iframe
                title={`${title} preview`}
                src={fileUrl}
                className="h-full min-h-[500px] lg:min-h-[580px] w-full rounded-xl border-0 bg-slate-900 shadow-xs"
              />
            )}
          </div>

          {/* Sidebar Area */}
          <div className="flex flex-col justify-between space-y-4">
            <div className="space-y-3.5">
              {/* Reviewer / Admin Remarks */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 p-4 shadow-2xs">
                <div className="text-[11px] font-bold text-[#0b5336] dark:text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <AppIcon icon={Notes} size="xs" color="success" />
                  <span>Admin Remarks</span>
                </div>
                <div className="rounded-xl border border-[#0b5336]/20 dark:border-[#0b5336]/30 bg-[#0b5336]/5 dark:bg-[#0b5336]/15 p-3 text-xs sm:text-sm italic text-slate-800 dark:text-slate-200 leading-relaxed">
                  {adminFeedback ? (
                    <span>&ldquo;{adminFeedback}&rdquo;</span>
                  ) : (
                    <span className="not-italic text-slate-500 dark:text-slate-400">
                      Validated with no additional remarks.
                    </span>
                  )}
                </div>
                {submission.reviewedAt ? (
                  <div className="mt-3 pt-2.5 border-t border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between text-xs">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <AppIcon icon={CheckCircle} size="xs" color="success" />
                      Reviewed On:
                    </span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {formatSubmittedDateTime(submission.reviewedAt) ?? submission.reviewedAt}
                    </span>
                  </div>
                ) : null}
              </div>

              {/* My Remarks / Note Section */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 p-4 shadow-2xs">
                <div className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <AppIcon icon={ChatBubble} size="xs" color="active" />
                  <span>My Remarks / Note</span>
                </div>
                {userNote ? (
                  <div className="rounded-xl border border-amber-200/70 dark:border-amber-900/40 bg-amber-500/5 dark:bg-amber-500/10 p-3 text-xs sm:text-sm italic text-slate-800 dark:text-slate-200 leading-relaxed">
                    &ldquo;{userNote}&rdquo;
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                    No note was added.
                  </p>
                )}
              </div>

              {/* Submission Timeline Details */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 p-4 shadow-2xs space-y-2.5">
                <div className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <AppIcon icon={Calendar} size="xs" />
                  <span>Submission Timeline</span>
                </div>
                {submission.submittedAt ? (
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-slate-500 dark:text-slate-400">Submitted:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {formatSubmittedDateTime(submission.submittedAt) ?? submission.submittedAt}
                    </span>
                  </div>
                ) : null}
                {submission.reviewedAt ? (
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-slate-500 dark:text-slate-400">Validated:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {formatSubmittedDateTime(submission.reviewedAt) ?? submission.reviewedAt}
                    </span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/80 dark:border-slate-800/80">
                  <span className="text-slate-500 dark:text-slate-400">Document Format:</span>
                  <span className="font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    {fileExtension}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons Area */}
            <div className="pt-2 space-y-2.5">
              {/* Download Button (Matches Validation History download button) */}
              <button
                type="button"
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-[#08412a] bg-[#0b5336] hover:bg-[#08412a] text-white font-bold text-xs py-2.5 shadow-xs transition-all cursor-pointer active:scale-95"
                onClick={handleDownload}
                title="Download file directly"
              >
                <AppIcon icon={Download} size="sm" color="white" />
                <span>Download File</span>
              </button>

              {/* Full View Button (Matches Validation History secondary button) */}
              <button
                type="button"
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs py-2.5 transition cursor-pointer shadow-2xs active:scale-95"
                onClick={() =>
                  window.open(
                    fileUrl,
                    "_blank",
                    "noopener,noreferrer",
                  )
                }
                title="Open document in a new tab"
              >
                <AppIcon icon={OpenNewWindow} size="sm" color="inherit" />
                <span>Open Full View</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
