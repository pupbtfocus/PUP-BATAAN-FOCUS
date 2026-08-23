"use client";

import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import {
  UploadCloud,
  FileText,
  FileSpreadsheet,
  FileImage,
  FileCode,
  Archive,
  File,
  Trash2,
  X,
  Eye,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Info,
  Loader2,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { SubmissionStatusBadge } from "./submission-status-badge";

export interface DocumentUploadZoneProps {
  selectedFile: File | null;
  onFileSelect: (file: File | null) => void;
  isUploading?: boolean;
  uploadProgress?: number;
  disabled?: boolean;
  maxSizeMb?: number;
  allowedFormats?: string[];
  currentStatus?: string | null;
  reviewerFeedback?: string | null;
  className?: string;
  id?: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/* ─── Authentic Brand SVG Icons ─── */
function PdfBrandIcon({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 3C4.34315 3 3 4.34315 3 6V26C3 27.6569 4.34315 29 6 29H26C27.6569 29 29 27.6569 29 26V11L21 3H6Z" fill="#E5252A"/>
      <path d="M21 3V8.5C21 9.88071 22.1193 11 23.5 11H29L21 3Z" fill="#B31B1B"/>
      <path d="M23.6 22.6C22.8 21.8 20.8 21.5 18.7 21.7C17.8 20.4 16.9 18.8 16.2 17.2C16.8 15.2 17.2 13.4 16.7 12.5C16.3 11.7 15.3 11.5 14.7 12C14 12.6 13.9 14.1 14.4 16.2C13.8 18.2 12.8 20.3 11.5 21.9C9.5 22.6 8 23.7 8.2 24.8C8.3 25.5 8.9 26 9.8 26C11.6 26 13.6 24 15.2 22.4C16.8 22.7 18.5 23.1 20 23.6C21 24.8 22.2 25.4 23.1 25.2C23.9 25 24.3 24.1 24.2 23.4C24.1 23 23.9 22.8 23.6 22.6ZM15.5 13.2C15.6 13.5 15.5 14.4 15 15.7C14.8 14.6 14.9 13.7 15.2 13.3C15.4 13.1 15.5 13.1 15.5 13.2ZM9.4 25C9.1 24.9 9 24.5 9.2 24.1C9.6 23.4 10.7 22.5 12.2 22C11.1 23.4 10.1 24.6 9.4 25ZM20.7 22.9C19.7 22.5 18.6 22.2 17.5 22C18.1 21.1 18.7 20.2 19.3 19.3C20.6 20.3 21.8 21.4 22.6 22.3C21.9 22.7 21.2 22.9 20.7 22.9Z" fill="white"/>
    </svg>
  );
}

function WordBrandIcon({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 3C4.34315 3 3 4.34315 3 6V26C3 27.6569 4.34315 29 6 29H26C27.6569 29 29 27.6569 29 26V11L21 3H6Z" fill="#185ABD"/>
      <path d="M21 3V8.5C21 9.88071 22.1193 11 23.5 11H29L21 3Z" fill="#104494"/>
      <rect x="7" y="24" width="18" height="1.8" rx="0.9" fill="#93C5FD" fillOpacity="0.6"/>
      <rect x="14" y="14" width="11" height="1.8" rx="0.9" fill="#93C5FD" fillOpacity="0.6"/>
      <rect x="14" y="18" width="11" height="1.8" rx="0.9" fill="#93C5FD" fillOpacity="0.6"/>
      <rect x="5" y="11" width="13" height="13" rx="2.5" fill="#104494" stroke="#60A5FA" strokeWidth="0.8"/>
      <path d="M7.5 14H9.2L10.5 19.5L11.8 14H13.2L14.5 19.5L15.8 14H17.5L15.5 21.5H13.8L12.5 16.5L11.2 21.5H9.5L7.5 14Z" fill="white"/>
    </svg>
  );
}

function ExcelBrandIcon({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 3C4.34315 3 3 4.34315 3 6V26C3 27.6569 4.34315 29 6 29H26C27.6569 29 29 27.6569 29 26V11L21 3H6Z" fill="#107C41"/>
      <path d="M21 3V8.5C21 9.88071 22.1193 11 23.5 11H29L21 3Z" fill="#0A5C30"/>
      <rect x="7" y="24" width="18" height="1.8" rx="0.9" fill="#86EFAC" fillOpacity="0.6"/>
      <rect x="14" y="14" width="11" height="1.8" rx="0.9" fill="#86EFAC" fillOpacity="0.6"/>
      <rect x="14" y="18" width="11" height="1.8" rx="0.9" fill="#86EFAC" fillOpacity="0.6"/>
      <rect x="5" y="11" width="13" height="13" rx="2.5" fill="#0A5C30" stroke="#4ADE80" strokeWidth="0.8"/>
      <path d="M8 14L10.8 17.5L8 21H9.8L11.7 18.5L13.6 21H15.4L12.6 17.5L15.4 14H13.6L11.7 16.5L9.8 14H8Z" fill="white"/>
    </svg>
  );
}

function PowerPointBrandIcon({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 3C4.34315 3 3 4.34315 3 6V26C3 27.6569 4.34315 29 6 29H26C27.6569 29 29 27.6569 29 26V11L21 3H6Z" fill="#C43E1C"/>
      <path d="M21 3V8.5C21 9.88071 22.1193 11 23.5 11H29L21 3Z" fill="#932D15"/>
      <rect x="7" y="24" width="18" height="1.8" rx="0.9" fill="#FDBA74" fillOpacity="0.6"/>
      <rect x="14" y="14" width="11" height="1.8" rx="0.9" fill="#FDBA74" fillOpacity="0.6"/>
      <rect x="14" y="18" width="11" height="1.8" rx="0.9" fill="#FDBA74" fillOpacity="0.6"/>
      <rect x="5" y="11" width="13" height="13" rx="2.5" fill="#932D15" stroke="#FB923C" strokeWidth="0.8"/>
      <path d="M9 14H12.8C14.2 14 15.2 14.8 15.2 16.2C15.2 17.6 14.2 18.4 12.8 18.4H10.7V21H9V14ZM10.7 15.6V16.8H12.6C13.2 16.8 13.5 16.5 13.5 16.2C13.5 15.9 13.2 15.6 12.6 15.6H10.7Z" fill="white"/>
    </svg>
  );
}

function ZipBrandIcon({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 3C4.34315 3 3 4.34315 3 6V26C3 27.6569 4.34315 29 6 29H26C27.6569 29 29 27.6569 29 26V11L21 3H6Z" fill="#7C3AED"/>
      <path d="M21 3V8.5C21 9.88071 22.1193 11 23.5 11H29L21 3Z" fill="#5B21B6"/>
      <rect x="14" y="6" width="4" height="2" rx="0.5" fill="#DDD6FE"/>
      <rect x="14" y="9" width="4" height="2" rx="0.5" fill="#DDD6FE"/>
      <rect x="14" y="12" width="4" height="2" rx="0.5" fill="#DDD6FE"/>
      <rect x="14" y="15" width="4" height="2" rx="0.5" fill="#DDD6FE"/>
      <rect x="13" y="18" width="6" height="5" rx="1.5" fill="#FACC15" stroke="#CA8A04" strokeWidth="0.6"/>
      <path d="M16 22.5V25.5" stroke="#CA8A04" strokeWidth="1.2" strokeLinecap="round"/>
      <circle cx="16" cy="20.5" r="1" fill="#78350F"/>
    </svg>
  );
}

function getFileTypeDetails(fileName: string) {
  const ext = fileName.split(".").pop()?.toUpperCase() || "FILE";
  const extLower = ext.toLowerCase();

  if (extLower === "pdf") {
    return {
      icon: <PdfBrandIcon className="h-10 w-10 drop-shadow-xs" />,
      tag: "PDF",
      type: "Adobe PDF Document",
    };
  }
  if (extLower === "xlsx" || extLower === "xls" || extLower === "csv") {
    return {
      icon: <ExcelBrandIcon className="h-10 w-10 drop-shadow-xs" />,
      tag: ext === "CSV" ? "CSV" : "XLSX",
      type: "Microsoft Excel Spreadsheet",
    };
  }
  if (extLower === "docx" || extLower === "doc") {
    return {
      icon: <WordBrandIcon className="h-10 w-10 drop-shadow-xs" />,
      tag: "DOCX",
      type: "Microsoft Word Document",
    };
  }
  if (extLower === "pptx" || extLower === "ppt") {
    return {
      icon: <PowerPointBrandIcon className="h-10 w-10 drop-shadow-xs" />,
      tag: "PPTX",
      type: "Microsoft PowerPoint Presentation",
    };
  }
  if (
    extLower === "zip" ||
    extLower === "rar" ||
    extLower === "7z" ||
    extLower === "tar" ||
    extLower === "gz"
  ) {
    return {
      icon: <ZipBrandIcon className="h-10 w-10 drop-shadow-xs" />,
      tag: "ZIP",
      type: "Compressed Archive",
    };
  }
  if (
    extLower === "txt" ||
    extLower === "json" ||
    extLower === "js" ||
    extLower === "ts" ||
    extLower === "html" ||
    extLower === "css"
  ) {
    return {
      icon: (
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-white shadow-xs">
          <FileCode className="h-6 w-6 stroke-[2]" />
        </div>
      ),
      tag: ext.slice(0, 4),
      type: "Text / Code File",
    };
  }
  if (
    extLower === "png" ||
    extLower === "jpg" ||
    extLower === "jpeg" ||
    extLower === "webp" ||
    extLower === "gif" ||
    extLower === "svg"
  ) {
    return {
      icon: (
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-xs">
          <FileImage className="h-6 w-6 stroke-[2]" />
        </div>
      ),
      tag: "IMG",
      type: "Image File",
    };
  }
  return {
    icon: (
      <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center text-white shadow-xs">
        <File className="h-6 w-6 stroke-[2]" />
      </div>
    ),
    tag: ext.slice(0, 4),
    type: "Document",
  };
}

export function DocumentUploadZone({
  selectedFile,
  onFileSelect,
  isUploading = false,
  uploadProgress = 100,
  disabled = false,
  maxSizeMb = 10,
  allowedFormats = ["PDF", "DOCX", "XLSX", "JPG", "PNG"],
  currentStatus,
  reviewerFeedback,
  className,
  id = "document-upload-input",
}: DocumentUploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [fileObjectUrl, setFileObjectUrl] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const maxSizeBytes = maxSizeMb * 1024 * 1024;
  const acceptedFormatsText = allowedFormats.map((f) => f.replace(/^\./, "").toUpperCase()).join(", ");

  const fileType = selectedFile ? getFileTypeDetails(selectedFile.name) : null;
  const isImage =
    selectedFile &&
    (selectedFile.type.startsWith("image/") ||
      /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(selectedFile.name));

  useEffect(() => {
    if (selectedFile) {
      const url = URL.createObjectURL(selectedFile);
      setFileObjectUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    }
    setFileObjectUrl(null);
    setIsPreviewOpen(false);
  }, [selectedFile]);

  const validateAndSelectFile = useCallback(
    (file: File) => {
      setValidationError(null);

      // Validate file size
      if (file.size > maxSizeBytes) {
        setValidationError(
          `File size (${formatBytes(file.size)}) exceeds the maximum limit of ${maxSizeMb} MB. Please select a smaller file.`,
        );
        onFileSelect(null);
        return false;
      }

      // Check extension if allowed formats specified
      const extension = file.name.split(".").pop()?.toUpperCase();
      if (
        allowedFormats.length > 0 &&
        extension &&
        !allowedFormats.includes(extension) &&
        !allowedFormats.includes(`.${extension}`)
      ) {
        const extAllowed = allowedFormats.map((f) => f.replace(/^\./, "")).join(", ");
        setValidationError(
          `Unsupported file format (.${extension.toLowerCase()}). Allowed: ${extAllowed}`,
        );
        onFileSelect(null);
        return false;
      }

      onFileSelect(file);
      return true;
    },
    [maxSizeBytes, maxSizeMb, allowedFormats, onFileSelect],
  );

  const handleDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled || isUploading) return;
      setIsDragOver(true);
    },
    [disabled, isUploading],
  );

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      if (disabled || isUploading) return;

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        validateAndSelectFile(file);
      }
    },
    [disabled, isUploading, validateAndSelectFile],
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        const file = e.target.files[0];
        validateAndSelectFile(file);
      }
    },
    [validateAndSelectFile],
  );

  const triggerFileInput = useCallback(() => {
    if (disabled || isUploading) return;
    fileInputRef.current?.click();
  }, [disabled, isUploading]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        triggerFileInput();
      }
    },
    [triggerFileInput],
  );

  const removeFile = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onFileSelect(null);
      setValidationError(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [onFileSelect],
  );

  const acceptString = allowedFormats
    .map((fmt) => (fmt.startsWith(".") ? fmt.toLowerCase() : `.${fmt.toLowerCase()}`))
    .join(",");

  return (
    <div className={cn("space-y-3", className)}>
      {/* Current status header if provided */}
      {currentStatus && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-slate-600 dark:text-slate-400 font-medium">
            Current Document Status:
          </span>
          <SubmissionStatusBadge status={currentStatus} size="sm" />
        </div>
      )}

      {/* Reviewer feedback callout if revisions required */}
      {reviewerFeedback && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200 shadow-2xs"
        >
          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold block uppercase tracking-wider text-[10px] text-amber-800 dark:text-amber-300">
              Reviewer Feedback:
            </span>
            <p className="mt-0.5 italic text-slate-800 dark:text-slate-200 leading-relaxed">
              &ldquo;{reviewerFeedback}&rdquo;
            </p>
          </div>
        </div>
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        id={id}
        type="file"
        accept={acceptString}
        onChange={handleFileInputChange}
        disabled={disabled || isUploading}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />

      {/* File Attachment Card or Drop Zone Box */}
      {selectedFile && fileType ? (
        <div className="bg-slate-50 dark:bg-slate-800/80 border border-emerald-500/40 dark:border-emerald-500/30 rounded-2xl p-4 shadow-xs flex items-center justify-between transition-all">
          <div className="flex items-center gap-3.5 min-w-0 text-left">
            {isImage && fileObjectUrl ? (
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-amber-500/40 shadow-xs bg-slate-900/10">
                <img
                  src={fileObjectUrl}
                  alt="File Preview"
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <div className="relative shrink-0 flex items-center justify-center">
                {fileType.icon}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p
                className="text-slate-900 dark:text-slate-100 font-bold text-sm truncate max-w-[240px] sm:max-w-[280px]"
                title={selectedFile.name}
              >
                {selectedFile.name}
              </p>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                <span>{formatBytes(selectedFile.size)}</span>
                <span>•</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800/60">
                  <CheckCircle2 className="h-3 w-3" /> Ready to submit
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 ml-3">
            <button
              type="button"
              onClick={() => setIsPreviewOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-amber-500 hover:text-amber-500 transition-all cursor-pointer shadow-2xs active:scale-95"
              title="Preview Document"
            >
              <Eye className="h-3.5 w-3.5" />
              <span>Preview</span>
            </button>
            <button
              type="button"
              onClick={triggerFileInput}
              disabled={isUploading}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-amber-500 hover:text-amber-500 transition-all cursor-pointer shadow-2xs active:scale-95"
            >
              Replace
            </button>
            <button
              type="button"
              aria-label="Remove selected file"
              onClick={removeFile}
              disabled={isUploading}
              className="p-2 text-xs font-semibold rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-500 hover:text-white transition-all cursor-pointer shadow-2xs active:scale-95"
              title="Remove File"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-label="Drop file here or press space to browse files"
          aria-disabled={disabled || isUploading}
          onClick={triggerFileInput}
          onKeyDown={handleKeyDown}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "relative group flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950",
            isDragOver
              ? "border-amber-500 bg-amber-50/80 dark:bg-amber-500/10 scale-[1.01] shadow-md ring-2 ring-amber-400/40"
              : "border-slate-300 dark:border-slate-700 bg-slate-50/50 hover:border-amber-500 hover:bg-amber-50/50 dark:bg-slate-900/50 dark:hover:border-amber-500 dark:hover:bg-amber-500/5 transition-all shadow-xs",
            disabled && "opacity-50 cursor-not-allowed pointer-events-none",
          )}
        >
          <div className="flex flex-col items-center justify-center gap-2 py-4">
            <div
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-2xl border transition-all duration-200 shadow-2xs",
                isDragOver
                  ? "border-amber-400 bg-amber-100 text-amber-600 dark:bg-amber-400/20 dark:text-amber-300 animate-bounce"
                  : "border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:border-amber-400/50 group-hover:text-amber-500",
              )}
            >
              {isUploading ? (
                <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
              ) : (
                <UploadCloud className="h-6 w-6" />
              )}
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Click to upload or drag and drop
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {acceptedFormatsText} (up to {maxSizeMb} MB)
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Document Preview Modal Overlay */}
      {isPreviewOpen && selectedFile && fileObjectUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-200"
          onClick={() => setIsPreviewOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
              <div className="flex items-center gap-3 min-w-0">
                <div className="shrink-0">{fileType?.icon}</div>
                <div className="min-w-0">
                  <h3
                    className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate max-w-xs sm:max-w-md md:max-w-lg"
                    title={selectedFile.name}
                  >
                    {selectedFile.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    <span>{formatBytes(selectedFile.size)}</span>
                    <span>•</span>
                    <span>{fileType?.type}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={fileObjectUrl}
                  download={selectedFile.name}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-amber-500 hover:text-amber-500 transition-all shadow-2xs"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Download</span>
                </a>
                <button
                  type="button"
                  onClick={() => setIsPreviewOpen(false)}
                  className="rounded-full p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  aria-label="Close Preview"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 flex flex-col items-center justify-center min-h-[360px] bg-slate-100/50 dark:bg-slate-950/40">
              {isImage ? (
                <div className="flex items-center justify-center p-2 max-h-[65vh]">
                  <img
                    src={fileObjectUrl}
                    alt={selectedFile.name}
                    className="max-h-[60vh] max-w-full rounded-2xl object-contain shadow-md border border-slate-200 dark:border-slate-800"
                  />
                </div>
              ) : selectedFile.name.toLowerCase().endsWith(".pdf") ? (
                <iframe
                  src={fileObjectUrl}
                  title={selectedFile.name}
                  className="w-full h-[65vh] rounded-2xl border border-slate-300 dark:border-slate-800 bg-white shadow-inner"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-center p-8 max-w-md">
                  <div className="mb-4">{fileType?.icon}</div>
                  <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">
                    {selectedFile.name}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
                    Direct in-browser interactive preview is not supported for this file format ({fileType?.type}). You can open or download a local copy to inspect it.
                  </p>
                  <a
                    href={fileObjectUrl}
                    download={selectedFile.name}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs shadow-md shadow-amber-500/10 transition-all cursor-pointer"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span>Open / Download Copy</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isUploading && (
        <div className="space-y-1.5" aria-label="Upload progress">
          <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Uploading document…</span>
            <span className="font-mono font-medium">{uploadProgress}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-amber-500 transition-all duration-300 ease-out"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {validationError && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-rose-300 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-3 py-2 text-xs text-rose-800 dark:text-rose-300 shadow-2xs animate-in fade-in slide-in-from-top-1"
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
        <span className="flex items-center gap-1">
          <FileText className="h-3 w-3" />
          <span>Max {maxSizeMb}MB • PDF / Scanned Copy</span>
        </span>

        <div className="relative">
          <button
            type="button"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            onFocus={() => setShowTooltip(true)}
            onBlur={() => setShowTooltip(false)}
            className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition focus-visible:outline-none"
            aria-label="Upload rules and information"
          >
            <Info className="h-3 w-3" />
            <span>Upload rules</span>
          </button>

          {showTooltip && (
            <div
              role="tooltip"
              className="absolute right-0 bottom-full mb-1.5 w-64 rounded-xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-700 dark:text-slate-300 shadow-lg z-20"
            >
              <p className="font-semibold text-slate-900 dark:text-slate-100 mb-1">
                Document Submission Rules:
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-slate-600 dark:text-slate-400">
                <li>Ensure document contains official signatures.</li>
                <li>Scanned PDFs must be clear and legible.</li>
                <li>Only 1 file allowed per requirement.</li>
                <li>Maximum file size is {maxSizeMb} MB.</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
