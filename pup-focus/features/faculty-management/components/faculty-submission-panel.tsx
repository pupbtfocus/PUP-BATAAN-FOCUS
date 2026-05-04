"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_REQUIREMENTS,
  REQUIREMENT_LABEL,
  type RequirementCode,
} from "@/config/compliance";

const SEMESTER_OPTIONS = ["1st Semester", "2nd Semester"] as const;
const PANEL_VIEWS = ["submit", "history", "guide"] as const;

type PanelView = (typeof PANEL_VIEWS)[number];
type SubmissionStatus = "Pending Review" | "Submitted" | "Validated";

type PastSubmission = {
  id: string;
  academicYear: string;
  semester: (typeof SEMESTER_OPTIONS)[number];
  requirementCode: RequirementCode;
  status: SubmissionStatus;
  submittedAt: string;
  remarks: string;
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

function buildPastSubmissions(): PastSubmission[] {
  return [
    {
      id: "sub-001",
      academicYear: "2025-2026",
      semester: "1st Semester",
      requirementCode: "grade_sheet",
      status: "Validated",
      submittedAt: "2026-03-18",
      remarks: "Finalized class records attached.",
    },
    {
      id: "sub-002",
      academicYear: "2025-2026",
      semester: "1st Semester",
      requirementCode: "enhanced_syllabus",
      status: "Submitted",
      submittedAt: "2026-03-11",
      remarks: "Updated course outcomes included.",
    },
    {
      id: "sub-003",
      academicYear: "2025-2026",
      semester: "2nd Semester",
      requirementCode: "midterm_package",
      status: "Pending Review",
      submittedAt: "2026-04-02",
      remarks: "Waiting for admin validation.",
    },
    {
      id: "sub-004",
      academicYear: "2024-2025",
      semester: "2nd Semester",
      requirementCode: "final_package",
      status: "Validated",
      submittedAt: "2025-05-19",
      remarks: "All exam papers uploaded.",
    },
    {
      id: "sub-005",
      academicYear: "2024-2025",
      semester: "1st Semester",
      requirementCode: "class_orientation",
      status: "Validated",
      submittedAt: "2025-10-04",
      remarks: "Orientation photos and narrative report submitted.",
    },
  ];
}

function statusStyles(status: SubmissionStatus): string {
  if (status === "Validated")
    return "bg-green-900/30 text-green-400 border-green-800";
  if (status === "Submitted")
    return "bg-yellow-900/30 text-yellow-400 border-yellow-800";
  return "bg-sky-900/30 text-sky-300 border-sky-800";
}

export function FacultySubmissionPanel() {
  const academicYears = useMemo(() => buildAcademicYears(), []);
  const pastSubmissions = useMemo(() => buildPastSubmissions(), []);
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
      const referenceId = crypto.randomUUID();
      setSubmissionMessage(
        `Queued ${REQUIREMENT_LABEL[form.requirementCode]} for S.Y. ${form.academicYear} ${form.semester}${form.fileName ? ` using ${form.fileName}` : ""}. Reference: ${referenceId}`,
      );
      setForm((prev) => ({
        ...prev,
        requirementCode: DEFAULT_REQUIREMENTS[0],
        fileName: "",
        remarks: "",
      }));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-lg">
        <p className="px-2 text-sm uppercase tracking-[0.22em] text-amber-300">
          Menu
        </p>
        <div className="mt-4 space-y-2">
          {[
            ["submit", "Submit Requirement", "Upload a new requirement"],
            ["history", "Past Submissions", "Filter by S.Y. and semester"],
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

      <div className="space-y-6">
        {activeView === "submit" && (
          <article className="rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-lg">
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

        {activeView === "guide" && (
          <article className="rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-lg">
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
          <article className="rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-lg">
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
              {filteredPastSubmissions.length > 0 ? (
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
                        className={`rounded-full border px-3 py-1 text-xs font-medium ${statusStyles(submission.status)}`}
                      >
                        {submission.status}
                      </span>
                    </div>

                    <p className="mt-3 text-sm text-slate-300">
                      {submission.remarks}
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
