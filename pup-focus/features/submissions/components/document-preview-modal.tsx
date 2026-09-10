"use client";

import React from "react";
import { Download, OpenNewWindow, Page, Xmark } from "iconoir-react";
import { getFileType, getFileBrand } from "@/features/faculty-management/components/faculty-submission-panel";
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
  latestSubmissionId: string;
}

export interface DocumentPreviewModalProps {
  submission: DocumentPreviewSubmission | null;
  isOpen: boolean;
  onClose: () => void;
  getPreviewUrl?: (submissionId: string) => string;
}

function defaultGetPreviewUrl(submissionId: string): string {
  return `/api/faculty/submissions/view?submissionId=${encodeURIComponent(submissionId)}`;
}

function formatSubmittedDateTime(value?: string): string | null {
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

  const fileUrl = getPreviewUrl(submission.latestSubmissionId);
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

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="document-preview-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-300 dark:border-slate-800 px-6 py-5">
          <div className="flex-1 min-w-0">
            <h3
              id="document-preview-modal-title"
              className="text-xl font-bold text-slate-900 dark:text-slate-100 truncate"
            >
              {title}
            </h3>
            <span className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
              <Page className="h-3.5 w-3.5" />
              Document Preview
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 transition-colors shrink-0 ml-3 cursor-pointer"
            aria-label="Close preview"
          >
            <Xmark className="h-4 w-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="grid gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
          {/* Main Viewer Area */}
          <div className="min-h-[60vh] overflow-hidden rounded-xl border border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 shadow-xs flex items-center justify-center p-4">
            {isImage ? (
              <img
                src={fileUrl}
                alt={title}
                className="max-h-[60vh] max-w-full rounded-lg object-contain"
              />
            ) : isExcel || isWord || (!isPdf && !isImage) ? (
              <OnlineDocumentPreview
                fileName={fileIdentifier}
                fileUrl={fileUrl}
                storagePath={submission.storagePath}
                submissionId={submission.latestSubmissionId}
                fileExtension={fileExtension}
                isExcel={isExcel}
                isWord={isWord}
                brand={getFileBrand(fileExtension, isExcel, isWord)}
                onDownload={() =>
                  window.open(`${fileUrl}&download=true`, "_blank")
                }
              />
            ) : (
              <iframe
                title={`${title} preview`}
                src={fileUrl}
                className="h-full min-h-[60vh] w-full rounded-xl border-0"
              />
            )}
          </div>

          {/* Sidebar Area */}
          <div className="space-y-4">
            {/* MY NOTE Section */}
            <div className="rounded-xl border border-slate-300 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950/60 p-4">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                MY NOTE
              </div>
              <div className="mt-2 text-sm leading-6 italic text-slate-800 dark:text-slate-200">
                {userNote ? (
                  <span>&ldquo;{userNote}&rdquo;</span>
                ) : (
                  <span className="text-slate-500 not-italic">
                    No note was added.
                  </span>
                )}
              </div>
            </div>

            {/* Admin Remarks */}
            {submission.reviewedAt || adminFeedback ? (
              <div className="rounded-xl border border-slate-300 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950/60 p-4">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Admin Remarks
                </p>
                <p className="mt-2 text-sm leading-6 italic text-slate-800 dark:text-slate-200">
                  {adminFeedback || "Validated with no additional remarks."}
                </p>
                {submission.reviewedAt ? (
                  <p className="mt-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Reviewed On
                  </p>
                ) : null}
                {submission.reviewedAt ? (
                  <p className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-300">
                    {submission.reviewedAt}
                  </p>
                ) : null}
              </div>
            ) : null}

            {/* Submitted Date */}
            {submission.submittedAt ? (
              <div className="rounded-xl border border-slate-300 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950/60 p-4 text-sm text-slate-700 dark:text-slate-300">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Submitted On
                </p>
                <p className="mt-2 leading-6">
                  {formatSubmittedDateTime(submission.submittedAt) ??
                    submission.submittedAt}
                </p>
              </div>
            ) : null}

            {/* Full View Button */}
            <button
              type="button"
              className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-medium rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 py-2.5 cursor-pointer"
              onClick={() =>
                window.open(
                  getPreviewUrl(submission.latestSubmissionId),
                  "_blank",
                  "noopener,noreferrer",
                )
              }
            >
              <OpenNewWindow className="h-4 w-4" />
              Full View
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
