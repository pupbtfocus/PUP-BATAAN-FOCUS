"use client";

import { useCallback, useEffect, useState } from "react";
import {
  FileText,
  Download,
  History,
  Clock,
  Copy,
  Check,
  X,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  DocumentVersionDetail,
  VersionHistoryResponse,
} from "@/features/submissions/types/submission.types";

interface VersionHistoryModalProps {
  submissionId: string;
  requirementLabel: string;
  requirementCode: string;
  onClose: () => void;
}

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

function truncateChecksum(checksum: string, length = 16): string {
  if (!checksum) return "—";
  return checksum.length > length
    ? `${checksum.slice(0, length)}…`
    : checksum;
}

function ChecksumBadge({ checksum }: { checksum: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(checksum);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API fallback
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 font-mono text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 px-2.5 py-1 rounded-md transition hover:border-slate-400 dark:hover:border-slate-600 hover:text-slate-900 dark:hover:text-slate-200"
      title={`SHA-256: ${checksum}\nClick to copy`}
    >
      <span>{truncateChecksum(checksum)}</span>
      {copied ? (
        <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </button>
  );
}

export function VersionHistoryModal({
  submissionId,
  requirementLabel,
  onClose,
}: VersionHistoryModalProps) {
  const [versions, setVersions] = useState<DocumentVersionDetail[]>([]);
  const [submissionInfo, setSubmissionInfo] = useState<
    VersionHistoryResponse["submission"] | null
  >(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVersions = useCallback(async () => {
    try {
      setIsLoading(true);
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

      const data = (await response.json()) as VersionHistoryResponse;
      setVersions(data.versions ?? []);
      setSubmissionInfo(data.submission ?? null);
    } catch {
      setError("Error loading version history");
    } finally {
      setIsLoading(false);
    }
  }, [submissionId]);

  useEffect(() => {
    void fetchVersions();
  }, [fetchVersions]);

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
        className="w-full max-w-2xl rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
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
            className="rounded-full p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 transition-colors shrink-0 ml-3"
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
              <div className="flex items-start gap-2">
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
                className="mt-4"
                onClick={() => void fetchVersions()}
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

          {/* Version timeline */}
          {!isLoading && !error && versions.length > 0 && (
            <div className="relative space-y-0">
              {/* Timeline line */}
              {versions.length > 1 && (
                <div className="absolute left-[19px] top-8 bottom-8 w-px bg-slate-300 dark:bg-slate-700" />
              )}

              {versions.map((version, index) => {
                const isCurrent = index === 0;

                return (
                  <div key={version.id} className="relative flex gap-4 py-3">
                    {/* Timeline badge */}
                    <div className="relative z-10 flex shrink-0 items-start pt-1">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full border text-xs font-semibold ${
                          isCurrent
                            ? "bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700"
                        }`}
                      >
                        v{version.versionNumber}
                      </div>
                    </div>

                    {/* Version card */}
                    <div
                      className={`flex-1 rounded-xl p-4 transition shadow-xs ${
                        isCurrent
                          ? "bg-slate-50/80 dark:bg-slate-950/60 border border-slate-300 dark:border-slate-800"
                          : "bg-slate-50/80 dark:bg-slate-950/60 border border-slate-300 dark:border-slate-800"
                      }`}
                    >
                      {/* Top row: version title + current badge + download button */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                              Version {version.versionNumber}
                            </span>
                            {isCurrent && (
                              <span className="bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                Current
                              </span>
                            )}
                          </div>

                          {/* Timestamp */}
                          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                            <Clock className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                            <span>{formatTimestamp(version.createdAt)}</span>
                          </div>
                        </div>

                        {/* Download button */}
                        {version.downloadUrl && (
                          <a
                            href={version.downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors shrink-0"
                          >
                            <Download className="h-3.5 w-3.5" />
                            Download
                          </a>
                        )}
                      </div>

                      {/* File info & Checksum row */}
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-300 dark:border-slate-800/80">
                        <div className="flex items-center gap-2 text-xs min-w-0">
                          <FileText className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
                          <span className="text-slate-800 dark:text-slate-200 font-medium truncate max-w-[200px]">
                            {version.fileName}
                          </span>
                          <span className="text-slate-400 dark:text-slate-500">•</span>
                          <span className="text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {formatFileSize(version.sizeBytes)}
                          </span>
                        </div>

                        {version.checksumSha256 && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500">
                              SHA-256:
                            </span>
                            <ChecksumBadge checksum={version.checksumSha256} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-300 dark:border-slate-800 px-6 py-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {versions.length} {versions.length === 1 ? "version" : "versions"} found
            </p>
            <button
              type="button"
              onClick={onClose}
              className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 font-medium rounded-xl px-5 py-2.5 shadow-xs transition-colors cursor-pointer text-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

