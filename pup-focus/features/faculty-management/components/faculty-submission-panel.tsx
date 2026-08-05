"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/shared/brand-mark";
import { FacultySettingsPanel } from "@/features/faculty-management/components/faculty-settings-panel";
import { SubmissionWindowCountdown } from "@/features/submissions/components/submission-window-countdown";
import { SubmissionLockBanner } from "@/features/submissions/components/submission-lock-banner";
import { VersionHistoryModal } from "@/features/submissions/components/version-history-modal";
import {
  DEFAULT_REQUIREMENTS,
  REQUIREMENT_LABEL,
  REQUIREMENT_CODE,
  type RequirementCode,
} from "@/config/compliance";
import {
  getTodayInManila,
  buildAcademicYearOptions,
} from "@/features/submissions/services/submission-window.service";
import { X, LayoutDashboard, ClipboardList, History, Settings, FileText, AlertCircle, Upload, CheckCircle2, Calendar } from "lucide-react";

const SEMESTER_OPTIONS = ["1st Semester", "2nd Semester"] as const;
const REQUIREMENT_DESCRIPTIONS: Record<RequirementCode, string> = {
  grade_sheet: "Official signed grade sheets for assigned course sections.",
  enhanced_syllabus: "Course syllabus adhering to outcome-based education standards.",
  class_orientation: "Photos and narrative report documenting initial class orientation.",
  midterm_package: "Copy of Midterm Examinations with TOS and Answer Key.",
  final_package: "Copy of Final Examinations with TOS and Answer Key.",
  class_records: "Class Records including midterm and final grade computations.",
};
const PANEL_VIEWS = [
  "dashboard",
  "submit",
  "history",
  "status",
  "settings",
] as const;
const LOGIN_PAGE_IMAGES = [
  "/images/attachments/IMG_9399.jpeg",
  "/images/attachments/IMG_9402.jpeg",
];

type PanelView = (typeof PANEL_VIEWS)[number];
type HistorySubmissionStatus = "Pending" | "Validated" | "Rejected";

type RequirementStatus = {
  code: RequirementCode;
  status: "Validated" | "Rejected" | "Pending" | "Not Submitted";
  reviewedAt?: string;
  feedback?: string;
  note?: string;
  submittedAt?: string;
  latestSubmissionId?: string;
};

type SubmissionPreview = {
  code: RequirementCode;
  title: string;
  submittedAt?: string;
  note?: string;
  feedback?: string;
  reviewedAt?: string;
  latestSubmissionId: string;
};

type PastSubmission = {
  id: string;
  academicYear: string;
  semester: (typeof SEMESTER_OPTIONS)[number];
  requirementCode: RequirementCode;
  status: HistorySubmissionStatus;
  submittedAt: string;
  note?: string;
  remarks?: string;
  reviewedAt?: string;
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
  status: "Upcoming" | "Open" | "Closed";
  isOpen: boolean;
  today: string;
  currentTime: string;
  startDate: string | null;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  academicYear: string | null;
  semester: (typeof SEMESTER_OPTIONS)[number] | null;
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

function getStatusTextColorClass(
  status: RequirementStatus["status"] | HistorySubmissionStatus,
): string {
  if (status === "Validated")
    return "text-emerald-400 font-medium text-xs tracking-wider uppercase";
  if (status === "Rejected")
    return "text-rose-400 font-medium text-xs tracking-wider uppercase";
  if (status === "Not Submitted")
    return "text-slate-400 font-medium text-xs tracking-wider uppercase";
  return "text-amber-400 font-medium text-xs tracking-wider uppercase";
}

function getStatusText(
  status: RequirementStatus["status"] | HistorySubmissionStatus,
): string {
  if (status === "Validated") return "Validated";
  if (status === "Rejected") return "Needs Revision";
  if (status === "Not Submitted") return "Not Submitted";
  return "Pending Review";
}

function formatSubmittedDateTime(value?: string): string | null {
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

function getSubmissionPreviewUrl(submissionId: string) {
  return `/api/faculty/submissions/view?submissionId=${encodeURIComponent(submissionId)}`;
}

function FacultySubmissionPanelContent({
  facultyName,
}: {
  facultyName?: string | null;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const academicYears = useMemo(() => buildAcademicYearOptions(), []);
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
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
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
  const [previewSubmission, setPreviewSubmission] =
    useState<SubmissionPreview | null>(null);
  const [viewedSubmissionIds, setViewedSubmissionIds] = useState<Set<string>>(
    () => new Set(),
  );
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
  const [versionHistorySubmissionId, setVersionHistorySubmissionId] =
    useState<string | null>(null);
  const [versionHistoryLabel, setVersionHistoryLabel] = useState("");
  const [versionHistoryCode, setVersionHistoryCode] = useState("");
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [successModalData, setSuccessModalData] = useState<{
    isOpen: boolean;
    requirementTitle: string;
  }>({ isOpen: false, requirementTitle: "" });

  // ─── Page-load overlay state ───────────────────────────────────────
  const [isPageLoading, setIsPageLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsPageLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  const [selectedAcademicYear, setSelectedAcademicYear] =
    useState<string>(academicYears[0] ?? "");
  const [selectedSemester, setSelectedSemester] = useState<
    (typeof SEMESTER_OPTIONS)[number]
  >("1st Semester");

  const [selectedRequirementForUpload, setSelectedRequirementForUpload] =
    useState<RequirementCode | null>(null);
  const [directUploadFile, setDirectUploadFile] = useState<File | null>(null);
  const [directUploadRemarks, setDirectUploadRemarks] = useState("");
  const [isUploadingDirect, setIsUploadingDirect] = useState(false);
  const [directUploadMessage, setDirectUploadMessage] = useState<string | null>(
    null,
  );
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  const hasSubmissionWindowAcademicTerm = Boolean(
    submissionWindow?.isConfigured &&
    submissionWindow.academicYear &&
    submissionWindow.semester,
  );

  const historyAcademicYears = useMemo(() => {
    if (hasSubmissionWindowAcademicTerm && submissionWindow?.academicYear) {
      return [submissionWindow.academicYear];
    }

    return academicYears;
  }, [
    academicYears,
    hasSubmissionWindowAcademicTerm,
    submissionWindow?.academicYear,
  ]);

  const historySemesterOptions = useMemo<
    Array<(typeof SEMESTER_OPTIONS)[number] | "All">
  >(() => {
    if (hasSubmissionWindowAcademicTerm && submissionWindow?.semester) {
      return [submissionWindow.semester];
    }

    return ["All", ...SEMESTER_OPTIONS];
  }, [hasSubmissionWindowAcademicTerm, submissionWindow?.semester]);
  const [
    hasSeenIncompleteRequirementsModal,
    setHasSeenIncompleteRequirementsModal,
  ] = useState(false);
  const showIncompleteRequirementsModal =
    activeView === "dashboard" &&
    !hasSeenIncompleteRequirementsModal &&
    Boolean(submissionWindow?.isConfigured && submissionWindow?.isOpen) &&
    statusCounts !== null &&
    statusCounts.pending + statusCounts.notSubmitted > 0;

  async function fetchHistory() {
    try {
      setIsLoadingHistory(true);
      setHistoryError(null);
      const response = await fetch("/api/faculty/submissions/history", {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
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

  async function fetchStatuses() {
    try {
      setIsLoadingStatuses(true);
      setStatusError(null);
      const response = await fetch("/api/faculty/submissions/status", {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
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

  const refetchSubmissionWindow = useCallback(async () => {
    setIsLoadingSubmissionWindow(true);
    try {
      const response = await fetch("/api/faculty/submissions/window", {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      if (response.ok) {
        const data = (await response.json()) as SubmissionWindowState;
        setSubmissionWindow(data);
      }
    } catch {
      // Keep UI usable even if window info fails to load.
    } finally {
      setIsLoadingSubmissionWindow(false);
    }
  }, []);

  const handleWindowExpired = useCallback(() => {
    void refetchSubmissionWindow();
    void fetchStatuses();
  }, [refetchSubmissionWindow]);

  useEffect(() => {
    void fetchStatuses();
    void refetchSubmissionWindow();
    // Read view and history from URL on mount
    try {
      const params = new URLSearchParams(window.location.search);
      const view = params.get("view");
      const historyParam = params.get("history");
      if (view === "history" || (view === "status" && historyParam === "true")) {
        setActiveView("status");
        setIsHistoryModalOpen(true);
      } else if (view && (PANEL_VIEWS as readonly string[]).includes(view)) {
        setActiveView(view as PanelView);
      }
    } catch {
      // ignore
    }
  }, [refetchSubmissionWindow]);

  useEffect(() => {
    if (isHistoryModalOpen) {
      void fetchHistory();
    }
  }, [isHistoryModalOpen, historyAcademicYear, historySemester]);

  useEffect(() => {
    if (!submissionWindow) {
      return;
    }

    if (!submissionWindow.isOpen) {
      setRequirementStatuses([]);
      setStatusCounts(null);
      setHasSeenIncompleteRequirementsModal(false);
    }

    const currentTerm =
      submissionWindow.academicYear && submissionWindow.semester
        ? {
            academicYear: submissionWindow.academicYear,
            semester: submissionWindow.semester,
          }
        : toAcademicYearAndSemester(submissionWindow.today);

    setForm((previous) => ({
      ...previous,
      academicYear: currentTerm.academicYear,
      semester: currentTerm.semester,
    }));

    setHistoryAcademicYear(currentTerm.academicYear);
    setHistorySemester(currentTerm.semester);
    setSelectedAcademicYear(currentTerm.academicYear);
    setSelectedSemester(currentTerm.semester);
  }, [submissionWindow]);

  useEffect(() => {
    if (!historyAcademicYears.includes(historyAcademicYear)) {
      setHistoryAcademicYear(historyAcademicYears[0] ?? "");
    }

    if (!historySemesterOptions.includes(historySemester)) {
      setHistorySemester(historySemesterOptions[0] ?? "All");
    }
  }, [historyAcademicYears, historySemesterOptions]);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function openHistoryModal() {
    setIsHistoryModalOpen(true);
    void fetchHistory();
    try {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.set("view", "status");
      params.set("history", "true");
      router.replace(`${pathname}?${params.toString()}`);
    } catch {
      // fallback
    }
  }

  function closeHistoryModal() {
    setIsHistoryModalOpen(false);
    try {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.set("view", "status");
      params.delete("history");
      router.replace(`${pathname}?${params.toString()}`);
    } catch {
      // fallback
    }
  }

  function navigateToView(view: PanelView) {
    let targetView = view;
    let openHistory = false;

    if (view === "history") {
      targetView = "status";
      openHistory = true;
    }

    setActiveView(targetView);
    setIsHistoryModalOpen(openHistory);

    try {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.set("view", targetView);
      if (targetView === "status" && openHistory) {
        params.set("history", "true");
      } else {
        params.delete("history");
      }
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

  const displayedRequirementStatuses = useMemo<RequirementStatus[]>(() => {
    return DEFAULT_REQUIREMENTS.map((code) => {
      const live = requirementStatuses.find((r) => r.code === code);
      if (live && live.status !== "Not Submitted") {
        return live;
      }

      const match = pastSubmissions.find((s) => s.requirementCode === code);

      if (match) {
        return {
          code,
          status:
            match.status === "Validated"
              ? "Validated"
              : match.status === "Rejected"
                ? "Rejected"
                : "Pending",
          submittedAt: match.submittedAt,
          reviewedAt: match.reviewedAt,
          feedback: match.remarks,
          note: match.note,
          latestSubmissionId: match.id,
        };
      }

      if (live) return live;

      return {
        code,
        status: "Not Submitted" as const,
      };
    });
  }, [pastSubmissions, requirementStatuses]);

  const displayedStatusCounts = useMemo(() => {
    const total = DEFAULT_REQUIREMENTS.length;
    const validated = displayedRequirementStatuses.filter(
      (r) => r.status === "Validated",
    ).length;
    const rejected = displayedRequirementStatuses.filter(
      (r) => r.status === "Rejected",
    ).length;
    const pending = displayedRequirementStatuses.filter(
      (r) => r.status === "Pending",
    ).length;
    const notSubmitted = displayedRequirementStatuses.filter(
      (r) => r.status === "Not Submitted",
    ).length;
    return { total, validated, rejected, pending, notSubmitted };
  }, [displayedRequirementStatuses]);

  const totalRequirements = displayedStatusCounts?.total ?? DEFAULT_REQUIREMENTS.length;
  const validatedCount = displayedStatusCounts?.validated ?? 0;
  const isAllValidated = totalRequirements > 0 && validatedCount === totalRequirements;

  function openDirectUploadModal(code: RequirementCode) {
    setSelectedRequirementForUpload(code);
    setDirectUploadFile(null);
    setDirectUploadRemarks("");
    setDirectUploadMessage(null);
  }

  function closeDirectUploadModal() {
    if (isUploadingDirect) return;
    setSelectedRequirementForUpload(null);
    setDirectUploadFile(null);
    setDirectUploadRemarks("");
    setDirectUploadMessage(null);
  }

  async function handleDirectUploadSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (!selectedRequirementForUpload || !directUploadFile) {
      setDirectUploadMessage("Please select a file to submit.");
      return;
    }

    if (directUploadFile.size > 10 * 1024 * 1024) {
      setDirectUploadMessage("File size exceeds 10MB limit.");
      return;
    }

    setIsUploadingDirect(true);
    setDirectUploadMessage(null);

    try {
      const activeAY =
        submissionWindow?.academicYear || selectedAcademicYear || form.academicYear || "2025-2026";
      const activeSem =
        submissionWindow?.semester || selectedSemester || form.semester || "1st Semester";

      const formData = new FormData();
      formData.append("file", directUploadFile);
      formData.append("academicYear", activeAY);
      formData.append("semester", activeSem);
      formData.append("requirementCode", selectedRequirementForUpload);
      formData.append("requirement_type", selectedRequirementForUpload);
      formData.append("remarks", directUploadRemarks);
      formData.append("notes", directUploadRemarks);

      const response = await fetch("/api/faculty/submissions/create", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        try {
          const errorData = await response.json();
          setDirectUploadMessage(
            `Error: ${errorData.error || "Failed to submit requirement"}`,
          );
        } catch {
          setDirectUploadMessage(
            `Error: Failed to submit requirement (HTTP ${response.status})`,
          );
        }
        return;
      }

      const result = await response.json();

      setSubmissionMessage(
        `✓ Requirement submitted successfully! Reference ID: ${String(result.submissionId).slice(0, 8)}...`,
      );

      // Optimistically update status badge to Pending immediately
      setRequirementStatuses((prev) => {
        const exists = prev.some((r) => r.code === selectedRequirementForUpload);
        if (exists) {
          return prev.map((r) =>
            r.code === selectedRequirementForUpload
              ? {
                  ...r,
                  status: "Pending" as const,
                  submittedAt: new Date().toISOString(),
                  latestSubmissionId: result.submissionId,
                }
              : r,
          );
        }
        return [
          ...prev,
          {
            code: selectedRequirementForUpload,
            status: "Pending" as const,
            submittedAt: new Date().toISOString(),
            latestSubmissionId: result.submissionId,
          },
        ];
      });

      const activeReqTitle =
        REQUIREMENT_LABEL[selectedRequirementForUpload] ||
        selectedRequirementForUpload;

      closeDirectUploadModal();
      await Promise.all([fetchStatuses(), fetchHistory()]);

      setSuccessModalData({
        isOpen: true,
        requirementTitle: activeReqTitle,
      });
    } catch (error) {
      setDirectUploadMessage(
        `Error: ${error instanceof Error ? error.message : "An unexpected error occurred"}`,
      );
    } finally {
      setIsUploadingDirect(false);
    }
  }

  function updateField<K extends keyof SubmissionFormState>(
    key: K,
    value: SubmissionFormState[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function getRequirementStatus(code: RequirementCode) {
    return requirementStatuses.find((r) => r.code === code)?.status;
  }

  function markSubmissionViewed(submissionId: string) {
    setViewedSubmissionIds((current) => {
      if (current.has(submissionId)) {
        return current;
      }

      const next = new Set(current);
      next.add(submissionId);
      return next;
    });
  }

  function openSubmissionPreview(item: RequirementStatus) {
    if (!item.latestSubmissionId) {
      return;
    }

    markSubmissionViewed(item.latestSubmissionId);

    setPreviewSubmission({
      code: item.code,
      title: REQUIREMENT_LABEL[item.code],
      submittedAt: item.submittedAt,
      note: item.note,
      feedback: item.feedback,
      reviewedAt: item.reviewedAt,
      latestSubmissionId: item.latestSubmissionId,
    });
  }

  function openHistorySubmissionPreview(submission: PastSubmission) {
    markSubmissionViewed(submission.id);

    setPreviewSubmission({
      code: submission.requirementCode,
      title: REQUIREMENT_LABEL[submission.requirementCode],
      submittedAt: submission.submittedAt,
      note: submission.note,
      feedback: submission.remarks,
      reviewedAt: submission.reviewedAt,
      latestSubmissionId: submission.id,
    });
  }

  function openVersionHistory(
    item:
      | RequirementStatus
      | PastSubmission
      | {
          submissionId?: string;
          id?: string;
          latestSubmissionId?: string;
          requirementCode?: RequirementCode;
          code?: RequirementCode;
        },
  ) {
    const code =
      "code" in item && item.code
        ? item.code
        : "requirementCode" in item && item.requirementCode
          ? item.requirementCode
          : undefined;

    let targetSubmissionId =
      "latestSubmissionId" in item && item.latestSubmissionId
        ? item.latestSubmissionId
        : "submissionId" in item && item.submissionId
          ? item.submissionId
          : "id" in item && item.id
            ? item.id
            : undefined;

    if (!targetSubmissionId && code) {
      const match = pastSubmissions.find(
        (s) =>
          s.requirementCode === code ||
          (s as unknown as { requirement_type?: string }).requirement_type ===
            code,
      );
      if (match?.id) {
        targetSubmissionId = match.id;
      }
    }

    const finalSubmissionId = targetSubmissionId || code;
    if (!finalSubmissionId) return;

    setVersionHistorySubmissionId(finalSubmissionId);
    setVersionHistoryLabel(
      code ? REQUIREMENT_LABEL[code] || code : "Version History",
    );
    setVersionHistoryCode(code || "");
  }

  function closeVersionHistory() {
    setVersionHistorySubmissionId(null);
    setVersionHistoryLabel("");
    setVersionHistoryCode("");
  }

  function startRevision(requirementCode: RequirementCode) {
    updateField("requirementCode", requirementCode);
    openSubmitModal();
  }

  function closeSubmissionPreview() {
    setPreviewSubmission(null);
  }

  function openSubmitModal() {
    setSubmissionMessage(null);
    setIsSubmitModalOpen(true);
  }

  function closeSubmitModal() {
    if (isSubmitting) return;
    setIsSubmitModalOpen(false);
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

      await fetchStatuses();

      setForm((prev) => ({
        ...prev,
        requirementCode: DEFAULT_REQUIREMENTS[0],
        fileName: "",
        remarks: "",
      }));

      if (fileInput) fileInput.value = "";
      setIsSubmitModalOpen(false);
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
      {/* ─── Initial page-load overlay ─────────────────────────────── */}
      <div
        className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-950 transition-opacity duration-500 ${
          isPageLoading ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden={!isPageLoading}
      >
        {/* PUP Logo with gold glow */}
        <div className="relative mb-3 drop-shadow-[0_0_15px_rgba(245,158,11,0.4)]">
          <BrandMark size={64} className="rounded-full" />
        </div>

        {/* App Title */}
        <h1 className="text-xl font-bold tracking-wider text-amber-300">
          ᜉᜓᜉ᜔ ᜉ᜔ᜂᜃ᜔ᜂᜐ᜔
        </h1>

        {/* Animated hourglass loader */}
        <div className="my-4 flex items-center justify-center drop-shadow-[0_0_12px_rgba(245,158,11,0.5)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/loading.svg"
            alt="Loading"
            width={96}
            height={96}
            className="h-24 w-24"
          />
        </div>

        {/* Subtext */}
        <p className="text-xs font-medium tracking-wide text-slate-400">
          Loading academic portal...
        </p>
      </div>
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

        <div className="my-4">
          <SubmissionWindowCountdown
            window={submissionWindow}
            isLoading={isLoadingSubmissionWindow}
            onExpired={handleWindowExpired}
          />
        </div>

        <nav className="mt-4 space-y-2">
          {[
            { key: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
            { key: "status", label: "Requirements Management", Icon: ClipboardList },
            { key: "settings", label: "Settings", Icon: Settings },
          ].map(({ key, label, Icon }) => {
            const isActive = activeView === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => navigateToView(key as PanelView)}
                className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
                  isActive
                    ? "border-amber-400 bg-amber-400/10 text-amber-300"
                    : "border-slate-700 bg-slate-950/60 text-slate-100 hover:border-slate-500 hover:bg-slate-900"
                }`}
              >
                <Icon size={18} className={isActive ? "text-amber-300" : "text-slate-400"} />
                <span className="font-semibold">{label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="ml-72 flex min-h-full w-[calc(100%-18rem)] flex-col">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-l border-slate-700 bg-slate-900 shadow-lg">
          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            {activeView !== "dashboard" && (
              <SubmissionLockBanner
                isLocked={!isSubmissionAvailable}
                isConfigured={submissionWindow?.isConfigured}
              />
            )}
            {activeView !== "dashboard" && activeView !== "status" ? (
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div className="inline-block w-max rounded-xl border border-slate-700 bg-slate-950 px-4 py-2">
                  <h3 className="text-lg font-semibold text-amber-300">
                    {activeView === "submit" ? "Submit Requirements" : "Settings"}
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
                  {/* removed red overlay */}

                  <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
                    <BrandMark size={90} className="rounded-full" />
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
                        <p className="text-xs uppercase tracking-[0.18em] text-amber-300">
                          School Year
                        </p>
                        <p className="mt-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-slate-100">
                          {form.academicYear
                            ? `S.Y. ${form.academicYear}`
                            : "Loading current term..."}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-amber-300">
                          Semester
                        </p>
                        <p className="mt-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-slate-100">
                          {form.semester}
                        </p>
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
                        <h3
                          id="submission-guide-title"
                          className="text-2xl font-semibold text-slate-100"
                        >
                          Submission Guide
                        </h3>
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
              </article>
            )}

            {activeView === "status" && (
              <article className="min-h-[calc(100vh-4rem-3rem)] p-6 pt-0">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-100">
                      Requirements Management
                    </h2>
                    <p className="mt-1 text-sm font-medium text-slate-400 tracking-wide">
                      A.Y. {submissionWindow?.academicYear || selectedAcademicYear || form.academicYear || "2025-2026"} •{" "}
                      {submissionWindow?.semester || selectedSemester || form.semester || "1st Semester"}
                      {isAllValidated && (
                        <span className="ml-2 text-emerald-400 font-medium">• Validated</span>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={openHistoryModal}
                      className="inline-flex items-center px-3.5 py-2 rounded-lg text-xs font-medium text-amber-300 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 hover:border-amber-400 hover:text-amber-200 transition-all duration-200 backdrop-blur-sm cursor-pointer"
                    >
                      Submission History
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        window.open(
                          "https://www.pup.edu.ph/about/calendar",
                          "_blank",
                          "noopener,noreferrer",
                        )
                      }
                      className="inline-flex items-center px-3.5 py-2 rounded-lg text-xs font-medium text-amber-300 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 hover:border-amber-400 hover:text-amber-200 transition-all duration-200 backdrop-blur-sm cursor-pointer whitespace-nowrap"
                    >
                      University Calendar
                    </button>
                    <button
                      type="button"
                      onClick={() => void fetchStatuses()}
                      disabled={isLoadingStatuses}
                      className="whitespace-nowrap rounded-md bg-slate-800 px-3 py-2 text-xs text-white hover:bg-slate-700 disabled:opacity-50"
                    >
                      {isLoadingStatuses ? "⟳ Refreshing..." : "⟳ Refresh"}
                    </button>
                  </div>
                </div>

                {displayedStatusCounts && !isLoadingStatuses && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <div className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2">
                      <p className="text-xs text-amber-300">Progress</p>
                      <p className={`mt-1 text-lg font-semibold ${isAllValidated ? "text-emerald-400" : "text-slate-100"}`}>
                        {displayedStatusCounts.validated}/{displayedStatusCounts.total} Validated
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2">
                      <p className="text-xs text-amber-300">Validated</p>
                      <p className="mt-1 text-lg font-semibold text-emerald-400">
                        {displayedStatusCounts.validated}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2">
                      <p className="text-xs text-amber-300">Pending</p>
                      <p className={`mt-1 text-lg font-semibold ${isAllValidated || displayedStatusCounts.pending === 0 ? "text-slate-400" : "text-amber-400"}`}>
                        {isAllValidated ? 0 : displayedStatusCounts.pending} Pending
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2">
                      <p className="text-xs text-amber-300">Rejected</p>
                      <p className="mt-1 text-lg font-semibold text-slate-100">
                        {displayedStatusCounts.rejected}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-600 bg-slate-800/30 px-3 py-2">
                      <p className="text-xs text-amber-300">Not Submitted</p>
                      <p className="mt-1 text-lg font-semibold text-slate-300">
                        {isAllValidated ? 0 : displayedStatusCounts.notSubmitted}
                      </p>
                    </div>
                  </div>
                )}

                <div className="mt-6 space-y-4">
                  {isLoadingStatuses ? (
                    <p className="text-sm text-slate-400">
                      Loading requirement statuses...
                    </p>
                  ) : statusError ? (
                    <p className="text-sm text-red-400">{statusError}</p>
                  ) : displayedRequirementStatuses.map((req) => (
                    <article
                      key={req.code}
                      id={`requirement-${req.code}`}
                      className="rounded-xl border border-slate-700 bg-slate-950 p-5 transition-all duration-300 hover:border-slate-600"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-base text-slate-100">
                            {REQUIREMENT_LABEL[req.code]}
                          </p>
                          {req.reviewedAt && (
                            <p className="mt-1.5 text-xs text-slate-500">
                              Reviewed on {req.reviewedAt}
                            </p>
                          )}
                          {req.submittedAt &&
                          formatSubmittedDateTime(req.submittedAt) ? (
                            <p className="mt-1 text-xs text-slate-500">
                              Submitted on{" "}
                              {formatSubmittedDateTime(req.submittedAt)}
                            </p>
                          ) : null}
                        </div>

                        <div className="flex shrink-0 flex-wrap items-center gap-4">
                          {/* Pure text-only status indicator aligned on the action row */}
                          <span className={getStatusTextColorClass(req.status)}>
                            {getStatusText(req.status)}
                          </span>

                          {/* For Not Submitted: Primary Submit button */}
                          {req.status === "Not Submitted" && (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => openDirectUploadModal(req.code)}
                              disabled={!isSubmissionAvailable}
                              className="inline-flex items-center gap-1.5"
                            >
                              <Upload className="h-3.5 w-3.5" />
                              Submit
                            </Button>
                          )}

                          {/* For Needs Revision (Rejected): Primary Resubmit button */}
                          {req.status === "Rejected" && (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => openDirectUploadModal(req.code)}
                              disabled={!isSubmissionAvailable}
                              className="inline-flex items-center gap-1.5 bg-red-600 text-white hover:bg-red-500"
                            >
                              <Upload className="h-3.5 w-3.5" />
                              Resubmit
                            </Button>
                          )}

                          {/* For Pending, Validated, or Rejected: View File button */}
                          {req.status !== "Not Submitted" &&
                          req.latestSubmissionId ? (
                            <>
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => openSubmissionPreview(req)}
                                className="inline-flex items-center gap-2"
                              >
                                {req.feedback &&
                                !viewedSubmissionIds.has(
                                  req.latestSubmissionId,
                                ) ? (
                                  <span
                                    className="h-2 w-2 rounded-full bg-red-500"
                                    aria-hidden="true"
                                  />
                                ) : null}
                                View File
                              </Button>

                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => openVersionHistory(req)}
                                className="inline-flex items-center gap-1.5 text-slate-400 hover:text-slate-100"
                              >
                                <History className="h-3.5 w-3.5" />
                                History
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </div>

                      {/* Rejection / Revision alert */}
                      {req.status === "Rejected" && (
                        <div className="mt-3 rounded-lg border border-red-800/60 bg-red-950/30 p-3">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                            <div className="flex-1">
                              <p className="text-xs font-medium uppercase tracking-wider text-red-400">
                                Revision Required
                              </p>
                              <p className="mt-1 text-sm text-red-200 leading-relaxed">
                                {req.feedback ??
                                  "The reviewer has requested revisions for this requirement. Please resubmit an updated document."}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </article>
            )}

            {selectedRequirementForUpload && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm"
                role="dialog"
                aria-modal="true"
                aria-labelledby="upload-modal-title"
                onClick={closeDirectUploadModal}
              >
                <div
                  className="w-full max-w-2xl rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="flex items-center justify-between border-b border-slate-800 px-6 py-5">
                    <h3
                      id="upload-modal-title"
                      className="text-xl font-semibold text-slate-100"
                    >
                      Upload {REQUIREMENT_LABEL[selectedRequirementForUpload]}
                    </h3>
                    <button
                      type="button"
                      onClick={closeDirectUploadModal}
                      disabled={isUploadingDirect}
                      className="rounded-full border border-slate-700 p-2 text-slate-300 transition hover:bg-slate-800 hover:text-slate-100 disabled:opacity-50"
                      aria-label="Close upload modal"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <form onSubmit={handleDirectUploadSubmit} className="p-6 space-y-5">
                    <div>
                      <label className="block text-xs uppercase tracking-[0.18em] font-semibold text-amber-300 mb-2">
                        Upload Document File
                      </label>
                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          setIsDraggingFile(true);
                        }}
                        onDragLeave={() => setIsDraggingFile(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setIsDraggingFile(false);
                          const droppedFile = e.dataTransfer.files?.[0];
                          if (droppedFile) setDirectUploadFile(droppedFile);
                        }}
                        className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition cursor-pointer ${
                          isDraggingFile
                            ? "border-amber-400 bg-amber-400/10 text-amber-200"
                            : directUploadFile
                              ? "border-emerald-500/60 bg-emerald-950/20 text-emerald-300"
                              : "border-slate-700 bg-slate-950 hover:border-slate-500 text-slate-300"
                        }`}
                        onClick={() => {
                          const input = document.getElementById("directFileInput");
                          if (input) input.click();
                        }}
                      >
                        <input
                          id="directFileInput"
                          type="file"
                          className="hidden"
                          accept=".pdf,.docx,.xlsx,.doc,.jpg,.jpeg,.png"
                          onChange={(e) => {
                            const selected = e.target.files?.[0];
                            if (selected) setDirectUploadFile(selected);
                          }}
                        />

                        <Upload className={`h-8 w-8 mb-2 ${directUploadFile ? "text-emerald-400" : "text-amber-400"}`} />

                        {directUploadFile ? (
                          <div>
                            <p className="font-semibold text-slate-100 text-sm">
                              {directUploadFile.name}
                            </p>
                            <p className="text-xs text-slate-400 mt-1">
                              {(directUploadFile.size / (1024 * 1024)).toFixed(2)} MB · Click or drag to replace
                            </p>
                          </div>
                        ) : (
                          <div>
                            <p className="text-sm font-medium text-slate-200">
                              Drag and drop your file here, or <span className="text-amber-300 underline">browse</span>
                            </p>
                            <p className="mt-1 text-xs text-slate-400">
                              Supported formats: PDF, DOCX, XLSX (Max 10MB)
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="directUploadRemarks"
                        className="block text-xs uppercase tracking-[0.18em] font-semibold text-amber-300 mb-2"
                      >
                        Notes / Remarks for Reviewer (Optional)
                      </label>
                      <textarea
                        id="directUploadRemarks"
                        rows={3}
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-100 outline-none focus:ring focus:ring-amber-300/30"
                        placeholder="Add optional notes or remarks for the reviewer..."
                        value={directUploadRemarks}
                        onChange={(e) => setDirectUploadRemarks(e.target.value)}
                      />
                    </div>

                    {isUploadingDirect && (
                      <div className="flex items-center gap-3 rounded-xl border border-amber-400/40 bg-amber-400/10 p-3.5 text-amber-200">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-amber-400 border-t-transparent shrink-0" />
                        <p className="text-sm font-medium">
                          Uploading document to cloud storage, please wait...
                        </p>
                      </div>
                    )}

                    {directUploadMessage && (
                      <p className={`text-sm rounded-lg p-3 border ${
                        directUploadMessage.startsWith("Error")
                          ? "border-red-800 bg-red-950/40 text-red-300"
                          : "border-emerald-800 bg-emerald-950/40 text-emerald-300"
                      }`}>
                        {directUploadMessage}
                      </p>
                    )}

                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={closeDirectUploadModal}
                        disabled={isUploadingDirect}
                        className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-500 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <Button
                        type="submit"
                        disabled={isUploadingDirect || !directUploadFile}
                        className="inline-flex items-center gap-2"
                      >
                        {isUploadingDirect ? (
                          <>
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                            <span>Uploading...</span>
                          </>
                        ) : (
                          <span>Submit File</span>
                        )}
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {successModalData.isOpen && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm"
                role="dialog"
                aria-modal="true"
                aria-labelledby="success-modal-title"
                onClick={() =>
                  setSuccessModalData({ isOpen: false, requirementTitle: "" })
                }
              >
                <div
                  className="w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900 p-6 text-center shadow-2xl overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-950/80 border border-emerald-500/50 text-emerald-400 mb-4">
                    <CheckCircle2 className="h-10 w-10" />
                  </div>

                  <h3
                    id="success-modal-title"
                    className="text-xl font-bold text-slate-100"
                  >
                    Upload Successful
                  </h3>

                  <div className="mt-6 flex justify-center">
                    <Button
                      type="button"
                      onClick={() => {
                        setSuccessModalData({
                          isOpen: false,
                          requirementTitle: "",
                        });
                        navigateToView("status");
                      }}
                      className="w-full max-w-xs rounded-xl bg-amber-500 hover:bg-amber-400 font-semibold text-slate-950 py-2.5"
                    >
                      Back to Requirements
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {isHistoryModalOpen && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm"
                role="dialog"
                aria-modal="true"
                aria-labelledby="submission-history-title"
                onClick={closeHistoryModal}
              >
                <div
                  className="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="flex items-center justify-between border-b border-slate-800 px-6 py-5">
                    <h3
                      id="submission-history-title"
                      className="text-xl font-semibold text-slate-100"
                    >
                      Submission History
                    </h3>
                    <button
                      type="button"
                      onClick={closeHistoryModal}
                      className="rounded-full border border-slate-700 p-2 text-slate-300 transition hover:bg-slate-800 hover:text-slate-100"
                      aria-label="Close history modal"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/60 px-6 py-3">
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-2">
                        <label
                          htmlFor="modalHistoryAcademicYear"
                          className="text-xs uppercase tracking-wider text-slate-400"
                        >
                          School Year:
                        </label>
                        <select
                          id="modalHistoryAcademicYear"
                          className="rounded-md border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 outline-none focus:ring focus:ring-amber-300/30"
                          value={historyAcademicYear}
                          onChange={(event) =>
                            setHistoryAcademicYear(event.target.value)
                          }
                        >
                          {historyAcademicYears.map((year) => (
                            <option key={year} value={year}>
                              S.Y. {year}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-2">
                        <label
                          htmlFor="modalHistorySemester"
                          className="text-xs uppercase tracking-wider text-slate-400"
                        >
                          Semester:
                        </label>
                        <select
                          id="modalHistorySemester"
                          className="rounded-md border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 outline-none focus:ring focus:ring-amber-300/30"
                          value={historySemester}
                          onChange={(event) =>
                            setHistorySemester(
                              event.target.value as
                                | (typeof SEMESTER_OPTIONS)[number]
                                | "All",
                            )
                          }
                        >
                          {historySemesterOptions.map((semester) => (
                            <option key={semester} value={semester}>
                              {semester === "All" ? "All Semesters" : semester}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => void fetchHistory()}
                      disabled={isLoadingHistory}
                    >
                      {isLoadingHistory ? "Refreshing..." : "Refresh"}
                    </Button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 space-y-3">
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
                          className="rounded-xl border border-slate-800 bg-slate-950 p-4 transition hover:border-slate-700"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-medium text-slate-100">
                                {REQUIREMENT_LABEL[submission.requirementCode]}
                              </p>
                              <p className="mt-1 text-xs text-slate-400">
                                S.Y. {submission.academicYear} ·{" "}
                                {submission.semester}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                Submitted on{" "}
                                {formatSubmittedDateTime(
                                  submission.submittedAt,
                                ) ?? submission.submittedAt}
                              </p>
                            </div>

                            <div className="flex shrink-0 items-center gap-2">
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() =>
                                  openHistorySubmissionPreview(submission)
                                }
                                className="inline-flex items-center gap-2"
                              >
                                {submission.remarks &&
                                !viewedSubmissionIds.has(submission.id) ? (
                                  <span
                                    className="h-2 w-2 rounded-full bg-red-500"
                                    aria-hidden="true"
                                  />
                                ) : null}
                                View File
                              </Button>

                              <span
                                className={getStatusTextColorClass(submission.status)}
                              >
                                {getStatusText(submission.status)}
                              </span>
                            </div>
                          </div>
                        </article>
                      ))
                    ) : (
                      <p className="rounded-xl border border-dashed border-slate-800 bg-slate-950/50 px-4 py-8 text-center text-sm text-slate-400">
                        No past submissions found for the selected school year
                        and semester.
                      </p>
                    )}
                  </div>

                  <div className="flex justify-end border-t border-slate-800 px-6 py-4">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={closeHistoryModal}
                    >
                      Close
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {previewSubmission ? (
              <div
                className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm"
                onClick={closeSubmissionPreview}
              >
                <div
                  className="w-full max-w-4xl rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="flex items-start justify-between border-b border-slate-800 px-6 py-5">
                    <h3 className="text-xl font-semibold text-slate-100">
                      {previewSubmission.title}
                    </h3>
                    <button
                      type="button"
                      onClick={closeSubmissionPreview}
                      className="rounded-full border border-slate-700 p-2 text-slate-300 transition hover:bg-slate-800 hover:text-slate-100"
                      aria-label="Close preview"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
                    <div className="min-h-[60vh] overflow-hidden rounded-2xl border border-slate-700 bg-slate-950">
                      <iframe
                        title={`${previewSubmission.title} preview`}
                        src={getSubmissionPreviewUrl(
                          previewSubmission.latestSubmissionId,
                        )}
                        className="h-full min-h-[60vh] w-full border-0"
                      />
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-2xl border border-slate-700 bg-slate-950 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                          My Note
                        </p>
                        <p className="mt-2 text-sm leading-6 italic text-slate-200">
                          {previewSubmission.note || "No note was added."}
                        </p>
                      </div>

                      {previewSubmission.reviewedAt ||
                      previewSubmission.feedback ? (
                        <div className="rounded-2xl border border-slate-700 bg-slate-950 p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                            Admin Remarks
                          </p>
                          <p className="mt-2 text-sm leading-6 italic text-slate-200">
                            {previewSubmission.feedback ||
                              "No admin remarks were added."}
                          </p>
                          {previewSubmission.reviewedAt ? (
                            <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">
                              Reviewed On
                            </p>
                          ) : null}
                          {previewSubmission.reviewedAt ? (
                            <p className="mt-1 text-sm leading-6 text-slate-300">
                              {previewSubmission.reviewedAt}
                            </p>
                          ) : null}
                        </div>
                      ) : null}

                      {previewSubmission.submittedAt ? (
                        <div className="rounded-2xl border border-slate-700 bg-slate-950 p-4 text-sm text-slate-300">
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                            Submitted On
                          </p>
                          <p className="mt-2 leading-6">
                            {formatSubmittedDateTime(
                              previewSubmission.submittedAt,
                            ) ?? previewSubmission.submittedAt}
                          </p>
                        </div>
                      ) : null}

                      <Button
                        type="button"
                        className="w-full"
                        onClick={() =>
                          window.open(
                            getSubmissionPreviewUrl(
                              previewSubmission.latestSubmissionId,
                            ),
                            "_blank",
                            "noopener,noreferrer",
                          )
                        }
                      >
                        Full View
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {versionHistorySubmissionId && (
              <VersionHistoryModal
                submissionId={versionHistorySubmissionId}
                requirementLabel={versionHistoryLabel}
                requirementCode={versionHistoryCode}
                onClose={closeVersionHistory}
              />
            )}

            {showIncompleteRequirementsModal ? (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm"
                role="dialog"
                aria-modal="true"
                aria-labelledby="incomplete-requirements-title"
              >
                <div className="w-full max-w-2xl rounded-3xl border border-amber-400/30 bg-slate-900 p-6 shadow-2xl">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm uppercase tracking-[0.18em] text-amber-300">
                        Attention Required
                      </p>
                      <h3
                        id="incomplete-requirements-title"
                        className="mt-2 text-2xl font-semibold text-slate-100"
                      >
                        Some requirements still need your attention
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setHasSeenIncompleteRequirementsModal(true);
                      }}
                      className="rounded-full border border-slate-700 p-2 text-slate-300 transition hover:bg-slate-800 hover:text-slate-100"
                      aria-label="Close alert"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-5 space-y-4 text-slate-300">
                    <p>
                      You have pending or not submitted requirements for the
                      current submission window. Please submit the missing
                      documents before the due date.
                    </p>
                    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
                      <p>
                        Remaining requirements:{" "}
                        <strong>{statusCounts?.pending ?? 0}</strong> pending,{" "}
                        <strong>{statusCounts?.notSubmitted ?? 0}</strong> not
                        submitted.
                      </p>
                      {submissionWindow?.endDate ? (
                        <p className="mt-2">
                          Due date: <strong>{submissionWindow.endDate}</strong>
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <Button
                        type="button"
                        onClick={() => {
                          setHasSeenIncompleteRequirementsModal(true);
                          navigateToView("status");
                        }}
                      >
                        Go to Requirements Management
                      </Button>
                      <button
                        type="button"
                        onClick={() => {
                          setHasSeenIncompleteRequirementsModal(true);
                        }}
                        className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-500"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}



            {activeView === "settings" && (
              <article className="min-h-[calc(100vh-4rem-3rem)] p-6 pt-0">
                <FacultySettingsPanel />
              </article>
            )}

            {isSubmitModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm">
                <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
                  <div className="flex items-start justify-between border-b border-slate-700 px-6 py-5">
                    <h3 className="text-lg font-semibold text-amber-300">
                      Submit Requirement
                    </h3>
                    <button
                      type="button"
                      onClick={closeSubmitModal}
                      className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-100 hover:border-slate-500"
                    >
                      Close
                    </button>
                  </div>

                  <div className="max-h-[75vh] overflow-y-auto p-6">
                    {isSubmissionAvailable ? (
                      <form className="space-y-4" onSubmit={handleSubmit}>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="grid gap-4 md:grid-cols-2">
                            <div>
                              <label className="text-xs uppercase tracking-[0.18em] text-amber-300">
                                School Year
                              </label>
                              <p className="mt-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-slate-100">
                                {form.academicYear
                                  ? `S.Y. ${form.academicYear}`
                                  : "Loading current term..."}
                              </p>
                            </div>

                            <div>
                              <label className="text-xs uppercase tracking-[0.18em] text-amber-300">
                                Semester
                              </label>
                              <p className="mt-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-slate-100">
                                {form.semester}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div>
                          <label
                            className="text-xs uppercase tracking-[0.18em] text-amber-300"
                            htmlFor="modalRequirementCode"
                          >
                            Requirement Type
                          </label>
                          <select
                            id="modalRequirementCode"
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
                                <option
                                  key={code}
                                  value={code}
                                  disabled={disabled}
                                >
                                  {REQUIREMENT_LABEL[code]}
                                </option>
                              );
                            })}
                          </select>
                        </div>

                        <div>
                          <label
                            className="text-xs uppercase tracking-[0.18em] text-amber-300"
                            htmlFor="modalFileName"
                          >
                            File to Submit
                          </label>
                          <input
                            ref={fileInputRef}
                            id="modalFileName"
                            type="file"
                            className="mt-0 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-300 outline-none file:mr-4 file:rounded-md file:border-0 file:bg-amber-500 file:px-4 file:py-2 file:text-sm file:font-medium file:text-slate-950 hover:file:bg-amber-400 disabled:opacity-50"
                            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              updateField("fileName", file?.name ?? "");
                            }}
                            disabled={(() => {
                              const s = getRequirementStatus(
                                form.requirementCode,
                              );
                              return s === "Pending" || s === "Validated";
                            })()}
                          />
                        </div>

                        <div>
                          <label
                            className="text-xs uppercase tracking-[0.18em] text-amber-300"
                            htmlFor="modalRemarks"
                          >
                            Remarks
                          </label>
                          <textarea
                            id="modalRemarks"
                            className="mt-0 min-h-24 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:ring focus:ring-amber-300/30"
                            placeholder="Enter remarks or notes (optional)"
                            value={form.remarks}
                            onChange={(event) =>
                              updateField("remarks", event.target.value)
                            }
                          />
                        </div>

                        <div className="flex items-center gap-3">
                          <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting
                              ? "Submitting..."
                              : "Submit Requirements"}
                          </Button>
                          <button
                            type="button"
                            onClick={closeSubmitModal}
                            className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500"
                          >
                            Cancel
                          </button>
                        </div>

                        {submissionMessage && (
                          <p className="text-sm text-slate-300">
                            {submissionMessage}
                          </p>
                        )}
                      </form>
                    ) : (
                      <div className="rounded-xl border border-slate-700 bg-slate-950 p-4 text-sm text-slate-300">
                        {isLoadingSubmissionWindow
                          ? "Checking submission window..."
                          : submissionWindow?.isConfigured
                            ? `Submission is closed. Available only from ${submissionWindow.startDate} ${submissionWindow.startTimeLabel ?? submissionWindow.startTime ?? ""} to ${submissionWindow.endDate} ${submissionWindow.endTimeLabel ?? submissionWindow.endTime ?? ""}.`
                            : "Submission is not configured yet. Please wait for the admin to open the submission window."}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FacultySubmissionPanelFallback() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-950 text-amber-400 p-8">
      <div className="flex items-center gap-3">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
        <span className="text-sm font-medium">Loading panel...</span>
      </div>
    </div>
  );
}

export function FacultySubmissionPanel(props: { facultyName?: string | null }) {
  return (
    <Suspense fallback={<FacultySubmissionPanelFallback />}>
      <FacultySubmissionPanelContent {...props} />
    </Suspense>
  );
}
