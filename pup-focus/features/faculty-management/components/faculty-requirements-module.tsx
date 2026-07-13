"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  FileUp,
  Loader2,
  AlertCircle,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_REQUIREMENTS,
  REQUIREMENT_LABEL,
  type RequirementCode,
} from "@/config/compliance";

type RequirementStatus = {
  code: RequirementCode;
  status: "Validated" | "Rejected" | "Pending" | "Not Submitted";
  reviewedAt?: string;
  feedback?: string;
  submittedAt?: string;
};

type StatusResponse = {
  requirementStatuses: RequirementStatus[];
  counts?: {
    total: number;
    validated: number;
    rejected: number;
    pending: number;
    notSubmitted: number;
  };
};

const SEMESTER_OPTIONS = ["1st Semester", "2nd Semester"] as const;
type SemesterOption = (typeof SEMESTER_OPTIONS)[number];

type RequirementFormState = {
  academicYear: string;
  semester: SemesterOption;
  requirementCode: RequirementCode;
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

function statusTone(status: RequirementStatus["status"]) {
  switch (status) {
    case "Validated":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
    case "Rejected":
      return "border-rose-500/30 bg-rose-500/10 text-rose-200";
    case "Pending":
      return "border-amber-500/30 bg-amber-500/10 text-amber-100";
    default:
      return "border-slate-700 bg-slate-950/70 text-slate-300";
  }
}

function statusIcon(status: RequirementStatus["status"]) {
  if (status === "Validated") return <CheckCircle2 className="h-4 w-4" />;
  if (status === "Pending") return <Clock3 className="h-4 w-4" />;
  if (status === "Rejected") return <AlertCircle className="h-4 w-4" />;
  return <FileUp className="h-4 w-4" />;
}

export function FacultyRequirementsModule() {
  const academicYears = useMemo(() => buildAcademicYears(), []);
  const [requirementStatuses, setRequirementStatuses] = useState<
    RequirementStatus[]
  >([]);
  const [counts, setCounts] = useState<StatusResponse["counts"] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const initialFormState: RequirementFormState = {
    academicYear: academicYears[0] ?? "",
    semester: SEMESTER_OPTIONS[0],
    requirementCode: DEFAULT_REQUIREMENTS[0],
    remarks: "",
  };
  const [form, setForm] = useState(initialFormState);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    async function loadStatuses() {
      try {
        setIsLoading(true);
        const response = await fetch("/api/faculty/submissions/status");
        if (!response.ok) {
          throw new Error("Failed to load requirement statuses");
        }

        const data = (await response.json()) as StatusResponse;
        setRequirementStatuses(data.requirementStatuses || []);
        setCounts(data.counts || null);
      } catch {
        setMessage("Unable to load current requirement status right now.");
      } finally {
        setIsLoading(false);
      }
    }

    loadStatuses();
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsModalOpen(false);
        setIsCalendarModalOpen(false);
      }
    }

    if (isModalOpen || isCalendarModalOpen) {
      window.addEventListener("keydown", onKeyDown);
    }

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isModalOpen, isCalendarModalOpen]);

  function openModal() {
    setMessage(null);
    setIsModalOpen(true);
  }

  function openCalendarModal() {
    setMessage(null);
    setIsCalendarModalOpen(true);
  }

  function closeModal() {
    if (isSubmitting) return;
    setIsModalOpen(false);
  }

  function closeCalendarModal() {
    setIsCalendarModalOpen(false);
  }

  function getStatus(code: RequirementCode) {
    return (
      requirementStatuses.find((item) => item.code === code)?.status ??
      "Not Submitted"
    );
  }

  async function refreshStatuses() {
    const response = await fetch("/api/faculty/submissions/status");
    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as StatusResponse;
    setRequirementStatuses(data.requirementStatuses || []);
    setCounts(data.counts || null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFile) {
      setMessage("Please choose a file before submitting.");
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("academicYear", form.academicYear);
      formData.append("semester", form.semester);
      formData.append("requirementCode", form.requirementCode);
      formData.append("remarks", form.remarks);

      const response = await fetch("/api/faculty/submissions/create", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = "Failed to submit requirement.";
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // keep fallback message
        }
        setMessage(errorMessage);
        return;
      }

      await refreshStatuses();
      setMessage("Requirement submitted successfully.");
      setSelectedFile(null);
      setForm((current) => ({
        ...current,
        requirementCode: DEFAULT_REQUIREMENTS[0],
        remarks: "",
      }));
      setIsModalOpen(false);
    } catch {
      setMessage("Something went wrong while submitting the requirement.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const summary = counts ?? {
    total: DEFAULT_REQUIREMENTS.length,
    validated: 0,
    rejected: 0,
    pending: 0,
    notSubmitted: DEFAULT_REQUIREMENTS.length,
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-[rgba(255,215,0,0.16)] bg-gradient-to-br from-[#5e0000] via-[#4c0000] to-[#250000] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl space-y-2">
            <p className="text-xs uppercase tracking-[0.24em] text-[#ffd36a]">
              Faculty Requirements
            </p>
            <h2 className="text-2xl font-semibold text-[#fff8e7]">
              Upload documents and monitor validation in one module.
            </h2>
            <p className="text-sm leading-6 text-[#f5ddb8]">
              The status table stays visible on the page, while submissions open
              in a focused modal so you can file requirements without leaving
              the current view.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Total", summary.total],
          ["Validated", summary.validated],
          ["Pending", summary.pending],
          ["Not Submitted", summary.notSubmitted],
        ].map(([label, value]) => (
          <article
            key={label as string}
            className="rounded-2xl border border-slate-700 bg-slate-900/90 p-4"
          >
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
              {label}
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-100">
              {value as number}
            </p>
          </article>
        ))}
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-100">
              Requirements Management
            </h3>
            <p className="text-sm text-slate-400">
              Current validation status for each required document.
            </p>
          </div>
          <Button
            type="button"
            className="w-full sm:w-auto"
            onClick={openModal}
          >
            Submit Requirements
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="w-full sm:w-auto"
            onClick={openCalendarModal}
          >
            University Calendar
          </Button>
        </div>

        {message ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {message}
          </div>
        ) : null}

        <div className="grid gap-4">
          {isLoading ? (
            <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6 text-sm text-slate-400">
              Loading requirements status...
            </div>
          ) : (
            DEFAULT_REQUIREMENTS.map((code) => {
              const status = getStatus(code);
              const item = requirementStatuses.find(
                (entry) => entry.code === code,
              );

              return (
                <article
                  key={code}
                  className="rounded-2xl border border-slate-700 bg-slate-900/90 p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                      <p className="text-sm uppercase tracking-[0.18em] text-slate-400">
                        Requirement
                      </p>
                      <h4 className="text-base font-semibold text-slate-100">
                        {REQUIREMENT_LABEL[code]}
                      </h4>
                      <p className="text-sm text-slate-400">
                        {item?.submittedAt
                          ? `Submitted ${item.submittedAt}`
                          : "No submission has been recorded yet."}
                      </p>
                      {item?.feedback ? (
                        <p className="max-w-3xl rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-300">
                          {item.feedback}
                        </p>
                      ) : null}
                    </div>
                    <div
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium ${statusTone(status)}`}
                    >
                      {statusIcon(status)}
                      <span>{status}</span>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>

      {isModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-3xl rounded-3xl border border-slate-700 bg-[#120b0b] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-800 px-6 py-5">
              <div>
                <h3 className="text-xl font-semibold text-slate-100">
                  Submit Requirements
                </h3>
                <p className="text-sm text-slate-400">
                  Upload the file for the selected requirement.
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-full border border-slate-700 p-2 text-slate-300 transition hover:bg-slate-800 hover:text-slate-100"
                aria-label="Close modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form className="space-y-5 px-6 py-6" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm text-slate-300">
                  <span className="text-xs uppercase tracking-[0.18em] text-slate-400">
                    School Year
                  </span>
                  <select
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none focus:border-amber-400"
                    value={form.academicYear}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        academicYear: event.target.value,
                      }))
                    }
                  >
                    {academicYears.map((year) => (
                      <option key={year} value={year}>
                        S.Y. {year}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2 text-sm text-slate-300">
                  <span className="text-xs uppercase tracking-[0.18em] text-slate-400">
                    Semester
                  </span>
                  <select
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none focus:border-amber-400"
                    value={form.semester}
                    onChange={(event) =>
                      setForm(
                        (current): RequirementFormState => ({
                          ...current,
                          semester: event.target.value as SemesterOption,
                        }),
                      )
                    }
                  >
                    {SEMESTER_OPTIONS.map((semester) => (
                      <option key={semester} value={semester}>
                        {semester}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="space-y-2 text-sm text-slate-300">
                <span className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Requirement Type
                </span>
                <select
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none focus:border-amber-400"
                  value={form.requirementCode}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      requirementCode: event.target.value as RequirementCode,
                    }))
                  }
                >
                  {DEFAULT_REQUIREMENTS.map((code) => (
                    <option key={code} value={code}>
                      {REQUIREMENT_LABEL[code]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 text-sm text-slate-300">
                <span className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Document
                </span>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={(event) =>
                    setSelectedFile(event.target.files?.[0] ?? null)
                  }
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-amber-500 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-950 hover:file:bg-amber-400"
                />
                <span className="text-xs text-slate-500">
                  Accepted: PDF, DOC, DOCX, JPG, JPEG, PNG.
                </span>
              </label>

              <label className="space-y-2 text-sm text-slate-300">
                <span className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Remarks
                </span>
                <textarea
                  rows={4}
                  value={form.remarks}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      remarks: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none focus:border-amber-400"
                  placeholder="Optional notes for the reviewer"
                />
              </label>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-800 pt-4 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={closeModal}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Submit Requirements
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isCalendarModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm"
          onClick={closeCalendarModal}
        >
          <div
            className="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-800 px-6 py-5">
              <div>
                <h3 className="text-xl font-semibold text-slate-100">
                  University Calendar
                </h3>
                <p className="text-sm text-slate-400">
                  View the official PUP academic calendar.
                </p>
              </div>
              <button
                type="button"
                onClick={closeCalendarModal}
                className="rounded-full border border-slate-700 p-2 text-slate-300 transition hover:bg-slate-800 hover:text-slate-100"
                aria-label="Close calendar modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 bg-slate-950">
              <iframe
                title="University Calendar"
                src="https://www.pup.edu.ph/about/calendar"
                className="h-full w-full border-0"
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
