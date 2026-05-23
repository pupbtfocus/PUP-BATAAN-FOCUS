"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/shared/brand-mark";
import {
  DEFAULT_REQUIREMENTS,
  REQUIREMENT_LABEL,
  REQUIREMENT_CODE,
  type RequirementCode,
} from "@/config/compliance";

const SEMESTER_OPTIONS = ["1st Semester", "2nd Semester"] as const;
const PANEL_VIEWS = ["dashboard", "submit", "history", "status"] as const;
const LOGIN_PAGE_IMAGES = [
  "/images/attachments/IMG_9399.jpeg",
  "/images/attachments/IMG_9402.jpeg",
];
const CALENDAR_HIGHLIGHTS = [
  {
    term: "First Semester, A.Y. 2025-2026",
    date: "September 1",
    event: "First Semester classes start",
  },
  {
    term: "First Semester, A.Y. 2025-2026",
    date: "September 30",
    event: "Deadline for ACE forms",
  },
  {
    term: "First Semester, A.Y. 2025-2026",
    date: "January 26",
    event: "Submission of grade sheets to the Dean or Director",
  },
  {
    term: "First Semester, A.Y. 2025-2026",
    date: "January 28",
    event: "Submission of grade sheets to the University Registrar",
  },
  {
    term: "Second Semester, A.Y. 2025-2026",
    date: "February 9",
    event: "Second Semester classes start",
  },
  {
    term: "Second Semester, A.Y. 2025-2026",
    date: "June 25-26",
    event: "Submission of grade sheets to the Dean/Director and Registrar",
  },
  {
    term: "Second Semester, A.Y. 2025-2026",
    date: "February 6-7",
    event: "All Year Level Online Registration",
  },
  {
    term: "Second Semester, A.Y. 2025-2026",
    date: "February 9",
    event: "Second Semester classes start",
  },
  {
    term: "Second Semester, A.Y. 2025-2026",
    date: "February 9-March 6",
    event: "Adjustment period",
  },
  {
    term: "Second Semester, A.Y. 2025-2026",
    date: "March 2-31",
    event:
      "Online filing of Application for Year-End Graduation and proof of payment upload",
  },
  {
    term: "Second Semester, A.Y. 2025-2026",
    date: "April 2-5",
    event: "Maundy Thursday, Good Friday, Black Saturday",
  },
  {
    term: "Second Semester, A.Y. 2025-2026",
    date: "April 6-11",
    event: "Mid-Term and Departmental Examinations",
  },
  {
    term: "Second Semester, A.Y. 2025-2026",
    date: "May 25-30",
    event: "Final and Departmental Examinations of Graduating Students",
  },
  {
    term: "Summer Term, A.Y. 2025-2026",
    date: "June 25-27",
    event: "First to Fifth Year Online Registration",
  },
  {
    term: "Summer Term, A.Y. 2025-2026",
    date: "June 29",
    event: "Summer Classes start",
  },
  {
    term: "Summer Term, A.Y. 2025-2026",
    date: "August 6-8",
    event: "Final Examinations",
  },
  {
    term: "Summer Term, A.Y. 2025-2026",
    date: "August 20",
    event: "Submission of Summer Term grade sheets to the University Registrar",
  },
] as const;

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

type SubmissionWindowState = {
  isConfigured: boolean;
  isOpen: boolean;
  today: string;
  currentTime: string;
  startDate: string | null;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  startTimeLabel?: string | null;
  endTimeLabel?: string | null;
  currentTimeLabel?: string | null;
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

function requirementStatusStyles(status: RequirementStatus["status"]): string {
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
  const [activeView, setActiveView] = useState<PanelView>("dashboard");
  const [form, setForm] = useState<SubmissionFormState>({
    academicYear: academicYears[0] ?? "",
    semester: "1st Semester",
    requirementCode: REQUIREMENT_CODE.MIDTERM_PACKAGE as RequirementCode,
    fileName: "",
    remarks: "",
  });
  const [submissionMessage, setSubmissionMessage] = useState<string | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [historyAcademicYear, setHistoryAcademicYear] = useState("2025-2026");
  const [historySemester, setHistorySemester] = useState<
    (typeof SEMESTER_OPTIONS)[number] | "All"
  >("1st Semester");
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
  const [submissionWindow, setSubmissionWindow] =
    useState<SubmissionWindowState | null>(null);
  const [isLoadingSubmissionWindow, setIsLoadingSubmissionWindow] =
    useState(true);

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
      } catch {
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
      } catch {
        setHistoryError("Error loading submission history");
      } finally {
        setIsLoadingHistory(false);
      }
    }

    async function fetchSubmissionWindow() {
      setIsLoadingSubmissionWindow(true);
      try {
        const response = await fetch("/api/faculty/submissions/window");
        if (response.ok) {
          const data = (await response.json()) as SubmissionWindowState;
          setSubmissionWindow(data);
        }
      } catch {
        // Keep UI usable even if window info fails to load.
      } finally {
        setIsLoadingSubmissionWindow(false);
      }
    }

    fetchStatuses();
    fetchHistory();
    fetchSubmissionWindow();
    // Read view from URL on mount
    try {
      const params = new URLSearchParams(window.location.search);
      const view = params.get("view");
      if (view && (PANEL_VIEWS as readonly string[]).includes(view)) {
        setActiveView(view as PanelView);
      }
    } catch {
      // ignore
    }
  }, []);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function navigateToView(view: PanelView) {
    setActiveView(view);
    try {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.set("view", view);
      router.replace(`${pathname}?${params.toString()}`);
    } catch {
      // fallback
      router.replace(pathname);
    }
  }

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

  function getRequirementStatus(code: RequirementCode) {
    return requirementStatuses.find((r) => r.code === code)?.status;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setSubmissionMessage(null);

    try {
      if (
        isLoadingSubmissionWindow ||
        !submissionWindow ||
        !submissionWindow.isOpen
      ) {
        setSubmissionMessage(
          submissionWindow?.isConfigured
            ? `Error: Submission is currently closed. Allowed schedule is ${submissionWindow.startDate} ${submissionWindow.startTimeLabel ?? submissionWindow.startTime ?? ""} to ${submissionWindow.endDate} ${submissionWindow.endTimeLabel ?? submissionWindow.endTime ?? ""}.`
            : "Error: Cannot submit requirements because admin has not set submission dates yet.",
        );
        return;
      }

      const fileInput = fileInputRef.current;
      const file = fileInput?.files?.[0];

      if (!file) {
        setSubmissionMessage("Please select a file to submit.");
        return;
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("academicYear", form.academicYear);
      formData.append("semester", form.semester);
      formData.append("requirementCode", form.requirementCode);
      formData.append("remarks", form.remarks);

      const response = await fetch("/api/faculty/submissions/create", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        try {
          const errorData = await response.json();
          setSubmissionMessage(
            `Error: ${errorData.error || "Failed to submit requirement"}`,
          );
        } catch {
          setSubmissionMessage(
            `Error: Failed to submit requirement (HTTP ${response.status})`,
          );
        }
        return;
      }

      const result = await response.json();

      setSubmissionMessage(
        `✓ Successfully submitted ${REQUIREMENT_LABEL[form.requirementCode]} for S.Y. ${form.academicYear} ${form.semester}. Reference ID: ${String(result.submissionId).slice(0, 8)}...`,
      );

      // Optimistically mark this requirement as pending so the UI disables re-submission
      setRequirementStatuses((prev) => {
        const found = prev.find((p) => p.code === form.requirementCode);
        if (found) {
          return prev.map((p) =>
            p.code === form.requirementCode ? { ...p, status: "Pending" } : p,
          );
        }
        return [...prev, { code: form.requirementCode, status: "Pending" }];
      });

      setForm((prev) => ({
        ...prev,
        requirementCode: DEFAULT_REQUIREMENTS[0],
        fileName: "",
        remarks: "",
      }));

      if (fileInput) fileInput.value = "";
    } catch (error) {
      setSubmissionMessage(
        `Error: ${error instanceof Error ? error.message : "An unexpected error occurred"}`,
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const isSubmissionAvailable =
    !isLoadingSubmissionWindow && Boolean(submissionWindow?.isOpen);

  return (
    <div className="relative flex min-h-full w-full items-stretch gap-0">
      <aside className="fixed left-0 top-16 h-[calc(100vh-4rem)] w-72 overflow-y-auto rounded-r-2xl border border-l-0 border-slate-700 bg-slate-900 p-5 shadow-lg">
        {/* 'Faculty Workspace' label removed per request */}
        {/* Removed 'Faculty Portal' heading and description per request */}

        <div className="my-6 rounded-xl bg-[var(--card)] p-4 text-[var(--accent)] flex flex-col items-center">
          <p className="mt-2 font-semibold text-white text-center">
            {facultyName ?? "Faculty"}
          </p>

          <div className="my-2 h-px w-full bg-slate-700" />

          <p className="mt-1 text-xs uppercase tracking-[0.12em] text-[var(--accent)] text-center">
            Faculty
          </p>
        </div>

        <nav className="mt-6 space-y-2">
          {[
            ["dashboard", "Dashboard"],
            ["submit", "Submit Requirement"],
            ["history", "Past Submissions"],
            ["status", "Requirement Status"],
          ].map(([key, label]) => {
            const isActive = activeView === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => navigateToView(key as PanelView)}
                className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                  isActive
                    ? "border-amber-400 bg-amber-400/10"
                    : "border-slate-700 bg-slate-950/60 hover:border-slate-500"
                }`}
              >
                <p
                  className={`font-semibold ${
                    isActive ? "text-amber-300" : "text-slate-100"
                  }`}
                >
                  {label}
                </p>
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="ml-72 flex min-h-full w-[calc(100%-18rem)] flex-col">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-l border-slate-700 bg-slate-900 shadow-lg">
          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            {activeView !== "dashboard" ? (
              <div className="mb-6">
                <div className="inline-block w-max rounded-xl border border-slate-700 bg-slate-950 px-4 py-2">
                  <h3 className="text-lg font-semibold text-amber-300">
                    {activeView === "submit"
                      ? "Submit a Requirement"
                      : activeView === "history"
                        ? "Past Submissions"
                        : "Validation Status"}
                  </h3>
                </div>
              </div>
            ) : null}
            {activeView === "dashboard" && (
              <article className="relative -m-6 h-[calc(100vh-4rem)] w-[calc(100%+3rem)] overflow-hidden p-0">
                <div className="relative h-full overflow-hidden bg-[#4d0000]/80">
                  <Image
                    src={LOGIN_PAGE_IMAGES[0]}
                    alt="PUP Bataan login background"
                    fill
                    sizes="100vw"
                    className="object-cover"
                    style={{ animation: "backgroundFadeA 16s infinite linear" }}
                  />
                  <Image
                    src={LOGIN_PAGE_IMAGES[1]}
                    alt="PUP Bataan login background"
                    fill
                    sizes="100vw"
                    className="object-cover"
                    style={{ animation: "backgroundFadeB 16s infinite linear" }}
                  />
                  <div className="absolute inset-0 bg-[#4d0000]/70" />

                  <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
                    <BrandMark
                      size={90}
                      className="rounded-full shadow-lg shadow-black/20"
                    />
                    <p className="mt-4 text-xs uppercase tracking-[0.28em] text-[#ffd700]">
                      Polytechnic University of the Philippines - Bataan Campus
                    </p>
                    {/* Dashboard title removed */}
                  </div>
                </div>
              </article>
            )}

            {activeView === "submit" && (
              <article className="p-8 pt-0">
                {isSubmissionAvailable ? (
                  <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label
                          className="text-xs uppercase tracking-[0.18em] text-amber-300"
                          htmlFor="academicYear"
                        >
                          School Year
                        </label>
                        <select
                          id="academicYear"
                          className="mt-0 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:ring focus:ring-amber-300/30"
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
                        <label
                          className="text-xs uppercase tracking-[0.18em] text-amber-300"
                          htmlFor="semester"
                        >
                          Semester
                        </label>
                        <select
                          id="semester"
                          className="mt-0 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:ring focus:ring-amber-300/30"
                          value={form.semester}
                          onChange={(event) =>
                            updateField(
                              "semester",
                              event.target
                                .value as SubmissionFormState["semester"],
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
                        className="text-xs uppercase tracking-[0.18em] text-amber-300"
                        htmlFor="requirementCode"
                      >
                        Requirement Type
                      </label>
                      <select
                        id="requirementCode"
                        className="mt-0 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:ring focus:ring-amber-300/30"
                        value={form.requirementCode}
                        onChange={(event) =>
                          updateField(
                            "requirementCode",
                            event.target.value as RequirementCode,
                          )
                        }
                      >
                        {DEFAULT_REQUIREMENTS.map((code) => {
                          const status = getRequirementStatus(code);
                          const disabled =
                            status &&
                            status !== "Not Submitted" &&
                            status !== "Rejected";
                          return (
                            <option key={code} value={code} disabled={disabled}>
                              {REQUIREMENT_LABEL[code]}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div>
                      <label
                        className="text-xs uppercase tracking-[0.18em] text-amber-300"
                        htmlFor="fileName"
                      >
                        File to Submit
                      </label>
                      <input
                        ref={fileInputRef}
                        id="fileName"
                        type="file"
                        className="mt-0 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-300 outline-none file:mr-4 file:rounded-md file:border-0 file:bg-amber-500 file:px-4 file:py-2 file:text-sm file:font-medium file:text-slate-950 hover:file:bg-amber-400 disabled:opacity-50"
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          updateField("fileName", file?.name ?? "");
                        }}
                        disabled={(() => {
                          const s = getRequirementStatus(form.requirementCode);
                          return s === "Pending" || s === "Validated";
                        })()}
                      />
                      <p className="mt-1 text-xs text-slate-400">
                        Accepted files: PDF, Word documents, and images.
                      </p>
                    </div>

                    <div>
                      <label
                        className="text-xs uppercase tracking-[0.18em] text-amber-300"
                        htmlFor="remarks"
                      >
                        Remarks
                      </label>
                      <textarea
                        id="remarks"
                        rows={4}
                        className="mt-0 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:ring focus:ring-amber-300/30"
                        placeholder="Add short notes for the reviewer"
                        value={form.remarks}
                        onChange={(event) =>
                          updateField("remarks", event.target.value)
                        }
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-slate-700 bg-slate-950/60 px-4 py-3 text-sm text-slate-400">
                      <span>
                        Submission will be queued for review after upload.
                      </span>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => setIsGuideOpen(true)}
                        >
                          Submission Guide
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => setIsCalendarOpen(true)}
                        >
                          University Calendar
                        </Button>
                        <Button
                          type="submit"
                          disabled={
                            isSubmitting ||
                            !form.fileName ||
                            (submissionWindow
                              ? !submissionWindow.isOpen
                              : false) ||
                            (() => {
                              const s = getRequirementStatus(
                                form.requirementCode,
                              );
                              return s === "Pending" || s === "Validated";
                            })()
                          }
                        >
                          {isSubmitting
                            ? "Submitting..."
                            : "Submit Requirement"}
                        </Button>
                      </div>
                    </div>
                  </form>
                ) : (
                  <div className="mt-6 flex min-h-[60vh] items-center justify-center rounded-2xl border border-amber-700/60 bg-gradient-to-br from-amber-950/25 via-slate-950 to-slate-900 p-8">
                    <div className="w-full max-w-2xl rounded-2xl border border-amber-500/30 bg-slate-950/80 p-8 text-center shadow-2xl">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-amber-500/40 bg-amber-500/15 text-amber-300">
                        <svg
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                          className="h-8 w-8"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 9v4m0 4h.01M4.93 19h14.14c1.54 0 2.5-1.67 1.73-3L13.73 3c-.77-1.33-2.69-1.33-3.46 0L3.2 16c-.77 1.33.19 3 1.73 3z"
                          />
                        </svg>
                      </div>

                      <h3 className="mt-5 text-2xl font-semibold text-slate-100">
                        Submission Is Currently Unavailable
                      </h3>

                      {isLoadingSubmissionWindow ? (
                        <p className="mt-3 text-sm text-slate-300">
                          Checking submission availability...
                        </p>
                      ) : submissionWindow?.isConfigured ? (
                        <p className="mt-3 text-sm text-slate-300">
                          The submission window is closed. Allowed schedule is
                          <span className="font-semibold text-amber-300">
                            {" "}
                            {submissionWindow.startDate}{" "}
                            {submissionWindow.startTimeLabel ??
                              submissionWindow.startTime}{" "}
                            to {submissionWindow.endDate}{" "}
                            {submissionWindow.endTimeLabel ??
                              submissionWindow.endTime}
                          </span>
                          .
                        </p>
                      ) : (
                        <p className="mt-3 text-sm text-slate-300">
                          Admin has not set the submission start and end dates
                          yet. Please wait until the schedule is available.
                        </p>
                      )}

                      {submissionWindow?.today ? (
                        <p className="mt-4 text-xs uppercase tracking-[0.2em] text-slate-500">
                          Now: {submissionWindow.today}{" "}
                          {submissionWindow.currentTimeLabel ??
                            submissionWindow.currentTime}
                        </p>
                      ) : null}
                    </div>
                  </div>
                )}

                {submissionMessage ? (
                  <p className="mt-4 rounded-md border border-emerald-700 bg-emerald-950/20 px-3 py-2 text-sm text-emerald-300">
                    {submissionMessage}
                  </p>
                ) : null}

                {isGuideOpen ? (
                  <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="submission-guide-title"
                    onClick={() => setIsGuideOpen(false)}
                  >
                    <div
                      className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm uppercase tracking-[0.22em] text-amber-300">
                            Submission Guide
                          </p>
                          <h3
                            id="submission-guide-title"
                            className="mt-2 text-2xl font-semibold text-slate-100"
                          >
                            Quick Steps for Uploading
                          </h3>
                        </div>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => setIsGuideOpen(false)}
                        >
                          Close
                        </Button>
                      </div>

                      <div className="mt-5 space-y-3 text-sm text-slate-300">
                        <div className="rounded-xl border border-slate-700 bg-slate-950 p-4">
                          <p className="font-medium text-slate-100">
                            1. Select the term
                          </p>
                          <p className="mt-1 text-slate-400">
                            Match the school year and semester for the document
                            you are uploading.
                          </p>
                        </div>
                        <div className="rounded-xl border border-slate-700 bg-slate-950 p-4">
                          <p className="font-medium text-slate-100">
                            2. Choose the requirement
                          </p>
                          <p className="mt-1 text-slate-400">
                            Pick the requirement type so the reviewer can
                            validate it correctly.
                          </p>
                        </div>
                        <div className="rounded-xl border border-slate-700 bg-slate-950 p-4">
                          <p className="font-medium text-slate-100">
                            3. Attach the file
                          </p>
                          <p className="mt-1 text-slate-400">
                            Upload a PDF, Word file, or image, then submit it
                            for review.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {isCalendarOpen ? (
                  <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="calendar-popup-title"
                    onClick={() => setIsCalendarOpen(false)}
                  >
                    <div
                      className="w-full max-w-4xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="flex items-start justify-between gap-4 border-b border-slate-700 px-6 py-5">
                        <div>
                          <p className="text-sm uppercase tracking-[0.22em] text-amber-300">
                            Submission Calendar
                          </p>
                          <h3
                            id="calendar-popup-title"
                            className="mt-2 text-2xl font-semibold text-slate-100"
                          >
                            PUP University Calendar
                          </h3>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <a
                            href="https://www.pup.edu.ph/about/calendar"
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-md border border-slate-600 px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-amber-400 hover:text-amber-300"
                          >
                            Open in browser
                          </a>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsCalendarOpen(false)}
                            className="rounded-md border border-slate-600 px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-amber-400 hover:text-amber-300"
                          >
                            Close
                          </Button>
                        </div>
                      </div>

                      <div className="max-h-[75vh] overflow-y-auto bg-slate-950 p-4">
                        <div className="grid gap-3 md:grid-cols-2">
                          {CALENDAR_HIGHLIGHTS.map((item, index) => (
                            <article
                              key={`${item.term}-${item.date}-${index}`}
                              className="rounded-xl border border-slate-700 bg-slate-900 p-4"
                            >
                              <p className="text-xs uppercase tracking-[0.2em] text-amber-300">
                                {item.term}
                              </p>
                              <p className="mt-2 text-lg font-semibold text-slate-100">
                                {item.date}
                              </p>
                              <p className="mt-1 text-sm text-slate-400">
                                {item.event}
                              </p>
                            </article>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </article>
            )}

            {activeView === "status" && (
              <article className="min-h-[calc(100vh-4rem-3rem)] p-6 pt-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    {/* Heading moved to main header card */}
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
                          setRequirementStatuses(
                            data.requirementStatuses || [],
                          );
                          setStatusCounts(data.counts || null);
                        }
                      } catch {
                        setStatusError("Error loading requirement statuses");
                      } finally {
                        setIsLoadingStatuses(false);
                      }
                    }}
                    disabled={isLoadingStatuses}
                    className="whitespace-nowrap rounded-md bg-amber-600 px-3 py-2 text-xs text-white hover:bg-amber-700 disabled:opacity-50"
                  >
                    {isLoadingStatuses ? "⟳ Refreshing..." : "⟳ Refresh"}
                  </button>
                </div>

                {statusCounts && !isLoadingStatuses && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <div className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2">
                      <p className="text-xs text-amber-300">Submitted</p>
                      <p className="mt-1 text-lg font-semibold text-slate-100">
                        {statusCounts.validated + statusCounts.pending}/
                        {statusCounts.total}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2">
                      <p className="text-xs text-amber-300">Validated</p>
                      <p className="mt-1 text-lg font-semibold text-slate-100">
                        {statusCounts.validated}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2">
                      <p className="text-xs text-amber-300">Pending</p>
                      <p className="mt-1 text-lg font-semibold text-slate-100">
                        {statusCounts.pending}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2">
                      <p className="text-xs text-amber-300">Rejected</p>
                      <p className="mt-1 text-lg font-semibold text-slate-100">
                        {statusCounts.rejected}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-600 bg-slate-800/30 px-3 py-2">
                      <p className="text-xs text-amber-300">Not Submitted</p>
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

            {activeView === "history" && (
              <article className="min-h-[calc(100vh-4rem-3rem)] p-8 pt-0">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>{/* Heading moved to main header card */}</div>

                  <div className="grid gap-3 sm:grid-cols-2 mx-auto">
                    <div className="flex flex-col items-center">
                      <label
                        className="text-xs uppercase tracking-[0.18em] text-amber-300 text-center"
                        htmlFor="historyAcademicYear"
                      >
                        School Year
                      </label>
                      <select
                        id="historyAcademicYear"
                        className="mt-0 w-48 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-center outline-none focus:ring focus:ring-amber-300/30"
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

                    <div className="flex flex-col items-center">
                      <label
                        className="text-xs uppercase tracking-[0.18em] text-amber-300 text-center"
                        htmlFor="historySemester"
                      >
                        Semester
                      </label>
                      <select
                        id="historySemester"
                        className="mt-0 w-48 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-center outline-none focus:ring focus:ring-amber-300/30"
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
                              S.Y. {submission.academicYear} ·{" "}
                              {submission.semester}
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
        </div>
      </div>
    </div>
  );
}
