"use client";

import React, { useState, useEffect } from "react";
import {
  Calendar,
  ChatBubble,
  Check,
  CheckCircle,
  Download,
  Hourglass,
  Notes,
  OpenNewWindow,
  Page,
  SystemRestart,
  Upload,
  WarningCircle,
  Xmark,
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
  facultyNote?: string | null;
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
  facultyName?: string | null;
  isAdminView?: boolean;
}

export interface DocumentPreviewModalProps {
  submission: DocumentPreviewSubmission | null;
  isOpen: boolean;
  onClose: () => void;
  getPreviewUrl?: (submissionId: string) => string;
  onDownload?: (submission: DocumentPreviewSubmission) => void;
  isUploadPreview?: boolean;
  isAdminView?: boolean;
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
  isAdminView = false,
}: DocumentPreviewModalProps) {
  const [resolvedInfo, setResolvedInfo] = useState<ResolvedDirectFileResult | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isLoadingBlob, setIsLoadingBlob] = useState(false);

  const isReviewerView = Boolean(isAdminView || submission?.isAdminView);

  const fileUrl =
    submission?.fileUrl ||
    (submission?.latestSubmissionId
      ? getPreviewUrl(submission.latestSubmissionId)
      : "");

  const effectiveFileName = resolvedInfo?.fileName || submission?.fileName;
  const effectiveStoragePath = resolvedInfo?.storagePath || submission?.storagePath;
  const effectiveMimeType = resolvedInfo?.mimeType;

  const typeInfo = getDocumentTypeDetails(
    effectiveFileName,
    effectiveStoragePath,
    effectiveMimeType,
    false
  );

  const proxyUrl = effectiveStoragePath
    ? `/api/storage/download?path=${encodeURIComponent(effectiveStoragePath)}`
    : null;

  const displayUrl =
    resolvedInfo?.url ||
    (typeInfo.isPdf || typeInfo.isImage
      ? proxyUrl || fileUrl
      : fileUrl);

  useEffect(() => {
    setResolvedInfo(null);
    if (!isOpen || !submission) {
      return;
    }

    if (!submission?.latestSubmissionId && !submission?.storagePath) {
      return;
    }

    let isMounted = true;

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
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [isOpen, submission, fileUrl]);

  useEffect(() => {
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
      setBlobUrl(null);
    }

    if (!isOpen || !submission || !typeInfo.isPdf) {
      return;
    }

    let isMounted = true;
    setIsLoadingBlob(true);

    const sourceUrl =
      resolvedInfo?.url ||
      (fileUrl && !fileUrl.includes("/api/storage/download") ? fileUrl : null) ||
      proxyUrl ||
      fileUrl;

    if (!sourceUrl) {
      setIsLoadingBlob(false);
      return;
    }

    fetch(sourceUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        if (isMounted) {
          const url = URL.createObjectURL(
            new Blob([blob], { type: "application/pdf" })
          );
          setBlobUrl(url);
          setIsLoadingBlob(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.warn("Failed to load PDF as blob, falling back to direct URL:", err);
          setIsLoadingBlob(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, submission, proxyUrl, resolvedInfo?.url, fileUrl, typeInfo.isPdf]);

  useEffect(() => {
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blobUrl]);

  if (!isOpen || !submission) {
    return null;
  }

  const documentTitle =
    submission.title ||
    (submission.code
      ? REQUIREMENT_LABEL[submission.code as RequirementCode]
      : null) ||
    "Document";

  const rawFileName = effectiveFileName;
  const cleanBaseName = rawFileName && !rawFileName.startsWith("faculty-submissions/") && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i.test(rawFileName)
    ? (rawFileName.includes("/") ? rawFileName.split("/").pop() : rawFileName)
    : undefined;

  const adminFeedback =
    submission.adminRemarks ||
    submission.admin_remarks ||
    submission.feedback ||
    null;

  const userNote =
    submission.note ||
    submission.notes ||
    submission.remarks ||
    submission.facultyNote ||
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

  const showAdminRemarks =
    !isUpload &&
    Boolean(
      adminFeedback ||
        submission.reviewedAt ||
        normalizedStatus === "Validated" ||
        normalizedStatus === "Rejected"
    );

  const isOfficeDoc = Boolean(
    typeInfo.isWord ||
    typeInfo.isExcel ||
    typeInfo.isPpt ||
    typeInfo.isOffice
  );

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

  function handleDownload() {
    if (!submission) return;
    if (onDownload) {
      onDownload(submission);
      return;
    }
    const downloadUrl =
      blobUrl ||
      resolvedInfo?.url ||
      (fileUrl.startsWith("blob:") || fileUrl.startsWith("data:")
        ? fileUrl
        : `${fileUrl}&download=true`);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = effectiveFileName || `${documentTitle}.${typeInfo.ext ? typeInfo.ext.toLowerCase() : "pdf"}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handleOpenFullView() {
    const targetUrl = blobUrl || resolvedInfo?.url || displayUrl || effectiveUrl;
    if (typeInfo.isImage || typeInfo.isPdf || isLocalBlob) {
      window.open(targetUrl, "_blank", "noopener,noreferrer");
      return;
    }

    if (typeInfo.isOffice || typeInfo.isWord || typeInfo.isExcel || typeInfo.isPpt) {
      window.open(googleViewerUrl, "_blank", "noopener,noreferrer");
      return;
    }

    window.open(targetUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/75 px-2 sm:px-4 py-2 sm:py-4 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="document-preview-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[96vw] xl:max-w-7xl h-[88vh] max-h-[calc(100dvh-2rem)] flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden my-auto"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <ModalHeader
          iconNode={
            <div className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 shadow-2xs shrink-0 flex items-center justify-center">
              {typeInfo.icon("h-7 w-7 drop-shadow-xs")}
            </div>
          }
          title={isUpload ? "Upload File Preview" : "Document Preview"}
          subtitle={
            isUpload
              ? "Inspect selected file before uploading"
              : isReviewerView
              ? "Official Document Review & Verification Details"
              : "Official Document Verification Details"
          }
          titleId="document-preview-modal-title"
        />

        {/* Subheader Metadata Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 px-4 sm:px-5 py-2 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            {isUpload ? (
              <>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-2xs">
                  <AppIcon icon={Upload} size="xs" color="inherit" />
                  Ready to Submit
                </span>
                {submission.fileSize ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-2xs">
                    {formatBytes(submission.fileSize)}
                  </span>
                ) : null}
              </>
            ) : (
              <>
                {(submission.semester || submission.academicYear) && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-2xs">
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
        </div>

        {/* Content Body: Wide Viewer + Compact Details Sidebar */}
        <div className="p-2.5 sm:p-3.5 flex-1 overflow-hidden min-h-0 flex flex-col">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden flex flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_270px] xl:grid-cols-[minmax(0,1fr)_290px] divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800 flex-1 min-h-0">
            {/* Main Viewer Area (Left Side - Wide) */}
            {isOfficeDoc ? (
              <div className="w-full h-full flex flex-col min-h-0 overflow-hidden bg-white dark:bg-slate-900">
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
                  borderless={true}
                />
              </div>
            ) : (
              <div className="flex-1 min-h-[320px] lg:min-h-0 overflow-hidden bg-slate-100 dark:bg-slate-950 flex items-center justify-center relative h-full w-full">
                {typeInfo.isPdf && (isLoadingBlob || (!blobUrl && !resolvedInfo)) ? (
                  <div className="flex flex-col items-center justify-center h-full w-full bg-slate-100 dark:bg-slate-950 text-slate-500 dark:text-slate-400 gap-2">
                    <AppIcon icon={SystemRestart} size="md" color="inherit" className="animate-spin text-slate-400" />
                    <span className="text-xs font-medium">Loading document preview...</span>
                  </div>
                ) : typeInfo.isImage ? (
                  <div className="relative flex items-center justify-center w-full h-full p-2 bg-slate-100/80 dark:bg-slate-950/40 overflow-hidden">
                    <img
                      src={blobUrl || displayUrl}
                      alt={documentTitle}
                      className="max-h-full max-w-full rounded-lg object-contain shadow-md"
                    />
                  </div>
                ) : blobUrl || displayUrl ? (
                  <iframe
                    key={blobUrl || displayUrl}
                    title={`${documentTitle} preview`}
                    src={blobUrl || displayUrl}
                    className="h-full w-full border-0 bg-slate-100 dark:bg-slate-950"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full w-full bg-slate-100 dark:bg-slate-950 text-slate-500 dark:text-slate-400 gap-2">
                    <AppIcon icon={SystemRestart} size="md" color="inherit" className="animate-spin text-slate-400" />
                    <span className="text-xs font-medium">Loading document preview...</span>
                  </div>
                )}
              </div>
            )}

            {/* Compact Details & Actions Sidebar (Right Side) */}
            <div className="flex flex-col bg-white dark:bg-slate-900 h-full min-h-0 text-xs overflow-hidden">
              {/* Scrollable Details */}
              <div className="flex-1 overflow-y-auto min-h-0 divide-y divide-slate-200/80 dark:divide-slate-800/80">
                {/* 1. Remarks & Notes */}
                {!isUpload && (
                  <div className="p-3 space-y-2">
                    <div className="flex items-center gap-1.5">
                      <span className="flex items-center justify-center h-5 w-5 rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 shrink-0">
                        <AppIcon icon={Notes} size="xs" />
                      </span>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Remarks & Notes
                      </span>
                    </div>

                    {showAdminRemarks && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-slate-600 dark:text-slate-400">
                            {isReviewerView ? "Admin Remarks" : "Admin Remarks"}
                          </span>
                          {submission.reviewedAt && (
                            <span className="text-[10px] text-slate-400 dark:text-slate-500">
                              {formatSubmittedDateTime(submission.reviewedAt) ??
                                submission.reviewedAt}
                            </span>
                          )}
                        </div>

                        <div className="rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 px-2.5 py-1.5 text-[11px] leading-snug text-slate-700 dark:text-slate-300">
                          {adminFeedback ? (
                            <p className="break-words whitespace-pre-wrap">
                              {adminFeedback}
                            </p>
                          ) : normalizedStatus === "Validated" ? (
                            <span className="text-slate-500 dark:text-slate-400 italic">
                              Validated with no additional remarks.
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500 italic">
                              No remarks provided.
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block">
                        {isReviewerView ? "Faculty Note" : "My Remarks / Note"}
                      </span>
                      {userNote ? (
                        <div className="rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 px-2.5 py-1.5 text-[11px] leading-snug text-slate-700 dark:text-slate-300">
                          <p className="break-words whitespace-pre-wrap">
                            {userNote}
                          </p>
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 italic">
                          No personal note added.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* 2. Compact Submission / File Details */}
                <div className="p-3 space-y-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="flex items-center justify-center h-5 w-5 rounded-md bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 shrink-0">
                      <AppIcon icon={isUpload ? Page : Calendar} size="xs" />
                    </span>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      {isUpload ? "File Details" : "Submission Details"}
                    </span>
                  </div>

                  <div className="space-y-2 text-[11px]">
                    <div className="space-y-1">
                      <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 block">
                        Document Name
                      </span>
                      <div
                        className="flex items-start gap-2 font-semibold text-slate-900 dark:text-slate-100 break-words"
                        title={documentTitle}
                      >
                        <div className="shrink-0 mt-0.5">
                          {typeInfo.icon("h-4 w-4")}
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="leading-snug line-clamp-2 block text-xs">{documentTitle}</span>
                        </div>
                      </div>
                    </div>

                    {!isUpload && submission.submittedAt && (
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/70">
                        <span className="text-slate-500 dark:text-slate-400 shrink-0">Submitted</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 text-right">
                          {formatSubmittedDateTime(submission.submittedAt) ?? submission.submittedAt}
                        </span>
                      </div>
                    )}

                    {!isUpload && submission.facultyName && (
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/70">
                        <span className="text-slate-500 dark:text-slate-400 shrink-0">Faculty</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[170px] text-right" title={submission.facultyName}>
                          {submission.facultyName}
                        </span>
                      </div>
                    )}

                    {!isUpload && (
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/70">
                        <span className="text-slate-500 dark:text-slate-400 shrink-0">Status</span>
                        <SubmissionStatusBadge
                          status={normalizedStatus}
                          size="sm"
                          showBadgeIcon={false}
                          className="shrink-0"
                        />
                      </div>
                    )}

                    {submission.fileSize ? (
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/70">
                        <span className="text-slate-500 dark:text-slate-400 shrink-0">File Size</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 text-right">
                          {formatBytes(submission.fileSize)}
                        </span>
                      </div>
                    ) : null}

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/70">
                      <span className="text-slate-500 dark:text-slate-400 shrink-0">Format</span>
                      <span className="inline-flex items-center justify-end gap-1.5 font-semibold text-slate-800 dark:text-slate-200 text-right">
                        {typeInfo.icon("h-3.5 w-3.5 shrink-0")}
                        <span className="truncate max-w-[150px]">
                          {typeInfo.ext ? `${typeInfo.ext.toUpperCase()} Document` : typeInfo.type}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Compact Action Footer (Always pinned at bottom) */}
              <div className="p-3 bg-slate-50/50 dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800/80 space-y-1.5 shrink-0">
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#08412a] bg-[#0b5336] hover:bg-[#08412a] text-white font-bold text-[11px] py-2 px-2 shadow-2xs transition-all cursor-pointer active:scale-95"
                    onClick={handleDownload}
                    title="Download file directly"
                  >
                    <AppIcon icon={Download} size="xs" color="white" />
                    <span>Download</span>
                  </button>

                  <button
                    type="button"
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-amber-600/50 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] py-2 px-2 transition cursor-pointer shadow-2xs active:scale-95"
                    onClick={handleOpenFullView}
                    title="Open document in a new tab"
                  >
                    <AppIcon icon={OpenNewWindow} size="xs" color="inherit" />
                    <span>Full View</span>
                  </button>
                </div>

                <button
                  type="button"
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#5e0000] bg-[#780000] hover:bg-[#5e0000] text-white font-bold text-[11px] py-2 shadow-2xs transition cursor-pointer active:scale-95"
                  onClick={onClose}
                >
                  <span>Close Preview</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
