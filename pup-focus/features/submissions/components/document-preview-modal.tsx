"use client";

import React, { useState, useEffect } from "react";
import {
  Calendar,
  ChatBubble,
  CheckCircle,
  Download,
  Hourglass,
  Notes,
  OpenNewWindow,
  Page,
  Upload,
} from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";
import { ModalHeader } from "@/components/ui/modal-header";
import { SubmissionStatusBadge } from "@/features/submissions/components/submission-status-badge";
import {
  resolveDirectFileInfo,
  type ResolvedDirectFileResult,
  getGoogleDocsViewerUrl,
  getOfficeOnlineViewerUrl,
} from "@/lib/online-viewers";
import { SystemLoadingScreen } from "@/components/shared/system-loading-screen";
import { REQUIREMENT_LABEL, type RequirementCode } from "@/config/compliance";
import { OnlineDocumentPreview } from "@/features/submissions/components/online-document-preview";
import { getFileBrand } from "@/features/submissions/components/document-upload-zone";

function formatBytes(bytes?: number | null): string | null {
  if (bytes == null || isNaN(bytes) || bytes <= 0) return null;
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

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
  fileSize?: number | null;
  fileUrl?: string | null;
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
  isUploadPreview?: boolean;
}

export interface DocumentPreviewModalProps {
  submission: DocumentPreviewSubmission | null;
  isOpen: boolean;
  onClose: () => void;
  getPreviewUrl?: (submissionId: string) => string;
  onDownload?: (submission: DocumentPreviewSubmission) => void;
  isUploadPreview?: boolean;
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
  isUploadPreview = false,
}: DocumentPreviewModalProps) {
  const [resolvedInfo, setResolvedInfo] = useState<ResolvedDirectFileResult | null>(null);
  const [isResolving, setIsResolving] = useState(true);
  const [loadingPercent, setLoadingPercent] = useState(20);

  const fileUrl =
    submission?.fileUrl ||
    (submission?.latestSubmissionId
      ? getPreviewUrl(submission.latestSubmissionId)
      : "");

  useEffect(() => {
    if (!isOpen || !submission) {
      setIsResolving(false);
      return;
    }

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
  }, [isOpen, submission, fileUrl]);

  if (!isOpen || !submission) {
    return null;
  }

  const documentTitle =
    submission.title ||
    (submission.code
      ? REQUIREMENT_LABEL[submission.code as RequirementCode]
      : null) ||
    "Document";

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

  const isUpload = Boolean(
    isUploadPreview ||
    submission.isUploadPreview ||
    ((fileUrl?.startsWith("blob:") || submission.fileUrl?.startsWith("blob:")) &&
      !submission.latestSubmissionId &&
      !submission.storagePath)
  );

  const isDirectPreviewable = Boolean(typeInfo.isImage);
  const isOfficeDoc = Boolean(
    typeInfo.isWord ||
    typeInfo.isExcel ||
    typeInfo.isPpt ||
    typeInfo.isOffice
  );
  const isPdfDoc = Boolean(typeInfo.isPdf);

  const googleAppName = typeInfo.isWord
    ? "Google Docs"
    : typeInfo.isExcel
    ? "Google Sheets"
    : typeInfo.isPpt
    ? "Google Slides"
    : "Google Drive";

  const googleAppIcon = typeInfo.isWord
    ? "/icons/google-docs.svg"
    : typeInfo.isExcel
    ? "/icons/google-sheets.svg"
    : typeInfo.isPpt
    ? "/icons/google-slides.svg"
    : "/icons/google-drive.svg";

  const officeAppName = typeInfo.isWord
    ? "Word Online"
    : typeInfo.isExcel
    ? "Excel Online"
    : typeInfo.isPpt
    ? "PowerPoint Online"
    : "Office Online";

  const officeAppIcon = typeInfo.isWord
    ? "/icons/microsoft-word.svg"
    : typeInfo.isExcel
    ? "/icons/microsoft-excel.svg"
    : typeInfo.isPpt
    ? "/icons/microsoft-powerpoint.svg"
    : "/icons/microsoft-office.svg";

  const effectiveUrl =
    submission.fileUrl ||
    resolvedInfo?.url ||
    (typeof window !== "undefined" && fileUrl.startsWith("/")
      ? `${window.location.origin}${fileUrl}`
      : fileUrl);

  const isLocalBlob = Boolean(
    effectiveUrl.startsWith("blob:") ||
    effectiveUrl.startsWith("data:") ||
    fileUrl.startsWith("blob:") ||
    fileUrl.startsWith("data:")
  );

  const googleViewerUrl = getGoogleDocsViewerUrl(effectiveUrl, false);
  const officeViewerUrl = getOfficeOnlineViewerUrl(effectiveUrl, false);

  function handleDownload() {
    if (!submission) return;
    if (onDownload) {
      onDownload(submission);
      return;
    }
    const downloadUrl = fileUrl.startsWith("blob:") || fileUrl.startsWith("data:")
      ? fileUrl
      : `${fileUrl}&download=true`;
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = effectiveFileName || `${documentTitle}.${typeInfo.ext ? typeInfo.ext.toLowerCase() : "pdf"}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handleOpenFullView() {
    // 1. Image or PDF blob -> open direct in new tab
    if (typeInfo.isImage || typeInfo.isPdf || isLocalBlob) {
      window.open(displayUrl || effectiveUrl, "_blank", "noopener,noreferrer");
      return;
    }

    // 2. Word / Excel / PowerPoint (Office documents) -> open in Google Docs / Sheets / Slides in new tab
    if (typeInfo.isOffice || typeInfo.isWord || typeInfo.isExcel || typeInfo.isPpt) {
      window.open(googleViewerUrl, "_blank", "noopener,noreferrer");
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
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 px-2 sm:px-4 py-3 sm:py-6 backdrop-blur-sm overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="document-preview-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg sm:max-w-xl lg:max-w-5xl max-h-[96vh] sm:max-h-[92vh] flex flex-col rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-200"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <ModalHeader
          iconNode={
            <div className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 shadow-2xs shrink-0 flex items-center justify-center">
              {typeInfo.icon("h-8 w-8 drop-shadow-xs")}
            </div>
          }
          title={isUpload ? "Upload File Preview" : "Document Preview"}
          subtitle={
            isUpload
              ? "Inspect selected file before uploading"
              : "Official Document Verification Details"
          }
          titleId="document-preview-modal-title"
          onClose={onClose}
          closeAriaLabel="Close preview"
        />

        {/* Subheader Metadata Bar (Matches Validation History design) */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 px-4 sm:px-6 py-2.5 sm:py-3">
          {isUpload ? (
            <>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shadow-2xs">
                <AppIcon icon={Upload} size="xs" color="success" />
                Ready to Submit
              </span>
              {submission.fileSize ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-medium bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-2xs">
                  {formatBytes(submission.fileSize)}
                </span>
              ) : null}
            </>
          ) : (
            <>
              {(submission.semester || submission.academicYear) && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-2xs">
                  {submission.semester ? `${submission.semester} • ` : ""}
                  S.Y. {submission.academicYear || "Current Term"}
                </span>
              )}
              <SubmissionStatusBadge
                status={normalizedStatus}
                size="sm"
              />
            </>
          )}
        </div>

        {/* Content Body: stacks on mobile, side-by-side on lg */}
        <div className="flex flex-col lg:grid lg:gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)] px-3 sm:px-6 py-3 sm:py-6 flex-1 overflow-y-auto min-h-0 gap-4">
          {/* Main Viewer Area */}
          {isOfficeDoc ? (
            <div className="w-full flex flex-col justify-start">
              <OnlineDocumentPreview
                key={fileUrl}
                fileName={effectiveFileName || documentTitle}
                fileUrl={fileUrl}
                storagePath={submission.storagePath}
                submissionId={submission.latestSubmissionId}
                fileExtension={typeInfo.ext?.toLowerCase() || ""}
                isExcel={typeInfo.isExcel}
                isWord={typeInfo.isWord}
                isPpt={typeInfo.isPpt}
                brand={getFileBrand(
                  typeInfo.ext?.toLowerCase() || "",
                  typeInfo.isExcel,
                  typeInfo.isWord
                )}
                onDownload={handleDownload}
              />
            </div>
          ) : (
            <div className="min-h-[240px] sm:min-h-[360px] lg:min-h-[500px] overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-950 shadow-inner flex items-center justify-center p-2 sm:p-3 relative">
              {typeInfo.isImage ? (
                <div className="relative flex items-center justify-center w-full h-full min-h-[240px] sm:min-h-[360px] lg:min-h-[500px] p-2 bg-slate-950/40 rounded-xl overflow-hidden group">
                  <img
                    src={displayUrl}
                    alt={documentTitle}
                    className="max-h-[45vh] sm:max-h-[60vh] lg:max-h-[70vh] max-w-full rounded-xl object-contain shadow-md"
                  />
                </div>
              ) : (
                <iframe
                  title={`${documentTitle} preview`}
                  src={displayUrl}
                  className="h-full min-h-[240px] sm:min-h-[360px] lg:min-h-[500px] w-full rounded-xl border-0 bg-slate-900 shadow-xs"
                />
              )}
            </div>
          )}

          {/* Sidebar Area */}
          <div className="flex flex-col justify-between space-y-4">
            <div className="space-y-3.5">
              {/* Reviewer / Admin Remarks - Hidden in upload draft preview */}
              {!isUpload &&
                (adminFeedback ||
                  submission.reviewedAt ||
                  normalizedStatus === "Validated" ||
                  normalizedStatus === "Rejected") && (
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 p-4 shadow-2xs">
                    <div
                      className={`text-[11px] font-bold ${
                        normalizedStatus === "Rejected"
                          ? "text-rose-700 dark:text-rose-400"
                          : "text-[#0b5336] dark:text-emerald-400"
                      } uppercase tracking-wider mb-2 flex items-center gap-1.5`}
                    >
                      <AppIcon
                        icon={Notes}
                        size="xs"
                        color={normalizedStatus === "Rejected" ? "danger" : "success"}
                      />
                      <span>Admin Remarks</span>
                    </div>
                    <div
                      className={`rounded-xl border ${
                        normalizedStatus === "Rejected"
                          ? "border-rose-200 dark:border-rose-900/40 bg-rose-500/5 dark:bg-rose-500/10"
                          : "border-[#0b5336]/20 dark:border-[#0b5336]/30 bg-[#0b5336]/5 dark:bg-[#0b5336]/15"
                      } p-3 text-xs sm:text-sm italic text-slate-800 dark:text-slate-200 leading-relaxed`}
                    >
                      {adminFeedback ? (
                        <span>&ldquo;{adminFeedback}&rdquo;</span>
                      ) : normalizedStatus === "Validated" ? (
                        <span className="not-italic text-slate-500 dark:text-slate-400">
                          Validated with no additional remarks.
                        </span>
                      ) : (
                        <span className="not-italic text-slate-500 dark:text-slate-400">
                          No remarks provided.
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
                          {formatSubmittedDateTime(submission.reviewedAt) ??
                            submission.reviewedAt}
                        </span>
                      </div>
                    ) : null}
                  </div>
                )}

              {/* My Remarks / Note Section - Hidden in upload draft preview */}
              {!isUpload && (
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
              )}

              {/* Details Section */}
              {isUpload ? (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 p-4 shadow-2xs space-y-2.5">
                  <div className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <AppIcon icon={Page} size="xs" />
                    <span>File Details</span>
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

                  {submission.fileSize ? (
                    <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200/80 dark:border-slate-800/80">
                      <span className="text-slate-500 dark:text-slate-400">File Size:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {formatBytes(submission.fileSize)}
                      </span>
                    </div>
                  ) : null}

                  {/* Document Format */}
                  <div className="flex items-center justify-between text-xs pt-1">
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
              ) : (
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
                  {(submission.reviewedAt || normalizedStatus === "Validated") ? (
                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <AppIcon icon={CheckCircle} size="xs" color="success" />
                        <span>Validated:</span>
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {formatSubmittedDateTime(submission.reviewedAt) ?? submission.reviewedAt ?? "Validated"}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <AppIcon icon={Hourglass} size="xs" color="active" />
                        <span>Status:</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-400">
                        <span>{normalizedStatus}</span>
                      </span>
                    </div>
                  )}

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
              )}
            </div>

            {/* Action Buttons Area */}
            <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2 sm:gap-2.5">
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

              {/* Full View Button */}
              <button
                type="button"
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs py-2.5 transition cursor-pointer shadow-2xs active:scale-95"
                onClick={handleOpenFullView}
                title={
                  typeInfo.isImage
                    ? "Open image in a new tab"
                    : "Open document in a new tab"
                }
              >
                <AppIcon icon={OpenNewWindow} size="sm" color="inherit" />
                <span>Open Full View</span>
              </button>

              {/* Close Button */}
              <button
                type="button"
                className="w-full col-span-1 sm:col-span-2 lg:col-span-1 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 font-bold text-xs py-2.5 shadow-2xs transition cursor-pointer active:scale-95"
                onClick={onClose}
              >
                <span>Close Preview</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
