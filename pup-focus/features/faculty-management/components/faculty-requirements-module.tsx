"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Clock3,
  FileUp,
  Loader2,
  AlertCircle,
  RotateCw,
  X,
  Calendar,
  Eye,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_REQUIREMENTS,
  REQUIREMENT_LABEL,
  type RequirementCode,
} from "@/config/compliance";
import { SubmissionStatusBadge } from "@/features/submissions/components/submission-status-badge";
import { DocumentUploadZone } from "@/features/submissions/components/document-upload-zone";
import {
  ComplianceListSkeleton,
  StatusMetricsSkeleton,
} from "@/features/submissions/components/submission-skeletons";

export type RequirementTemplateItem = {
  code: string;
  title: string;
  is_mandatory?: boolean;
  max_size_mb?: number;
  allowed_formats?: string[];
};

export type RequirementStatusItem = {
  code: string;
  status: "Validated" | "Rejected" | "Pending" | "Not Submitted";
  reviewedAt?: string;
  feedback?: string;
  admin_remarks?: string;
  adminRemarks?: string | null;
  submittedAt?: string;
  latestSubmissionId?: string;
};

export type StatusResponse = {
  requirementStatuses: RequirementStatusItem[];
  requirementTemplates?: RequirementTemplateItem[];
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
  requirementCode: string;
  remarks: string;
};

export type SubmissionWindowState = {
  isConfigured: boolean;
  isOpen: boolean;
  today: string;
  currentTime: string;
  startDate: string | null;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  academicYear: string | null;
  semester: SemesterOption | null;
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

function toAcademicYearAndSemester(dateInput: string | null | undefined) {
  const sourceDate = dateInput ? new Date(dateInput) : new Date();
  const date = Number.isNaN(sourceDate.getTime()) ? new Date() : sourceDate;
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  const startsSchoolYear = month >= 6;

  return {
    academicYear: startsSchoolYear
      ? `${year}-${year + 1}`
      : `${year - 1}-${year}`,
    semester: startsSchoolYear ? "1st Semester" : "2nd Semester",
  } as const;
}

function formatSubmittedDateTime(value?: string): string | null {
  if (!value) return null;
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

interface FacultyRequirementsModuleProps {
  initialStatuses?: RequirementStatusItem[];
  initialTemplates?: RequirementTemplateItem[];
  initialCounts?: StatusResponse["counts"] | null;
  initialSubmissionWindow?: SubmissionWindowState | null;
}

export function FacultyRequirementsModule({
  initialStatuses,
  initialTemplates,
  initialCounts,
  initialSubmissionWindow,
}: FacultyRequirementsModuleProps = {}) {
  const router = useRouter();
  const academicYears = useMemo(() => buildAcademicYears(), []);

  const [requirementStatuses, setRequirementStatuses] = useState<RequirementStatusItem[]>(
    () => initialStatuses || [],
  );
  const [requirementTemplates, setRequirementTemplates] = useState<RequirementTemplateItem[]>(
    () => initialTemplates || [],
  );
  const [counts, setCounts] = useState<StatusResponse["counts"] | null>(
    () => initialCounts || null,
  );
  const [isLoading, setIsLoading] = useState(!initialStatuses);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [submissionWindow, setSubmissionWindow] = useState<SubmissionWindowState | null>(
    () => initialSubmissionWindow || null,
  );

  const initialFormState: RequirementFormState = {
    academicYear:
      initialSubmissionWindow?.academicYear || academicYears[0] || "2026-2027",
    semester:
      initialSubmissionWindow?.semester || SEMESTER_OPTIONS[0],
    requirementCode:
      initialTemplates?.[0]?.code || DEFAULT_REQUIREMENTS[0],
    remarks: "",
  };

  const [form, setForm] = useState(initialFormState);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const activeRequirementItems = useMemo(() => {
    if (requirementTemplates.length > 0) {
      return requirementTemplates.map((t) => ({
        code: t.code,
        title: t.title,
        maxSizeMb: t.max_size_mb || 10,
        allowedFormats: t.allowed_formats || ["PDF", "DOCX", "XLSX"],
      }));
    }
    return DEFAULT_REQUIREMENTS.map((code) => ({
      code,
      title: REQUIREMENT_LABEL[code] ?? code,
      maxSizeMb: 10,
      allowedFormats: ["PDF", "DOCX", "XLSX"],
    }));
  }, [requirementTemplates]);

  const summary = useMemo(() => {
    if (counts) {
      return counts;
    }
    const total = activeRequirementItems.length;
    const validated = requirementStatuses.filter((s) => s.status === "Validated").length;
    const rejected = requirementStatuses.filter((s) => s.status === "Rejected").length;
    const pending = requirementStatuses.filter((s) => s.status === "Pending").length;
    const notSubmitted = Math.max(0, total - (validated + rejected + pending));

    return { total, validated, rejected, pending, notSubmitted };
  }, [counts, activeRequirementItems, requirementStatuses]);

  async function loadStatuses() {
    try {
      setIsLoading(true);
      const response = await fetch("/api/faculty/submissions/status", {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Failed to load requirement statuses");
      }

      const data = (await response.json()) as StatusResponse;
      setRequirementStatuses(data.requirementStatuses || []);
      if (Array.isArray(data.requirementTemplates) && data.requirementTemplates.length > 0) {
        setRequirementTemplates(data.requirementTemplates);
      }
      setCounts(data.counts || null);
    } catch {
      setMessage("Unable to load current requirement status right now.");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadSubmissionWindow() {
    try {
      const response = await fetch("/api/faculty/submissions/window", {
        cache: "no-store",
      });
      if (response.ok) {
        const data = (await response.json()) as SubmissionWindowState;
        setSubmissionWindow(data);
      }
    } catch {}
  }

  useEffect(() => {
    if (!initialStatuses) {
      void loadStatuses();
    }
    if (!initialSubmissionWindow) {
      void loadSubmissionWindow();
    }
  }, [initialStatuses, initialSubmissionWindow]);

  useEffect(() => {
    if (!submissionWindow) return;

    const currentTerm =
      submissionWindow.academicYear && submissionWindow.semester
        ? {
            academicYear: submissionWindow.academicYear,
            semester: submissionWindow.semester,
          }
        : toAcademicYearAndSemester(submissionWindow.today);

    setForm((current) => ({
      ...current,
      academicYear: currentTerm.academicYear,
      semester: currentTerm.semester,
    }));
  }, [submissionWindow]);

  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
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

  function openModal(code?: string) {
    setMessage(null);
    if (code) {
      setForm((curr) => ({ ...curr, requirementCode: code }));
    }
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setSelectedFile(null);
    setForm((current) => ({ ...current, remarks: "" }));
  }

  function openCalendarModal() {
    setMessage(null);
    setIsCalendarModalOpen(true);
  }

  function closeCalendarModal() {
    setIsCalendarModalOpen(false);
  }

  function getStatus(code: string): RequirementStatusItem["status"] {
    const found = requirementStatuses.find((item) => item.code === code);
    return found ? found.status : "Not Submitted";
  }

  const selectedTemplate = useMemo(() => {
    return activeRequirementItems.find((i) => i.code === form.requirementCode);
  }, [activeRequirementItems, form.requirementCode]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!selectedFile) {
      setMessage("Please choose a file to upload.");
      return;
    }

    try {
      setIsSubmitting(true);
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

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit requirement");
      }

      setMessage("Requirement submitted successfully!");
      closeModal();
      router.refresh();
      await loadStatuses();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "An unexpected error occurred",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const selectedReqStatus = requirementStatuses.find(
    (s) => s.code === form.requirementCode,
  );

  return (
    <div className="space-y-6">
      {/* ─── Metric Summary Cards & Progress ─── */}
      <section
        aria-label="Compliance Summary Metrics"
        className="rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900/70 p-5 shadow-xs transition-colors space-y-4"
      >
        {isLoading && !initialStatuses ? (
          <StatusMetricsSkeleton />
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                  Overall Compliance Progress
                </span>
                <span className="text-slate-500 dark:text-slate-400 font-medium">
                  ({summary.validated} of {summary.total} Validated)
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {summary.validated} Validated
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-300 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  {summary.pending} Pending
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  {summary.rejected} Revision
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                  {summary.notSubmitted} Not Submitted
                </span>
              </div>
            </div>

            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div
                className="h-full bg-emerald-500 transition-all duration-500 rounded-full"
                style={{
                  width: `${Math.min(100, Math.round((summary.validated / (summary.total || 1)) * 100))}%`,
                }}
              />
            </div>
          </>
        )}
      </section>

      {/* ─── Header & Action Controls ─── */}
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-300 dark:border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Academic Requirements Status
            </h2>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
              Term: S.Y. {form.academicYear} • {form.semester}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-label="Open University Academic Calendar"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              onClick={openCalendarModal}
            >
              <Calendar className="h-3.5 w-3.5 text-amber-500" />
              University Calendar
            </button>
            <button
              type="button"
              aria-label="Open document submission modal"
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold px-4 py-2 text-xs shadow-sm shadow-amber-500/20 active:scale-[0.98] transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              onClick={() => openModal()}
            >
              <FileUp className="h-3.5 w-3.5" />
              Submit Requirements
            </button>
            <button
              type="button"
              onClick={() => void loadStatuses()}
              disabled={isLoading}
              aria-label="Refresh requirement statuses"
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition disabled:opacity-50 cursor-pointer shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              <RotateCw className={`h-4 w-4 ${isLoading ? "animate-spin text-amber-500" : ""}`} />
            </button>
          </div>
        </div>

        {message && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-xl border border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200 shadow-2xs"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>{message}</span>
          </div>
        )}

        {/* ─── Requirements List: Responsive Desktop Table & Mobile Cards ─── */}
        {isLoading && !initialStatuses ? (
          <ComplianceListSkeleton count={activeRequirementItems.length || 6} />
        ) : (
          <div className="w-full space-y-4">
            {/* Desktop Table View (Hidden on mobile, visible on md+) */}
            <div className="hidden md:block overflow-hidden rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900/70 shadow-xs">
              <table className="w-full text-left text-xs" aria-label="Requirements compliance list">
                <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 text-slate-700 dark:text-slate-300 font-semibold">
                  <tr>
                    <th scope="col" className="px-5 py-3.5">
                      Requirement Document
                    </th>
                    <th scope="col" className="px-4 py-3.5">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-3.5">
                      Submission Timestamp
                    </th>
                    <th scope="col" className="px-4 py-3.5">
                      Admin Remarks
                    </th>
                    <th scope="col" className="px-5 py-3.5 text-right">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                  {activeRequirementItems.map((req) => {
                    const code = req.code;
                    const status = getStatus(code);
                    const item = requirementStatuses.find((entry) => entry.code === code);
                    const adminRemarks =
                      item?.adminRemarks || item?.admin_remarks || item?.feedback;

                    return (
                      <tr
                        key={code}
                        id={`req-row-${code}`}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        {/* Requirement Name */}
                        <td className="px-5 py-3.5 font-medium text-slate-900 dark:text-slate-100 max-w-[240px]">
                          <p className="truncate font-semibold">{req.title}</p>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            Max {req.maxSizeMb} MB • {req.allowedFormats.join(", ")}
                          </span>
                        </td>

                        {/* Status Badge */}
                        <td className="px-4 py-3.5">
                          <SubmissionStatusBadge status={status} size="sm" />
                        </td>

                        {/* Submission Date */}
                        <td className="px-4 py-3.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {item?.submittedAt
                            ? formatSubmittedDateTime(item.submittedAt)
                            : "—"}
                        </td>

                        {/* Admin Remarks */}
                        <td className="px-4 py-3.5 text-slate-600 dark:text-slate-400 max-w-[200px]">
                          {adminRemarks ? (
                            <p className="truncate italic text-slate-800 dark:text-slate-200" title={adminRemarks}>
                              &ldquo;{adminRemarks}&rdquo;
                            </p>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500">—</span>
                          )}
                        </td>

                        {/* Action Buttons */}
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          {status === "Not Submitted" && (
                            <button
                              type="button"
                              aria-label={`Submit document for ${req.title}`}
                              onClick={() => openModal(code)}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1.5 text-xs transition cursor-pointer shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                            >
                              <FileUp className="h-3.5 w-3.5" />
                              Submit
                            </button>
                          )}
                          {status === "Rejected" && (
                            <button
                              type="button"
                              aria-label={`Resubmit revision for ${req.title}`}
                              onClick={() => openModal(code)}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1.5 text-xs transition cursor-pointer shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                            >
                              <FileUp className="h-3.5 w-3.5" />
                              Resubmit
                            </button>
                          )}
                          {(status === "Pending" || status === "Validated") && item?.latestSubmissionId && (
                            <a
                              href={`/api/faculty/submissions/view?submissionId=${encodeURIComponent(item.latestSubmissionId)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`View submitted file for ${req.title}`}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 transition cursor-pointer shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              View
                            </a>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Card View (Visible on mobile, hidden on md+) */}
            <div className="space-y-3 block md:hidden" role="feed" aria-label="Requirements card list">
              {activeRequirementItems.map((req) => {
                const code = req.code;
                const status = getStatus(code);
                const item = requirementStatuses.find((entry) => entry.code === code);
                const adminRemarks =
                  item?.adminRemarks || item?.admin_remarks || item?.feedback;

                return (
                  <article
                    key={code}
                    className="rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900/70 p-4 space-y-3 shadow-xs transition hover:border-slate-400 dark:hover:border-slate-700"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {req.title}
                        </h3>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Max {req.maxSizeMb} MB • {req.allowedFormats.join(", ")}
                        </p>
                      </div>
                      <SubmissionStatusBadge status={status} size="sm" />
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <Clock3 className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        {item?.submittedAt
                          ? `Submitted: ${formatSubmittedDateTime(item.submittedAt)}`
                          : "No submission recorded yet"}
                      </span>
                    </div>

                    {adminRemarks && (
                      <div className="rounded-xl border border-amber-300/80 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-2.5 text-xs text-amber-900 dark:text-amber-200">
                        <span className="font-semibold block uppercase tracking-wider text-[10px] text-amber-800 dark:text-amber-300 mb-0.5">
                          Admin Remarks:
                        </span>
                        <p className="italic leading-relaxed">&ldquo;{adminRemarks}&rdquo;</p>
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                      {status === "Not Submitted" && (
                        <button
                          type="button"
                          aria-label={`Submit requirement ${req.title}`}
                          onClick={() => openModal(code)}
                          className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 text-xs transition cursor-pointer shadow-2xs"
                        >
                          <FileUp className="h-3.5 w-3.5" />
                          Submit Document
                        </button>
                      )}
                      {status === "Rejected" && (
                        <button
                          type="button"
                          aria-label={`Resubmit revision for ${req.title}`}
                          onClick={() => openModal(code)}
                          className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 text-xs transition cursor-pointer shadow-2xs"
                        >
                          <FileUp className="h-3.5 w-3.5" />
                          Resubmit Revision
                        </button>
                      )}
                      {(status === "Pending" || status === "Validated") && item?.latestSubmissionId && (
                        <a
                          href={`/api/faculty/submissions/view?submissionId=${encodeURIComponent(item.latestSubmissionId)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`View uploaded file for ${req.title}`}
                          className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 px-4 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 transition cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View Uploaded File
                        </a>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* ─── Submit Requirement Modal ─── */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="submit-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <h3 id="submit-modal-title" className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  Submit Requirement Document
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Upload your compliance file for admin review and validation.
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-full border border-slate-300 dark:border-slate-700 p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 transition"
                aria-label="Close modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              {/* Term Selection */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-600 dark:text-slate-400">
                    Academic Year
                  </span>
                  <p className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2.5 text-xs text-slate-800 dark:text-slate-100 font-semibold">
                    {form.academicYear ? `S.Y. ${form.academicYear}` : "—"}
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-600 dark:text-slate-400">
                    Semester
                  </span>
                  <p className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2.5 text-xs text-slate-800 dark:text-slate-100 font-semibold">
                    {form.semester}
                  </p>
                </div>
              </div>

              {/* Requirement Type Selector */}
              <div className="space-y-1">
                <label
                  htmlFor="req-type-select"
                  className="text-[11px] uppercase tracking-wider font-semibold text-slate-600 dark:text-slate-400"
                >
                  Requirement Type
                </label>
                <select
                  id="req-type-select"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-xs text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-medium"
                  value={form.requirementCode}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      requirementCode: event.target.value,
                    }))
                  }
                >
                  {activeRequirementItems.map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Drag and Drop Upload Zone */}
              <DocumentUploadZone
                selectedFile={selectedFile}
                onFileSelect={setSelectedFile}
                maxSizeMb={selectedTemplate?.maxSizeMb || 10}
                allowedFormats={selectedTemplate?.allowedFormats || ["PDF", "DOCX", "XLSX"]}
                currentStatus={selectedReqStatus?.status}
                reviewerFeedback={
                  selectedReqStatus?.adminRemarks ||
                  selectedReqStatus?.admin_remarks ||
                  selectedReqStatus?.feedback
                }
                isUploading={isSubmitting}
              />

              {/* Remarks / Notes */}
              <div className="space-y-1">
                <label
                  htmlFor="req-remarks"
                  className="text-[11px] uppercase tracking-wider font-semibold text-slate-600 dark:text-slate-400"
                >
                  Optional Remarks for Admin
                </label>
                <textarea
                  id="req-remarks"
                  rows={3}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 placeholder:text-slate-400 resize-none"
                  placeholder="Add notes, course section codes, or explanations for reviewer..."
                  value={form.remarks}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      remarks: event.target.value,
                    }))
                  }
                />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800 pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={closeModal}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || !selectedFile}
                  className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500 text-white font-medium px-5 py-2.5 rounded-xl text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-amber-500 disabled:shadow-none"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Uploading...
                    </span>
                  ) : (
                    "Submit File"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── University Calendar Modal ─── */}
      {isCalendarModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="calendar-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm"
          onClick={closeCalendarModal}
        >
          <div
            className="w-full max-w-lg rounded-3xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 id="calendar-modal-title" className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  University Academic Calendar
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Reference dates and submission window guidelines.
                </p>
              </div>
              <button
                type="button"
                onClick={closeCalendarModal}
                className="rounded-full border border-slate-300 dark:border-slate-700 p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                aria-label="Close calendar modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3.5 space-y-2">
                <p className="font-semibold text-slate-900 dark:text-slate-100">
                  Current Submission Window:
                </p>
                {submissionWindow?.isConfigured ? (
                  <ul className="space-y-1 list-disc list-inside text-slate-600 dark:text-slate-400">
                    <li>Period: {submissionWindow.startDate} to {submissionWindow.endDate}</li>
                    <li>Hours: {submissionWindow.startTime ?? "09:00"} – {submissionWindow.endTime ?? "17:00"} (Asia/Manila)</li>
                    <li>Status: <span className="font-semibold text-amber-600 dark:text-amber-400">{submissionWindow.isOpen ? "Open for Submissions" : "Closed"}</span></li>
                  </ul>
                ) : (
                  <p className="italic text-slate-500">No submission window active at this time.</p>
                )}
              </div>

              <p className="text-[11px] text-slate-500">
                For complete university schedules, visit the official PUP Academic Calendar portal.
              </p>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-800">
              <a
                href="https://www.pup.edu.ph/about/calendar"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline"
              >
                Open PUP Portal &rarr;
              </a>
              <Button type="button" variant="secondary" size="sm" onClick={closeCalendarModal}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
