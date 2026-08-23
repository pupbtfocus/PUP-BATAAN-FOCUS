"use client";

import React, { useState, useRef, useCallback, type DragEvent, type KeyboardEvent } from "react";
import { UploadCloud, FileText, X, AlertCircle, CheckCircle2, Info, Loader2 } from "lucide-react";
import { cn } from "@/utils/cn";
import { SubmissionStatusBadge } from "./submission-status-badge";

export interface DocumentUploadZoneProps {
  selectedFile: File | null;
  onFileSelect: (file: File | null) => void;
  isUploading?: boolean;
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

export function DocumentUploadZone({
  selectedFile,
  onFileSelect,
  isUploading = false,
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const maxSizeBytes = maxSizeMb * 1024 * 1024;

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

      {/* Drop Zone Box */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={
          selectedFile
            ? `Selected file: ${selectedFile.name}. Press space or enter to choose a different file.`
            : "Drop file here or press space to browse files"
        }
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
            : selectedFile
              ? "border-emerald-500 bg-emerald-50/40 dark:border-emerald-500/40 dark:bg-emerald-950/20"
            : "border-[#000000] bg-white hover:border-amber-500 hover:bg-amber-50/30 dark:border-slate-700 dark:bg-slate-900/50 dark:hover:border-amber-400/60 dark:hover:bg-slate-900/80 shadow-xs",
          disabled && "opacity-50 cursor-not-allowed pointer-events-none",
        )}
      >
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

        {selectedFile ? (
          <div className="flex w-full flex-col sm:flex-row items-center justify-between gap-3 p-1">
            <div className="flex items-center gap-3 min-w-0 text-left">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-solid border-[#000000] dark:border-emerald-500/30 bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                <FileText className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {selectedFile.name}
                </p>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  <span>{formatBytes(selectedFile.size)}</span>
                  <span>•</span>
                  <span className="text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Ready
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={triggerFileInput}
                disabled={isUploading}
                className="rounded-xl border border-solid border-[#000000] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
              >
                Change File
              </button>
              <button
                type="button"
                aria-label="Remove selected file"
                onClick={removeFile}
                disabled={isUploading}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-solid border-[#000000] dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 py-2">
            <div
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-2xl border transition-all duration-200 shadow-2xs",
                isDragOver
                  ? "border-amber-400 bg-amber-100 text-amber-600 dark:bg-amber-400/20 dark:text-amber-300 animate-bounce"
                  : "border-solid border-[#000000] dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:border-amber-400/50 group-hover:text-amber-500",
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
                {isDragOver ? (
                  <span className="text-amber-600 dark:text-amber-300">Drop your file here</span>
                ) : (
                  <>
                    <span className="text-amber-600 dark:text-amber-400 font-bold hover:underline">
                      Click to browse
                    </span>{" "}
                    or drag & drop
                  </>
                )}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Supported formats: {allowedFormats.map((f) => f.replace(/^\./, "").toUpperCase()).join(", ")}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Validation error message */}
      {validationError && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-rose-300 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-3 py-2 text-xs text-rose-800 dark:text-rose-300 shadow-2xs animate-in fade-in slide-in-from-top-1"
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      {/* File Size & Upload Guidance Note */}
      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 px-1">
        <div className="flex items-center gap-1">
          <span className="font-medium text-slate-700 dark:text-slate-300">Max size:</span>{" "}
          {maxSizeMb} MB
        </div>

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
              className="absolute right-0 bottom-full mb-1.5 w-64 rounded-xl border-2 border-solid border-[#000000] dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-700 dark:text-slate-300 shadow-lg z-20"
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
