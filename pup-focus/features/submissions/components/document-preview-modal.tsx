"use client";

import React from "react";
import { ChatBubble, Download, Notes, OpenNewWindow, Page, Xmark } from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";
import { ModalHeader } from "@/components/ui/modal-header";
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
        <ModalHeader
          icon={Page}
          title={title}
          subtitle="Document Preview"
          onClose={onClose}
          closeAriaLabel="Close preview"
        />

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
              <div className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <AppIcon icon={ChatBubble} size="sm" color="active" />
                <span>My Remarks / Note</span>
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
                <p className="text-xs font-bold text-[#0b5336] dark:text-emerald-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <AppIcon icon={Notes} size="sm" color="success" />
                  <span>Admin Remarks</span>
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
              <AppIcon icon={OpenNewWindow} size="md" color="inherit" />
              Full View
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
