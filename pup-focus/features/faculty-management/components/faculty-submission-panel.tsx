"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_REQUIREMENTS,
  REQUIREMENT_LABEL,
  type RequirementCode,
} from "@/config/compliance";

const SEMESTER_OPTIONS = ["1st Semester", "2nd Semester"] as const;
const PANEL_VIEWS = ["submit", "history", "status", "guide"] as const;

type PanelView = (typeof PANEL_VIEWS)[number];
type HistorySubmissionStatus = "Pending" | "Validated" | "Rejected";

type RequirementStatus = {
  code: RequirementCode;
  status: "Validated" | "Rejected" | "Pending" | "Not Submitted";
  reviewedAt?: string;
  feedback?: string;
};

type PastSubmission = {
  id: string;
  academicYear: string;
  semester: (typeof SEMESTER_OPTIONS)[number];
  requirementCode: RequirementCode;
  status: HistorySubmissionStatus;
  submittedAt: string;
  remarks?: string;
};

type SubmissionFormState = {
  academicYear: string;
  semester: (typeof SEMESTER_OPTIONS)[number];
  requirementCode: RequirementCode;
  fileName: string;
  remarks: string;
};

function buildAcademicYears(count = 5): string[] {
  const now = new Date();
  const startYear =
    now.getMonth() + 1 >= 6 ? now.getFullYear() : now.getFullYear() - 1;

  return Array.from({ length: count }, (_, index) => {
    const yearStart = startYear - index;
    return `${yearStart}-${yearStart + 1}`;
  });
}

function requirementStatusStyles(
  status: "Validated" | "Rejected" | "Pending" | "Not Submitted",
): string {
  if (status === "Validated")
    return "bg-green-900/30 text-green-400 border-green-800";
  if (status === "Rejected") return "bg-red-900/30 text-red-400 border-red-800";
  if (status === "Not Submitted")
    return "bg-slate-900/30 text-slate-400 border-slate-700";
  return "bg-yellow-900/30 text-yellow-400 border-yellow-800";
}

export function FacultySubmissionPanel({
  facultyName,
}: {
  facultyName?: string | null;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const academicYears = useMemo(() => buildAcademicYears(), []);
  const [activeView, setActiveView] = useState<PanelView>("submit");
  const [form, setForm] = useState<SubmissionFormState>({
    academicYear: academicYears[0] ?? "",
    semester: "1st Semester",
    requirementCode: DEFAULT_REQUIREMENTS[0],
    fileName: "",
    remarks: "",
  });
  const [submissionMessage, setSubmissionMessage] = useState<string | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [historyAcademicYear, setHistoryAcademicYear] = useState(
    academicYears[0] ?? "",
  );
  const [historySemester, setHistorySemester] = useState<
    (typeof SEMESTER_OPTIONS)[number] | "All"
  >("All");
  const [pastSubmissions, setPastSubmissions] = useState<PastSubmission[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [requirementStatuses, setRequirementStatuses] = useState<
    RequirementStatus[]
  >([]);
  const [statusCounts, setStatusCounts] = useState<{
    total: number;
    validated: number;
    rejected: number;
    pending: number;
    notSubmitted: number;
  } | null>(null);
  const [isLoadingStatuses, setIsLoadingStatuses] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Fetch real requirement statuses on mount and periodically refresh
  useEffect(() => {
    async function fetchStatuses() {
      try {
        setIsLoadingStatuses(true);
        setStatusError(null);
        const response = await fetch("/api/faculty/submissions/status");
        if (response.ok) {
          const data = await response.json();
          setRequirementStatuses(data.requirementStatuses || []);
          setStatusCounts(data.counts || null);
        } else {
          setStatusError("Failed to load requirement statuses");
        }
      } catch (error) {
        setStatusError("Error loading requirement statuses");
      } finally {
        setIsLoadingStatuses(false);
      }
    }

    async function fetchHistory() {
      try {
        setIsLoadingHistory(true);
        setHistoryError(null);
        const response = await fetch("/api/faculty/submissions/history");
        if (!response.ok) {
          setHistoryError("Failed to load submission history");
          return;
        }

        const data = await response.json();
        setPastSubmissions(data.submissions || []);
      } catch (error) {
        setHistoryError("Error loading submission history");
      } finally {
        setIsLoadingHistory(false);
      }
    }

    // Initial load
    fetchStatuses();
    fetchHistory();

    // Refresh statuses every 10 seconds to catch admin approvals
    const statusInterval = setInterval(fetchStatuses, 10000);

    return () => clearInterval(statusInterval);
  }, []);

  const filteredPastSubmissions = useMemo(() => {
    return pastSubmissions.filter((submission) => {
      const matchesYear = submission.academicYear === historyAcademicYear;
      const matchesSemester =
        historySemester === "All" || submission.semester === historySemester;
      return matchesYear && matchesSemester;
    });
  }, [historyAcademicYear, historySemester, pastSubmissions]);

  function updateField<K extends keyof SubmissionFormState>(
    key: K,
    value: SubmissionFormState[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setSubmissionMessage(null);

    try {
      const fileInput = fileInputRef.current;
      const file = fileInput?.files?.[0];

      if (!file) {
        setSubmissionMessage("Please select a file to submit.");
        return;
      }

      // Create FormData with file and metadata
      const formData = new FormData();
      formData.append("file", file);
      formData.append("academicYear", form.academicYear);
      formData.append("semester", form.semester);
      formData.append("requirementCode", form.requirementCode);
      formData.append("remarks", form.remarks);

      // Call the submission API
      const response = await fetch("/api/faculty/submissions/create", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        setSubmissionMessage(
          `Error: ${errorData.error || "Failed to submit requirement"}`,
        );
        return;
      }

      const result = await response.json();

      setSubmissionMessage(
        `✓ Successfully submitted ${REQUIREMENT_LABEL[form.requirementCode]} for S.Y. ${form.academicYear} ${form.semester}. Reference ID: ${result.submissionId.slice(0, 8)}...`,
      );

      // Reset form
      setForm((prev) => ({
        ...prev,
        requirementCode: DEFAULT_REQUIREMENTS[0],
        fileName: "",
        remarks: "",
      }));

      // Clear file input
      if (fileInput) {
        fileInput.value = "";
      }
    } catch (error) {
      setSubmissionMessage(
        `Error: ${error instanceof Error ? error.message : "An unexpected error occurred"}`,
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)] h-full">
      <aside className="rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-lg sticky top-28 self-start">
        {/* Account card at top of sidebar */}
        <div className="mb-4">
          <div className="rounded-xl bg-slate-950 p-3">
            <p className="text-sm text-slate-400">Faculty</p>
            <p className="mt-1 font-semibold text-slate-100">
              {facultyName ?? "Faculty"}
            </p>
          </div>
        </div>
        <p className="px-2 text-sm uppercase tracking-[0.22em] text-amber-300">
          Menu
        </p>
        <div className="mt-4 space-y-2">
          {[
            ["submit", "Submit Requirement", "Upload a new requirement"],
            ["history", "Past Submissions", "Filter by S.Y. and semester"],
            ["status", "Requirement Status", "View validation status"],
            ["guide", "Submission Guide", "Quick steps for uploading"],
          ].map(([key, label, description]) => {
            const isActive = activeView === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveView(key as PanelView)}
                className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                  isActive
                    ? "border-amber-400 bg-amber-400/10"
                    : "border-slate-700 bg-slate-950/60 hover:border-slate-500"
                }`}
              >
                <p className="font-semibold text-slate-100">{label}</p>
                <p className="mt-1 text-sm text-slate-400">{description}</p>
              </button>
            );
          })}
        </div>
      </aside>

      <div className="space-y-6 h-full overflow-y-auto">
        {activeView === "submit" && (
          <article className="rounded-2xl border border-slate-700 bg-slate-900 p-8 shadow-lg min-h-[600px]">
            <p className="text-sm uppercase tracking-[0.22em] text-amber-300">
              Faculty Workspace
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-100">
              Submit a Requirement
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Choose the school year, semester, and document you want to submit.
            </p>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label
                    className="text-sm text-slate-300"
                    htmlFor="academicYear"
                  >
                    School Year
                  </label>
                  <select
                    id="academicYear"
                    className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:ring focus:ring-amber-300/30"
                    value={form.academicYear}
                    onChange={(event) =>
                      updateField("academicYear", event.target.value)
                    }
                  >
                    {academicYears.map((year) => (
                      <option key={year} value={year}>
                        S.Y. {year}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm text-slate-300" htmlFor="semester">
                    Semester
                  </label>
                  <select
                    id="semester"
                    className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:ring focus:ring-amber-300/30"
                    value={form.semester}
                    onChange={(event) =>
                      updateField(
                        "semester",
                        event.target.value as SubmissionFormState["semester"],
                      )
                    }
                  >
                    {SEMESTER_OPTIONS.map((semester) => (
                      <option key={semester} value={semester}>
                        {semester}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label
                  className="text-sm text-slate-300"
                  htmlFor="requirementCode"
                >
                  Requirement Type
                </label>
                <select
                  id="requirementCode"
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:ring focus:ring-amber-300/30"
                  value={form.requirementCode}
                  onChange={(event) =>
                    updateField(
                      "requirementCode",
                      event.target.value as RequirementCode,
                    )
                  }
                >
                  {DEFAULT_REQUIREMENTS.map((code) => (
                    <option key={code} value={code}>
                      {REQUIREMENT_LABEL[code]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm text-slate-300" htmlFor="fileName">
                  File to Submit
                </label>
                <input
                  ref={fileInputRef}
                  id="fileName"
                  type="file"
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-300 outline-none file:mr-4 file:rounded-md file:border-0 file:bg-amber-500 file:px-4 file:py-2 file:text-sm file:font-medium file:text-slate-950 hover:file:bg-amber-400"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    updateField("fileName", file?.name ?? "");
                  }}
                />
                <p className="mt-1 text-xs text-slate-500">
                  Accepted files: PDF, Word documents, and images.
                </p>
              </div>

              <div>
                <label className="text-sm text-slate-300" htmlFor="remarks">
                  Remarks
                </label>
                <textarea
                  id="remarks"
                  rows={4}
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:ring focus:ring-amber-300/30"
                  placeholder="Add short notes for the reviewer"
                  value={form.remarks}
                  onChange={(event) =>
                    updateField("remarks", event.target.value)
                  }
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-slate-700 bg-slate-950/60 px-4 py-3 text-sm text-slate-400">
                <span>Submission will be queued for review after upload.</span>
                <Button type="submit" disabled={isSubmitting || !form.fileName}>
                  {isSubmitting ? "Submitting..." : "Submit Requirement"}
                </Button>
              </div>
            </form>

            {submissionMessage ? (
              <p className="mt-4 rounded-md border border-emerald-700 bg-emerald-950/20 px-3 py-2 text-sm text-emerald-300">
                {submissionMessage}
              </p>
            ) : null}
          </article>
        )}

        {activeView === "status" && (
          <article className="rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-lg">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="text-sm uppercase tracking-[0.22em] text-amber-300">
                  Requirement Status
                </p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-100">
                  Validation Status
                </h3>
                <p className="mt-2 text-sm text-slate-400">
                  Track the status of all your requirement submissions.
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  setIsLoadingStatuses(true);
                  try {
                    const response = await fetch(
                      "/api/faculty/submissions/status",
                    );
                    if (response.ok) {
                      const data = await response.json();
                      setRequirementStatuses(data.requirementStatuses || []);
                      setStatusCounts(data.counts || null);
                    }
                  } catch (error) {
                    console.error("Refresh error:", error);
                  } finally {
                    setIsLoadingStatuses(false);
                  }
                }}
                disabled={isLoadingStatuses}
                className="whitespace-nowrap rounded-md bg-amber-600 px-3 py-2 text-xs text-white hover:bg-amber-700 disabled:opacity-50"
                title="Refresh status (auto-refreshes every 10 seconds)"
              >
                {isLoadingStatuses ? "⟳ Refreshing..." : "⟳ Refresh"}
              </button>
            </div>

            {statusCounts && !isLoadingStatuses && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <div className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2">
                  <p className="text-xs text-slate-400">Submitted</p>
                  <p className="mt-1 text-lg font-semibold text-slate-100">
                    {statusCounts.validated + statusCounts.pending}/
                    {statusCounts.total}
                  </p>
                </div>
                <div className="rounded-lg border border-green-700 bg-green-900/20 px-3 py-2">
                  <p className="text-xs text-green-400">Validated</p>
                  <p className="mt-1 text-lg font-semibold text-green-300">
                    {statusCounts.validated}
                  </p>
                </div>
                <div className="rounded-lg border border-yellow-700 bg-yellow-900/20 px-3 py-2">
                  <p className="text-xs text-yellow-400">Pending</p>
                  <p className="mt-1 text-lg font-semibold text-yellow-300">
                    {statusCounts.pending}
                  </p>
                </div>
                <div className="rounded-lg border border-red-700 bg-red-900/20 px-3 py-2">
                  <p className="text-xs text-red-400">Rejected</p>
                  <p className="mt-1 text-lg font-semibold text-red-300">
                    {statusCounts.rejected}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-600 bg-slate-800/30 px-3 py-2">
                  <p className="text-xs text-slate-400">Not Submitted</p>
                  <p className="mt-1 text-lg font-semibold text-slate-300">
                    {statusCounts.notSubmitted}
                  </p>
                </div>
              </div>
            )}

            <div className="mt-6 space-y-3">
              {isLoadingStatuses ? (
                <p className="text-sm text-slate-400">
                  Loading requirement statuses...
                </p>
              ) : statusError ? (
                <p className="text-sm text-red-400">{statusError}</p>
              ) : requirementStatuses.length === 0 ? (
                <p className="text-sm text-slate-400">
                  No submissions yet. Submit requirements to see their
                  validation status.
                </p>
              ) : (
                requirementStatuses.map((req) => (
                  <article
                    key={req.code}
                    className="rounded-xl border border-slate-700 bg-slate-950 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="font-medium text-slate-100">
                          {REQUIREMENT_LABEL[req.code]}
                        </p>
                        {req.feedback && (
                          <p className="mt-2 text-sm text-slate-300">
                            {req.feedback}
                          </p>
                        )}
                        {req.reviewedAt && (
                          <p className="mt-1 text-xs text-slate-500">
                            Reviewed on {req.reviewedAt}
                          </p>
                        )}
                      </div>
                      <span
                        className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${requirementStatusStyles(req.status)}`}
                      >
                        {req.status === "Validated"
                          ? "✓ Validated"
                          : req.status === "Rejected"
                            ? "✗ Rejected"
                            : req.status === "Not Submitted"
                              ? "○ Not Submitted"
                              : "⏳ Pending"}
                      </span>
                    </div>
                  </article>
                ))
              )}
            </div>
          </article>
        )}

        {activeView === "guide" && (
          <article className="rounded-2xl border border-slate-700 bg-slate-900 p-8 shadow-lg min-h-[600px]">
            <h3 className="text-lg font-semibold text-slate-100">
              Submission Guide
            </h3>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <div className="rounded-xl border border-slate-700 bg-slate-950 p-4">
                <p className="font-medium text-slate-100">1. Select the term</p>
                <p className="mt-1 text-slate-400">
                  Match the school year and semester for the document you are
                  uploading.
                </p>
              </div>
              <div className="rounded-xl border border-slate-700 bg-slate-950 p-4">
                <p className="font-medium text-slate-100">
                  2. Choose the requirement
                </p>
                <p className="mt-1 text-slate-400">
                  Pick the requirement type so the reviewer can validate it
                  correctly.
                </p>
              </div>
              <div className="rounded-xl border border-slate-700 bg-slate-950 p-4">
                <p className="font-medium text-slate-100">3. Attach the file</p>
                <p className="mt-1 text-slate-400">
                  Upload a PDF, Word file, or image, then submit it for review.
                </p>
              </div>
            </div>
          </article>
        )}

        {activeView === "history" && (
          <article className="rounded-2xl border border-slate-700 bg-slate-900 p-8 shadow-lg min-h-[600px]">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.22em] text-amber-300">
                  Submission History
                </p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-100">
                  Past Submissions
                </h3>
                <p className="mt-2 text-sm text-slate-400">
                  Filter your submitted requirements by school year and
                  semester.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label
                    className="text-sm text-slate-300"
                    htmlFor="historyAcademicYear"
                  >
                    School Year
                  </label>
                  <select
                    id="historyAcademicYear"
                    className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:ring focus:ring-amber-300/30"
                    value={historyAcademicYear}
                    onChange={(event) =>
                      setHistoryAcademicYear(event.target.value)
                    }
                  >
                    {academicYears.map((year) => (
                      <option key={year} value={year}>
                        S.Y. {year}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    className="text-sm text-slate-300"
                    htmlFor="historySemester"
                  >
                    Semester
                  </label>
                  <select
                    id="historySemester"
                    className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:ring focus:ring-amber-300/30"
                    value={historySemester}
                    onChange={(event) =>
                      setHistorySemester(
                        event.target.value as
                          | (typeof SEMESTER_OPTIONS)[number]
                          | "All",
                      )
                    }
                  >
                    <option value="All">All Semesters</option>
                    {SEMESTER_OPTIONS.map((semester) => (
                      <option key={semester} value={semester}>
                        {semester}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {isLoadingHistory ? (
                <p className="text-sm text-slate-400">
                  Loading submission history...
                </p>
              ) : historyError ? (
                <p className="text-sm text-red-400">{historyError}</p>
              ) : filteredPastSubmissions.length > 0 ? (
                filteredPastSubmissions.map((submission) => (
                  <article
                    key={submission.id}
                    className="rounded-xl border border-slate-700 bg-slate-950 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-100">
                          {REQUIREMENT_LABEL[submission.requirementCode]}
                        </p>
                        <p className="mt-1 text-sm text-slate-400">
                          S.Y. {submission.academicYear} · {submission.semester}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Submitted on {submission.submittedAt}
                        </p>
                      </div>

                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-medium ${requirementStatusStyles(submission.status)}`}
                      >
                        {submission.status === "Validated"
                          ? "✓ Validated"
                          : submission.status === "Rejected"
                            ? "✗ Rejected"
                            : "⏳ Pending"}
                      </span>
                    </div>

                    <p className="mt-3 text-sm text-slate-300">
                      {submission.remarks || "No remarks provided."}
                    </p>
                  </article>
                ))
              ) : (
                <p className="rounded-xl border border-dashed border-slate-700 bg-slate-950 px-4 py-6 text-sm text-slate-400">
                  No past submissions found for the selected school year and
                  semester.
                </p>
              )}
            </div>
          </article>
        )}
      </div>
    </section>
  );
}
