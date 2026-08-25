"use client";

import { useCallback, useEffect, useState } from "react";
import {
  FileText,
  Download,
  History,
  Clock,
  X,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  DocumentVersionDetail,
  VersionHistoryResponse,
} from "@/features/submissions/types/submission.types";
import { getFileBrand } from "@/features/submissions/components/document-upload-zone";

interface VersionHistoryModalProps {
  submissionId: string;
  requirementLabel: string;
  requirementCode: string;
  onClose: () => void;
}

// In-memory client cache for instantaneous modal opening (< 0ms rendering)
const versionHistoryCache = new Map<string, VersionHistoryResponse>();

function formatTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatFileSize(bytes: number): string {
  if (bytes <= 0) return "Unknown size";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function VersionHistoryModal({
  submissionId,
  requirementLabel,
  onClose,
}: VersionHistoryModalProps) {
  const cachedData = versionHistoryCache.get(submissionId);
  const hasValidCachedVersions = Boolean(
    cachedData?.versions && cachedData.versions.length > 0,
  );

  const [versions, setVersions] = useState<DocumentVersionDetail[]>(
    () => (hasValidCachedVersions ? cachedData!.versions : []),
  );
  const [submissionInfo, setSubmissionInfo] = useState<
    VersionHistoryResponse["submission"] | null
  >(() => (hasValidCachedVersions ? cachedData!.submission : null));
  const [isLoading, setIsLoading] = useState(!hasValidCachedVersions);
  const [error, setError] = useState<string | null>(null);

  const fetchVersions = useCallback(
    async (isBackground = false) => {
      try {
        if (!isBackground) {
          setIsLoading(true);
        }
        setError(null);
        const response = await fetch(
          `/api/faculty/submissions/${encodeURIComponent(submissionId)}/versions`,
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          setError(
            (errorData as { error?: string }).error ??
              `Failed to load versions (HTTP ${response.status})`,
          );
          return;
        }

        const json = await response.json();
        const list: DocumentVersionDetail[] = Array.isArray(json)
          ? json
          : (json.versions || json.data || json.history || []);
        const submissionData = Array.isArray(json)
          ? null
          : (json.submission ?? null);

        const payload: VersionHistoryResponse = {
          versions: list,
          submission: submissionData,
        };

        if (list.length > 0) {
          versionHistoryCache.set(submissionId, payload);
        } else {
          versionHistoryCache.delete(submissionId);
        }

        setVersions(list);
        setSubmissionInfo(submissionData);
      } catch {
        if (!isBackground) {
          setError("Error loading version history");
        }
      } finally {
        setIsLoading(false);
      }
    },
    [submissionId],
  );

  useEffect(() => {
    void fetchVersions(hasValidCachedVersions);
  }, [fetchVersions, hasValidCachedVersions]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="version-history-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-300 dark:border-slate-800 px-6 py-5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <h3
                id="version-history-title"
                className="text-lg font-bold text-slate-900 dark:text-slate-100 truncate"
              >
                Version History
              </h3>
            </div>
            <p className="mt-1 text-sm font-medium text-amber-600 dark:text-amber-400 truncate">
              {requirementLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 transition-colors shrink-0 ml-3 cursor-pointer"
            aria-label="Close version history"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[65vh] overflow-y-auto px-6 py-5">
          {/* Review feedback banner */}
          {submissionInfo?.feedback && (
            <div className="mb-5 rounded-xl border border-red-500/30 bg-red-50 dark:bg-red-950/30 p-4">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-red-700 dark:text-red-400 font-semibold">
                    Reviewer Remarks
                  </p>
                  <p className="mt-1.5 text-sm text-red-950 dark:text-red-200 leading-6">
                    {submissionInfo.feedback}
                  </p>
                  {submissionInfo.reviewedAt && (
                    <p className="mt-2 text-xs text-red-700/70 dark:text-red-400/60">
                      Reviewed on {submissionInfo.reviewedAt}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                Loading version history…
              </p>
            </div>
          )}

          {/* Error state */}
          {!isLoading && error && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-red-500/30 bg-red-50 dark:bg-red-950/20 px-6 py-8">
              <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
              <p className="mt-3 text-sm text-red-700 dark:text-red-300">{error}</p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="mt-4 cursor-pointer"
                onClick={() => void fetchVersions(false)}
              >
                Retry
              </Button>
            </div>
          )}

          {/* Empty state */}
          {!isLoading && !error && versions.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-6 py-8">
              <FileText className="h-8 w-8 text-slate-400 dark:text-slate-600" />
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
                No versions found for this document.
              </p>
            </div>
          )}

          {/* Version list */}
          {!isLoading && !error && versions.length > 0 && (
            <div className="space-y-3">
              {versions.map((version, index) => {
                const isCurrent = index === 0;
                const versionNum =
                  version.versionNumber ?? version.version_number ?? index + 1;
                const fileName =
                  version.fileName ||
                  version.file_name ||
                  "Uploaded Document";
                const sizeBytes =
                  version.sizeBytes ?? version.size_bytes ?? 0;
                const createdAt =
                  version.createdAt ||
                  version.created_at ||
                  new Date().toISOString();
                const downloadUrl =
                  version.downloadUrl || version.download_url;

                const ext = fileName.split(".").pop() || "file";
                const isExcel = Boolean(
                  version.mimeType?.includes("sheet") ||
                    version.mimeType?.includes("excel") ||
                    version.mimeType?.includes("csv") ||
                    fileName.toLowerCase().endsWith(".xlsx") ||
                    fileName.toLowerCase().endsWith(".xls") ||
                    fileName.toLowerCase().endsWith(".csv"),
                );
                const isWord = Boolean(
                  version.mimeType?.includes("word") ||
                    version.mimeType?.includes("document") ||
                    fileName.toLowerCase().endsWith(".docx") ||
                    fileName.toLowerCase().endsWith(".doc"),
                );
                const brand = getFileBrand(ext, isExcel, isWord);

                return (
                  <div
                    key={version.id}
                    className={`rounded-2xl p-4 transition-all shadow-xs bg-slate-50/90 dark:bg-slate-950/60 border ${
                      isCurrent
                        ? "border-emerald-500/40 dark:border-emerald-500/30"
                        : "border-slate-200 dark:border-slate-800"
                    }`}
                  >
                    {/* Top row: version title + current badge + download button */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Official brand thumbnail icon */}
                        <div className="flex-shrink-0 w-10 h-10 p-1.5 rounded-xl bg-white dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700/60 flex items-center justify-center shadow-xs">
                          <img
                            src={brand.iconUrl}
                            alt={brand.label}
                            className="w-6 h-6 object-contain select-none"
                            loading="lazy"
                          />
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                              Version {versionNum}
                            </span>
                            {isCurrent && (
                              <span className="bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider">
                                Current
                              </span>
                            )}
                          </div>

                          {/* Timestamp */}
                          <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                            <Clock className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                            <span>{formatTimestamp(createdAt)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Download button */}
                      {downloadUrl && (
                        <a
                          href={downloadUrl}
                          download={fileName}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold text-xs px-3.5 py-2 rounded-xl shadow-xs transition-all cursor-pointer shrink-0"
                          title="Download this version"
                        >
                          <Download className="h-3.5 w-3.5 stroke-[2.2]" />
                          <span>Download</span>
                        </a>
                      )}
                    </div>

                    {/* File info row */}
                    <div className="mt-3 flex items-center gap-2 text-xs pt-2.5 border-t border-slate-200 dark:border-slate-800/80">
                      <span
                        className="text-slate-800 dark:text-slate-200 font-medium truncate max-w-[280px] sm:max-w-md"
                        title={fileName}
                      >
                        {fileName}
                      </span>
                      <span className="text-slate-400 dark:text-slate-500">•</span>
                      <span className="text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {formatFileSize(sizeBytes)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-300 dark:border-slate-800 px-6 py-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 font-semibold rounded-xl px-5 py-2.5 shadow-xs transition-colors cursor-pointer text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
