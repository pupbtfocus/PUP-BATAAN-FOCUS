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
import { extractFirstName } from "@/lib/faculty-profile";
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
import type { FacultyInitialData } from "@/features/submissions/services/faculty-data.service";
import { SubmissionStatusBadge } from "@/features/submissions/components/submission-status-badge";
import { DocumentUploadZone } from "@/features/submissions/components/document-upload-zone";
import { SubmissionHistoryList } from "@/features/submissions/components/submission-history-list";
import {
  StatusMetricsSkeleton,
  ComplianceListSkeleton,
  SubmissionHistorySkeleton,
  DashboardMetricsSkeleton,
  SubmissionWindowSkeleton,
} from "@/features/submissions/components/submission-skeletons";
import { Menu, X, LayoutDashboard, ClipboardList, History, Settings, FileText, AlertCircle, Upload, UploadCloud, CheckCircle2, Calendar, Loader2, Eye, RotateCw, Clock3, Download, ExternalLink, ArrowRight, Sparkles, FileSpreadsheet, FileCheck } from "lucide-react";
import { LogoutButton } from "@/components/shared/logout-button";
import { NotificationDrawer } from "@/features/notifications/components/notification-drawer";

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
  admin_remarks?: string;
  adminRemarks?: string | null;
  remarks?: string;
  note?: string | null;
  submittedAt?: string;
  latestSubmissionId?: string;
  is_read?: boolean;
  isViewed?: boolean;
  viewed_at?: string;
};

type SubmissionPreview = {
  code: RequirementCode;
  title: string;
  submittedAt?: string;
  note?: string | null;
  feedback?: string;
  admin_remarks?: string;
  adminRemarks?: string | null;
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
  admin_remarks?: string;
  adminRemarks?: string | null;
  feedback?: string;
  reviewedAt?: string;
  is_read?: boolean;
  isViewed?: boolean;
  viewed_at?: string;
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

function normalizeSemester(sem?: string | null): string {
  if (!sem) return "";
  const s = sem.toLowerCase().trim();
  if (s.includes("1") || s.includes("first") || s.includes("1st")) return "1st semester";
  if (s.includes("2") || s.includes("second") || s.includes("2nd")) return "2nd semester";
  if (s.includes("3") || s.includes("third") || s.includes("3rd") || s.includes("summer")) return "3rd semester";
  return s;
}

function normalizeAcademicYear(ay?: string | null): string {
  if (!ay) return "";
  return ay.toLowerCase().trim().replace(/^s\.?y\.?\s*/i, "").replace(/^a\.?y\.?\s*/i, "");
}

function getStatusDotColor(
  status: RequirementStatus["status"] | HistorySubmissionStatus,
): string {
  if (status === "Validated") return "bg-emerald-400";
  if (status === "Rejected") return "bg-amber-400";
  if (status === "Not Submitted") return "bg-slate-600";
  return "bg-blue-400";
}

function getStatusTextColor(
  status: RequirementStatus["status"] | HistorySubmissionStatus,
): string {
  if (status === "Validated") return "text-emerald-700 dark:text-emerald-400";
  if (status === "Rejected") return "text-amber-700 dark:text-amber-400";
  if (status === "Not Submitted") return "text-slate-500 dark:text-slate-500";
  return "text-blue-700 dark:text-blue-400";
}

function getStatusTextColorClass(
  status: RequirementStatus["status"] | HistorySubmissionStatus,
): string {
  return getStatusTextColor(status);
}

function getStatusBadgeTone(
  status: RequirementStatus["status"] | HistorySubmissionStatus,
): string {
  if (status === "Validated")
    return "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400";
  if (status === "Rejected")
    return "border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400";
  if (status === "Not Submitted")
    return "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700/50 dark:bg-slate-800/60 dark:text-slate-400 font-semibold";
  return "border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-400";
}

function getStatusIcon(
  status: RequirementStatus["status"] | HistorySubmissionStatus,
) {
  if (status === "Validated") return <CheckCircle2 className="h-3 w-3" />;
  if (status === "Rejected") return <AlertCircle className="h-3 w-3" />;
  if (status === "Not Submitted")
    return <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />;
  return <Clock3 className="h-3 w-3" />;
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

export interface FacultySubmissionPanelProps {
  facultyName?: string | null;
  initialData?: FacultyInitialData | null;
  initialView?: PanelView;
}

function FacultySubmissionPanelContent({
  facultyName,
  initialData,
  initialView = "dashboard",
}: FacultySubmissionPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const academicYears = useMemo(() => buildAcademicYearOptions(), []);
  const facultyFirstName = useMemo(() => extractFirstName(facultyName, "Faculty"), [facultyName]);
  const [isMounted, setIsMounted] = useState(false);
  const [activeView, setActiveView] = useState<PanelView>(initialView);
  const [form, setForm] = useState<SubmissionFormState>({
    academicYear: initialData?.academicYear || academicYears[0] || "",
    semester: (initialData?.semester as (typeof SEMESTER_OPTIONS)[number]) || "1st Semester",
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
  const [historyAcademicYear, setHistoryAcademicYear] = useState<string>("All");
  const [historySemester, setHistorySemester] = useState<
    (typeof SEMESTER_OPTIONS)[number] | "All"
  >("All");
  const [pastSubmissions, setPastSubmissions] = useState<PastSubmission[]>(
    () => (initialData?.pastSubmissions as PastSubmission[]) || [],
  );
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [requirementStatuses, setRequirementStatuses] = useState<
    RequirementStatus[]
  >(() => (initialData?.requirementStatuses as RequirementStatus[]) || []);
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
  } | null>(() => initialData?.counts || null);
  const [isLoadingStatuses, setIsLoadingStatuses] = useState(!initialData);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [submissionWindow, setSubmissionWindow] =
    useState<SubmissionWindowState | null>(
      () => (initialData?.submissionWindow as SubmissionWindowState) || null,
    );
  const [hasActiveSchedule, setHasActiveSchedule] = useState<boolean>(
    () => initialData?.hasActiveSchedule ?? true,
  );
  const [statusAcademicYear, setStatusAcademicYear] = useState<string>(
    () => initialData?.academicYear || "",
  );
  const [statusSemester, setStatusSemester] = useState<string>(
    () => initialData?.semester || "",
  );
  const [isLoadingSubmissionWindow, setIsLoadingSubmissionWindow] =
    useState(!initialData);
  const [versionHistorySubmissionId, setVersionHistorySubmissionId] =
    useState<string | null>(null);
  const [versionHistoryLabel, setVersionHistoryLabel] = useState("");
  const [versionHistoryCode, setVersionHistoryCode] = useState("");
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [successModalData, setSuccessModalData] = useState<{
    isOpen: boolean;
    requirementTitle: string;
  }>({ isOpen: false, requirementTitle: "" });

  // ─── Mobile menu state ────────────────────────────────────────────
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // ─── Page-load overlay state ───────────────────────────────────────
  const [isPageLoading, setIsPageLoading] = useState(!initialData);

  useEffect(() => {
    if (!initialData) {
      const timer = setTimeout(() => setIsPageLoading(false), 400);
      return () => clearTimeout(timer);
    }
  }, [initialData]);

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

  const [isSubmittingModalOpen, setIsSubmittingModalOpen] = useState(false);
  const [isSubmitSuccess, setIsSubmitSuccess] = useState(false);

  function handleCloseModalAndRefresh() {
    setIsSubmittingModalOpen(false);
    setIsSubmitSuccess(false);
    closeDirectUploadModal();
    router.refresh();
    void fetchStatuses();
  }

  const hasSubmissionWindowAcademicTerm = Boolean(
    submissionWindow?.isConfigured &&
    submissionWindow.academicYear &&
    submissionWindow.semester,
  );

  const historyAcademicYears = useMemo(() => {
    const yearsSet = new Set<string>(academicYears);
    pastSubmissions.forEach((sub) => {
      if (sub.academicYear) yearsSet.add(sub.academicYear);
    });
    return ["All", ...Array.from(yearsSet)];
  }, [academicYears, pastSubmissions]);

  const historySemesterOptions = useMemo<
    Array<(typeof SEMESTER_OPTIONS)[number] | "All">
  >(() => {
    return ["All", ...SEMESTER_OPTIONS];
  }, []);
  const [
    hasSeenIncompleteRequirementsModal,
    setHasSeenIncompleteRequirementsModal,
  ] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    try {
      if (sessionStorage.getItem("dismissed_requirement_alert") === "true") {
        setHasSeenIncompleteRequirementsModal(true);
      }
    } catch {
      // safe
    }
    try {
      const cached = localStorage.getItem("pup_focus_viewed_submission_ids");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          setViewedSubmissionIds(new Set(parsed));
        }
      }
    } catch {
      // safe
    }
  }, []);

  function dismissIncompleteRequirementsAlert() {
    setHasSeenIncompleteRequirementsModal(true);
    try {
      sessionStorage.setItem("dismissed_requirement_alert", "true");
    } catch {
      // safe
    }
  }

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
      const historyList: PastSubmission[] = data.submissions || [];
      setPastSubmissions(historyList);

      setViewedSubmissionIds((current) => {
        const next = new Set(current);
        historyList.forEach((s) => {
          if (s.id && (s.is_read || s.isViewed)) {
            next.add(s.id);
          }
        });
        return next;
      });
    } catch {
      setHistoryError("Error loading submission history");
    } finally {
      setIsLoadingHistory(false);
    }
  }

  async function fetchStatuses(year?: string, sem?: string) {
    try {
      setIsLoadingStatuses(true);
      setStatusError(null);

      const params = new URLSearchParams();
      if (year && sem) {
        params.set("academicYear", year);
        params.set("semester", sem);
      }

      const response = await fetch(`/api/faculty/submissions/status?${params.toString()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      if (response.ok) {
        const data = await response.json();
        const statuses: RequirementStatus[] = data.requirementStatuses || [];
        setRequirementStatuses(statuses);
        setStatusCounts(data.counts || null);
        if (data.academicYear) setStatusAcademicYear(data.academicYear);
        if (data.semester) setStatusSemester(data.semester);
        if (typeof data.hasActiveSchedule === "boolean") {
          setHasActiveSchedule(data.hasActiveSchedule);
        }

        setViewedSubmissionIds((current) => {
          const next = new Set(current);
          try {
            const cached = localStorage.getItem("pup_focus_viewed_submission_ids");
            if (cached) {
              const parsed = JSON.parse(cached);
              if (Array.isArray(parsed)) {
                parsed.forEach((id: string) => next.add(id));
              }
            }
          } catch {
            // safe fallback
          }

          statuses.forEach((r) => {
            if (r.latestSubmissionId && (r.is_read || r.isViewed)) {
              next.add(r.latestSubmissionId);
            }
          });
          return next;
        });
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
    if (!initialData) {
      void fetchStatuses();
      void refetchSubmissionWindow();
    }
  }, [initialData, refetchSubmissionWindow]);

  // Deep-linking, view routing, and auto-scrolling with highlight
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const view = params.get("view");
      const highlightParam =
        params.get("highlight") || params.get("requirement");
      const historyParam = params.get("history");

      if (view === "history" || (view === "status" && historyParam === "true")) {
        setActiveView("status");
        setIsHistoryModalOpen(true);
      } else if (highlightParam) {
        setActiveView("status");
      } else if (view && (PANEL_VIEWS as readonly string[]).includes(view)) {
        setActiveView(view as PanelView);
      }

      if (highlightParam) {
        const timer = setTimeout(() => {
          const targetElement =
            document.getElementById(`requirement-${highlightParam}`) ||
            document.getElementById(highlightParam);
          if (targetElement) {
            targetElement.scrollIntoView({ behavior: "smooth", block: "center" });
            targetElement.classList.add(
              "ring-2",
              "ring-amber-400",
              "bg-amber-500/10",
            );
            setTimeout(() => {
              targetElement.classList.remove(
                "ring-2",
                "ring-amber-400",
                "bg-amber-500/10",
              );
            }, 3500);
          }
        }, 500);
        return () => clearTimeout(timer);
      }
    } catch {
      // ignore
    }
  }, [searchParams, requirementStatuses]);

  useEffect(() => {
    if (submissionWindow?.academicYear && submissionWindow?.semester) {
      void fetchStatuses(submissionWindow.academicYear, submissionWindow.semester);
    }
  }, [submissionWindow]);

  useEffect(() => {
    if (isHistoryModalOpen) {
      void fetchHistory();
    }
  }, [isHistoryModalOpen]);

  useEffect(() => {
    if (!submissionWindow) {
      return;
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

    setSelectedAcademicYear(currentTerm.academicYear);
    setSelectedSemester(currentTerm.semester);
  }, [submissionWindow]);

  useEffect(() => {
    if (!historyAcademicYears.includes(historyAcademicYear)) {
      setHistoryAcademicYear(historyAcademicYears[0] ?? "All");
    }

    if (!historySemesterOptions.includes(historySemester)) {
      setHistorySemester(historySemesterOptions[0] ?? "All");
    }
  }, [historyAcademicYears, historySemesterOptions]);

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
    setIsMobileMenuOpen(false);

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
      const matchesYear =
        historyAcademicYear === "All" || submission.academicYear === historyAcademicYear;
      const matchesSemester =
        historySemester === "All" || submission.semester === historySemester;
      return matchesYear && matchesSemester;
    });
  }, [historyAcademicYear, historySemester, pastSubmissions]);

  const deduplicatedRecentActivities = useMemo(() => {
    const seen = new Set<string>();
    const list: PastSubmission[] = [];

    for (const sub of pastSubmissions) {
      const key = `${sub.requirementCode}-${sub.status}-${sub.submittedAt}`;
      if (!seen.has(key)) {
        seen.add(key);
        list.push(sub);
      }
      if (list.length >= 4) break;
    }

    return list;
  }, [pastSubmissions]);

  const activeAY = submissionWindow?.academicYear || selectedAcademicYear || form.academicYear;
  const activeSem = submissionWindow?.semester || selectedSemester || form.semester;

  const displayedRequirementStatuses = useMemo<RequirementStatus[]>(() => {
    if (!hasActiveSchedule) {
      return DEFAULT_REQUIREMENTS.map((code) => ({
        code,
        status: "Not Submitted" as const,
      }));
    }

    const normActiveAY = normalizeAcademicYear(activeAY);
    const normActiveSem = normalizeSemester(activeSem);

    return DEFAULT_REQUIREMENTS.map((code) => {
      const live = requirementStatuses.find((r) => r.code === code);
      if (live && live.status !== "Not Submitted") {
        return live;
      }

      const match = pastSubmissions.find((s) => {
        if (s.requirementCode !== code) return false;
        const subSem = normalizeSemester(s.semester);
        const subYear = normalizeAcademicYear(s.academicYear);
        return subSem === normActiveSem && subYear === normActiveAY;
      });

      if (match) {
        const adminRemarks =
          match.adminRemarks ||
          match.admin_remarks ||
          match.feedback ||
          match.remarks ||
          null;

        return {
          code: match.requirementCode || code,
          status:
            match.status === "Validated"
              ? "Validated"
              : match.status === "Rejected"
                ? "Rejected"
                : "Pending",
          submittedAt: match.submittedAt,
          reviewedAt: match.reviewedAt,
          note: match.note || null,
          latestSubmissionId: match.id,
          adminRemarks: adminRemarks,
          admin_remarks: adminRemarks || undefined,
          feedback: adminRemarks || undefined,
        };
      }

      if (live) {
        const liveAdminRemarks =
          live.adminRemarks ||
          live.admin_remarks ||
          live.feedback ||
          live.remarks ||
          null;

        return {
          ...live,
          adminRemarks: liveAdminRemarks,
          admin_remarks: liveAdminRemarks || undefined,
          feedback: liveAdminRemarks || undefined,
        };
      }

      return {
        code,
        status: "Not Submitted" as const,
      };
    });
  }, [hasActiveSchedule, activeAY, activeSem, pastSubmissions, requirementStatuses]);

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

  const windowDeadlineDisplay = useMemo(() => {
    if (!submissionWindow?.endDate) return null;
    const parsed = new Date(`${submissionWindow.endDate}T${submissionWindow.endTime || "23:59:59"}`);
    if (Number.isNaN(parsed.getTime())) return submissionWindow.endDate;
    return parsed.toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }, [submissionWindow]);

  const windowDaysRemaining = useMemo(() => {
    if (!submissionWindow?.endDate) return null;
    const targetMs = new Date(`${submissionWindow.endDate}T${submissionWindow.endTime || "23:59:59"}`).getTime();
    if (Number.isNaN(targetMs)) return null;
    const diffMs = targetMs - Date.now();
    if (diffMs <= 0) return 0;
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }, [submissionWindow]);

  const showIncompleteRequirementsModal =
    isMounted &&
    activeView === "dashboard" &&
    !hasSeenIncompleteRequirementsModal &&
    Boolean(submissionWindow?.isConfigured && submissionWindow?.isOpen) &&
    displayedStatusCounts !== null &&
    (displayedStatusCounts.notSubmitted + displayedStatusCounts.rejected > 0);

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
    setIsSubmittingModalOpen(true);
    setIsSubmitSuccess(false);
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
        setIsSubmittingModalOpen(false);
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

      setIsSubmitSuccess(true);
      router.refresh();
      void fetchStatuses();
      void fetchHistory();
    } catch (error) {
      setIsSubmittingModalOpen(false);
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

  function getRequirementStatusItem(code: RequirementCode) {
    return requirementStatuses.find((r) => r.code === code);
  }

  function markSubmissionViewed(submissionId: string) {
    if (!submissionId) return;

    setViewedSubmissionIds((current) => {
      const next = new Set(current);
      next.add(submissionId);
      try {
        localStorage.setItem(
          "pup_focus_viewed_submission_ids",
          JSON.stringify(Array.from(next)),
        );
      } catch {
        // safe
      }
      return next;
    });

    // Persist viewed state to backend database
    void fetch("/api/faculty/submissions/mark-viewed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId }),
    }).catch((err) => {
      console.warn("Failed to persist mark-viewed on server:", err);
    });
  }

  function openSubmissionPreview(item: RequirementStatus) {
    if (!item.latestSubmissionId) {
      return;
    }

    markSubmissionViewed(item.latestSubmissionId);

    const adminRemarks =
      item.adminRemarks ||
      item.admin_remarks ||
      item.feedback ||
      item.remarks ||
      null;

    setPreviewSubmission({
      code: item.code,
      title: REQUIREMENT_LABEL[item.code],
      submittedAt: item.submittedAt,
      note: item.note,
      feedback: adminRemarks || undefined,
      admin_remarks: adminRemarks || undefined,
      adminRemarks: adminRemarks,
      reviewedAt: item.reviewedAt,
      latestSubmissionId: item.latestSubmissionId,
    });
  }

  function openHistorySubmissionPreview(submission: PastSubmission) {
    markSubmissionViewed(submission.id);

    const adminRemarks =
      submission.adminRemarks ||
      submission.admin_remarks ||
      submission.feedback ||
      submission.remarks ||
      null;

    setPreviewSubmission({
      code: submission.requirementCode,
      title: REQUIREMENT_LABEL[submission.requirementCode],
      submittedAt: submission.submittedAt,
      note: submission.note,
      feedback: adminRemarks || undefined,
      admin_remarks: adminRemarks || undefined,
      adminRemarks: adminRemarks,
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

      await Promise.all([fetchStatuses(), fetchHistory()]);
      router.refresh();

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
  const isWindowClosed = !isSubmissionAvailable;

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
      {/* Mobile Menu Button (visible only on small screens when drawer is closed) */}
      {!isMobileMenuOpen && (
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(true)}
          className="fixed left-3 top-2.5 z-[55] md:hidden p-1.5 text-amber-300 hover:bg-amber-500/10 rounded-xl transition-all"
          aria-label="Open Navigation Menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      )}

      {/* Desktop Sidebar (hidden on mobile) */}
      <aside className="hidden md:flex md:flex-col fixed left-0 top-14 h-[calc(100vh-3.5rem)] w-56 overflow-y-auto rounded-none border-r border-l-0 border-slate-300 dark:border-slate-800 bg-[#F6F8FC] dark:bg-slate-950 p-2.5 shadow-sm transition-colors duration-200">
        <div className="my-1.5 rounded-2xl bg-white/80 border-2 border-slate-300 dark:border dark:border-slate-800 p-2.5 flex flex-col items-center shadow-sm shadow-slate-200/60 dark:shadow-none transition-colors">
          <p className="mt-0.5 font-semibold text-slate-900 dark:text-white text-center text-xs sm:text-sm">
            {facultyFirstName}
          </p>

          <div className="my-1.5 h-px w-full bg-slate-200 dark:bg-slate-800" />

          <span className="mt-0.5 inline-flex items-center justify-center px-2.5 py-0.5 text-[10px] uppercase tracking-[0.12em] font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20">
            Faculty
          </span>
        </div>

        <div className="my-2">
          <SubmissionWindowCountdown
            window={submissionWindow}
            isLoading={isLoadingSubmissionWindow}
            onExpired={handleWindowExpired}
          />
        </div>

        <nav className="mt-1.5 space-y-1">
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
                className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-xs transition-all ${
                  isActive
                    ? "rounded-full bg-amber-500/15 text-amber-950 dark:bg-amber-500/20 dark:text-amber-300 font-semibold"
                    : "rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800/50 font-medium"
                }`}
              >
                <Icon size={16} className={isActive ? "text-amber-700 dark:text-amber-300" : "text-slate-500 dark:text-slate-400"} />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Mobile Drawer (visible only on small screens when drawer is open) */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm md:hidden flex"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <aside
            className="relative flex flex-col h-full w-64 bg-[#F6F8FC] dark:bg-slate-950 border-r border-slate-300 dark:border-slate-800 p-4 shadow-2xl transition-colors duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-2">
              <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">Faculty Menu</span>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="my-1.5 rounded-2xl bg-white/80 border-2 border-slate-300 dark:border dark:border-slate-800 p-2.5 flex flex-col items-center shadow-sm shadow-slate-200/60 dark:shadow-none transition-colors">
              <p className="mt-0.5 font-semibold text-slate-900 dark:text-white text-center text-xs sm:text-sm">
                {facultyFirstName}
              </p>

              <div className="my-1.5 h-px w-full bg-slate-200 dark:bg-slate-800" />

              <span className="mt-0.5 inline-flex items-center justify-center px-2.5 py-0.5 text-[10px] uppercase tracking-[0.12em] font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20">
                Faculty
              </span>
            </div>

            <div className="my-2">
              <SubmissionWindowCountdown
                window={submissionWindow}
                isLoading={isLoadingSubmissionWindow}
                onExpired={handleWindowExpired}
              />
            </div>

            <nav className="mt-1.5 space-y-1 flex-1">
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
                    className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-xs transition-all ${
                      isActive
                        ? "rounded-full bg-amber-500/15 text-amber-950 dark:bg-amber-500/20 dark:text-amber-300 font-semibold"
                        : "rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800/50 font-medium"
                    }`}
                  >
                    <Icon size={16} className={isActive ? "text-amber-700 dark:text-amber-300" : "text-slate-500 dark:text-slate-400"} />
                    <span>{label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      <div className="md:ml-56 flex min-h-full w-full md:w-[calc(100%-14rem)] flex-col">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-l border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition-colors duration-200">
          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
            {activeView === "submit" ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-300 dark:border-slate-800 pb-4 mb-6">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                    Submit Requirements
                  </h1>
                </div>
              </div>
            ) : null}
            {activeView === "dashboard" && (
              <article className="space-y-6">
                {/* Top Hero Section */}
                <section className="relative overflow-hidden rounded-2xl border-2 border-slate-300 bg-gradient-to-r from-white via-slate-50 to-white dark:border dark:border-slate-800/80 dark:bg-gradient-to-r dark:from-slate-900/90 dark:via-slate-900/80 dark:to-slate-950 p-6 sm:p-7 shadow-sm shadow-slate-200/60 dark:shadow-none transition-colors">
                  {/* Subtle Campus Photo Backdrop Overlay */}
                  <div className="absolute inset-0 pointer-events-none opacity-[0.06] dark:opacity-[0.14] mix-blend-luminosity overflow-hidden">
                    <Image
                      src={LOGIN_PAGE_IMAGES[0]}
                      alt="PUP Bataan campus backdrop"
                      fill
                      sizes="100vw"
                      className="object-cover object-center"
                      priority
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-white/90 via-white/50 to-white/90 dark:from-slate-950 dark:via-slate-900/60 dark:to-slate-950/90" />
                  </div>

                  <div className="relative z-10 space-y-1">
                    <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
                      Welcome back, {facultyFirstName}
                    </h1>
                    <p className="text-xs text-slate-600 dark:text-slate-400 font-normal">
                      {submissionWindow
                        ? `A.Y. ${submissionWindow.academicYear} • ${submissionWindow.semester}`
                        : "A.Y. 2026-2027 • 1st Semester"}
                    </p>
                  </div>
                </section>

                {/* Top Stat Summary Grid (3 Cards) */}
                <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {/* Card 1: Overall Progress */}
                  <div className="rounded-2xl border-2 border-slate-300 bg-white shadow-sm shadow-slate-200/60 dark:border dark:border-slate-800/80 dark:bg-slate-900/60 dark:shadow-none p-5 space-y-3 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Overall Progress</span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-100 border border-emerald-200 dark:text-emerald-400 dark:bg-emerald-500/10 dark:border-emerald-500/20 px-2 py-0.5 rounded-full">
                        {Math.round(((displayedStatusCounts?.validated ?? 0) / (displayedStatusCounts?.total || 6)) * 100)}%
                      </span>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                        {displayedStatusCounts?.validated ?? 0} of {displayedStatusCounts?.total ?? 6} Validated
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {isAllValidated
                          ? "All documents completed and validated"
                          : `${(displayedStatusCounts?.total ?? 6) - (displayedStatusCounts?.validated ?? 0)} items awaiting completion`}
                      </p>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800/90 border-2 border-slate-300 dark:border dark:border-slate-700">
                      <div
                        className="h-full bg-emerald-500 transition-all duration-500 rounded-full"
                        style={{
                          width: `${Math.min(100, Math.round(((displayedStatusCounts?.validated ?? 0) / (displayedStatusCounts?.total || 6)) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Card 2: Submission Window Status */}
                  <div className="rounded-2xl border-2 border-slate-300 bg-white shadow-sm shadow-slate-200/60 dark:border dark:border-slate-800/80 dark:bg-slate-900/60 dark:shadow-none p-5 space-y-3 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Window Status</span>
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                          hasActiveSchedule && !isWindowClosed
                            ? "text-blue-800 bg-blue-100 border-blue-200 dark:text-blue-400 dark:bg-blue-500/10 dark:border-blue-500/20"
                            : "text-amber-800 bg-amber-100 border-amber-200 dark:text-amber-400 dark:bg-amber-500/10 dark:border-amber-500/20"
                        }`}
                      >
                        {hasActiveSchedule && !isWindowClosed ? "Open" : "Closed"}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                        {!hasActiveSchedule
                          ? "No Active Window"
                          : isWindowClosed
                            ? "Window Closed"
                            : "Submission Open"}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {windowDeadlineDisplay
                          ? `Deadline: ${windowDeadlineDisplay}`
                          : "Schedule not configured"}
                      </p>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {hasActiveSchedule && !isWindowClosed
                        ? "Uploads and resubmissions are currently enabled"
                        : "Document submissions are currently locked"}
                    </p>
                  </div>

                  {/* Card 3: Action Required */}
                  <div className="rounded-2xl border-2 border-slate-300 bg-white shadow-sm shadow-slate-200/60 dark:border dark:border-slate-800/80 dark:bg-slate-900/60 dark:shadow-none p-5 space-y-3 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Action Required</span>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                        {(displayedStatusCounts?.notSubmitted ?? 0) + (displayedStatusCounts?.rejected ?? 0)} Items
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {displayedStatusCounts?.notSubmitted ?? 0} Not Submitted • {displayedStatusCounts?.rejected ?? 0} Needs Revision
                      </p>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {(displayedStatusCounts?.pending ?? 0) > 0
                        ? `${displayedStatusCounts?.pending} item(s) currently under admin review`
                        : "Direct upload available for pending items"}
                    </p>
                  </div>
                </section>

                {/* Main Dashboard Body (2-Column Grid) */}
                <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                  {/* Left Column (2 Span - Action Required Checklist) */}
                  <div className="lg:col-span-2 space-y-4">
                    <div className="rounded-2xl border-2 border-slate-300 bg-white shadow-sm shadow-slate-200/60 dark:border dark:border-slate-800/80 dark:bg-slate-900/60 dark:shadow-none p-5 sm:p-6 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-200 dark:border-slate-800/80">
                        <div>
                          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 tracking-normal">
                            Pending Requirements
                          </h2>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                            Documents awaiting your submission or revision for this semester.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => navigateToView("status")}
                          className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 font-medium transition cursor-pointer"
                        >
                          <span>View all 6</span>
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      </div>

                      {isLoadingStatuses ? (
                        <p className="text-xs text-slate-500 dark:text-slate-400 py-6 text-center">Loading requirements...</p>
                      ) : (
                        <div className="mt-4">
                          {displayedRequirementStatuses.filter(
                            (req) => req.status === "Not Submitted" || req.status === "Rejected"
                          ).length === 0 ? (
                            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6 text-center space-y-2">
                              <CheckCircle2 className="h-8 w-8 text-emerald-500 dark:text-emerald-400 mx-auto" />
                              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                Great job! No pending requirements.
                              </h3>
                              <p className="text-xs text-slate-600 dark:text-slate-400 max-w-sm mx-auto">
                                All 6 required faculty documents have been submitted or validated for this semester.
                              </p>
                              <button
                                type="button"
                                onClick={() => navigateToView("status")}
                                className="mt-2 inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-slate-300 dark:hover:text-slate-100 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs font-medium transition cursor-pointer"
                              >
                                View Requirements Table
                              </button>
                            </div>
                          ) : (
                            <div className="bg-slate-50/60 dark:bg-slate-950/60 border-2 border-slate-300/80 dark:border dark:border-slate-800/80 rounded-2xl divide-y divide-slate-200 dark:divide-slate-800/60 overflow-hidden shadow-xs">
                              {displayedRequirementStatuses
                                .filter((req) => req.status === "Not Submitted" || req.status === "Rejected")
                                .map((req) => (
                                  <div
                                    key={req.code}
                                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-100/80 dark:hover:bg-slate-800/20 transition-colors"
                                  >
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <h4 className="text-sm font-medium text-slate-900 dark:text-slate-200 truncate">
                                          {REQUIREMENT_LABEL[req.code]}
                                        </h4>
                                        <SubmissionStatusBadge status={req.status} size="sm" />
                                      </div>
                                      {req.status === "Rejected" && (
                                        <p className="text-xs text-amber-700 dark:text-amber-300/90 flex items-center gap-1.5 mt-1.5 font-normal">
                                          <AlertCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400/90 shrink-0" />
                                          <span className="italic truncate">
                                            &ldquo;{req.adminRemarks || req.admin_remarks || req.feedback || "Revision requested. Please check and resubmit."}&rdquo;
                                          </span>
                                        </p>
                                      )}
                                    </div>

                                    <div className="shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => openDirectUploadModal(req.code)}
                                        disabled={!hasActiveSchedule || isWindowClosed}
                                        className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-3 py-1.5 rounded-xl text-xs shadow-sm shadow-amber-500/10 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
                                      >
                                        <Upload className="h-3.5 w-3.5" />
                                        <span>{req.status === "Rejected" ? "Resubmit" : "Submit Now"}</span>
                                      </button>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column (1 Span - Recent Activity) */}
                  <div className="space-y-6">
                    {/* Activity Feed Card */}
                    <div className="rounded-2xl border-2 border-slate-300 bg-white shadow-sm shadow-slate-200/60 dark:border dark:border-slate-800/80 dark:bg-slate-900/60 dark:shadow-none p-5 space-y-4 transition-colors">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800/80">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 tracking-normal">
                          Recent Activity
                        </h3>
                        <button
                          type="button"
                          onClick={openHistoryModal}
                          className="text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 transition cursor-pointer font-medium"
                        >
                          View all
                        </button>
                      </div>

                      {deduplicatedRecentActivities.length > 0 ? (
                        <div className="space-y-3">
                          {deduplicatedRecentActivities.map((sub) => (
                            <div
                              key={sub.id}
                              className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-950/40 border-2 border-slate-200 dark:border dark:border-slate-800/60 transition-colors"
                            >
                              <div className="mt-0.5 shrink-0">
                                <span className={`h-2 w-2 rounded-full block ${getStatusDotColor(sub.status)}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-slate-900 dark:text-slate-200 truncate">
                                  {REQUIREMENT_LABEL[sub.requirementCode]}
                                </p>
                                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                                  Status: <span className={getStatusTextColor(sub.status)}>{getStatusText(sub.status)}</span>
                                </p>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                  {formatSubmittedDateTime(sub.submittedAt) ?? sub.submittedAt}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 dark:text-slate-400 py-3 text-center">
                          No submission activity recorded yet.
                        </p>
                      )}
                    </div>
                  </div>
                </section>
              </article>
            )}

            {activeView === "submit" && (
              <article className="space-y-6 p-2 sm:p-4 md:p-5">
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
                      <DocumentUploadZone
                        selectedFile={directUploadFile}
                        onFileSelect={(file) => {
                          setDirectUploadFile(file);
                          updateField("fileName", file?.name ?? "");
                        }}
                        maxSizeMb={10}
                        allowedFormats={["PDF", "DOCX", "XLSX", "JPG", "PNG"]}
                        currentStatus={getRequirementStatus(form.requirementCode)}
                        reviewerFeedback={
                          getRequirementStatusItem(form.requirementCode)?.adminRemarks ||
                          getRequirementStatusItem(form.requirementCode)?.admin_remarks ||
                          getRequirementStatusItem(form.requirementCode)?.feedback
                        }
                        disabled={(() => {
                          const s = getRequirementStatus(form.requirementCode);
                          return s === "Pending" || s === "Validated";
                        })()}
                      />
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

                {isMounted && isGuideOpen ? (
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
              <article className="space-y-5 p-2 sm:p-4 md:p-5">
                {/* Minimalist Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-300 dark:border-slate-800/80 pb-4">
                  <div>
                    <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
                      Requirements Management
                    </h1>
                    <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400 font-normal">
                      {!hasActiveSchedule ? (
                        "No Active Academic Schedule"
                      ) : (
                        <>
                          A.Y. {statusAcademicYear || submissionWindow?.academicYear || "2027-2028"} •{" "}
                          {statusSemester || submissionWindow?.semester || "1st Semester"}
                          {isAllValidated && (
                            <span className="ml-2 text-emerald-600 dark:text-emerald-400 font-semibold">• Validated</span>
                          )}
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={openHistoryModal}
                      className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <History className="h-3.5 w-3.5" />
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
                      className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <Calendar className="h-3.5 w-3.5" />
                      University Calendar
                    </button>
                    <button
                      type="button"
                      onClick={() => void fetchStatuses()}
                      disabled={isLoadingStatuses}
                      title="Refresh status"
                      className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white dark:border-slate-800 dark:bg-slate-900/60 p-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition disabled:opacity-50 cursor-pointer shadow-sm shadow-slate-200/60 dark:shadow-none"
                    >
                      <RotateCw className={`h-3.5 w-3.5 ${isLoadingStatuses ? "animate-spin text-amber-500" : ""}`} />
                      <span className="sr-only">Refresh</span>
                    </button>
                  </div>
                </div>

                {/* Clean Header Progress & Status Counts */}
                {displayedStatusCounts && !isLoadingStatuses && (
                  <div className="space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {displayedStatusCounts.validated} of {displayedStatusCounts.total} Completed ({Math.round((displayedStatusCounts.validated / (displayedStatusCounts.total || 1)) * 100)}%)
                      </span>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-400 font-medium">
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-emerald-500" />
                          <span>{displayedStatusCounts.validated} Validated</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-blue-500" />
                          <span>{isAllValidated ? 0 : displayedStatusCounts.pending} Pending</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-amber-500" />
                          <span>{displayedStatusCounts.rejected} Revision</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-slate-400 dark:bg-slate-600" />
                          <span>{isAllValidated ? 0 : displayedStatusCounts.notSubmitted} Not Submitted</span>
                        </span>
                      </div>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800/90 border-2 border-slate-300 dark:border dark:border-slate-700">
                      <div
                        className="h-full bg-emerald-500 transition-all duration-500 rounded-full"
                        style={{
                          width: `${Math.min(100, Math.round((displayedStatusCounts.validated / (displayedStatusCounts.total || 1)) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {(!hasActiveSchedule || isWindowClosed) && (
                  <div className="p-3 sm:p-3.5 rounded-xl border-2 border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-xs text-amber-950 dark:text-amber-200">
                    <span className="font-semibold text-amber-900 dark:text-amber-300 mr-1.5">
                      Submission Window Closed:
                    </span>
                    {!hasActiveSchedule
                      ? "There is currently no active academic schedule set for document submissions. Document uploads are locked."
                      : "Submission Window is currently closed. Document uploads are locked for this term."}
                  </div>
                )}

                {/* Single Unified Table/List Container */}
                {isLoadingStatuses ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400 py-6 text-center">
                    Loading requirement statuses...
                  </p>
                ) : statusError ? (
                  <p className="text-sm text-red-500 dark:text-red-400 py-4">{statusError}</p>
                ) : (
                  <div className="bg-white border-2 border-slate-300/80 shadow-sm shadow-slate-200/60 dark:bg-slate-900/60 dark:border dark:border-slate-800/80 dark:shadow-none rounded-2xl divide-y divide-slate-200 dark:divide-slate-800/60 overflow-hidden transition-colors">
                    {displayedRequirementStatuses.map((req) => (
                      <div
                        key={req.code}
                        id={`requirement-${req.code}`}
                        className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {REQUIREMENT_LABEL[req.code]}
                          </h4>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-slate-500 dark:text-slate-400">
                            {req.submittedAt && formatSubmittedDateTime(req.submittedAt) ? (
                              <span>Submitted: {formatSubmittedDateTime(req.submittedAt)}</span>
                            ) : (
                              <span>No submission recorded yet</span>
                            )}
                            {req.reviewedAt && (
                              <span>• Reviewed: {req.reviewedAt}</span>
                            )}
                          </div>
                          {/* Inline Revision Note */}
                          {req.status === "Rejected" && (
                            <p className="text-xs text-amber-800 dark:text-amber-300/90 flex items-center gap-1.5 mt-1 font-normal">
                              <AlertCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400/90 shrink-0" />
                              <span className="italic truncate">
                                &ldquo;{req.adminRemarks || req.admin_remarks || req.feedback || "Revision requested. Please check and resubmit."}&rdquo;
                              </span>
                            </p>
                          )}
                        </div>

                        <div className="flex shrink-0 flex-wrap items-center gap-3">
                          <SubmissionStatusBadge status={req.status} size="sm" />

                          {/* Action Buttons */}
                          <div className="flex items-center gap-1.5">
                            {/* Submit Button for Not Submitted */}
                            {req.status === "Not Submitted" && (
                              <button
                                type="button"
                                onClick={() => openDirectUploadModal(req.code)}
                                disabled={!hasActiveSchedule || isWindowClosed}
                                className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-4 py-2 rounded-xl text-xs shadow-sm shadow-amber-500/10 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
                              >
                                <Upload className="h-3.5 w-3.5" />
                                Submit
                              </button>
                            )}

                            {/* Resubmit Button for Rejected */}
                            {req.status === "Rejected" && (
                              <button
                                type="button"
                                onClick={() => openDirectUploadModal(req.code)}
                                disabled={!hasActiveSchedule || isWindowClosed}
                                className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-4 py-2 rounded-xl text-xs shadow-sm shadow-amber-500/10 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
                              >
                                <Upload className="h-3.5 w-3.5" />
                                Resubmit
                              </button>
                            )}

                            {/* View File & History Buttons */}
                            {req.status !== "Not Submitted" && req.latestSubmissionId ? (
                              <>
                                <button
                                type="button"
                                onClick={() => openSubmissionPreview(req)}
                                className="relative inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
                              >
                                  {Boolean(
                                    req.feedback &&
                                    !viewedSubmissionIds.has(req.latestSubmissionId) &&
                                    req.is_read !== true
                                  ) ? (
                                    <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                                    </span>
                                  ) : null}
                                  <Eye className="h-3.5 w-3.5" />
                                  View File
                                </button>

                                <button
                                type="button"
                                onClick={() => openVersionHistory(req)}
                                className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
                              >
                                  <History className="h-3.5 w-3.5" />
                                  History
                                </button>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            )}

            {isMounted && selectedRequirementForUpload && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm"
                role="dialog"
                aria-modal="true"
                aria-labelledby="upload-modal-title"
                onClick={closeDirectUploadModal}
              >
                <div
                  className="w-full max-w-2xl rounded-3xl border-2 border-slate-300 dark:border dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-5">
                    <h3
                      id="upload-modal-title"
                      className="text-xl font-semibold text-slate-900 dark:text-slate-100"
                    >
                      Upload {REQUIREMENT_LABEL[selectedRequirementForUpload]}
                    </h3>
                    <button
                      type="button"
                      onClick={closeDirectUploadModal}
                      disabled={isUploadingDirect}
                      className="rounded-full border border-slate-300 dark:border-slate-700 p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100 disabled:opacity-50"
                      aria-label="Close upload modal"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <form onSubmit={handleDirectUploadSubmit} className="p-6 space-y-5">
                    <div>
                      <DocumentUploadZone
                        selectedFile={directUploadFile}
                        onFileSelect={setDirectUploadFile}
                        isUploading={isUploadingDirect}
                        maxSizeMb={10}
                        allowedFormats={["PDF", "DOCX", "XLSX", "JPG", "PNG"]}
                        currentStatus={selectedRequirementForUpload ? getRequirementStatus(selectedRequirementForUpload) : null}
                        reviewerFeedback={
                          selectedRequirementForUpload
                            ? getRequirementStatusItem(selectedRequirementForUpload)?.adminRemarks ||
                              getRequirementStatusItem(selectedRequirementForUpload)?.admin_remarks ||
                              getRequirementStatusItem(selectedRequirementForUpload)?.feedback
                            : null
                        }
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="directUploadRemarks"
                        className="block text-xs uppercase tracking-[0.18em] font-semibold text-slate-700 dark:text-amber-300 mb-2"
                      >
                        Notes / Remarks for Reviewer (Optional)
                      </label>
                      <textarea
                        id="directUploadRemarks"
                        rows={3}
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
                        placeholder="Add optional notes or remarks for the reviewer..."
                        value={directUploadRemarks}
                        onChange={(e) => setDirectUploadRemarks(e.target.value)}
                      />
                    </div>

                    {directUploadMessage && (
                      <p
                        className={`text-sm rounded-xl p-3 border ${
                          directUploadMessage.startsWith("Error")
                            ? "border-red-500/30 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300"
                            : "border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                        }`}
                      >
                        {directUploadMessage}
                      </p>
                    )}

                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={closeDirectUploadModal}
                        disabled={isUploadingDirect}
                        className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 transition hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 font-medium"
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
                            <Loader2 className="h-4 w-4 animate-spin" />
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

            {/* SUBMITTING & SUCCESS MODAL POPUPS */}
            {isMounted && isSubmittingModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
                <div className="bg-gradient-to-b from-[#3a0000] to-[#1a0000] border border-amber-500/30 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl space-y-4">
                  {isUploadingDirect ? (
                    <>
                      <Loader2 className="w-12 h-12 text-amber-400 mx-auto animate-spin" />
                      <h3 className="text-lg font-bold text-amber-200">Submitting Document...</h3>
                      <p className="text-xs text-amber-300/70">
                        Please wait while your file is being uploaded to the system.
                      </p>
                    </>
                  ) : isSubmitSuccess ? (
                    <>
                      <div className="w-16 h-16 bg-green-500/20 border-2 border-green-500/50 rounded-full flex items-center justify-center mx-auto text-green-400 animate-in zoom-in">
                        <CheckCircle2 className="w-10 h-10" />
                      </div>
                      <h3 className="text-xl font-bold text-amber-200">Submitted Successfully!</h3>
                      <p className="text-xs text-amber-300/80">
                        Your requirement has been uploaded and sent for validation.
                      </p>
                      <button
                        type="button"
                        onClick={handleCloseModalAndRefresh}
                        className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold rounded-xl shadow-lg transition-all"
                      >
                        Done
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            )}

            {isMounted && successModalData.isOpen && (
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
                  className="w-full max-w-md rounded-3xl border-2 border-slate-300 dark:border dark:border-slate-700 bg-white dark:bg-slate-900 p-6 text-center shadow-2xl overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-500/50 text-emerald-600 dark:text-emerald-400 mb-4">
                    <CheckCircle2 className="h-10 w-10" />
                  </div>

                  <h3
                    id="success-modal-title"
                    className="text-xl font-bold text-slate-900 dark:text-slate-100"
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

            {isMounted && isHistoryModalOpen && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm"
                role="dialog"
                aria-modal="true"
                aria-labelledby="submission-history-title"
                onClick={closeHistoryModal}
              >
                <div
                  className="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-3xl border-2 border-slate-300 dark:border dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-5">
                    <h3
                      id="submission-history-title"
                      className="text-xl font-semibold text-slate-900 dark:text-slate-100"
                    >
                      Submission History
                    </h3>
                    <button
                      type="button"
                      onClick={closeHistoryModal}
                      className="rounded-full border border-slate-300 dark:border-slate-700 p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                      aria-label="Close history modal"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 px-6 py-3">
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-2">
                        <label
                          htmlFor="modalHistoryAcademicYear"
                          className="text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400 font-medium"
                        >
                          School Year:
                        </label>
                        <select
                          id="modalHistoryAcademicYear"
                          className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-200 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                          value={historyAcademicYear}
                          onChange={(event) =>
                            setHistoryAcademicYear(event.target.value)
                          }
                        >
                          {historyAcademicYears.map((year) => (
                            <option key={year} value={year}>
                              {year === "All" ? "All Academic Years" : `S.Y. ${year}`}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-2">
                        <label
                          htmlFor="modalHistorySemester"
                          className="text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400 font-medium"
                        >
                          Semester:
                        </label>
                        <select
                          id="modalHistorySemester"
                          className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-200 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
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

                  <div className="flex-1 overflow-y-auto p-6">
                    {isLoadingHistory ? (
                      <SubmissionHistorySkeleton count={4} />
                    ) : historyError ? (
                      <p className="text-sm text-red-500 dark:text-red-400">{historyError}</p>
                    ) : (
                      <SubmissionHistoryList
                        submissions={filteredPastSubmissions}
                        onViewFile={openHistorySubmissionPreview}
                        viewedSubmissionIds={viewedSubmissionIds}
                        emptyMessage="No past submissions found for the selected school year and semester."
                      />
                    )}
                  </div>

                  <div className="flex justify-end border-t border-slate-200 dark:border-slate-800 px-6 py-4">
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

            {isMounted && previewSubmission ? (
              <div
                className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm"
                onClick={closeSubmissionPreview}
              >
                <div
                  className="w-full max-w-4xl rounded-3xl border-2 border-slate-300 dark:border dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-5">
                    <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                      {previewSubmission.title}
                    </h3>
                    <button
                      type="button"
                      onClick={closeSubmissionPreview}
                      className="rounded-full border border-slate-300 dark:border-slate-700 p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                      aria-label="Close preview"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
                    <div className="min-h-[60vh] overflow-hidden rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950">
                      <iframe
                        title={`${previewSubmission.title} preview`}
                        src={getSubmissionPreviewUrl(
                          previewSubmission.latestSubmissionId,
                        )}
                        className="h-full min-h-[60vh] w-full border-0"
                      />
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-600 dark:text-slate-400 font-semibold">
                          My Note
                        </p>
                        <p className="mt-2 text-sm leading-6 italic text-slate-800 dark:text-slate-200">
                          {previewSubmission.note || "No note was added."}
                        </p>
                      </div>

                      {previewSubmission.reviewedAt ||
                      previewSubmission.adminRemarks ||
                      previewSubmission.admin_remarks ||
                      previewSubmission.feedback ? (
                        <div className="rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-600 dark:text-slate-400 font-semibold">
                            Admin Remarks
                          </p>
                          <p className="mt-2 text-sm leading-6 italic text-slate-800 dark:text-slate-200">
                            {previewSubmission.adminRemarks ||
                              previewSubmission.admin_remarks ||
                              previewSubmission.feedback ||
                              "Validated with no additional remarks."}
                          </p>
                          {previewSubmission.reviewedAt ? (
                            <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">
                              Reviewed On
                            </p>
                          ) : null}
                          {previewSubmission.reviewedAt ? (
                            <p className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-300">
                              {previewSubmission.reviewedAt}
                            </p>
                          ) : null}
                        </div>
                      ) : null}

                      {previewSubmission.submittedAt ? (
                        <div className="rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-4 text-sm text-slate-700 dark:text-slate-300">
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-600 dark:text-slate-400 font-semibold">
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

            {isMounted && versionHistorySubmissionId && (
              <VersionHistoryModal
                submissionId={versionHistorySubmissionId}
                requirementLabel={versionHistoryLabel}
                requirementCode={versionHistoryCode}
                onClose={closeVersionHistory}
              />
            )}

            {isMounted && showIncompleteRequirementsModal ? (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm"
                role="dialog"
                aria-modal="true"
                aria-labelledby="incomplete-requirements-title"
              >
                <div className="w-full max-w-md rounded-2xl border-2 border-slate-300 dark:border dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-200">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs font-semibold mb-3">
                        <AlertCircle className="h-3.5 w-3.5" />
                        <span>Action Required</span>
                      </div>
                      <h3
                        id="incomplete-requirements-title"
                        className="text-base font-semibold text-slate-900 dark:text-slate-100 tracking-tight"
                      >
                        Requirements Pending Submission
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={dismissIncompleteRequirementsAlert}
                      className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                      aria-label="Close alert"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    You have documents awaiting submission or revision for this semester. Please submit the missing requirements before the deadline.
                  </p>

                  {/* Inner Stats Container */}
                  <div className="bg-slate-50 dark:bg-slate-950/60 border-2 border-slate-300/80 dark:border dark:border-slate-800/80 rounded-xl p-4 my-4 flex items-center justify-between text-xs text-slate-700 dark:text-slate-300">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-slate-400 dark:bg-slate-500" />
                        <span>{displayedStatusCounts?.notSubmitted ?? 0} Not Submitted</span>
                      </span>
                      {(displayedStatusCounts?.rejected ?? 0) > 0 && (
                        <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-semibold">
                          <span className="h-2 w-2 rounded-full bg-amber-500" />
                          <span>{displayedStatusCounts?.rejected} Revision</span>
                        </span>
                      )}
                    </div>
                    {windowDeadlineDisplay && (
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Due: {windowDeadlineDisplay}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2.5 mt-5">
                    <button
                      type="button"
                      onClick={dismissIncompleteRequirementsAlert}
                      className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium px-4 py-2 rounded-xl transition-colors cursor-pointer"
                    >
                      Dismiss
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        dismissIncompleteRequirementsAlert();
                        navigateToView("status");
                      }}
                      className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-4 py-2 rounded-xl text-xs shadow-sm shadow-amber-500/10 active:scale-[0.98] transition-all cursor-pointer"
                    >
                      Go to Requirements Management
                    </button>
                  </div>
                </div>
              </div>
            ) : null}



            {activeView === "settings" && (
              <article className="space-y-6">
                <FacultySettingsPanel />
              </article>
            )}

            {isMounted && isSubmitModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm">
                <div className="w-full max-w-3xl overflow-hidden rounded-3xl border-2 border-slate-300 dark:border dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl">
                  <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-700 px-6 py-5">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-amber-300">
                      Submit Requirement
                    </h3>
                    <button
                      type="button"
                      onClick={closeSubmitModal}
                      className="rounded-full border border-slate-300 dark:border-slate-700 p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="max-h-[75vh] overflow-y-auto p-6">
                    {isSubmissionAvailable ? (
                      <form className="space-y-4" onSubmit={handleSubmit}>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="grid gap-4 md:grid-cols-2">
                            <div>
                              <label className="text-xs uppercase tracking-[0.18em] font-semibold text-slate-700 dark:text-amber-300">
                                School Year
                              </label>
                              <p className="mt-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-3 text-sm text-slate-800 dark:text-slate-100 font-medium">
                                {form.academicYear
                                  ? `S.Y. ${form.academicYear}`
                                  : "Loading current term..."}
                              </p>
                            </div>

                            <div>
                              <label className="text-xs uppercase tracking-[0.18em] font-semibold text-slate-700 dark:text-amber-300">
                                Semester
                              </label>
                              <p className="mt-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-3 text-sm text-slate-800 dark:text-slate-100 font-medium">
                                {form.semester}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div>
                          <label
                            className="text-xs uppercase tracking-[0.18em] font-semibold text-slate-700 dark:text-amber-300"
                            htmlFor="modalRequirementCode"
                          >
                            Requirement Type
                          </label>
                          <select
                            id="modalRequirementCode"
                            className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
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
                            className="text-xs uppercase tracking-[0.18em] font-semibold text-slate-700 dark:text-amber-300"
                            htmlFor="modalFileName"
                          >
                            File to Submit
                          </label>
                          <input
                            ref={fileInputRef}
                            id="modalFileName"
                            type="file"
                            className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 outline-none file:mr-4 file:rounded-lg file:border-0 file:bg-amber-500 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-950 hover:file:bg-amber-400 disabled:opacity-50"
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
                            className="text-xs uppercase tracking-[0.18em] font-semibold text-slate-700 dark:text-amber-300"
                            htmlFor="modalRemarks"
                          >
                            Remarks
                          </label>
                          <textarea
                            id="modalRemarks"
                            className="mt-1 min-h-24 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
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
                            className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium"
                          >
                            Cancel
                          </button>
                        </div>

                        {submissionMessage && (
                          <p className="text-sm text-slate-700 dark:text-slate-300">
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

export function FacultySubmissionPanel(props: FacultySubmissionPanelProps) {
  return (
    <Suspense fallback={<FacultySubmissionPanelFallback />}>
      <FacultySubmissionPanelContent {...props} />
    </Suspense>
  );
}
