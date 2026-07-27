"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_REQUIREMENTS,
  REQUIREMENT_LABEL,
  type RequirementCode,
} from "@/config/compliance";
import type {
  FacultyAccount,
  RequirementStatus,
  SemesterOption,
} from "@/features/faculty-management/types/faculty-dashboard.types";

const SEMESTER_OPTIONS: SemesterOption[] = ["1st Semester", "2nd Semester"];

function statusLabel(status: RequirementStatus): string {
  switch (status) {
    case "uploaded":
      return "Uploaded (Pending Review)";
    case "validated":
      return "Validated";
    case "not_submitted":
      return "Not Submitted";
  }
}

function statusTone(status: RequirementStatus): string {
  switch (status) {
    case "uploaded":
      return "text-amber-400";
    case "validated":
      return "text-emerald-400";
    case "not_submitted":
      return "text-rose-400";
  }
}

function formatSubmittedDateTime(
  value: string | null | undefined,
): string | null {
  if (!value) return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function toAcademicYearAndSemester(dateInput: string | null | undefined): {
  academicYear: string;
  semester: SemesterOption;
} {
  const parsed = dateInput ? new Date(dateInput) : null;

  if (!parsed || Number.isNaN(parsed.getTime())) {
    return {
      academicYear: "",
      semester: "1st Semester",
    };
  }

  const month = parsed.getMonth() + 1;
  const year = parsed.getFullYear();
  const startsSchoolYear = month >= 6;

  return {
    academicYear: startsSchoolYear
      ? `${year}-${year + 1}`
      : `${year - 1}-${year}`,
    semester: startsSchoolYear ? "1st Semester" : "2nd Semester",
  };
}

export interface RequirementsVerificationModalProps {
  facultyName: string;
  academicYear: string;
  semester: SemesterOption;
  requirementStatus: Record<RequirementCode, RequirementStatus> | null;
  facultyId: string;
  onClose: () => void;
}

export function RequirementsVerificationModal({
  facultyName,
  academicYear,
  semester,
  requirementStatus,
  facultyId,
  onClose,
}: RequirementsVerificationModalProps) {
  const [viewingRequirement, setViewingRequirement] =
    useState<RequirementCode | null>(null);
  const [submissions, setSubmissions] = useState<AdminSubmission[]>([]);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);
  const [reviewingSubmissionId, setReviewingSubmissionId] = useState<
    string | null
  >(null);
  const [reviewRemarks, setReviewRemarks] = useState("");

  type AdminSubmissionReviewDecision = {
    decision: "validated" | "rejected";
    remarks?: string | null;
    created_at?: string | null;
  };

  type AdminSubmissionDocumentVersion = {
    id: string;
    storage_path: string;
    mime_type?: string | null;
    size_bytes?: number | null;
    created_at?: string | null;
  };

  type AdminSubmission = {
    id: string;
    requirement_code: string;
    status: string | null;
    submitted_at?: string | null;
    created_at?: string | null;
    remarks?: string | null;
    document_versions?: AdminSubmissionDocumentVersion[] | null;
    review_decisions?: AdminSubmissionReviewDecision[] | null;
  };

  const selectedSubmission = submissions[0] ?? null;
  const submissionDocuments = selectedSubmission?.document_versions ?? [];
  const selectedDocument = selectedSubmission?.document_versions?.[0] ?? null;
  const latestReview = selectedSubmission?.review_decisions?.length
    ? [...selectedSubmission.review_decisions].sort((a, b) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bTime - aTime;
      })[0]
    : null;
  const previewPath = selectedDocument?.storage_path ?? null;
  const previewUrl = previewPath
    ? `/api/storage/download?path=${encodeURIComponent(previewPath)}`
    : null;
  const getDocumentDownloadUrl = (storagePath: string) =>
    `/api/storage/download?path=${encodeURIComponent(storagePath)}`;
  const previewFileName = previewPath?.split("/").pop() ?? "Submitted file";
  const previewMimeType = selectedDocument?.mime_type ?? null;
  const isImagePreview =
    previewMimeType?.startsWith("image/") ||
    /\.(jpe?g|png|gif|bmp|webp)$/i.test(previewFileName);
  const isPdfPreview =
    previewMimeType === "application/pdf" || /\.pdf$/i.test(previewFileName);
  const reviewedOn = latestReview?.created_at
    ? new Date(latestReview.created_at).toISOString().split("T")[0]
    : null;
  const submittedOn = formatSubmittedDateTime(
    selectedSubmission?.submitted_at || selectedSubmission?.created_at,
  );
  const previewLabel = "Submitted File";
  const validatedFileCount = requirementStatus
    ? DEFAULT_REQUIREMENTS.filter(
        (code) => requirementStatus[code] === "validated",
      ).length
    : 0;
  const downloadValidatedZipHref = `/api/admin/faculty/submissions/download-validated?facultyId=${encodeURIComponent(
    facultyId,
  )}&academicYear=${encodeURIComponent(academicYear)}&semester=${encodeURIComponent(
    semester,
  )}`;
  const reviewStatus =
    selectedSubmission?.status === "validated" ||
    latestReview?.decision === "validated"
      ? "validated"
      : selectedSubmission?.status === "rejected" ||
          latestReview?.decision === "rejected"
        ? "rejected"
        : null;
  const reviewStatusLabel =
    reviewStatus === "validated"
      ? "Validated"
      : reviewStatus === "rejected"
        ? "Rejected"
        : null;
  const reviewStatusTone =
    reviewStatus === "validated"
      ? "border-green-500/30 bg-green-500/10 text-green-300"
      : reviewStatus === "rejected"
        ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
        : "border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950 text-slate-500 dark:text-slate-400";

  async function handleViewRequirement(code: RequirementCode) {
    setIsLoadingSubmissions(true);
    try {
      const response = await fetch(
        `/api/admin/faculty/submissions?facultyId=${facultyId}`,
        { credentials: "include" },
      );
      if (response.ok) {
        const data = await response.json();
        const filtered = (data.submissions || []).filter((sub: any) => {
          if (sub.requirement_code !== code) {
            return false;
          }

          const term = toAcademicYearAndSemester(
            sub.submitted_at || sub.created_at,
          );

          if (academicYear && term.academicYear !== academicYear) {
            return false;
          }

          if (semester && term.semester !== semester) {
            return false;
          }

          return true;
        });

        setSubmissions(filtered.length > 0 ? [filtered[0]] : []);
        setViewingRequirement(code);
      }
    } catch (error) {
      console.error("Failed to load submissions:", error);
    } finally {
      setIsLoadingSubmissions(false);
    }
  }

  async function handleReviewSubmission(
    submissionId: string,
    decision: "validated" | "rejected",
  ) {
    setReviewingSubmissionId(submissionId);
    try {
      const response = await fetch("/api/admin/faculty/submissions/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          submissionId,
          decision,
          remarks: reviewRemarks,
        }),
      });

      if (response.ok) {
        setSubmissions(
          submissions.map((sub) =>
            sub.id === submissionId ? { ...sub, status: decision } : sub,
          ),
        );
        setReviewRemarks("");
        alert(`Submission ${decision} successfully!`);
      } else {
        try {
          const error = await response.json();
          alert(`Error: ${error.error}`);
        } catch (parseError) {
          alert(`Error: Failed to process review (HTTP ${response.status})`);
        }
      }
    } catch (error) {
      console.error("Failed to review submission:", error);
      alert("Failed to process review. Please try again.");
    } finally {
      setReviewingSubmissionId(null);
    }
  }

  if (viewingRequirement) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-3 backdrop-blur-sm"
        onClick={() => setViewingRequirement(null)}
      >
        <div
          className="flex h-[96vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between border-b border-slate-800 px-6 py-5">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-[#7a0000] dark:text-amber-300">
                File Preview
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-800 dark:text-slate-100">
                {previewLabel}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.location.assign(downloadValidatedZipHref)}
                disabled={validatedFileCount === 0}
                className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-950 disabled:text-slate-500"
              >
                Download ZIP
                {validatedFileCount > 0 ? ` (${validatedFileCount})` : ""}
              </button>
              <button
                type="button"
                onClick={() => setViewingRequirement(null)}
                className="rounded-full border border-slate-700 p-2 text-slate-700 dark:text-slate-300 transition hover:bg-slate-800 hover:text-slate-800 dark:text-slate-100"
                aria-label="Close preview"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="grid flex-1 gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)] lg:px-6 lg:py-5">
            {isLoadingSubmissions ? (
              <div className="lg:col-span-2 rounded-2xl border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950 p-4 text-sm text-slate-500 dark:text-slate-400">
                Loading submissions...
              </div>
            ) : submissions.length === 0 ? (
              <div className="lg:col-span-2 rounded-2xl border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950 p-4 text-sm text-slate-500 dark:text-slate-400">
                No submissions found for this requirement.
              </div>
            ) : (
              <>
                <div className="relative min-h-[60vh] overflow-hidden rounded-2xl border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950">
                  {previewUrl ? (
                    <div className="absolute right-3 top-3 z-10">
                      <a
                        href={previewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center rounded-md border border-slate-700 bg-slate-800/95 px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-blue-300 shadow-sm transition hover:bg-slate-700"
                      >
                        Open full view
                      </a>
                    </div>
                  ) : null}

                  {previewUrl ? (
                    isImagePreview ? (
                      <Image
                        src={previewUrl}
                        alt={previewFileName}
                        width={1200}
                        height={900}
                        unoptimized
                        className="h-full min-h-[60vh] w-full object-contain"
                      />
                    ) : isPdfPreview ? (
                      <iframe
                        title={`${REQUIREMENT_LABEL[viewingRequirement]} preview`}
                        src={previewUrl}
                        className="h-full min-h-[60vh] w-full border-0"
                      />
                    ) : (
                      <div className="flex min-h-[60vh] items-center justify-center p-4 text-sm text-slate-700 dark:text-slate-300">
                        Preview not available for this file type.
                      </div>
                    )
                  ) : (
                    <div className="flex min-h-[60vh] items-center justify-center p-4 text-sm text-slate-700 dark:text-slate-300">
                      Preview not available for this file.
                    </div>
                  )}
                </div>

                <div className="space-y-2.5 lg:pr-1">
                  {reviewStatusLabel ? (
                    <div
                      className={`rounded-2xl border p-2.5 text-sm font-semibold uppercase tracking-[0.18em] ${reviewStatusTone}`}
                    >
                      {reviewStatus === "validated" ? "✓ " : "✗ "}
                      {reviewStatusLabel}
                    </div>
                  ) : null}

                  <div className="rounded-2xl border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950 p-2.5">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      Faculty Note
                    </p>
                    <p className="mt-2 text-sm leading-6 italic text-slate-200">
                      {selectedSubmission?.remarks || "No note was added."}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950 p-2.5">
                    <div className="mt-3 space-y-2">
                      {submissionDocuments.length > 0 ? (
                        submissionDocuments.map((doc, index) => {
                          const downloadUrl = getDocumentDownloadUrl(
                            doc.storage_path,
                          );

                          return (
                            <div
                              key={doc.id}
                              className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/70 p-3"
                            >
                              <div className="flex flex-col items-center gap-3 text-center">
                                <a
                                  href={downloadUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center justify-center rounded-lg border border-blue-500/30 bg-blue-600 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-blue-700"
                                >
                                  Download
                                </a>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-sm leading-6 italic text-slate-200">
                          No file pieces available.
                        </p>
                      )}
                    </div>
                  </div>

                  {latestReview?.created_at || latestReview?.remarks ? (
                    <div className="rounded-2xl border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950 p-2.5">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                        My Remarks
                      </p>
                      <p className="mt-2 text-sm leading-6 italic text-slate-200">
                        {latestReview?.remarks || "No remarks were added."}
                      </p>
                      {reviewedOn ? (
                        <>
                          <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">
                            Reviewed On
                          </p>
                          <p className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-300">
                            {reviewedOn}
                          </p>
                        </>
                      ) : null}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950 p-2.5">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                        My Remarks
                      </p>
                      <p className="mt-2 text-sm leading-6 italic text-slate-200">
                        No remarks were added.
                      </p>
                    </div>
                  )}

                  {submittedOn ? (
                    <div className="rounded-2xl border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950 p-2.5 text-sm text-slate-700 dark:text-slate-300">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                        Submitted On
                      </p>
                      <p className="mt-2 leading-6">{submittedOn}</p>
                    </div>
                  ) : null}

                  {selectedSubmission?.status === "uploaded" ? (
                    <div className="rounded-2xl border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950 p-2.5">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                        Admin Action
                      </p>
                      <textarea
                        placeholder="Add remarks (optional)"
                        value={reviewRemarks}
                        onChange={(e) => setReviewRemarks(e.target.value)}
                        className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950 px-3 py-2.5 text-xs text-slate-700 dark:text-slate-300 placeholder-slate-500 outline-none focus:ring focus:ring-amber-300/30"
                        rows={2}
                      />
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() =>
                            handleReviewSubmission(
                              selectedSubmission.id,
                              "validated",
                            )
                          }
                          disabled={
                            reviewingSubmissionId === selectedSubmission.id
                          }
                          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-950/30 transition hover:from-emerald-400 hover:to-green-500 hover:shadow-emerald-950/40 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <span className="text-base leading-none">✓</span>
                          {reviewingSubmissionId === selectedSubmission.id
                            ? "Approving..."
                            : "Approve"}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleReviewSubmission(
                              selectedSubmission.id,
                              "rejected",
                            )
                          }
                          disabled={
                            reviewingSubmissionId === selectedSubmission.id
                          }
                          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-500 to-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-rose-950/30 transition hover:from-rose-400 hover:to-red-500 hover:shadow-rose-950/40 focus:outline-none focus:ring-2 focus:ring-rose-400/50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <span className="text-base leading-none">✗</span>
                          {reviewingSubmissionId === selectedSubmission.id
                            ? "Rejecting..."
                            : "Reject"}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-3 backdrop-blur-sm">
      <div className="flex h-[96vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-800 px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-[#7a0000] dark:text-amber-300">
              Requirements Verification
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-800 dark:text-slate-100">
              Faculty Requirement Status
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.location.assign(downloadValidatedZipHref)}
              disabled={validatedFileCount === 0}
              className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-950 disabled:text-slate-500"
            >
              Download ZIP
              {validatedFileCount > 0 ? ` (${validatedFileCount})` : ""}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-700 p-2 text-slate-700 dark:text-slate-300 transition hover:bg-slate-800 hover:text-slate-800 dark:text-slate-100"
              aria-label="Close modal"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)]">
            <div className="rounded-2xl border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950 p-4 text-sm text-slate-700 dark:text-slate-300">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Faculty
              </p>
              <p className="mt-2 text-slate-800 dark:text-slate-100">{facultyName}</p>
              <p className="mt-4 text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Filter
              </p>
              <p className="mt-2 text-slate-800 dark:text-slate-100">
                S.Y. {academicYear} - {semester}
              </p>
            </div>

            <div className="space-y-3">
              {requirementStatus ? (
                DEFAULT_REQUIREMENTS.map((code) => {
                  const status = requirementStatus[code] ?? "not_submitted";
                  return (
                    <article
                      key={code}
                      className="rounded-2xl border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                            {REQUIREMENT_LABEL[code]}
                          </p>
                          <p
                            className={`mt-1 text-sm font-medium ${statusTone(status)}`}
                          >
                            {statusLabel(status)}
                          </p>
                        </div>

                        {(status === "uploaded" || status === "validated") && (
                          <button
                            type="button"
                            onClick={() => handleViewRequirement(code)}
                            className="inline-flex items-center rounded-xl border border-blue-500/30 bg-blue-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-blue-700"
                          >
                            View
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })
              ) : (
                <p className="rounded-2xl border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950 p-4 text-sm text-slate-500 dark:text-slate-400">
                  No requirements data loaded. Please refresh the modal.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-slate-800 px-6 py-4 flex justify-end">
          <Button onClick={onClose} variant="secondary">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

export interface RequirementsPanelProps {
  facultyAccounts: FacultyAccount[];
  selectedFaculty: FacultyAccount | null;
  onSelectFaculty: (facultyId: string) => void;
  resetTrigger?: number;
}

export function RequirementsPanel({
  facultyAccounts,
  selectedFaculty,
  onSelectFaculty,
  resetTrigger,
}: RequirementsPanelProps) {
  const [academicYear, setAcademicYear] = useState("");
  const [semester, setSemester] = useState<SemesterOption>("1st Semester");
  const [currentAcademicYear, setCurrentAcademicYear] = useState<string | null>(
    null,
  );
  const [currentSemester, setCurrentSemester] = useState<SemesterOption | null>(
    null,
  );
  const [currentTermConfigured, setCurrentTermConfigured] = useState(false);
  const [isHistoryMode, setIsHistoryMode] = useState(false);
  const [availableAcademicYears, setAvailableAcademicYears] = useState<
    string[]
  >([]);
  const [availableSemesters, setAvailableSemesters] = useState<
    SemesterOption[]
  >([]);
  const [verificationStatus, setVerificationStatus] = useState<Record<
    RequirementCode,
    RequirementStatus
  > | null>(null);
  const [isLoadingVerification, setIsLoadingVerification] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(
    null,
  );
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (resetTrigger === undefined) {
      return;
    }

    setVerificationStatus(null);
    setVerificationError(null);
  }, [resetTrigger]);

  async function fetchVerificationStatus(
    selectedFacultyId: string,
    selectedAcademicYear?: string,
    selectedSemester?: SemesterOption,
  ) {
    setIsLoadingVerification(true);
    setVerificationError(null);

    try {
      const params = new URLSearchParams({
        facultyId: selectedFacultyId,
      });

      if (selectedAcademicYear) {
        params.set("academicYear", selectedAcademicYear);
      }

      if (selectedSemester) {
        params.set("semester", selectedSemester);
      }

      const response = await fetch(
        `/api/admin/faculty/requirements/verification?${params.toString()}`,
        { credentials: "include" },
      );

      if (!response.ok) {
        let details = "";
        try {
          const err = await response.json();
          details = JSON.stringify(err);
        } catch (e) {
          try {
            details = await response.text();
          } catch (e2) {
            details = "(no body)";
          }
        }

        throw new Error(
          `Failed to load verification requirements (HTTP ${response.status}): ${details}`,
        );
      }

      const data = await response.json();

      const years: string[] = data.availableAcademicYears ?? [];
      const selectedYear = data.selectedAcademicYear ?? "";
      const selectedSem =
        (data.selectedSemester as SemesterOption | undefined) ?? "1st Semester";

      const availableSemestersFromResponse =
        (data.availableSemesters as SemesterOption[] | undefined) ??
        SEMESTER_OPTIONS;

      setAvailableAcademicYears(years);
      setAvailableSemesters(availableSemestersFromResponse);
      setAcademicYear(selectedYear);
      setSemester(selectedSem);
      setVerificationStatus(data.requirementStatus ?? null);
    } catch (error) {
      console.error("Verification fetch error:", error);
      setVerificationError(
        error instanceof Error
          ? error.message
          : "Unable to load requirements for the selected filter.",
      );
      setVerificationStatus(null);
    } finally {
      setIsLoadingVerification(false);
    }
  }

  useEffect(() => {
    if (!selectedFaculty) {
      const timeoutId = window.setTimeout(() => {
        setAvailableAcademicYears([]);
        setAvailableSemesters([]);
        setCurrentAcademicYear(null);
        setCurrentSemester(null);
        setCurrentTermConfigured(false);
        setVerificationError(null);
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }

    (async () => {
      try {
        const response = await fetch(
          `/api/admin/faculty/requirements/verification?facultyId=${selectedFaculty.id}`,
          { credentials: "include" },
        );

        if (response.ok) {
          const data = await response.json();
          const years: string[] = data.availableAcademicYears ?? [];
          const selectedYear = data.selectedAcademicYear ?? "";
          const selectedSem =
            (data.selectedSemester as SemesterOption | undefined) ??
            "1st Semester";
          const currentYear = data.currentAcademicYear ?? null;
          const currentSem =
            (data.currentSemester as SemesterOption | undefined) ?? null;
          const termConfigured = Boolean(data.currentTermConfigured);

          const computedYear =
            termConfigured && currentYear
              ? currentYear
              : selectedYear || years[0] || "";
          const computedSem =
            termConfigured && currentSem ? currentSem : selectedSem;

          setAvailableAcademicYears(years);
          setAvailableSemesters(data.availableSemesters ?? []);
          setCurrentAcademicYear(currentYear);
          setCurrentSemester(currentSem);
          setCurrentTermConfigured(termConfigured);
          setAcademicYear(computedYear || "");
          setSemester(computedSem);
          setIsHistoryMode(!termConfigured);
          setVerificationStatus(null);
        } else {
          let details = "";
          try {
            const err = await response.json();
            details = JSON.stringify(err);
          } catch (e) {
            try {
              details = await response.text();
            } catch (e2) {
              details = "(no body)";
            }
          }

          setVerificationError(
            `API returned HTTP ${response.status} - ${details}`,
          );
        }
      } catch (error) {
        console.error("Failed to load academic years", error);
        setVerificationError(`Failed to load academic years: ${String(error)}`);
      }
    })();
  }, [selectedFaculty]);

  function handleToggleHistoryMode(enabled: boolean) {
    setIsHistoryMode(enabled);

    if (!enabled && currentAcademicYear && currentSemester) {
      setAcademicYear(currentAcademicYear);
      setSemester(currentSemester);
    }

    if (enabled) {
      setAcademicYear(
        (previous) => previous || availableAcademicYears[0] || "",
      );
      setSemester((previous) =>
        previous && availableSemesters.includes(previous)
          ? previous
          : (availableSemesters[0] ?? "1st Semester"),
      );
    }
  }

  useEffect(() => {
    if (!selectedFaculty || !academicYear) {
      return;
    }

    let isMounted = true;

    (async () => {
      try {
        const response = await fetch(
          `/api/admin/faculty/requirements/verification?facultyId=${selectedFaculty.id}&academicYear=${encodeURIComponent(
            academicYear,
          )}`,
          { credentials: "include" },
        );

        if (!response.ok) {
          return;
        }

        const data = await response.json();
        if (!isMounted) {
          return;
        }

        const availableSemestersFromResponse =
          (data.availableSemesters as SemesterOption[] | undefined) ??
          SEMESTER_OPTIONS;

        setAvailableSemesters(availableSemestersFromResponse);

        const selectedSem =
          (data.selectedSemester as SemesterOption | undefined) ??
          "1st Semester";

        if (!availableSemestersFromResponse.includes(semester)) {
          setSemester(selectedSem);
        }
      } catch (error) {
        console.error("Failed to refresh available semesters", error);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [selectedFaculty?.id, academicYear, semester]);

  async function onOpenModal() {
    if (!selectedFaculty) return;

    const useYear =
      isHistoryMode && academicYear
        ? academicYear
        : (currentAcademicYear ?? academicYear);
    const useSem =
      isHistoryMode && semester ? semester : (currentSemester ?? semester);

    if (!useYear || !useSem) {
      setVerificationError(
        "A school year and semester are required. Configure the current academic term or select a previous term.",
      );
      return;
    }

    await fetchVerificationStatus(selectedFaculty.id, useYear, useSem);
    setIsModalOpen(true);
  }

  return (
    <div>
      {facultyAccounts.length === 0 ? (
        <p className="mt-4 rounded-md border border-dashed border-slate-700 px-4 py-6 text-sm text-slate-500 dark:text-slate-400">
          Add faculty accounts first, then verify their required uploads.
        </p>
      ) : null}

      {facultyAccounts.length > 0 ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-2xl border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950/80 p-5 shadow-lg shadow-black/20">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-[#7a0000] dark:text-amber-300">
                  Current Academic Term
                </p>
                <h4 className="mt-2 text-lg font-semibold text-white">
                  {currentTermConfigured
                    ? "Current Academic Term"
                    : "Academic Term"}
                </h4>
              </div>
              {currentTermConfigured ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="uppercase tracking-[0.18em]"
                  onClick={() => handleToggleHistoryMode(!isHistoryMode)}
                >
                  {isHistoryMode
                    ? "Return to current term"
                    : "View previous terms"}
                </Button>
              ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Academic Year
                </p>
                <p className="mt-2 text-sm font-medium text-white">
                  {currentTermConfigured
                    ? (currentAcademicYear ?? academicYear)
                    : "Not configured"}
                </p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Semester
                </p>
                <p className="mt-2 text-sm font-medium text-white">
                  {currentTermConfigured
                    ? (currentSemester ?? semester)
                    : "Not configured"}
                </p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Status
                </p>
                <p className="mt-2 text-sm font-medium text-white">
                  {currentTermConfigured ? "Current 🟢" : "No active term"}
                </p>
              </div>
            </div>

            {!currentTermConfigured ? (
              <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                The current academic term is not configured. Select a previous
                term to review history.
              </p>
            ) : null}
          </div>

          <div className="rounded-xl border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950 p-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label
                  className="text-xs uppercase tracking-[0.18em] text-[#7a0000] dark:text-amber-300"
                  htmlFor="facultyFilter"
                >
                  Faculty
                </label>
                <select
                  id="facultyFilter"
                  className="mt-1 w-full rounded-md border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950 px-3 py-2 text-sm outline-none focus:ring focus:ring-amber-300/30"
                  value={selectedFaculty?.id ?? ""}
                  onChange={(event) => onSelectFaculty(event.target.value)}
                >
                  <option value="">Select faculty</option>
                  {facultyAccounts.map((faculty) => (
                    <option key={faculty.id} value={faculty.id}>
                      {faculty.fullName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <label
                      className="text-xs uppercase tracking-[0.18em] text-[#7a0000] dark:text-amber-300"
                      htmlFor="academicYearFilter"
                    >
                      Academic Year
                    </label>
                  </div>

                  {currentTermConfigured && !isHistoryMode ? (
                    <div className="mt-1 rounded-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 px-3 py-2 text-sm text-white">
                      S.Y. {currentAcademicYear}
                    </div>
                  ) : (
                    <select
                      id="academicYearFilter"
                      className="mt-1 w-full rounded-md border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950 px-3 py-2 text-sm outline-none focus:ring focus:ring-amber-300/30"
                      value={academicYear}
                      onChange={(event) => setAcademicYear(event.target.value)}
                      disabled={currentTermConfigured && !isHistoryMode}
                    >
                      {availableAcademicYears.length === 0 ? (
                        <option value="">No school year found</option>
                      ) : null}

                      {availableAcademicYears.map((year) => (
                        <option key={year} value={year}>
                          S.Y. {year}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div>
                <label
                  className="text-xs uppercase tracking-[0.18em] text-[#7a0000] dark:text-amber-300"
                  htmlFor="semesterFilter"
                >
                  Semester
                </label>
                {currentTermConfigured && !isHistoryMode ? (
                  <div className="mt-1 rounded-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 px-3 py-2 text-sm text-white">
                    {currentSemester}
                  </div>
                ) : (
                  <select
                    id="semesterFilter"
                    className="mt-1 w-full rounded-md border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950 px-3 py-2 text-sm outline-none focus:ring focus:ring-amber-300/30"
                    value={semester}
                    onChange={(event) =>
                      setSemester(event.target.value as SemesterOption)
                    }
                    disabled={
                      currentTermConfigured && !isHistoryMode
                        ? true
                        : !selectedFaculty ||
                          !academicYear ||
                          availableSemesters.length === 0
                    }
                  >
                    {SEMESTER_OPTIONS.map((term) => {
                      const disabled =
                        availableSemesters.length > 0
                          ? !availableSemesters.includes(term)
                          : true;

                      return (
                        <option key={term} value={term} disabled={disabled}>
                          {term}
                          {disabled ? " (no content yet)" : ""}
                        </option>
                      );
                    })}
                  </select>
                )}
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {availableSemesters.length === 0
                    ? `No semester content is available for ${
                        currentTermConfigured && !isHistoryMode
                          ? currentAcademicYear
                          : academicYear || "the selected school year"
                      }.`
                    : availableSemesters.length === 1
                      ? `${availableSemesters[0]} is available for ${academicYear}.`
                      : `Both semesters are available for ${academicYear}.`}
                </p>
                {currentTermConfigured ? (
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    {isHistoryMode
                      ? "Viewing previous term history."
                      : "Using the active term for verification."}
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    No active academic term is configured. Select a previous
                    term to review history.
                  </p>
                )}
              </div>
            </div>

            {verificationError ? (
              <p className="mt-3 rounded-md border border-red-700 bg-red-950/20 px-3 py-2 text-sm text-red-300">
                {verificationError}
              </p>
            ) : null}

            <div className="mt-4 flex justify-center">
              <Button
                type="button"
                variant="default"
                size="sm"
                disabled={
                  !selectedFaculty ||
                  !academicYear ||
                  availableSemesters.length === 0 ||
                  isLoadingVerification
                }
                onClick={onOpenModal}
              >
                {isLoadingVerification
                  ? "Loading requirements..."
                  : "Verify Requirements"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {isModalOpen && selectedFaculty ? (
        <RequirementsVerificationModal
          facultyName={selectedFaculty.fullName}
          facultyId={selectedFaculty.id}
          academicYear={academicYear}
          semester={semester}
          requirementStatus={verificationStatus}
          onClose={() => setIsModalOpen(false)}
        />
      ) : null}
    </div>
  );
}
