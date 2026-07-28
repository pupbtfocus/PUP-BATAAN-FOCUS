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
      // Clipboard API may fail in some contexts
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-xs text-slate-400 transition hover:border-slate-500 hover:text-slate-200"
      title={`SHA-256: ${checksum}\nClick to copy`}
    >
      <span>{truncateChecksum(checksum)}</span>
      {copied ? (
        <Check className="h-3 w-3 text-green-400" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </button>
  );
}

export function VersionHistoryModal({
  submissionId,
  requirementLabel,
  requirementCode,
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="version-history-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 px-6 py-5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-amber-300 shrink-0" />
              <p className="text-xs uppercase tracking-[0.22em] text-amber-300">
                Version History
              </p>
            </div>
            <h3
              id="version-history-title"
              className="mt-2 text-xl font-semibold text-slate-100 truncate"
            >
              {requirementLabel}
            </h3>
            <p className="mt-1 text-xs text-slate-500 font-mono">
              {requirementCode}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-700 p-2 text-slate-300 transition hover:bg-slate-800 hover:text-slate-100 shrink-0 ml-3"
            aria-label="Close version history"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[65vh] overflow-y-auto px-6 py-5">
          {/* Review feedback banner */}
          {submissionInfo?.feedback && (
            <div className="mb-5 rounded-xl border border-red-800/60 bg-red-950/30 p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-red-400 font-medium">
                    Reviewer Remarks
                  </p>
                  <p className="mt-1.5 text-sm text-red-200 leading-6">
                    {submissionInfo.feedback}
                  </p>
                  {submissionInfo.reviewedAt && (
                    <p className="mt-2 text-xs text-red-400/60">
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
              <Loader2 className="h-8 w-8 animate-spin text-amber-300" />
              <p className="mt-3 text-sm text-slate-400">
                Loading version history…
              </p>
            </div>
          )}

          {/* Error state */}
          {!isLoading && error && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-red-800/40 bg-red-950/20 px-6 py-8">
              <AlertCircle className="h-8 w-8 text-red-400" />
              <p className="mt-3 text-sm text-red-300">{error}</p>
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
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-950 px-6 py-8">
              <FileText className="h-8 w-8 text-slate-600" />
              <p className="mt-3 text-sm text-slate-400">
                No versions found for this document.
              </p>
            </div>
          )}

          {/* Version timeline */}
          {!isLoading && !error && versions.length > 0 && (
            <div className="relative space-y-0">
              {/* Timeline line */}
              {versions.length > 1 && (
                <div className="absolute left-[19px] top-8 bottom-8 w-px bg-slate-700" />
              )}

              {versions.map((version, index) => {
                const isCurrent = index === 0;

                return (
                  <div key={version.id} className="relative flex gap-4 py-3">
                    {/* Timeline dot */}
                    <div className="relative z-10 flex shrink-0 items-start pt-1">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-xs font-bold ${
                          isCurrent
                            ? "border-amber-400 bg-amber-400/15 text-amber-300"
                            : "border-slate-600 bg-slate-800 text-slate-400"
                        }`}
                      >
                        v{version.versionNumber}
                      </div>
                    </div>

                    {/* Version card */}
                    <div
                      className={`flex-1 rounded-xl border p-4 transition ${
                        isCurrent
                          ? "border-amber-500/30 bg-slate-950"
                          : "border-slate-700 bg-slate-950/60"
                      }`}
                    >
                      {/* Top row: version label + download */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-slate-100">
                              Version {version.versionNumber}
                            </span>
                            {isCurrent && (
                              <span className="rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
                                Current
                              </span>
                            )}
                            {!isCurrent && (
                              <span className="rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">
                                Archived
                              </span>
                            )}
                          </div>

                          {/* Timestamp */}
                          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
                            <Clock className="h-3 w-3" />
                            <span>{formatTimestamp(version.createdAt)}</span>
                          </div>
                        </div>

                        {/* Download button */}
                        {version.downloadUrl && (
                          <a
                            href={version.downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-100 transition hover:border-slate-500 hover:bg-slate-700 shrink-0"
                          >
                            <Download className="h-3.5 w-3.5" />
                            Download
                          </a>
                        )}
                      </div>

                      {/* File info */}
                      <div className="mt-3 flex items-center gap-2 text-sm">
                        <FileText className="h-4 w-4 text-slate-500 shrink-0" />
                        <span className="text-slate-300 truncate">
                          {version.fileName}
                        </span>
                        <span className="text-slate-500">—</span>
                        <span className="text-slate-400 whitespace-nowrap">
                          {formatFileSize(version.sizeBytes)}
                        </span>
                      </div>

                      {/* Checksum */}
                      {version.checksumSha256 && (
                        <div className="mt-2.5 flex items-center gap-2">
                          <span className="text-[10px] uppercase tracking-wider text-slate-500">
                            SHA-256
                          </span>
                          <ChecksumBadge checksum={version.checksumSha256} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 px-6 py-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              {versions.length > 0
                ? `${versions.length} version${versions.length === 1 ? "" : "s"} found`
                : ""}
            </p>
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
