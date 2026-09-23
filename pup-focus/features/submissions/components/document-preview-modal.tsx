"use client";

import React, { useState, useEffect } from "react";
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
  getFileBrand,
} from "@/features/faculty-management/components/faculty-submission-panel";
import { OnlineDocumentPreview } from "@/features/submissions/components/online-document-preview";
import {
  resolveDirectFileInfo,
  type ResolvedDirectFileResult,
  getGoogleDocsViewerUrl,
} from "@/lib/online-viewers";
import { SystemLoadingScreen } from "@/components/shared/system-loading-screen";
import { REQUIREMENT_LABEL, type RequirementCode } from "@/config/compliance";

/* ─── Official Brand File Icons ─── */
export function OfficialFileIcon({
  fileCategory,
  className = "h-8 w-8",
}: {
  fileCategory: "excel" | "word" | "powerpoint" | "pdf" | "image" | "zip" | "unknown" | "default";
  className?: string;
}) {
  switch (fileCategory) {
    case "excel":
      return (
        <img
          src="/icons/microsoft-excel.svg"
          alt="Microsoft Excel"
          className={`${className} object-contain select-none`}
        />
      );
    case "word":
      return (
        <img
          src="/icons/microsoft-word.svg"
          alt="Microsoft Word"
          className={`${className} object-contain select-none`}
        />
      );
    case "powerpoint":
      return (
        <img
          src="/icons/microsoft-powerpoint.svg"
          alt="Microsoft PowerPoint"
          className={`${className} object-contain select-none`}
        />
      );
    case "pdf":
      return (
        <img
          src="/icons/adobe-pdf.svg"
          alt="Adobe PDF"
          className={`${className} object-contain select-none`}
        />
      );
    case "image":
      return (
        <svg className={`${className} object-contain select-none`} viewBox="0 0 32 32" fill="none">
          <rect width="28" height="28" x="2" y="2" rx="6" fill="#8B5CF6" />
          <circle cx="11" cy="12" r="3" fill="#FDE047" />
          <path d="M5 25L13 16L18 21L21 18L27 25H5Z" fill="#EDE9FE" />
        </svg>
      );
    case "zip":
      return (
        <svg className={`${className} object-contain select-none`} viewBox="0 0 32 32" fill="none">
          <rect width="28" height="28" x="2" y="2" rx="6" fill="#7C3AED" />
          <rect x="14" y="6" width="4" height="2" rx="0.5" fill="#DDD6FE" />
          <rect x="14" y="9" width="4" height="2" rx="0.5" fill="#DDD6FE" />
          <rect x="14" y="12" width="4" height="2" rx="0.5" fill="#DDD6FE" />
          <rect x="13" y="16" width="6" height="5" rx="1.5" fill="#FACC15" stroke="#CA8A04" strokeWidth="0.6" />
          <path d="M16 21V25" stroke="#CA8A04" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    case "unknown":
      return (
        <div className={`${className} rounded-lg bg-slate-200 dark:bg-slate-700 animate-pulse`} />
      );
    default:
      return (
        <svg className={`${className} object-contain select-none`} viewBox="0 0 32 32" fill="none">
          <rect width="28" height="28" x="2" y="2" rx="6" fill="#64748B" />
          <path d="M9 10H23M9 15H23M9 20H17" stroke="white" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
  }
}

function getDocumentTypeDetails(
  fileName?: string,
  storagePath?: string,
  mimeType?: string | null,
  isResolving: boolean = false
) {
  const candidate = (fileName || storagePath || "").split("?")[0].split("#")[0].toLowerCase();
  const match = candidate.match(/\.([a-z0-9]+)$/i);
  let ext = match ? match[1].toLowerCase() : "";

  if (!ext && storagePath) {
    const storageMatch = storagePath.split("?")[0].split("#")[0].toLowerCase().match(/\.([a-z0-9]+)$/i);
    if (storageMatch) ext = storageMatch[1].toLowerCase();
  }

  // Check MIME type if extension is still missing
  if (!ext && mimeType) {
    const mime = mimeType.toLowerCase();
    if (mime.includes("pdf")) ext = "pdf";
    else if (mime.includes("wordprocessingml") || mime.includes("msword")) ext = "docx";
    else if (mime.includes("spreadsheetml") || mime.includes("ms-excel") || mime.includes("csv")) ext = "xlsx";
    else if (mime.includes("presentationml") || mime.includes("ms-powerpoint")) ext = "pptx";
    else if (mime.startsWith("image/")) ext = mime.replace("image/", "").replace("+xml", "");
    else if (mime.includes("zip") || mime.includes("compressed") || mime.includes("tar")) ext = "zip";
  }

  // If still no extension and resolving is in progress, do NOT prematurely assume PDF!
  if (!ext && isResolving) {
    return {
      ext: "",
      type: "Detecting Document...",
      fileCategory: "unknown" as const,
      icon: (className = "h-8 w-8") => (
        <OfficialFileIcon fileCategory="unknown" className={className} />
      ),
      isUnknown: true,
      isPdf: false,
      isImage: false,
      isExcel: false,
      isWord: false,
      isPpt: false,
      isOffice: false,
      googleApp: null,
    };
  }

  // Fallback for compliance requirement files only after resolution attempts
  if (!ext || ext === "file") {
    ext = "pdf";
  }

  if (ext === "pdf") {
    return {
      ext: "PDF",
      type: "Adobe PDF Document",
      fileCategory: "pdf" as const,
      icon: (className = "h-8 w-8") => (
        <OfficialFileIcon fileCategory="pdf" className={className} />
      ),
      isUnknown: false,
      isPdf: true,
      isImage: false,
      isExcel: false,
      isWord: false,
      isPpt: false,
      isOffice: false,
      googleApp: null,
    };
  }
  if (["xlsx", "xls", "csv"].includes(ext)) {
    return {
      ext: ext.toUpperCase(),
      type: "Microsoft Excel Spreadsheet",
      fileCategory: "excel" as const,
      icon: (className = "h-8 w-8") => (
        <OfficialFileIcon fileCategory="excel" className={className} />
      ),
      isUnknown: false,
      isPdf: false,
      isImage: false,
      isExcel: true,
      isWord: false,
      isPpt: false,
      isOffice: true,
      googleApp: "Google Sheets",
    };
  }
  if (["docx", "doc"].includes(ext)) {
    return {
      ext: "DOCX",
      type: "Microsoft Word Document",
      fileCategory: "word" as const,
      icon: (className = "h-8 w-8") => (
        <OfficialFileIcon fileCategory="word" className={className} />
      ),
      isUnknown: false,
      isPdf: false,
      isImage: false,
      isExcel: false,
      isWord: true,
      isPpt: false,
      isOffice: true,
      googleApp: "Google Docs",
    };
  }
  if (["pptx", "ppt"].includes(ext)) {
    return {
      ext: "PPTX",
      type: "Microsoft PowerPoint Presentation",
      fileCategory: "powerpoint" as const,
      icon: (className = "h-8 w-8") => (
        <OfficialFileIcon fileCategory="powerpoint" className={className} />
      ),
      isUnknown: false,
      isPdf: false,
      isImage: false,
      isExcel: false,
      isWord: false,
      isPpt: true,
      isOffice: true,
      googleApp: "Google Slides",
    };
  }
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) {
    return {
      ext: ext.toUpperCase(),
      type: "Compressed Archive",
      fileCategory: "zip" as const,
      icon: (className = "h-8 w-8") => (
        <OfficialFileIcon fileCategory="zip" className={className} />
      ),
      isUnknown: false,
      isPdf: false,
      isImage: false,
      isExcel: false,
      isWord: false,
      isPpt: false,
      isOffice: false,
      googleApp: null,
    };
  }
  if (["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(ext)) {
    return {
      ext: ext.toUpperCase(),
      type: "Image File",
      fileCategory: "image" as const,
      icon: (className = "h-8 w-8") => (
        <OfficialFileIcon fileCategory="image" className={className} />
      ),
      isUnknown: false,
      isPdf: false,
      isImage: true,
      isExcel: false,
      isWord: false,
      isPpt: false,
      isOffice: false,
      googleApp: null,
    };
  }
  return {
    ext: ext ? ext.toUpperCase() : "DOC",
    type: "Document File",
    fileCategory: "default" as const,
    icon: (className = "h-8 w-8") => (
      <OfficialFileIcon fileCategory="default" className={className} />
    ),
    isUnknown: false,
    isPdf: false,
    isImage: false,
    isExcel: false,
    isWord: false,
    isPpt: false,
    isOffice: false,
    googleApp: null,
  };
}

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

  const documentTitle =
    submission.title ||
    (submission.code
      ? REQUIREMENT_LABEL[submission.code as RequirementCode]
      : null) ||
    "Document";

  const [resolvedInfo, setResolvedInfo] = useState<ResolvedDirectFileResult | null>(null);
  const [isResolving, setIsResolving] = useState(true);
  const [loadingPercent, setLoadingPercent] = useState(20);

  const fileUrl = submission.latestSubmissionId
    ? getPreviewUrl(submission.latestSubmissionId)
    : "";

  useEffect(() => {
    let isMounted = true;
    if (!submission?.latestSubmissionId && !submission?.storagePath) {
      setIsResolving(false);
      return;
    }

    setIsResolving(true);
    setLoadingPercent(20);

    const interval = setInterval(() => {
      if (!isMounted) return;
      setLoadingPercent((prev) => {
        if (prev < 45) return prev + 15;
        if (prev < 75) return prev + 10;
        if (prev < 92) return prev + 5;
        return prev;
      });
    }, 70);

    resolveDirectFileInfo({
      storagePath: submission.storagePath,
      submissionId: submission.latestSubmissionId,
      currentUrl: fileUrl,
    })
      .then((info) => {
        if (isMounted && info) {
          setResolvedInfo(info);
        }
      })
      .finally(() => {
        if (isMounted) {
          clearInterval(interval);
          setLoadingPercent(100);
          setTimeout(() => {
            if (isMounted) {
              setIsResolving(false);
            }
          }, 240);
        }
      });

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [submission?.latestSubmissionId, submission?.storagePath, fileUrl]);

  const effectiveFileName = resolvedInfo?.fileName || submission.fileName;
  const effectiveStoragePath = resolvedInfo?.storagePath || submission.storagePath;
  const effectiveMimeType = resolvedInfo?.mimeType;

  const typeInfo = getDocumentTypeDetails(
    effectiveFileName,
    effectiveStoragePath,
    effectiveMimeType,
    isResolving
  );

  const rawFileName = effectiveFileName;
  const cleanBaseName = rawFileName && !rawFileName.startsWith("faculty-submissions/") && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i.test(rawFileName)
    ? (rawFileName.includes("/") ? rawFileName.split("/").pop() : rawFileName)
    : undefined;

  const fileIdentifier = cleanBaseName || documentTitle || "Document";
  const displayUrl = resolvedInfo?.url || fileUrl;

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
    link.download = effectiveFileName || `${documentTitle}.${typeInfo.ext ? typeInfo.ext.toLowerCase() : "pdf"}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handleOpenFullView() {
    const effectiveUrl =
      resolvedInfo?.url ||
      (typeof window !== "undefined" && fileUrl.startsWith("/")
        ? `${window.location.origin}${fileUrl}`
        : fileUrl);

    // 1. Image -> open direct image in new tab
    if (typeInfo.isImage) {
      window.open(effectiveUrl, "_blank", "noopener,noreferrer");
      return;
    }

    // 2. Word / Excel / PowerPoint (Office documents) -> open in Google Docs / Sheets / Slides in new tab
    if (typeInfo.isOffice || typeInfo.isWord || typeInfo.isExcel || typeInfo.isPpt) {
      const viewerUrl = getGoogleDocsViewerUrl(effectiveUrl, false);
      window.open(viewerUrl, "_blank", "noopener,noreferrer");
      return;
    }

    // 3. PDF or direct document
    window.open(effectiveUrl, "_blank", "noopener,noreferrer");
  }

  if (isResolving) {
    return (
      <SystemLoadingScreen
        text="Loading Document Preview..."
        subtitle={documentTitle}
        progress={loadingPercent}
        fullScreen={true}
      />
    );
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
          iconNode={
            <div className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 shadow-2xs shrink-0 flex items-center justify-center">
              {typeInfo.icon("h-8 w-8 drop-shadow-xs")}
            </div>
          }
          title="Document Preview"
          subtitle="Official Document Verification Details"
          titleId="document-preview-modal-title"
          onClose={onClose}
          closeAriaLabel="Close preview"
        />

        {/* Subheader Metadata Bar (Matches Validation History design) */}
        <div className="flex flex-wrap items-center gap-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 px-6 py-3">
          {(submission.semester || submission.academicYear) && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-2xs">
              {submission.semester ? `${submission.semester} • ` : ""}
              S.Y. {submission.academicYear || "Current Term"}
            </span>
          )}
          <SubmissionStatusBadge status={normalizedStatus} size="md" />
        </div>

        {/* Content Body */}
        <div className="grid gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)] flex-1 overflow-y-auto min-h-0">
          {/* Main Viewer Area */}
          <div className="min-h-[500px] lg:min-h-[580px] overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-950 shadow-inner flex items-center justify-center p-2 sm:p-3 relative">
            {typeInfo.isUnknown ? (
              <SystemLoadingScreen
                fullScreen={false}
                className="h-full min-h-[480px] rounded-xl"
                text="Verifying document format..."
                subtitle={documentTitle}
              />
            ) : typeInfo.isImage ? (
              <div className="relative flex items-center justify-center w-full h-full min-h-[500px] lg:min-h-[580px] p-2 bg-slate-950/40 rounded-xl overflow-hidden group">
                <img
                  src={displayUrl}
                  alt={documentTitle}
                  className="max-h-[70vh] max-w-full rounded-xl object-contain shadow-md"
                />
              </div>
            ) : typeInfo.isOffice || typeInfo.isExcel || typeInfo.isWord || typeInfo.isPpt || (!typeInfo.isPdf && fileIdentifier.includes(".")) ? (
              <OnlineDocumentPreview
                fileName={fileIdentifier}
                fileUrl={fileUrl}
                storagePath={effectiveStoragePath}
                submissionId={submission.latestSubmissionId || ""}
                fileExtension={typeInfo.ext.toLowerCase()}
                isExcel={typeInfo.isExcel}
                isWord={typeInfo.isWord}
                isPpt={typeInfo.isPpt}
                brand={getFileBrand(typeInfo.ext.toLowerCase(), typeInfo.isExcel, typeInfo.isWord)}
                onDownload={handleDownload}
              />
            ) : (
              <iframe
                title={`${documentTitle} preview`}
                src={displayUrl}
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

              {/* Submission Details */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 p-4 shadow-2xs space-y-2.5">
                <div className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <AppIcon icon={Calendar} size="xs" />
                  <span>Submission Details</span>
                </div>

                {/* Document Name */}
                <div className="space-y-1 pt-1">
                  <span className="text-slate-500 dark:text-slate-400 text-xs font-medium">Document Name:</span>
                  <div className="flex items-start gap-2 text-xs font-bold text-slate-900 dark:text-slate-100 leading-snug break-words" title={documentTitle}>
                    <div className="shrink-0 mt-0.5">{typeInfo.icon("h-4 w-4 drop-shadow-2xs")}</div>
                    <span>{documentTitle}</span>
                  </div>
                  {cleanBaseName && cleanBaseName !== documentTitle && (
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium pl-6 truncate" title={cleanBaseName}>
                      {cleanBaseName}
                    </div>
                  )}
                </div>

                {/* Timestamps */}
                {submission.submittedAt ? (
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200/80 dark:border-slate-800/80">
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

                {/* Document Format */}
                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200/80 dark:border-slate-800/80">
                  <span className="text-slate-500 dark:text-slate-400">Document Format:</span>
                  <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
                    <span className="shrink-0">{typeInfo.icon("h-4 w-4 drop-shadow-2xs")}</span>
                    <span>
                      {typeInfo.isUnknown
                        ? "Detecting format..."
                        : `${typeInfo.type}${typeInfo.ext ? ` (${typeInfo.ext})` : ""}`}
                    </span>
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
                onClick={handleOpenFullView}
                title={
                  typeInfo.isImage
                    ? "Open image in a new tab"
                    : typeInfo.isWord
                    ? "Open in Google Docs in a new tab"
                    : typeInfo.isExcel
                    ? "Open in Google Sheets in a new tab"
                    : typeInfo.isPpt
                    ? "Open in Google Slides in a new tab"
                    : "Open document in a new tab"
                }
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
