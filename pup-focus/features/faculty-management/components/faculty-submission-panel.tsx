"use client";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/shared/brand-mark";
import { Logo } from "@/components/ui/logo";
import { FacultySettingsPanel } from "@/features/faculty-management/components/faculty-settings-panel";
import { SubmissionWindowCountdown } from "@/features/submissions/components/submission-window-countdown";
import { SubmissionLockBanner } from "@/features/submissions/components/submission-lock-banner";
import { FacultyExtensionRequestModal } from "@/features/submissions/components/faculty-extension-request-modal";
import { TermCompletionResetModal } from "@/features/submissions/components/term-completion-reset-modal";
import { extractFirstName, buildFacultyInitials } from "@/lib/faculty-profile";
import { createClient } from "@/lib/supabase/client";
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
import type {
  FacultyInitialData,
  RequirementTemplateData,
} from "@/features/submissions/services/faculty-data.service";
import { SubmissionStatusBadge } from "@/features/submissions/components/submission-status-badge";
import { DocumentUploadZone } from "@/features/submissions/components/document-upload-zone";
import JSZip from "jszip";
import {
  SubmissionHistoryList,
  getFriendlyRequirementName,
} from "@/features/submissions/components/submission-history-list";
import {
  StatusMetricsSkeleton,
  ComplianceListSkeleton,
  SubmissionHistorySkeleton,
  DashboardMetricsSkeleton,
  SubmissionWindowSkeleton,
} from "@/features/submissions/components/submission-skeletons";
import { Activity, Archive, Calendar, Check, CheckCircle, ClockRotateRight, CloudUpload, Download, Eye, Hourglass, Lock, Menu, Minus, NavArrowRight, OpenNewWindow, Page, Refresh, Reports, Settings, SystemRestart, TaskList, Upload, ViewGrid, WarningCircle, WarningTriangle, Xmark } from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";
import { ModalHeader } from "@/components/ui/modal-header";
import { LogoutButton } from "@/components/shared/logout-button";
import { NotificationDrawer } from "@/features/notifications/components/notification-drawer";
import { OnlineDocumentPreview } from "@/features/submissions/components/online-document-preview";
import { DocumentPreviewModal, type DocumentPreviewSubmission } from "@/features/submissions/components/document-preview-modal";
import { AlertPopup } from "@/components/ui/alert-popup";
import { SystemLoadingScreen } from "@/components/shared/system-loading-screen";
import { FacultyIncompleteRequirementsModal } from "./faculty-incomplete-requirements-modal";
export type DetectedFileType = "pdf" | "image" | "excel" | "word" | "other";
export function getFileType(fileNameOrUrl: string): {
  type: DetectedFileType;
  extension: string;
  isPdf: boolean;
  isImage: boolean;
  isExcel: boolean;
  isWord: boolean;
} {
  const cleanStr = (fileNameOrUrl || "")
    .split("?")[0]
    .split("#")[0]
    .toLowerCase();
  const match = cleanStr.match(/\.([a-z0-9]+)$/i);
  const extension = match ? match[1].toLowerCase() : "";
  const isPdf = extension === "pdf";
  const isImage = ["png", "jpg", "jpeg", "webp", "gif", "bmp", "svg"].includes(
    extension,
  );
  const isExcel = ["xlsx", "xls", "csv"].includes(extension);
  const isWord = ["docx", "doc"].includes(extension);
  let type: DetectedFileType = "other";
  if (isPdf) type = "pdf";
  else if (isImage) type = "image";
  else if (isExcel) type = "excel";
  else if (isWord) type = "word";
  return { type, extension, isPdf, isImage, isExcel, isWord };
}
export const getFileBrand = (
  extension: string,
  isExcel?: boolean,
  isWord?: boolean,
) => {
  const ext = (extension || "").toLowerCase().trim();
  if (ext === "pdf") {
    return {
      label: "Adobe PDF Document",
      iconUrl: "/icons/adobe-pdf.svg",
      borderColor: "border-slate-200 dark:border-slate-800",
      badgeBg: "bg-slate-800 text-white dark:bg-slate-700 dark:text-slate-100",
      googleApp: "Google Drive",
      googleAction: "Open in Google Drive",
      officeApp: null,
      officeAction: null,
    };
  }
  if (isExcel || ["xlsx", "xls", "csv"].includes(ext)) {
    return {
      label: "Microsoft Excel Spreadsheet",
      iconUrl: "/icons/microsoft-excel.svg",
      borderColor: "border-slate-200 dark:border-slate-800",
      badgeBg: "bg-slate-800 text-white dark:bg-slate-700 dark:text-slate-100",
      googleApp: "Google Sheets",
      googleAction: "Open in Google Sheets (Drive)",
      officeApp: "Excel Online",
      officeAction: "Open in Excel Online",
    };
  }
  if (isWord || ["docx", "doc"].includes(ext)) {
    return {
      label: "Microsoft Word Document",
      iconUrl: "/icons/microsoft-word.svg",
      borderColor: "border-slate-200 dark:border-slate-800",
      badgeBg: "bg-slate-800 text-white dark:bg-slate-700 dark:text-slate-100",
      googleApp: "Google Docs",
      googleAction: "Open in Google Docs (Drive)",
      officeApp: "Word Online",
      officeAction: "Open in Word Online",
    };
  }
  if (["pptx", "ppt"].includes(ext)) {
    return {
      label: "Microsoft PowerPoint Presentation",
      iconUrl: "/icons/microsoft-powerpoint.svg",
      borderColor: "border-slate-200 dark:border-slate-800",
      badgeBg: "bg-slate-800 text-white dark:bg-slate-700 dark:text-slate-100",
      googleApp: "Google Slides",
      googleAction: "Open in Google Slides (Drive)",
      officeApp: "PowerPoint Online",
      officeAction: "Open in PowerPoint Online",
    };
  }
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) {
    return {
      label: "Compressed Archive",
      iconUrl: "https://api.iconify.design/vscode-icons:file-type-zip.svg",
      borderColor: "border-slate-200 dark:border-slate-800",
      badgeBg: "bg-slate-800 text-white dark:bg-slate-700 dark:text-slate-100",
    };
  }
  if (["png", "jpg", "jpeg", "webp", "gif", "bmp", "svg"].includes(ext)) {
    return {
      label: "Image File",
      iconUrl: "https://api.iconify.design/vscode-icons:file-type-image.svg",
      borderColor: "border-slate-200 dark:border-slate-800",
      badgeBg: "bg-slate-800 text-white dark:bg-slate-700 dark:text-slate-100",
    };
  }
  return {
    label: "Document File",
    iconUrl: "https://api.iconify.design/vscode-icons:file-type-text.svg",
    borderColor: "border-slate-200 dark:border-slate-800",
    badgeBg: "bg-slate-800 text-white dark:bg-slate-700 dark:text-slate-100",
  };
};
const SEMESTER_OPTIONS = ["1st Semester", "2nd Semester"] as const;
const REQUIREMENT_DESCRIPTIONS: Record<string, string> = {
  grade_sheet: "Official signed grade sheets for assigned course sections.",
  enhanced_syllabus:
    "Course syllabus adhering to outcome-based education standards.",
  class_orientation:
    "Photos and narrative report documenting initial class orientation.",
  midterm_package: "Copy of Midterm Examinations with TOS and Answer Key.",
  final_package: "Copy of Final Examinations with TOS and Answer Key.",
  class_records:
    "Class Records including midterm and final grade computations.",
};
export const PANEL_VIEWS = [
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
export type PanelView = (typeof PANEL_VIEWS)[number];
type HistorySubmissionStatus = "Pending" | "Validated" | "Rejected";
type RequirementStatus = {
  code: RequirementCode | string;
  status: "Validated" | "Rejected" | "Pending" | "Not Submitted";
  reviewedAt?: string;
  feedback?: string;
  admin_remarks?: string;
  adminRemarks?: string | null;
  remarks?: string;
  note?: string | null;
  submittedAt?: string;
  latestSubmissionId?: string;
  fileName?: string;
  storagePath?: string;
  is_read?: boolean;
  isViewed?: boolean;
  viewed_at?: string;
  isRevision?: boolean;
  hasPriorRevision?: boolean;
};
type SubmissionPreview = DocumentPreviewSubmission;
type PastSubmission = {
  id: string;
  academicYear: string;
  semester: (typeof SEMESTER_OPTIONS)[number];
  requirementCode: RequirementCode | string;
  status: HistorySubmissionStatus;
  submittedAt: string;
  updatedAt?: string;
  dateValidated?: string;
  fileName?: string;
  storagePath?: string;
  file_name?: string;
  file_path?: string;
  original_name?: string;
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
  requirementCode: RequirementCode | string;
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
  if (s.includes("1") || s.includes("first") || s.includes("1st"))
    return "1st semester";
  if (s.includes("2") || s.includes("second") || s.includes("2nd"))
    return "2nd semester";
  if (
    s.includes("3") ||
    s.includes("third") ||
    s.includes("3rd") ||
    s.includes("summer")
  )
    return "3rd semester";
  return s;
}
function normalizeAcademicYear(ay?: string | null): string {
  if (!ay) return "";
  return ay
    .toLowerCase()
    .trim()
    .replace(/^s\.?y\.?\s*/i, "")
    .replace(/^a\.?y\.?\s*/i, "");
}
function getStatusDotColor(
  status: RequirementStatus["status"] | HistorySubmissionStatus,
): string {
  if (status === "Validated") return "bg-[#0b5336]";
  if (status === "Rejected") return "bg-[#780000]";
  if (status === "Not Submitted") return "bg-slate-600";
  return "bg-blue-400";
}
function getStatusTextColor(
  status: RequirementStatus["status"] | HistorySubmissionStatus,
): string {
  if (status === "Validated") return "text-[#0b5336] dark:text-emerald-400 font-semibold";
  if (status === "Rejected") return "text-[#780000] dark:text-rose-400 font-semibold";
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
    return "bg-[#0b5336] text-white border border-[#08412a]";
  if (status === "Rejected")
    return "bg-[#780000] text-white border border-[#5e0000]";
  if (status === "Not Submitted")
    return "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700";
  return "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/60";
}
function renderStatusIconBadge(
  status: RequirementStatus["status"] | HistorySubmissionStatus,
) {
  if (status === "Validated") {
    return (
      <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-[#0b5336] text-white border border-[#08412a] shrink-0 shadow-2xs">
        <AppIcon icon={Check} size="xs" color="white" />
      </span>
    );
  }
  if (status === "Rejected") {
    return (
      <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-[#780000] text-white border border-[#5e0000] shrink-0 shadow-2xs">
        <AppIcon icon={Xmark} size="xs" color="white" />
      </span>
    );
  }
  if (status === "Not Submitted") {
    return (
      <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-300 dark:border-slate-700 shrink-0 shadow-2xs">
        <AppIcon icon={Minus} size="xs" color="inherit" />
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-amber-500 text-slate-950 border border-amber-600 shrink-0 shadow-2xs">
      <AppIcon icon={Hourglass} size="xs" color="inherit" />
    </span>
  );
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
  facultyEmail?: string | null;
  facultyAvatarUrl?: string | null;
  initialFirstName?: string | null;
  initialMiddleName?: string | null;
  initialLastName?: string | null;
  facultyFirstName?: string | null;
  facultyMiddleName?: string | null;
  facultyLastName?: string | null;
  initialData?: FacultyInitialData | null;
  initialView?: PanelView;
}
function FacultySubmissionPanelContent({
  facultyName,
  facultyEmail,
  facultyAvatarUrl,
  initialFirstName,
  initialMiddleName,
  initialLastName,
  facultyFirstName: propFacultyFirstName,
  facultyMiddleName: propFacultyMiddleName,
  facultyLastName: propFacultyLastName,
  initialData,
  initialView = "dashboard",
}: FacultySubmissionPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const academicYears = useMemo(() => buildAcademicYearOptions(), []);
  const [currentFacultyName, setCurrentFacultyName] = useState<string | null>(
    facultyName ?? null,
  );
  const resolvedFirstName = initialFirstName ?? propFacultyFirstName ?? null;
  const resolvedMiddleName = initialMiddleName ?? propFacultyMiddleName ?? null;
  const resolvedLastName = initialLastName ?? propFacultyLastName ?? null;
  const departmentName = useMemo(() => {
    if (initialData?.department) return initialData.department;
    if (initialData?.program) {
      return `${initialData.program.code} — ${initialData.program.name}`;
    }
    return "Unassigned";
  }, [initialData?.department, initialData?.program]);
  const avatarUrl = useMemo(() => {
    return (
      facultyAvatarUrl ??
      initialData?.avatarUrl ??
      initialData?.profileImageUrl ??
      null
    );
  }, [facultyAvatarUrl, initialData?.avatarUrl, initialData?.profileImageUrl]);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null>(avatarUrl);
  const [hasAvatarError, setHasAvatarError] = useState(false);
  useEffect(() => {
    setCurrentAvatarUrl(avatarUrl);
    setHasAvatarError(false);
  }, [avatarUrl]);
  useEffect(() => {
    if (facultyName) {
      setCurrentFacultyName(facultyName);
    }
  }, [facultyName]);
  // Fallback client session check for profile image and name if initial data didn't have it
  useEffect(() => {
    if (!avatarUrl || !currentFacultyName) {
      try {
        const supabase = createClient();
        supabase.auth.getUser().then((result: any) => {
          const meta = result?.data?.user?.user_metadata as
            | Record<string, unknown>
            | undefined;
          if (meta) {
            if (!avatarUrl && (meta.profile_image_url || meta.avatar_url)) {
              setCurrentAvatarUrl(
                (meta.profile_image_url || meta.avatar_url) as string,
              );
              setHasAvatarError(false);
            }
            if (meta.full_name && !currentFacultyName) {
              setCurrentFacultyName(meta.full_name as string);
            }
          }
        });
      } catch {
        // safe fallback
      }
    }
  }, [avatarUrl, currentFacultyName]);
  const handleProfileUpdated = useCallback(
    (updated: { fullName?: string; avatarUrl?: string | null }) => {
      if (updated.fullName) {
        setCurrentFacultyName(updated.fullName);
      }
      if (updated.avatarUrl !== undefined) {
        setCurrentAvatarUrl(updated.avatarUrl);
        setHasAvatarError(false);
      }
    },
    [],
  );
  const facultyFirstName = useMemo(
    () => extractFirstName(currentFacultyName, "Faculty"),
    [currentFacultyName],
  );
  const facultyInitials = useMemo(
    () => buildFacultyInitials(currentFacultyName || "Faculty"),
    [currentFacultyName],
  );
  useEffect(() => {
    if (currentAvatarUrl && typeof window !== "undefined") {
      const img = new window.Image();
      img.src = currentAvatarUrl;
    }
  }, [currentAvatarUrl]);
  const [isMounted, setIsMounted] = useState(false);

  // SSR-safe initial view calculation: strictly identical on server and client
  const resolveInitialView = useCallback((): PanelView => {
    if (initialView && initialView !== "dashboard") {
      return initialView;
    }
    const v = searchParams?.get("view");
    const highlight = searchParams?.get("highlight") || searchParams?.get("requirement");
    const hist = searchParams?.get("history");
    if (v === "history" || (v === "status" && hist === "true") || highlight) {
      return "status";
    }
    if (v && (PANEL_VIEWS as readonly string[]).includes(v)) {
      return v as PanelView;
    }
    return initialView || "dashboard";
  }, [initialView, searchParams]);

  const [activeView, setActiveView] = useState<PanelView>(() => resolveInitialView());

  // Restore saved view from sessionStorage only after client has hydrated
  useEffect(() => {
    setIsMounted(true);
    const v = searchParams?.get("view");
    const highlight = searchParams?.get("highlight") || searchParams?.get("requirement");
    const hist = searchParams?.get("history");
    if (!v && !highlight && !hist && (!initialView || initialView === "dashboard")) {
      try {
        const savedView = sessionStorage.getItem("pup_focus_faculty_active_view");
        if (
          savedView &&
          (PANEL_VIEWS as readonly string[]).includes(savedView) &&
          savedView !== activeView
        ) {
          setActiveView(savedView as PanelView);
        }
      } catch {
        // safe fallback
      }
    }
  }, []);

  const [form, setForm] = useState<SubmissionFormState>({
    academicYear: initialData?.academicYear || academicYears[0] || "",
    semester:
      (initialData?.semester as (typeof SEMESTER_OPTIONS)[number]) ||
      "1st Semester",
    requirementCode:
      initialData?.requirementTemplates?.[0]?.code ||
      REQUIREMENT_CODE.GRADE_SHEET,
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
  const [isBulkDownloading, setIsBulkDownloading] = useState(false);
  const [bulkDownloadProgressText, setBulkDownloadProgressText] = useState("");
  const [requirementStatuses, setRequirementStatuses] = useState<
    RequirementStatus[]
  >(() => (initialData?.requirementStatuses as RequirementStatus[]) || []);
  const [requirementTemplates, setRequirementTemplates] = useState<
    RequirementTemplateData[]
  >(() => (initialData?.requirementTemplates as RequirementTemplateData[]) || []);
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
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(() => {
    if (initialView === "history") return true;
    const hist = searchParams?.get("history");
    const v = searchParams?.get("view");
    return hist === "true" || v === "history";
  });
  useEffect(() => {
    try {
      sessionStorage.setItem("pup_focus_faculty_active_view", activeView);
    } catch {
      // safe
    }
  }, [activeView]);
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
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>(
    academicYears[0] ?? "",
  );
  const [selectedSemester, setSelectedSemester] =
    useState<(typeof SEMESTER_OPTIONS)[number]>("1st Semester");
  const [selectedRequirementForUpload, setSelectedRequirementForUpload] =
    useState<RequirementCode | string | null>(null);
  const [isRevisionUpload, setIsRevisionUpload] = useState(false);
  const [directUploadFile, setDirectUploadFile] = useState<File | null>(null);
  const [directUploadRemarks, setDirectUploadRemarks] = useState("");
  const [isUploadingDirect, setIsUploadingDirect] = useState(false);
  const [directUploadPercent, setDirectUploadPercent] = useState(0);
  const [directUploadMessage, setDirectUploadMessage] = useState<string | null>(
    null,
  );
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [isSubmittingModalOpen, setIsSubmittingModalOpen] = useState(false);
  const [isSubmitSuccess, setIsSubmitSuccess] = useState(false);
  function handleCloseModalAndRefresh() {
    setIsSubmittingModalOpen(false);
    setIsSubmitSuccess(false);
    setDirectUploadPercent(0);
    closeDirectUploadModal();
    router.refresh();
    void fetchStatuses();
  }

  // ─── Extension Request & Term Completion Reset States ─────────────
  const [isExtensionModalOpen, setIsExtensionModalOpen] = useState(false);
  const [selectedExtensionReqCode, setSelectedExtensionReqCode] =
    useState<RequirementCode | string | null>(null);
  const [isTermCompletionModalOpen, setIsTermCompletionModalOpen] =
    useState(false);
  const [isTermResetAcknowledged, setIsTermResetAcknowledged] = useState(false);
  const [showResetArchivedView, setShowResetArchivedView] = useState(false);
  const [hasPendingExtensionRequest, setHasPendingExtensionRequest] =
    useState(false);
  const [pendingExtensionData, setPendingExtensionData] = useState<any | null>(null);
  const [showExtensionDetailsModal, setShowExtensionDetailsModal] = useState(false);
  const [extensionRequestToast, setExtensionRequestToast] = useState<
    string | null
  >(null);
  const [hasPromptedTermCompletion, setHasPromptedTermCompletion] =
    useState(false);
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
  const [isRequirementAlertOpen, setIsRequirementAlertOpen] = useState(false);
  const [hasTriggeredRequirementAlert, setHasTriggeredRequirementAlert] = useState(false);
  useEffect(() => {
    setIsMounted(true);
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
    setIsRequirementAlertOpen(false);
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
  async function handleBulkDownload() {
    if (filteredPastSubmissions.length === 0 || isBulkDownloading) return;
    try {
      setIsBulkDownloading(true);
      setBulkDownloadProgressText("Preparing...");
      const zip = new JSZip();
      let processed = 0;
      const total = filteredPastSubmissions.length;
      for (const sub of filteredPastSubmissions) {
        processed++;
        setBulkDownloadProgressText(`Downloading ${processed}/${total}...`);
        const downloadUrl = `/api/faculty/submissions/view?submissionId=${encodeURIComponent(sub.id)}&download=true`;
        try {
          const fileRes = await fetch(downloadUrl);
          if (fileRes.ok) {
            const fileBlob = await fileRes.blob();
            const reqTitle = getFriendlyRequirementName(
              sub.requirementCode,
            ).replace(/[^a-zA-Z0-9_-]/g, "_");
            const ext =
              sub.fileName?.match(/\.[^.]+$/)?.[0] ||
              sub.storagePath?.match(/\.[^.]+$/)?.[0] ||
              ".pdf";
            const fileName =
              `${reqTitle}_${sub.academicYear}_${sub.semester}${ext}`.replace(
                /[\s/]+/g,
                "_",
              );
            zip.file(fileName, fileBlob);
          }
        } catch (fetchErr) {
          console.error("Failed to fetch file for ZIP:", sub.id, fetchErr);
        }
      }
      setBulkDownloadProgressText("Generating ZIP...");
      const zipContent = await zip.generateAsync({ type: "blob" });
      const url = window.URL.createObjectURL(zipContent);
      const link = document.createElement("a");
      const sanitizedName = (facultyName || "Faculty").replace(
        /[^a-zA-Z0-9_-]/g,
        "_",
      );
      link.href = url;
      link.download =
        `${sanitizedName}_Validated_Requirements_${historyAcademicYear}_${historySemester}.zip`.replace(
          /[\s/]+/g,
          "_",
        );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Bulk download failed:", err);
    } finally {
      setIsBulkDownloading(false);
      setBulkDownloadProgressText("");
    }
  }
  async function fetchStatuses(year?: string, sem?: string) {
    try {
      setIsLoadingStatuses(true);
      setStatusError(null);
      const params = new URLSearchParams();
      const targetYear =
        year ||
        (submissionWindow?.academicYear
          ? submissionWindow.academicYear
          : statusAcademicYear) ||
        "2026-2027";
      const targetSem =
        sem ||
        (submissionWindow?.semester
          ? submissionWindow.semester
          : statusSemester) ||
        "1st Semester";
      if (targetYear && targetSem) {
        params.set("academicYear", targetYear);
        params.set("semester", targetSem);
      }
      const response = await fetch(
        `/api/faculty/submissions/status?${params.toString()}`,
        {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
        },
      );
      if (response.ok) {
        const data = await response.json();
        const statuses: RequirementStatus[] = data.requirementStatuses || [];
        setRequirementStatuses(statuses);
        if (Array.isArray(data.requirementTemplates) && data.requirementTemplates.length > 0) {
          setRequirementTemplates(data.requirementTemplates);
        }
        setStatusCounts(data.counts || null);
        if (data.academicYear) setStatusAcademicYear(data.academicYear);
        if (data.semester) setStatusSemester(data.semester);
        if (typeof data.hasActiveSchedule === "boolean") {
          setHasActiveSchedule(data.hasActiveSchedule);
        }
        setViewedSubmissionIds((current) => {
          const next = new Set(current);
          try {
            const cached = localStorage.getItem(
              "pup_focus_viewed_submission_ids",
            );
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
    void fetchHistory();
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
      if (
        view === "history" ||
        (view === "status" && historyParam === "true")
      ) {
        setActiveView((prev) => (prev !== "status" ? "status" : prev));
        setIsHistoryModalOpen(true);
      } else if (highlightParam) {
        setActiveView((prev) => (prev !== "status" ? "status" : prev));
      } else if (view && (PANEL_VIEWS as readonly string[]).includes(view)) {
        setActiveView((prev) => (prev !== view ? (view as PanelView) : prev));
      }
      if (highlightParam) {
        const timer = setTimeout(() => {
          const targetElement =
            document.getElementById(`requirement-${highlightParam}`) ||
            document.getElementById(highlightParam);
          if (targetElement) {
            targetElement.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
            targetElement.classList.add(
              "ring-2",
              "ring-slate-400",
              "bg-slate-500/10",
            );
            setTimeout(() => {
              targetElement.classList.remove(
                "ring-2",
                "ring-slate-400",
                "bg-slate-500/10",
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
      void fetchStatuses(
        submissionWindow.academicYear,
        submissionWindow.semester,
      );
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
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
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
      sessionStorage.setItem("pup_focus_faculty_active_view", targetView);
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.set("view", targetView);
      if (targetView === "status" && openHistory) {
        params.set("history", "true");
      } else {
        params.delete("history");
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    } catch {
      // fallback
      router.replace(pathname, { scroll: false });
    }
  }
  const filteredPastSubmissions = useMemo(() => {
    return pastSubmissions.filter((submission) => {
      const matchesYear =
        historyAcademicYear === "All" ||
        submission.academicYear === historyAcademicYear;
      const matchesSemester =
        historySemester === "All" || submission.semester === historySemester;
      return matchesYear && matchesSemester;
    });
  }, [historyAcademicYear, historySemester, pastSubmissions]);
  const deduplicatedRecentActivities = useMemo(() => {
    const seen = new Set<string>();
    const list: PastSubmission[] = [];
    for (const sub of pastSubmissions) {
      const key = sub.requirementCode || sub.id;
      if (!seen.has(key)) {
        seen.add(key);
        list.push(sub);
      }
      if (list.length >= 4) break;
    }
    return list;
  }, [pastSubmissions]);
  const activeAY = useMemo(() => {
    return (
      submissionWindow?.academicYear ||
      statusAcademicYear ||
      (pastSubmissions.length > 0 && pastSubmissions[0].academicYear
        ? pastSubmissions[0].academicYear
        : null) ||
      selectedAcademicYear ||
      form.academicYear ||
      "2026-2027"
    );
  }, [
    submissionWindow?.academicYear,
    statusAcademicYear,
    pastSubmissions,
    selectedAcademicYear,
    form.academicYear,
  ]);

  const activeSem = useMemo(() => {
    return (
      submissionWindow?.semester ||
      statusSemester ||
      (pastSubmissions.length > 0 && pastSubmissions[0].semester
        ? pastSubmissions[0].semester
        : null) ||
      selectedSemester ||
      form.semester ||
      "1st Semester"
    );
  }, [
    submissionWindow?.semester,
    statusSemester,
    pastSubmissions,
    selectedSemester,
    form.semester,
  ]);

  const activeTemplates = useMemo<RequirementTemplateData[]>(() => {
    if (requirementTemplates && requirementTemplates.length > 0) {
      return requirementTemplates;
    }
    return DEFAULT_REQUIREMENTS.map((code) => ({
      code,
      title: REQUIREMENT_LABEL[code] || code,
      is_mandatory: true,
      max_size_mb: 10,
      allowed_formats: ["PDF", "DOCX", "XLSX"],
    }));
  }, [requirementTemplates]);

  const templateTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of activeTemplates) {
      map.set(t.code, t.title);
    }
    return map;
  }, [activeTemplates]);

  const getRequirementTitle = useCallback(
    (code: string) => {
      return (
        templateTitleMap.get(code) ||
        (REQUIREMENT_LABEL as Record<string, string>)[code] ||
        code
      );
    },
    [templateTitleMap],
  );

  const displayedRequirementStatuses = useMemo<RequirementStatus[]>(() => {
    const normActiveAY = normalizeAcademicYear(activeAY);
    const normActiveSem = normalizeSemester(activeSem);
    const activeCodes = activeTemplates.map((t) => t.code);

    return activeCodes.map((code) => {
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
          null;
        const matchUserNote =
          (match.note && match.note !== adminRemarks ? match.note : null) ||
          ((match as { notes?: string }).notes &&
          (match as { notes?: string }).notes !== adminRemarks
            ? (match as { notes?: string }).notes
            : null) ||
          (match.remarks && match.remarks !== adminRemarks
            ? match.remarks
            : null) ||
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
          note: matchUserNote,
          remarks: matchUserNote || undefined,
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
          null;
        const liveUserNote =
          (live.note && live.note !== liveAdminRemarks ? live.note : null) ||
          ((live as { notes?: string }).notes &&
          (live as { notes?: string }).notes !== liveAdminRemarks
            ? (live as { notes?: string }).notes
            : null) ||
          (live.remarks && live.remarks !== liveAdminRemarks
            ? live.remarks
            : null) ||
          null;
        return {
          ...live,
          note: liveUserNote,
          remarks: liveUserNote || undefined,
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
  }, [
    activeAY,
    activeSem,
    pastSubmissions,
    requirementStatuses,
    activeTemplates,
  ]);
  const displayedStatusCounts = useMemo(() => {
    const total = activeTemplates.length;
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
  }, [displayedRequirementStatuses, activeTemplates.length]);
  const totalRequirements =
    displayedStatusCounts?.total ?? activeTemplates.length;
  const validatedCount = displayedStatusCounts?.validated ?? 0;
  const isAllValidated =
    totalRequirements > 0 && validatedCount === totalRequirements;
  const isWindowConfigured = Boolean(submissionWindow?.isConfigured);
  const isSubmissionAvailable =
    !isLoadingSubmissionWindow && Boolean(submissionWindow?.isOpen);
  // Only considered closed if a schedule was actually configured in the database
  const isWindowClosed = isWindowConfigured && !isSubmissionAvailable;
  // True when admin has not configured any schedule (e.g. schedules deleted from database)
  const isWindowNotConfigured = !isLoadingSubmissionWindow && !isWindowConfigured;
  const hasLackings = !isAllValidated && totalRequirements > 0;
  const lackingRequirements = useMemo(() => {
    return displayedRequirementStatuses
      .filter((r) => r.status === "Not Submitted" || r.status === "Rejected")
      .map((r) => ({
        code: r.code,
        status: r.status as "Not Submitted" | "Rejected",
        label: getRequirementTitle(r.code),
        adminRemarks: r.adminRemarks || r.admin_remarks || r.feedback,
      }));
  }, [displayedRequirementStatuses, getRequirementTitle]);

  useEffect(() => {
    if (!isMounted) return;
    try {
      const resetKey = `pup_focus_term_reset_${normalizeAcademicYear(activeAY)}_${normalizeSemester(activeSem)}`;
      const isReset = localStorage.getItem(resetKey) === "true";
      setIsTermResetAcknowledged(isReset);
    } catch {
      // safe
    }
  }, [isMounted, activeAY, activeSem]);

  useEffect(() => {
    if (!isMounted) return;
    async function checkPendingExtension() {
      try {
        const res = await fetch(
          `/api/faculty/submissions/extension-request?academicYear=${encodeURIComponent(activeAY)}&semester=${encodeURIComponent(activeSem)}`,
        );
        if (res.ok) {
          const data = await res.json();
          setHasPendingExtensionRequest(Boolean(data.hasPendingRequest));
          setPendingExtensionData(data.pendingRequest || data.latestRequest || null);
          if (data.isApproved || data.latestApprovedRequest || data.latestRequest?.status === "approved") {
            void refetchSubmissionWindow();
          }
        }
      } catch {
        // safe
      }
    }
    void checkPendingExtension();
  }, [isMounted, activeAY, activeSem, refetchSubmissionWindow]);

  useEffect(() => {
    if (
      isMounted &&
      isAllValidated &&
      !isTermResetAcknowledged &&
      !hasPromptedTermCompletion
    ) {
      setHasPromptedTermCompletion(true);
      const timer = setTimeout(() => setIsTermCompletionModalOpen(true), 1200);
      return () => clearTimeout(timer);
    }
  }, [
    isMounted,
    isAllValidated,
    isTermResetAcknowledged,
    hasPromptedTermCompletion,
  ]);

  function openExtensionRequestModal(code?: RequirementCode | string) {
    if (!isWindowConfigured) return;
    setSelectedExtensionReqCode(code || null);
    setIsExtensionModalOpen(true);
  }

  function handleExtensionSuccess(message: string) {
    setExtensionRequestToast(message);
    setHasPendingExtensionRequest(true);
    void (async () => {
      try {
        const res = await fetch(
          `/api/faculty/submissions/extension-request?academicYear=${encodeURIComponent(activeAY)}&semester=${encodeURIComponent(activeSem)}`,
        );
        if (res.ok) {
          const data = await res.json();
          setPendingExtensionData(data.pendingRequest || data.latestRequest || null);
        }
      } catch {
        // safe
      }
    })();
    setTimeout(() => setExtensionRequestToast(null), 5000);
  }

  function handleConfirmTermReset() {
    try {
      const resetKey = `pup_focus_term_reset_${normalizeAcademicYear(activeAY)}_${normalizeSemester(activeSem)}`;
      localStorage.setItem(resetKey, "true");
      setIsTermResetAcknowledged(true);
      setShowResetArchivedView(false);
    } catch {
      // safe
    }
  }
  const windowDeadlineDisplay = useMemo(() => {
    if (!submissionWindow?.endDate) return null;
    if (submissionWindow.endDate.startsWith("2099")) return "Always Open (No Deadline)";
    const parsed = new Date(
      `${submissionWindow.endDate}T${submissionWindow.endTime || "23:59:59"}`,
    );
    if (Number.isNaN(parsed.getTime())) return submissionWindow.endDate;
    return parsed.toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }, [submissionWindow]);
  const windowDaysRemaining = useMemo(() => {
    if (!submissionWindow?.endDate) return null;
    if (submissionWindow.endDate.startsWith("2099")) return null;
    const targetMs = new Date(
      `${submissionWindow.endDate}T${submissionWindow.endTime || "23:59:59"}`,
    ).getTime();
    if (Number.isNaN(targetMs)) return null;
    const diffMs = targetMs - Date.now();
    if (diffMs <= 0) return 0;
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }, [submissionWindow]);
  // Show the alert once per page load when there are actionable items.
  // Waits for isLoadingStatuses=false so we use fresh API data, not stale SSR counts.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (
      !hasTriggeredRequirementAlert &&
      isMounted &&
      !isLoadingStatuses &&
      activeView === "dashboard" &&
      Boolean(submissionWindow?.isConfigured && submissionWindow?.isOpen) &&
      displayedStatusCounts !== null &&
      displayedStatusCounts.notSubmitted + displayedStatusCounts.rejected + displayedStatusCounts.pending > 0
    ) {
      setHasTriggeredRequirementAlert(true);
      setIsRequirementAlertOpen(true);
    }
  }, [
    hasTriggeredRequirementAlert,
    isMounted,
    isLoadingStatuses,
    activeView,
    submissionWindow,
    displayedStatusCounts,
  ]);
  const showIncompleteRequirementsModal = isMounted && isRequirementAlertOpen;
  function openDirectUploadModal(
    code: RequirementCode | string,
    isRevision: boolean = false,
  ) {
    if (isAllValidated) return;
    setSelectedRequirementForUpload(code);
    setIsRevisionUpload(isRevision);
    setDirectUploadFile(null);
    setDirectUploadRemarks("");
    setDirectUploadMessage(null);
  }
  function closeDirectUploadModal() {
    if (isUploadingDirect) return;
    setSelectedRequirementForUpload(null);
    setIsRevisionUpload(false);
    setDirectUploadFile(null);
    setDirectUploadRemarks("");
    setDirectUploadMessage(null);
    setDirectUploadPercent(0);
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
    setDirectUploadPercent(10);
    setDirectUploadMessage(null);

    let progressTimer: NodeJS.Timeout | null = null;
    try {
      const activeAY =
        submissionWindow?.academicYear ||
        selectedAcademicYear ||
        form.academicYear ||
        "2025-2026";
      const activeSem =
        submissionWindow?.semester ||
        selectedSemester ||
        form.semester ||
        "1st Semester";
      const formData = new FormData();
      formData.append("file", directUploadFile);
      formData.append("academicYear", activeAY);
      formData.append("semester", activeSem);
      formData.append("requirementCode", selectedRequirementForUpload);
      formData.append("requirement_type", selectedRequirementForUpload);
      formData.append("remarks", directUploadRemarks);
      formData.append("notes", directUploadRemarks);

      // Smooth progress ticker for realistic UX progression
      let currentProgress = 15;
      progressTimer = setInterval(() => {
        currentProgress = Math.min(94, currentProgress + Math.floor(Math.random() * 8 + 4));
        setDirectUploadPercent((prev) => Math.max(prev, currentProgress));
      }, 150);

      const result = await new Promise<{ submissionId: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/faculty/submissions/create");

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable && event.total > 0) {
            const rawPercent = Math.min(95, Math.round((event.loaded / event.total) * 95));
            setDirectUploadPercent((prev) => Math.max(prev, rawPercent));
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const res = JSON.parse(xhr.responseText);
              resolve(res);
            } catch {
              reject(new Error("Invalid response from server"));
            }
          } else {
            try {
              const err = JSON.parse(xhr.responseText);
              reject(new Error(err.error || `Failed to submit requirement (HTTP ${xhr.status})`));
            } catch {
              reject(new Error(`Failed to submit requirement (HTTP ${xhr.status})`));
            }
          }
        };

        xhr.onerror = () => reject(new Error("Network error during document upload"));
        xhr.onabort = () => reject(new Error("Upload cancelled"));

        xhr.send(formData);
      });

      if (progressTimer) clearInterval(progressTimer);
      setDirectUploadPercent(100);
      await new Promise((resolve) => setTimeout(resolve, 380));

      setSubmissionMessage(
        isRevisionUpload
          ? `Revision submitted successfully for review. Reference ID: ${String(result.submissionId).slice(0, 8)}...`
          : `Requirement submitted successfully. Reference ID: ${String(result.submissionId).slice(0, 8)}...`,
      );
      // Optimistically update status badge to Pending immediately and lock out resubmission
      setRequirementStatuses((prev) => {
        const exists = prev.some(
          (r) => r.code === selectedRequirementForUpload,
        );
        if (exists) {
          return prev.map((r) =>
            r.code === selectedRequirementForUpload
              ? {
                  ...r,
                  status: "Pending" as const,
                  submittedAt: new Date().toISOString(),
                  latestSubmissionId: result.submissionId,
                  isRevision: isRevisionUpload || Boolean(r.feedback),
                  hasPriorRevision: true,
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
            isRevision: isRevisionUpload,
            hasPriorRevision: isRevisionUpload,
          },
        ];
      });
      setIsSubmitSuccess(true);
      router.refresh();
      void fetchStatuses();
      void fetchHistory();
    } catch (error) {
      if (progressTimer) clearInterval(progressTimer);
      setIsSubmittingModalOpen(false);
      setDirectUploadPercent(0);
      setDirectUploadMessage(
        `Error: ${error instanceof Error ? error.message : "An unexpected error occurred"}`,
      );
    } finally {
      if (progressTimer) clearInterval(progressTimer);
      setIsUploadingDirect(false);
    }
  }
  function updateField<K extends keyof SubmissionFormState>(
    key: K,
    value: SubmissionFormState[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }
  function getRequirementStatus(code: RequirementCode | string) {
    return requirementStatuses.find((r) => r.code === code)?.status;
  }
  function getRequirementStatusItem(code: RequirementCode | string) {
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
      item.adminRemarks || item.admin_remarks || item.feedback || null;
    const userNote =
      (item.note && item.note !== adminRemarks ? item.note : null) ||
      ((item as { notes?: string }).notes &&
      (item as { notes?: string }).notes !== adminRemarks
        ? (item as { notes?: string }).notes
        : null) ||
      (item.remarks && item.remarks !== adminRemarks ? item.remarks : null) ||
      null;
    const fileName =
      item.fileName ||
      item.storagePath ||
      (item as { file_name?: string }).file_name ||
      (item as { original_name?: string }).original_name ||
      undefined;
    const activeAY =
      submissionWindow?.academicYear ||
      selectedAcademicYear ||
      form.academicYear ||
      "2025-2026";
    const activeSem =
      submissionWindow?.semester ||
      selectedSemester ||
      form.semester ||
      "1st Semester";
    setPreviewSubmission({
      code: item.code,
      title: getRequirementTitle(item.code),
      fileName,
      storagePath: item.storagePath || undefined,
      submittedAt: item.submittedAt,
      note: userNote,
      notes: userNote,
      remarks: userNote,
      feedback: adminRemarks || undefined,
      admin_remarks: adminRemarks || undefined,
      adminRemarks: adminRemarks,
      reviewedAt: item.reviewedAt,
      latestSubmissionId: item.latestSubmissionId,
      status: item.status,
      academicYear: activeAY,
      semester: activeSem,
      hasPriorRevision: item.hasPriorRevision,
      isRevision: item.isRevision,
    });
  }
  function openHistorySubmissionPreview(submission: PastSubmission) {
    markSubmissionViewed(submission.id);
    const adminRemarks =
      submission.adminRemarks ||
      submission.admin_remarks ||
      submission.feedback ||
      null;
    const userNote =
      (submission.note && submission.note !== adminRemarks
        ? submission.note
        : null) ||
      ((submission as { notes?: string }).notes &&
      (submission as { notes?: string }).notes !== adminRemarks
        ? (submission as { notes?: string }).notes
        : null) ||
      (submission.remarks && submission.remarks !== adminRemarks
        ? submission.remarks
        : null) ||
      null;
    const fileName =
      submission.fileName ||
      submission.storagePath ||
      submission.file_name ||
      submission.original_name ||
      submission.file_path ||
      undefined;
    setPreviewSubmission({
      code: submission.requirementCode,
      title: getRequirementTitle(submission.requirementCode),
      fileName,
      storagePath: submission.storagePath || undefined,
      submittedAt: submission.submittedAt,
      note: userNote,
      notes: userNote,
      remarks: userNote,
      feedback: adminRemarks || undefined,
      admin_remarks: adminRemarks || undefined,
      adminRemarks: adminRemarks,
      reviewedAt: submission.reviewedAt || submission.dateValidated,
      latestSubmissionId: submission.id,
      status: submission.status,
      academicYear: submission.academicYear,
      semester: submission.semester,
    });
  }
  function startRevision(requirementCode: RequirementCode | string) {
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
        `Successfully submitted ${getRequirementTitle(form.requirementCode)} for S.Y. ${form.academicYear} ${form.semester}. Reference ID: ${String(result.submissionId).slice(0, 8)}...`,
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
        requirementCode: activeTemplates[0]?.code || "grade_sheet",
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

  return (
    <div className="relative flex min-h-full w-full items-stretch gap-0">
      {/* ─── Initial page-load overlay ─────────────────────────────── */}
      {isPageLoading && (
        <SystemLoadingScreen text="Loading faculty academic portal..." />
      )}
      {/* Mobile Menu Button (visible only on small screens when drawer is closed) */}
      {!isMobileMenuOpen && (
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(true)}
          className="fixed left-3 top-2.5 z-[55] md:hidden p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
          aria-label="Open Navigation Menu"
        >
          <AppIcon icon={Menu} size="lg" color="inherit" />
        </button>
      )}
      {/* Desktop Sidebar (hidden on mobile) */}
      <aside className="hidden md:flex md:flex-col fixed left-0 top-14 h-[calc(100vh-3.5rem)] w-72 overflow-y-auto rounded-none bg-[#800000] text-amber-50 border-r-2 border-amber-400/60 p-3.5 shadow-md transition-colors duration-200">
        <div className="my-1.5 bg-[#6b0000]/80 border border-amber-400/40 p-4 rounded-xl text-center flex flex-col items-center transition-colors shadow-xs">
          <button
            type="button"
            onClick={() => navigateToView("settings")}
            className="relative mb-2 cursor-pointer transition-transform hover:scale-105 group focus:outline-hidden"
            title="Manage Profile & Settings"
          >
            {currentAvatarUrl && !hasAvatarError ? (
              <img
                src={currentAvatarUrl}
                alt={currentFacultyName || "Faculty Profile"}
                className="w-14 h-14 rounded-full object-cover border-2 border-amber-400/60 bg-slate-900 shadow-md ring-2 ring-amber-400/30 group-hover:border-amber-400 transition-colors"
                onError={() => setHasAvatarError(true)}
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-amber-500/20 text-amber-200 border border-amber-400/40 font-bold text-sm flex items-center justify-center shadow-xs ring-2 ring-amber-400/30 group-hover:border-amber-400 transition-colors">
                {facultyInitials}
              </div>
            )}
            <span
              className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[#800000]"
              title="Active"
            />
          </button>
          <span className="text-xs font-medium text-amber-200/90 tracking-wide">
            Welcome,
          </span>
          <p className="mt-0.5 font-bold text-white text-center text-sm sm:text-base tracking-tight">
            {facultyFirstName}
          </p>
          <div className="my-2 h-px w-full bg-amber-400/50" />
          <span className="mt-0.5 inline-flex items-center justify-center bg-amber-400/15 text-amber-300 border border-amber-400/40 px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full">
            Faculty
          </span>
        </div>
        <div className="my-2 h-px w-full bg-amber-400/50" />
        <div className="my-1.5">
          <SubmissionWindowCountdown
            window={submissionWindow}
            isLoading={isLoadingSubmissionWindow}
            onExpired={handleWindowExpired}
          />
        </div>
        <div className="my-2 h-px w-full bg-amber-400/50" />
        <nav className="mt-1.5 space-y-1.5">
          {[
            { key: "dashboard", label: "Dashboard", Icon: ViewGrid },
            {
              key: "status",
              label: "Documents to be Submitted",
              Icon: TaskList,
            },
            { key: "settings", label: "Settings", Icon: Settings },
          ].map(({ key, label, Icon }) => {
            const isActive = activeView === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => navigateToView(key as PanelView)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium transition-colors cursor-pointer rounded-lg ${
                  isActive
                    ? "bg-amber-400/20 text-white font-semibold border-l-2 border-amber-400 shadow-xs"
                    : "text-amber-100/80 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon
                  strokeWidth={2}
                  className={`h-5 w-5 shrink-0 ${
                    isActive
                      ? "text-amber-300 stroke-[2]"
                      : "text-amber-200/70"
                  }`}
                />
                <span className="truncate">{label}</span>
                {key === "status" && isAllValidated && (
                  <span className="ml-auto inline-flex items-center px-2 py-0.5 rounded-full bg-[#0b5336] text-[10px] font-bold text-white shadow-2xs">
                    Done
                  </span>
                )}
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
            className="relative flex flex-col h-full w-72 max-w-[85%] bg-[#800000] text-amber-50 border-r-2 border-amber-400/60 p-4 shadow-2xl transition-colors duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-amber-400/50 mb-2">
              <span className="text-sm font-semibold text-white">
                Faculty Menu
              </span>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1.5 rounded-lg border border-amber-400/40 bg-[#6b0000] hover:bg-[#580000] text-white transition-colors cursor-pointer shadow-xs"
              >
                <AppIcon icon={Xmark} size="md" color="inherit" />
              </button>
            </div>
            <div className="my-1.5 bg-[#6b0000]/80 border border-amber-400/40 p-4 rounded-xl text-center flex flex-col items-center transition-colors shadow-xs">
              <button
                type="button"
                onClick={() => {
                  navigateToView("settings");
                  setIsMobileMenuOpen(false);
                }}
                className="relative mb-2 cursor-pointer transition-transform hover:scale-105 group focus:outline-hidden"
                title="Manage Profile & Settings"
              >
                {currentAvatarUrl && !hasAvatarError ? (
                  <img
                    src={currentAvatarUrl}
                    alt={currentFacultyName || "Faculty Profile"}
                    className="w-14 h-14 rounded-full object-cover border-2 border-amber-400/60 bg-slate-900 shadow-md ring-2 ring-amber-400/30 group-hover:border-amber-400 transition-colors"
                    onError={() => setHasAvatarError(true)}
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-amber-500/20 text-amber-200 border border-amber-400/40 font-bold text-sm flex items-center justify-center shadow-xs ring-2 ring-amber-400/30 group-hover:border-amber-400 transition-colors">
                    {facultyInitials}
                  </div>
                )}
                <span
                  className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[#800000]"
                  title="Active"
                />
              </button>
              <span className="text-xs font-medium text-amber-200/90 tracking-wide">
                Welcome,
              </span>
              <p className="mt-0.5 font-bold text-white text-center text-sm sm:text-base tracking-tight">
                {facultyFirstName}
              </p>
              <div className="my-2 h-px w-full bg-amber-400/50" />
              <span className="mt-0.5 inline-flex items-center justify-center bg-amber-400/15 text-amber-300 border border-amber-400/40 px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full">
                Faculty
              </span>
            </div>
            <div className="my-2 h-px w-full bg-amber-400/50" />
            <div className="my-1.5">
              <SubmissionWindowCountdown
                window={submissionWindow}
                isLoading={isLoadingSubmissionWindow}
                onExpired={handleWindowExpired}
              />
            </div>
            <div className="my-2 h-px w-full bg-amber-400/50" />
            <nav className="mt-1.5 space-y-1.5 flex-1">
              {[
                { key: "dashboard", label: "Dashboard", Icon: ViewGrid },
                {
                  key: "status",
                  label: "Documents to be Submitted",
                  Icon: TaskList,
                },
                { key: "settings", label: "Settings", Icon: Settings },
              ].map(({ key, label, Icon }) => {
                const isActive = activeView === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      navigateToView(key as PanelView);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium transition-colors cursor-pointer rounded-lg ${
                      isActive
                        ? "bg-amber-400/20 text-white font-semibold border-l-2 border-amber-400 shadow-xs"
                        : "text-amber-100/80 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <Icon
                      strokeWidth={2}
                      className={`h-5 w-5 shrink-0 ${
                        isActive
                          ? "text-amber-300 stroke-[2]"
                          : "text-amber-200/70"
                      }`}
                    />
                    <span className="truncate">{label}</span>
                    {key === "status" && isAllValidated && (
                      <span className="ml-auto inline-flex items-center px-2 py-0.5 rounded-full bg-[#0b5336] text-[10px] font-bold text-white shadow-2xs">
                        Done
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}
      <div className="md:ml-72 flex min-h-full w-full md:w-[calc(100%-18rem)] flex-col">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-l-0 bg-slate-100 dark:bg-[#0b0f19] shadow-sm transition-colors duration-200">
          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-100 dark:bg-[#0b0f19] text-slate-900 dark:text-slate-100 transition-colors duration-200">
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
              <article className="space-y-5 p-2 sm:p-4 md:p-5">
                {/* Minimalist Header */}
                <div className="border-b border-slate-300 dark:border-slate-800/80 pb-4 space-y-3">
                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                        Dashboard
                      </h1>
                      {isAllValidated && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0b5336] text-white text-xs font-bold shadow-2xs">
                          <AppIcon icon={CheckCircle} size="sm" color="inherit" />
                          Done All for This Semester
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-sm sm:text-base text-slate-600 dark:text-slate-300 font-normal leading-relaxed">
                      Overview of your faculty compliance status, submission timeline, and recent document activity.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-0.5">
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
                      A.Y. {activeAY} • {activeSem}
                      {isWindowNotConfigured && !isAllValidated ? (
                        <span className="ml-2 text-slate-500 dark:text-slate-400 font-medium">
                          • (Awaiting Schedule)
                        </span>
                      ) : isWindowClosed && !isAllValidated ? (
                        <span className="ml-2 text-slate-500 dark:text-slate-400 font-medium">
                          • (Submission Window Closed)
                        </span>
                      ) : null}
                    </p>

                    <div className="flex flex-wrap items-center justify-end gap-2 shrink-0 sm:ml-auto">
                      <button
                        type="button"
                        onClick={() => void fetchStatuses()}
                        disabled={isLoadingStatuses}
                        title="Refresh dashboard"
                        className="inline-flex items-center justify-center rounded-lg border border-amber-600 bg-amber-500 hover:bg-amber-400 p-2 text-slate-950 transition disabled:opacity-50 cursor-pointer shadow-xs"
                      >
                        <Refresh
                          className={`h-3.5 w-3.5 text-slate-950 ${isLoadingStatuses ? "animate-spin" : ""}`}
                        />
                        <span className="sr-only">Refresh</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Clean Status Counts with Legend */}
                {displayedStatusCounts && !isLoadingStatuses && (
                  <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium pt-1">
                      <span className="inline-flex items-center gap-1.5" title="Validated: Requirements verified and approved">
                        <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-[#0b5336] text-white border border-[#08412a] shrink-0 shadow-2xs">
                          <AppIcon icon={Check} size="xs" color="white" />
                        </span>
                        <span>
                          <strong className="text-slate-900 dark:text-slate-100 font-semibold">{displayedStatusCounts.validated}</strong> Validated
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-1.5" title="Pending: Awaiting administration verification">
                        <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-amber-500 text-slate-950 border border-amber-600 shrink-0 shadow-2xs">
                          <AppIcon icon={Hourglass} size="xs" color="inherit" />
                        </span>
                        <span>
                          <strong className="text-slate-900 dark:text-slate-100 font-semibold">{isAllValidated ? 0 : displayedStatusCounts.pending}</strong> Pending
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-1.5" title="Needs Revision: Correction requested by reviewer">
                        <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-[#780000] text-white border border-[#5e0000] shrink-0 shadow-2xs">
                          <AppIcon icon={Xmark} size="xs" color="white" />
                        </span>
                        <span>
                          <strong className="text-slate-900 dark:text-slate-100 font-semibold">{isAllValidated ? 0 : displayedStatusCounts.rejected}</strong> Needs Revision
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-1.5" title="Not Submitted: Requirement pending document upload">
                        <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-300 dark:border-slate-700 shrink-0 shadow-2xs">
                          <AppIcon icon={Minus} size="xs" color="inherit" />
                        </span>
                        <span>
                          <strong className="text-slate-900 dark:text-slate-100 font-semibold">{isAllValidated ? 0 : displayedStatusCounts.notSubmitted}</strong> Not Submitted
                        </span>
                      </span>
                    </div>
                )}

                {/* Term Completion Celebration Banner in Dashboard */}
                {isAllValidated && (
                  <div className="p-4 sm:p-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-950/30 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in duration-200">
                    <div className="flex items-start sm:items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-[#0b5336] text-white shrink-0 shadow-2xs">
                        <AppIcon icon={CheckCircle} size="lg" color="inherit" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            Done All for This Semester (100% Validated)
                          </h3>
                          <span className="inline-flex items-center rounded-full bg-[#0b5336] text-white text-[10px] font-bold px-2 py-0.2 shadow-2xs">
                            6/6 Complete
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                          All 6 mandatory compliance documents for {activeAY} • {activeSem} have been verified and validated.
                          {!isWindowClosed && (
                            <span className="block mt-0.5 text-[#0b5336] dark:text-emerald-400 font-medium">
                              Active submission window extensions apply only to faculty with pending lackings. Your account remains fully completed.
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={openHistoryModal}
                        className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 text-xs font-semibold cursor-pointer shadow-2xs transition"
                      >
                        View History
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsTermCompletionModalOpen(true)}
                        className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs shadow-sm transition active:scale-[0.98] cursor-pointer"
                      >
                        <AppIcon icon={CheckCircle} size="md" color="inherit" />
                        <span>View Summary</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Extension Request Feedback Toast in Dashboard */}
                <AlertPopup
                  type="success"
                  message={extensionRequestToast}
                  onClose={() => setExtensionRequestToast(null)}
                />

                {/* Top Stat Summary Grid (3 Cards) */}
                <section className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
                  {/* Card 1: Overall Progress */}
                  <div className="rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs p-5 sm:p-6 space-y-3 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Overall Progress
                      </span>
                      <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" strokeWidth={2} />
                    </div>
                    <div>
                      <div className="flex items-baseline justify-between">
                        <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                          {isAllValidated
                            ? "Done All for This Semester"
                            : `${displayedStatusCounts?.validated ?? 0} of ${displayedStatusCounts?.total ?? 6} Validated`}
                        </h3>
                        <span className="text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400">
                          {Math.round(
                            ((displayedStatusCounts?.validated ?? 0) /
                              (displayedStatusCounts?.total || 6)) *
                              100,
                          )}
                          %
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
                        {isAllValidated
                          ? "All 6/6 requirements completed and validated"
                          : `${(displayedStatusCounts?.total ?? 6) - (displayedStatusCounts?.validated ?? 0)} items awaiting completion`}
                      </p>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700">
                      <div
                        className="h-full bg-emerald-500 transition-all duration-500 rounded-full"
                        style={{
                          width: `${Math.min(100, Math.round(((displayedStatusCounts?.validated ?? 0) / (displayedStatusCounts?.total || 6)) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Card 2: Submission Window Status */}
                  <div className="rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs p-5 sm:p-6 space-y-3 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Window Status
                      </span>
                      {isWindowNotConfigured || (hasActiveSchedule && !isWindowClosed) ? (
                        <Calendar className="h-5 w-5 text-slate-400" strokeWidth={2} />
                      ) : (
                        <Hourglass className="h-5 w-5 text-slate-400" strokeWidth={2} />
                      )}
                    </div>
                    <div>
                      <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                        {isAllValidated
                          ? "Done All for This Sem"
                          : isWindowNotConfigured
                            ? "Schedule Not Set"
                            : isWindowClosed
                              ? "Window Closed"
                              : "Submission Open"}
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
                        {isAllValidated
                          ? "All requirements completed for this term"
                          : windowDeadlineDisplay
                            ? `Deadline: ${windowDeadlineDisplay}`
                            : "Awaiting admin schedule"}
                      </p>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {isAllValidated
                        ? "Requirements locked in validated status"
                        : isSubmissionAvailable
                          ? "Uploads and resubmissions are currently enabled"
                          : isWindowNotConfigured
                            ? "Submissions will unlock when scheduled"
                            : "Document submissions are currently locked"}
                    </p>
                  </div>

                  {/* Card 3: Action Required */}
                  <div className="rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs p-5 sm:p-6 space-y-3 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Action Required
                      </span>
                      <TaskList className="h-5 w-5 text-slate-400" strokeWidth={2} />
                    </div>
                    <div>
                      <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                        {isAllValidated
                          ? "0 Items (Done All for This Sem)"
                          : `${(displayedStatusCounts?.notSubmitted ?? 0) +
                              (displayedStatusCounts?.rejected ?? 0)} Items`}
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
                        {isAllValidated
                          ? "All 6/6 Requirements Validated"
                          : `${displayedStatusCounts?.notSubmitted ?? 0} Not Submitted • ${displayedStatusCounts?.rejected ?? 0} Needs Revision`}
                      </p>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {isAllValidated
                        ? "No further action needed for this semester"
                        : (displayedStatusCounts?.pending ?? 0) > 0
                          ? `${displayedStatusCounts?.pending} item(s) currently under admin review`
                          : "Direct upload available for pending items"}
                    </p>
                  </div>
                </section>

                {/* Main Dashboard Body: Recent Activity */}
                <section className="space-y-6">
                  {/* Activity Feed Card */}
                  <div className="rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs p-5 sm:p-6 space-y-4 transition-colors">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-300 dark:border-slate-800">
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                        Recent Activity
                      </h3>
                      <button
                        type="button"
                        onClick={openHistoryModal}
                        className="text-xs sm:text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 transition cursor-pointer font-semibold"
                      >
                        View all
                      </button>
                    </div>
                    {deduplicatedRecentActivities.length > 0 ? (
                      <div className="space-y-3">
                        {deduplicatedRecentActivities.map((sub) => (
                          <div
                            key={sub.id}
                            className="flex items-start gap-3.5 p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 dark:bg-slate-950/60 dark:hover:bg-slate-950/90 border border-slate-300 dark:border-slate-800/80 transition-colors"
                          >
                            <div className="mt-0.5 shrink-0">
                              {renderStatusIconBadge(sub.status)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                                {getRequirementTitle(sub.requirementCode)}
                              </p>
                              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                                Status:{" "}
                                <span
                                  className={getStatusTextColor(sub.status)}
                                >
                                  {getStatusText(sub.status)}
                                </span>
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                {formatSubmittedDateTime(sub.submittedAt) ??
                                  sub.submittedAt}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500 dark:text-slate-400 py-3 text-center">
                        No submission activity recorded yet.
                      </p>
                    )}
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
                        <p className="text-xs uppercase tracking-[0.18em] text-amber-600 dark:text-amber-300 font-semibold">
                          School Year
                        </p>
                        <p className="mt-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-3 text-sm text-slate-900 dark:text-slate-100">
                          {form.academicYear
                            ? `S.Y. ${form.academicYear}`
                            : "Loading current term..."}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-amber-600 dark:text-amber-300 font-semibold">
                          Semester
                        </p>
                        <p className="mt-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-3 text-sm text-slate-900 dark:text-slate-100">
                          {form.semester}
                        </p>
                      </div>
                    </div>
                    <div>
                      <label
                        className="text-xs uppercase tracking-[0.18em] text-amber-600 dark:text-amber-300 font-semibold"
                        htmlFor="requirementCode"
                      >
                        Requirement Type
                      </label>
                      <select
                        id="requirementCode"
                        className="mt-0 w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100 px-3 py-2 text-sm outline-none focus:border-slate-400 dark:focus:border-slate-600 focus:ring focus:ring-amber-300/30 cursor-pointer"
                        value={form.requirementCode}
                        onChange={(event) =>
                          updateField(
                            "requirementCode",
                            event.target.value,
                          )
                        }
                      >
                        {activeTemplates.map((tpl) => {
                          const status = getRequirementStatus(tpl.code);
                          const disabled =
                            status &&
                            status !== "Not Submitted" &&
                            status !== "Rejected";
                          return (
                            <option key={tpl.code} value={tpl.code} disabled={disabled}>
                              {tpl.title}
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
                        maxSizeMb={
                          activeTemplates.find((t) => t.code === form.requirementCode)
                            ?.max_size_mb || 10
                        }
                        allowedFormats={
                          activeTemplates.find((t) => t.code === form.requirementCode)
                            ?.allowed_formats || ["PDF", "DOCX", "XLSX", "JPG", "PNG"]
                        }
                        currentStatus={getRequirementStatus(
                          form.requirementCode,
                        )}
                        reviewerFeedback={
                          getRequirementStatusItem(form.requirementCode)
                            ?.adminRemarks ||
                          getRequirementStatusItem(form.requirementCode)
                            ?.admin_remarks ||
                          getRequirementStatusItem(form.requirementCode)
                            ?.feedback
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
                        className="mt-0 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition resize-none"
                        placeholder="Add short notes for the reviewer"
                        value={form.remarks}
                        onChange={(event) =>
                          updateField("remarks", event.target.value)
                        }
                      />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/60 px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
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
                  <div className="mt-6 flex min-h-[60vh] items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8">
                    <div className="w-full max-w-2xl rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/80 p-8 text-center shadow-2xl">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        <WarningTriangle className="h-8 w-8" strokeWidth={2} />
                      </div>
                      <h3 className="mt-5 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                        Submission Is Currently Unavailable
                      </h3>
                      {isLoadingSubmissionWindow ? (
                        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                          Checking submission availability...
                        </p>
                      ) : submissionWindow?.isConfigured ? (
                        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                          The submission window is closed. Allowed schedule is
                          <span className="font-semibold text-amber-600 dark:text-amber-300">
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
                        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                          Admin has not set the submission start and end dates
                          yet. Please wait until the schedule is available.
                        </p>
                      )}
                      {submissionWindow?.today ? (
                        <p className="mt-4 text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                          Now: {submissionWindow.today}{" "}
                          {submissionWindow.currentTimeLabel ??
                            submissionWindow.currentTime}
                        </p>
                      ) : null}
                    </div>
                  </div>
                )}
                <AlertPopup
                  type={
                    submissionMessage?.toLowerCase().includes("please") ||
                    submissionMessage?.toLowerCase().includes("failed") ||
                    submissionMessage?.toLowerCase().includes("error")
                      ? "error"
                      : "success"
                  }
                  message={submissionMessage}
                  onClose={() => setSubmissionMessage(null)}
                />
                {isMounted && isGuideOpen ? (
                  <div
                    className="fixed inset-0 z-50 overflow-y-auto bg-black/60 p-4 sm:p-6 flex min-h-full items-center justify-center backdrop-blur-sm"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="submission-guide-title"
                    onClick={() => setIsGuideOpen(false)}
                  >
                    <div
                      className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100 p-6 shadow-2xl my-auto"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <ModalHeader
                        icon={Page}
                        title="Submission Guide"
                        subtitle="Instructions and guidelines for uploading compliance documents"
                        onClose={() => setIsGuideOpen(false)}
                        className="-mx-6 -mt-6 mb-5 rounded-t-2xl"
                      />
                      <div className="mt-5 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4">
                          <p className="font-medium text-slate-900 dark:text-slate-100">
                            1. Select the term
                          </p>
                          <p className="mt-1 text-slate-500 dark:text-slate-400">
                            Match the school year and semester for the document
                            you are uploading.
                          </p>
                        </div>
                        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4">
                          <p className="font-medium text-slate-900 dark:text-slate-100">
                            2. Choose the requirement
                          </p>
                          <p className="mt-1 text-slate-500 dark:text-slate-400">
                            Pick the requirement type so the reviewer can
                            validate it correctly.
                          </p>
                        </div>
                        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4">
                          <p className="font-medium text-slate-900 dark:text-slate-100">
                            3. Attach the file
                          </p>
                          <p className="mt-1 text-slate-500 dark:text-slate-400">
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
                <div className="border-b border-slate-300 dark:border-slate-800/80 pb-4 space-y-3">
                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                        Documents to be Submitted
                      </h1>
                      {isAllValidated && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0b5336] text-white text-xs font-bold shadow-2xs">
                          <AppIcon icon={CheckCircle} size="sm" color="inherit" />
                          Done All for This Semester
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-sm sm:text-base text-slate-600 dark:text-slate-300 font-normal leading-relaxed">
                      View, upload, and track the status of your required faculty compliance documents for this academic term.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-0.5">
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
                      A.Y. {activeAY} • {activeSem}
                      {isWindowNotConfigured && !isAllValidated ? (
                        <span className="ml-2 text-slate-500 dark:text-slate-400 font-medium">
                          • (Awaiting Schedule)
                        </span>
                      ) : isWindowClosed && !isAllValidated ? (
                        <span className="ml-2 text-slate-500 dark:text-slate-400 font-medium">
                          • (Submission Window Closed)
                        </span>
                      ) : null}
                    </p>

                    <div className="flex flex-wrap items-center justify-end gap-2 shrink-0 sm:ml-auto">
                      <button
                        type="button"
                        onClick={openHistoryModal}
                        className="inline-flex items-center gap-1.5 bg-[#0b5336] hover:bg-[#08412a] text-white border border-[#08412a] rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shadow-xs"
                        title="View validated documents history"
                      >
                        <AppIcon icon={CheckCircle} size="sm" color="white" />
                        <span>Validation History</span>
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
                        className="inline-flex items-center gap-1.5 bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shadow-xs"
                      >
                        <Logo size={14} className="shrink-0" />
                        <span>University Calendar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void fetchStatuses()}
                        disabled={isLoadingStatuses}
                        title="Refresh status"
                        className="inline-flex items-center justify-center rounded-lg border border-amber-600 bg-amber-500 hover:bg-amber-400 p-2 text-slate-950 transition disabled:opacity-50 cursor-pointer shadow-xs"
                      >
                        <Refresh
                          className={`h-3.5 w-3.5 text-slate-950 ${isLoadingStatuses ? "animate-spin" : ""}`}
                        />
                        <span className="sr-only">Refresh</span>
                      </button>
                    </div>
                  </div>
                </div>
                {/* Clean Header Progress & Status Counts with Legend */}
                {displayedStatusCounts && !isLoadingStatuses && (
                  <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium pt-1">
                      <span className="inline-flex items-center gap-1.5" title="Validated: Requirements verified and approved">
                        <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-[#0b5336] text-white border border-[#08412a] shrink-0 shadow-2xs">
                          <AppIcon icon={Check} size="xs" color="white" />
                        </span>
                        <span>
                          <strong className="text-slate-900 dark:text-slate-100 font-semibold">{displayedStatusCounts.validated}</strong> Validated
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-1.5" title="Pending: Awaiting administration verification">
                        <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-amber-500 text-slate-950 border border-amber-600 shrink-0 shadow-2xs">
                          <AppIcon icon={Hourglass} size="xs" color="inherit" />
                        </span>
                        <span>
                          <strong className="text-slate-900 dark:text-slate-100 font-semibold">{isAllValidated ? 0 : displayedStatusCounts.pending}</strong> Pending
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-1.5" title="Needs Revision: Correction requested by reviewer">
                        <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-[#780000] text-white border border-[#5e0000] shrink-0 shadow-2xs">
                          <AppIcon icon={Xmark} size="xs" color="white" />
                        </span>
                        <span>
                          <strong className="text-slate-900 dark:text-slate-100 font-semibold">{isAllValidated ? 0 : displayedStatusCounts.rejected}</strong> Needs Revision
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-1.5" title="Not Submitted: Requirement pending document upload">
                        <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-300 dark:border-slate-700 shrink-0 shadow-2xs">
                          <AppIcon icon={Minus} size="xs" color="inherit" />
                        </span>
                        <span>
                          <strong className="text-slate-900 dark:text-slate-100 font-semibold">{isAllValidated ? 0 : displayedStatusCounts.notSubmitted}</strong> Not Submitted
                        </span>
                      </span>
                    </div>
                )}

                {/* 1. Schedule Not Set Banner (No Schedule Configured in Database) */}
                {isWindowNotConfigured && !isAllValidated && (
                  <div className="p-3 sm:p-4 rounded-xl border border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-700 dark:text-slate-300">
                    <div className="flex items-start sm:items-center gap-2.5">
                      <div className="p-1.5 rounded-lg bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shrink-0">
                        <AppIcon icon={Calendar} size="md" color="inherit" />
                      </div>
                      <div>
                        <span className="font-bold text-slate-900 dark:text-slate-200 mr-1.5">
                          Submission Schedule Not Set:
                        </span>
                        <span className="text-slate-600 dark:text-slate-400">
                          There is currently no active academic schedule set for document submissions. Uploads will unlock once the administrator announces the submission schedule.
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-200/70 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 text-xs font-semibold">
                        <AppIcon icon={Lock} size="xs" color="inherit" />
                        <span>Awaiting Schedule</span>
                      </span>
                    </div>
                  </div>
                )}

                {/* 2. Closed Window Banner with Request Extension Button (Schedule was set and has now expired) */}
                {isWindowClosed && !isAllValidated && (
                  <div className="p-3 sm:p-4 rounded-xl border border-amber-300 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-700 dark:text-slate-300">
                    <div className="flex items-start sm:items-center gap-2.5">
                      <div className="p-1 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-400 shrink-0">
                        <AppIcon icon={Hourglass} size="md" color="inherit" />
                      </div>
                      <div>
                        <div>
                          <span className="font-bold text-amber-900 dark:text-amber-300 mr-1.5">
                            Submission Window Closed:
                          </span>
                          Submission Window is currently closed. Document uploads are locked for this term.
                        </div>
                        {hasPendingExtensionRequest && (
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-950 dark:text-amber-200 border border-amber-500/40 text-[11px] font-bold">
                              <AppIcon icon={Hourglass} size="xs" color="active" />
                              Extension Request Pending Admin Review ({pendingExtensionData?.requested_preset || "+3 Days"})
                            </span>
                            {pendingExtensionData?.reason && (
                              <span className="text-[11px] text-slate-600 dark:text-slate-400 italic">
                                &ldquo;{pendingExtensionData.reason}&rdquo;
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {hasLackings && (
                      <div className="shrink-0 flex items-center gap-2">
                        {hasPendingExtensionRequest ? (
                          <button
                            type="button"
                            onClick={() => setShowExtensionDetailsModal(true)}
                            className="inline-flex items-center gap-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 border border-amber-500/40 font-bold px-3.5 py-2 rounded-xl text-xs shadow-xs transition-all cursor-pointer"
                          >
                            <AppIcon icon={Hourglass} size="sm" color="inherit" />
                            <span>View Request Details</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openExtensionRequestModal()}
                            className="inline-flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3.5 py-2 rounded-xl text-xs shadow-sm active:scale-[0.98] transition-all cursor-pointer"
                          >
                            <AppIcon icon={Hourglass} size="sm" color="inherit" />
                            <span>Request Extension</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Single Unified Table/List Container */}
                {isLoadingStatuses ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400 py-6 text-center">
                    Loading requirement statuses...
                  </p>
                ) : statusError ? (
                  <div
                    role="alert"
                    className="p-3.5 my-3 rounded-xl bg-[#780000] text-white border border-[#5e0000] flex items-center gap-2.5 text-xs font-semibold shadow-xs"
                  >
                    <AppIcon icon={WarningCircle} size="md" color="white" className="shrink-0" />
                    <span className="leading-snug">{statusError}</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {isAllValidated && (
                      <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-950/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-lg bg-[#0b5336] text-white shrink-0 shadow-2xs">
                            <AppIcon icon={CheckCircle} size="md" color="inherit" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-[#0b5336] dark:text-emerald-400 text-sm">
                                All Requirements Completed & Validated
                              </span>
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0b5336] dark:text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                                {`${displayedStatusCounts.validated} of ${displayedStatusCounts.total} Validated`}
                              </span>
                            </div>
                            <p className="text-slate-600 dark:text-slate-300 text-xs mt-0.5">
                              All {displayedStatusCounts.total} compliance requirements for A.Y. {activeAY} • {activeSem} are completed. Your submissions remain active and viewable below.
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={openHistoryModal}
                            className="inline-flex items-center gap-1.5 bg-[#0b5336] hover:bg-[#08412a] text-white border border-[#08412a] rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shadow-xs"
                            title="View validated documents history"
                          >
                            <AppIcon icon={CheckCircle} size="sm" color="white" />
                            <span>Validation History</span>
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="bg-white border border-slate-300 shadow-sm shadow-slate-300/50 dark:bg-slate-900 dark:border dark:border-slate-800 dark:shadow-none rounded-xl overflow-hidden transition-colors">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm min-w-[640px]">
                          <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
                              <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 w-[50%]">Document</th>
                              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-center w-[30%]">Actions</th>
                              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-center w-[20%]">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                            {displayedRequirementStatuses.map((req) => (
                              <tr
                                key={req.code}
                                id={`requirement-${req.code}`}
                                className="bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/40 transition-colors"
                              >
                                {/* Document column */}
                                <td className="px-5 py-3.5 align-middle">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                        {getRequirementTitle(req.code)}
                                      </h4>
                                    </div>
                                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-slate-500 dark:text-slate-400">
                                      {req.submittedAt &&
                                      formatSubmittedDateTime(req.submittedAt) ? (
                                        <span>
                                          Submitted:{" "}
                                          {formatSubmittedDateTime(req.submittedAt)}
                                        </span>
                                      ) : (
                                        <span>No submission recorded yet</span>
                                      )}
                                      {req.reviewedAt && (
                                        <span>• Reviewed: {req.reviewedAt}</span>
                                      )}
                                    </div>
                                    {/* Inline Revision Note */}
                                    {req.status === "Rejected" && (
                                      <p className="text-xs text-[#780000] dark:text-rose-400 flex items-center gap-1.5 mt-1 font-medium">
                                        <AppIcon icon={WarningCircle} size="sm" color="danger" />
                                        <span className="italic truncate">
                                          &ldquo;
                                          {req.adminRemarks ||
                                            req.admin_remarks ||
                                            req.feedback ||
                                            "Revision requested. Please check and resubmit."}
                                          &rdquo;
                                        </span>
                                      </p>
                                    )}
                                  </div>
                                </td>

                                {/* Actions column */}
                                <td className="px-4 py-3.5 align-middle text-center">
                                  <div className="flex flex-col items-center justify-center gap-1.5">
                                    {/* Upload Revision (Rejected - Primary Action on Top) */}
                                    {req.status === "Rejected" && (
                                      isWindowNotConfigured ? (
                                        <button
                                          type="button"
                                          disabled
                                          className="inline-flex items-center justify-center gap-1.5 bg-slate-200/70 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 font-medium w-36 h-8 rounded-xl text-xs cursor-not-allowed opacity-80"
                                          title="Submissions will open once the administration announces the submission schedule."
                                        >
                                          <AppIcon icon={Calendar} size="sm" color="inherit" />
                                          <span>Awaiting Schedule</span>
                                        </button>
                                      ) : isWindowClosed ? (
                                        hasPendingExtensionRequest ? (
                                          <button
                                            type="button"
                                            onClick={() => setShowExtensionDetailsModal(true)}
                                            className="inline-flex items-center justify-center gap-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 border border-amber-500/30 font-bold w-36 h-8 rounded-xl text-xs shadow-xs transition-all cursor-pointer"
                                          >
                                            <AppIcon icon={Hourglass} size="sm" color="active" />
                                            <span>Extension Pending</span>
                                          </button>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => openExtensionRequestModal(req.code)}
                                            className="inline-flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-600/40 font-bold w-36 h-8 rounded-xl text-xs shadow-xs active:scale-[0.98] transition-all cursor-pointer"
                                          >
                                            <AppIcon icon={Hourglass} size="sm" color="inherit" />
                                            <span>Request Extension</span>
                                          </button>
                                        )
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => openDirectUploadModal(req.code, true)}
                                          disabled={!hasActiveSchedule}
                                          className="inline-flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-600/40 font-semibold w-36 h-8 rounded-xl text-xs shadow-xs active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
                                        >
                                          <AppIcon icon={Upload} size="sm" color="inherit" />
                                          <span>Upload Revision</span>
                                        </button>
                                      )
                                    )}

                                    {/* View File */}
                                    {req.status !== "Not Submitted" &&
                                    req.latestSubmissionId ? (
                                      <button
                                        type="button"
                                        onClick={() => openSubmissionPreview(req)}
                                        className="relative inline-flex items-center justify-center gap-1.5 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-xl w-36 h-8 text-xs font-bold transition-all cursor-pointer shadow-2xs active:scale-95"
                                      >
                                        {Boolean(
                                          req.feedback &&
                                          !viewedSubmissionIds.has(req.latestSubmissionId) &&
                                          req.is_read !== true,
                                        ) ? (
                                          <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                                          </span>
                                        ) : null}
                                        <AppIcon icon={Eye} size="sm" color="inherit" />
                                        <span>View File</span>
                                      </button>
                                    ) : null}

                                    {/* Upload (Not Submitted) */}
                                    {req.status === "Not Submitted" && (
                                      isWindowNotConfigured ? (
                                        <button
                                          type="button"
                                          disabled
                                          className="inline-flex items-center justify-center gap-1.5 bg-slate-200/70 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 font-medium w-36 h-8 rounded-xl text-xs cursor-not-allowed opacity-80"
                                          title="Submissions will open once the administration announces the submission schedule."
                                        >
                                          <AppIcon icon={Calendar} size="sm" color="inherit" />
                                          <span>Awaiting Schedule</span>
                                        </button>
                                      ) : isWindowClosed ? (
                                        hasPendingExtensionRequest ? (
                                          <button
                                            type="button"
                                            onClick={() => setShowExtensionDetailsModal(true)}
                                            className="inline-flex items-center justify-center gap-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 border border-amber-500/30 font-bold w-36 h-8 rounded-xl text-xs shadow-xs transition-all cursor-pointer"
                                          >
                                            <AppIcon icon={Hourglass} size="sm" color="active" />
                                            <span>Extension Pending</span>
                                          </button>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => openExtensionRequestModal(req.code)}
                                            className="inline-flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-600/40 font-bold w-36 h-8 rounded-xl text-xs shadow-xs active:scale-[0.98] transition-all cursor-pointer"
                                          >
                                            <AppIcon icon={Hourglass} size="sm" color="inherit" />
                                            <span>Request Extension</span>
                                          </button>
                                        )
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => openDirectUploadModal(req.code)}
                                          disabled={!hasActiveSchedule}
                                          className="inline-flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-600/40 font-semibold w-36 h-8 rounded-xl text-xs shadow-xs active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
                                        >
                                          <AppIcon icon={Upload} size="sm" color="inherit" />
                                          <span>Upload</span>
                                        </button>
                                      )
                                    )}
                                  </div>
                                </td>

                                {/* Status column */}
                                <td className="px-4 py-3.5 align-middle text-center">
                                  <div className="flex items-center justify-center">
                                    <SubmissionStatusBadge
                                      status={
                                        req.status === "Pending" &&
                                        (req.hasPriorRevision || req.isRevision)
                                          ? "Revision Under Review"
                                          : req.status
                                      }
                                      size="md"
                                      iconOnly
                                    />
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </article>
            )}
            {isMounted && selectedRequirementForUpload && (
              <div
                className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 p-4 sm:p-6 flex min-h-full items-center justify-center backdrop-blur-sm"
                role="dialog"
                aria-modal="true"
                aria-labelledby="upload-modal-title"
                onClick={closeDirectUploadModal}
              >
                <div
                  className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden my-auto"
                  onClick={(event) => event.stopPropagation()}
                >
                  {/* Modal Header (Pinned Top) */}
                  <ModalHeader
                    icon={
                      isRevisionUpload || (selectedRequirementForUpload && getRequirementStatus(selectedRequirementForUpload) === "Rejected")
                        ? WarningCircle
                        : Upload
                    }
                    title={
                      isRevisionUpload || (selectedRequirementForUpload && getRequirementStatus(selectedRequirementForUpload) === "Rejected")
                        ? `Resubmit Revision: ${selectedRequirementForUpload ? getRequirementTitle(selectedRequirementForUpload) : ""}`
                        : `Upload ${selectedRequirementForUpload ? getRequirementTitle(selectedRequirementForUpload) : ""}`
                    }
                    subtitle={
                      isRevisionUpload || (selectedRequirementForUpload && getRequirementStatus(selectedRequirementForUpload) === "Rejected")
                        ? "Upload your revised compliance document addressing the reviewer's feedback below."
                        : "Upload your compliance document for admin review and validation."
                    }
                    onClose={closeDirectUploadModal}
                    closeAriaLabel="Close upload modal"
                  />

                  {/* Modal Form with Scrollable Content */}
                  <form
                    onSubmit={handleDirectUploadSubmit}
                    className="flex flex-col flex-1 min-h-0 overflow-hidden"
                  >
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                      {/* Reviewer Feedback / Revision Request Alert Box */}
                      {(isRevisionUpload || (selectedRequirementForUpload && getRequirementStatus(selectedRequirementForUpload) === "Rejected")) && (() => {
                        const statusItem = selectedRequirementForUpload
                          ? getRequirementStatusItem(selectedRequirementForUpload)
                          : null;
                        const reviewerRemarks =
                          statusItem?.adminRemarks ||
                          statusItem?.admin_remarks ||
                          statusItem?.feedback;
                        if (!reviewerRemarks) return null;
                        return (
                          <div className="rounded-xl border border-rose-300 dark:border-rose-900/60 bg-rose-50/80 dark:bg-rose-950/30 p-3.5 space-y-1 shadow-2xs">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-[#780000] dark:text-rose-400 uppercase tracking-wider">
                              <AppIcon icon={WarningCircle} size="md" />
                              <span>Reviewer Feedback / Revision Request:</span>
                            </div>
                            <p className="text-xs text-slate-800 dark:text-slate-200 italic font-medium leading-relaxed pl-5.5">
                              &ldquo;{reviewerRemarks}&rdquo;
                            </p>
                          </div>
                        );
                      })()}

                      <div>
                        <DocumentUploadZone
                          selectedFile={directUploadFile}
                          onFileSelect={setDirectUploadFile}
                          isUploading={isUploadingDirect}
                          uploadProgress={directUploadPercent}
                          maxSizeMb={10}
                          allowedFormats={["PDF", "DOCX", "XLSX", "JPG", "PNG"]}
                          currentStatus={
                            isRevisionUpload || (selectedRequirementForUpload && getRequirementStatus(selectedRequirementForUpload) === "Rejected")
                              ? undefined
                              : (selectedRequirementForUpload
                                ? getRequirementStatus(selectedRequirementForUpload)
                                : null)
                          }
                          reviewerFeedback={
                            isRevisionUpload || (selectedRequirementForUpload && getRequirementStatus(selectedRequirementForUpload) === "Rejected")
                              ? undefined
                              : (selectedRequirementForUpload
                                ? getRequirementStatusItem(selectedRequirementForUpload)?.adminRemarks ||
                                  getRequirementStatusItem(selectedRequirementForUpload)?.admin_remarks ||
                                  getRequirementStatusItem(selectedRequirementForUpload)?.feedback
                                : null)
                          }
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="directUploadRemarks"
                          className="block text-xs uppercase tracking-[0.18em] font-semibold text-slate-700 dark:text-amber-300 mb-1.5"
                        >
                          {isRevisionUpload || (selectedRequirementForUpload && getRequirementStatus(selectedRequirementForUpload) === "Rejected")
                            ? "Notes on Corrections Made (Optional)"
                            : "Notes / Remarks for Reviewer (Optional)"}
                        </label>
                        <textarea
                          id="directUploadRemarks"
                          rows={3}
                          className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-3 text-xs text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition resize-none placeholder:text-slate-400"
                          placeholder={
                            isRevisionUpload || (selectedRequirementForUpload && getRequirementStatus(selectedRequirementForUpload) === "Rejected")
                              ? "Explain the corrections made in this revision (e.g., Added missing signatures, updated section codes)..."
                              : "Add optional notes or remarks for the reviewer..."
                          }
                          value={directUploadRemarks}
                          onChange={(e) => setDirectUploadRemarks(e.target.value)}
                        />
                      </div>

                      {directUploadMessage && (
                        <div
                          role="alert"
                          className={`rounded-xl p-3 text-xs sm:text-sm font-semibold flex items-center gap-2.5 shadow-xs ${
                            directUploadMessage.toLowerCase().includes("error") ||
                            directUploadMessage.toLowerCase().includes("failed") ||
                            directUploadMessage.toLowerCase().includes("please") ||
                            directUploadMessage.toLowerCase().includes("exceeds")
                              ? "bg-[#780000] text-white border border-[#5e0000]"
                              : "bg-[#0b5336] text-white border border-[#08412a]"
                          }`}
                        >
                          <AppIcon
                            icon={
                              directUploadMessage.toLowerCase().includes("error") ||
                              directUploadMessage.toLowerCase().includes("failed") ||
                              directUploadMessage.toLowerCase().includes("please") ||
                              directUploadMessage.toLowerCase().includes("exceeds")
                                ? WarningCircle
                                : CheckCircle
                            }
                            size="md"
                            color="white"
                            className="shrink-0"
                          />
                          <span className="leading-snug">{directUploadMessage}</span>
                        </div>
                      )}
                    </div>

                    {/* Modal Footer (Pinned Bottom) */}
                    <div className="flex items-center justify-end gap-2.5 px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 shrink-0 bg-slate-50/70 dark:bg-slate-950/50">
                      <button
                        type="button"
                        onClick={closeDirectUploadModal}
                        disabled={isUploadingDirect}
                        className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isUploadingDirect || !directUploadFile}
                        className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-amber-500 disabled:shadow-none active:scale-[0.98]"
                      >
                        {isUploadingDirect ? (
                          <>
                            <AppIcon icon={SystemRestart} size="sm" color="inherit" className="animate-spin" />
                            <span>
                              {isRevisionUpload || (selectedRequirementForUpload && getRequirementStatus(selectedRequirementForUpload) === "Rejected")
                                ? "Uploading Revision..."
                                : "Uploading..."}
                            </span>
                          </>
                        ) : (
                          <>
                            <AppIcon icon={Upload} size="sm" color="inherit" />
                            <span>
                              {isRevisionUpload || (selectedRequirementForUpload && getRequirementStatus(selectedRequirementForUpload) === "Rejected")
                                ? "Upload Revision"
                                : "Upload File"}
                            </span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
            {/* SUBMITTING & SUCCESS MODAL POPUPS */}
            {isMounted && isSubmittingModalOpen && (
              isUploadingDirect ? (
                <SystemLoadingScreen
                  fullScreen={true}
                  text={isRevisionUpload ? "Submitting Revision..." : "Submitting Document..."}
                  subtitle={directUploadFile?.name}
                  progress={directUploadPercent}
                />
              ) : isSubmitSuccess ? (
                <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 p-4 sm:p-6 flex min-h-full items-center justify-center backdrop-blur-sm animate-in fade-in duration-200">
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 sm:p-10 max-w-lg w-full text-center shadow-2xl space-y-6 my-auto animate-in zoom-in-95 duration-200">
                    <div className="space-y-6 py-2">
                      {/* Large Solid PUP Green Icon Badge */}
                      <div className="mx-auto flex h-24 w-24 sm:h-28 sm:w-28 items-center justify-center rounded-3xl bg-[#0b5336] text-white shadow-xl shadow-[#0b5336]/30 border-2 border-[#08412a] animate-in zoom-in duration-300">
                        <CheckCircle className="w-12 h-12 sm:w-14 sm:h-14 stroke-[2.5]" />
                      </div>

                      {/* Title & Description */}
                      <div className="space-y-2">
                        <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                          Submitted Successfully!
                        </h3>
                        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-md mx-auto px-2">
                          Your requirement has been uploaded and queued for admin validation.
                        </p>
                      </div>

                      {/* File Card Pill */}
                      {directUploadFile && (
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3.5 sm:p-4 text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-center gap-2.5 shadow-xs">
                          <Page className="w-5 h-5 text-[#0b5336] dark:text-emerald-400 shrink-0" />
                          <span className="truncate max-w-[280px] sm:max-w-[360px]">{directUploadFile.name}</span>
                        </div>
                      )}

                      {/* Action Button: Solid PUP Green & Large */}
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={handleCloseModalAndRefresh}
                          className="w-full py-3.5 sm:py-4 px-6 bg-[#0b5336] hover:bg-[#08412a] text-white border border-[#08412a] font-bold text-base rounded-2xl shadow-lg shadow-[#0b5336]/25 hover:shadow-xl transition-all duration-200 cursor-pointer active:scale-[0.98]"
                        >
                          Okay, got it
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null
            )}
            {isMounted && successModalData.isOpen && (
              <div
                className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 p-4 sm:p-6 flex min-h-full items-center justify-center backdrop-blur-sm animate-in fade-in duration-200"
                role="dialog"
                aria-modal="true"
                aria-labelledby="success-modal-title"
                onClick={() =>
                  setSuccessModalData({ isOpen: false, requirementTitle: "" })
                }
              >
                <div
                  className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 sm:p-10 text-center shadow-2xl my-auto space-y-6 animate-in zoom-in-95 duration-200"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="mx-auto flex h-24 w-24 sm:h-28 sm:w-28 items-center justify-center rounded-3xl bg-[#0b5336] text-white shadow-xl shadow-[#0b5336]/30 border-2 border-[#08412a] animate-in zoom-in duration-300">
                    <CheckCircle className="w-12 h-12 sm:w-14 sm:h-14 stroke-[2.5]" />
                  </div>
                  <div className="space-y-2">
                    <h3
                      id="success-modal-title"
                      className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight"
                    >
                      Upload Successful!
                    </h3>
                    <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-md mx-auto px-2">
                      Your requirement has been uploaded and queued for admin validation.
                    </p>
                  </div>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSuccessModalData({
                          isOpen: false,
                          requirementTitle: "",
                        });
                        navigateToView("status");
                      }}
                      className="w-full py-3.5 sm:py-4 px-6 bg-[#0b5336] hover:bg-[#08412a] text-white border border-[#08412a] font-bold text-base rounded-2xl shadow-lg shadow-[#0b5336]/25 hover:shadow-xl transition-all duration-200 cursor-pointer active:scale-[0.98]"
                    >
                      Okay, got it
                    </button>
                  </div>
                </div>
              </div>
            )}
            {isMounted && isHistoryModalOpen && (
              <div
                className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 p-4 sm:p-6 flex min-h-full items-center justify-center backdrop-blur-sm"
                role="dialog"
                aria-modal="true"
                aria-labelledby="submission-history-title"
                onClick={closeHistoryModal}
              >
                <div
                  className="relative w-full max-w-7xl mx-auto flex max-h-[90vh] flex-col rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden my-auto"
                  onClick={(event) => event.stopPropagation()}
                >
                  <ModalHeader
                    title="Validation History"
                    subtitle="Official verified submissions and reviewer remarks"
                    titleId="submission-history-title"
                    icon={ClockRotateRight}
                    onClose={closeHistoryModal}
                    closeAriaLabel="Close history modal"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 px-6 py-3.5">
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-2">
                        <label
                          htmlFor="modalHistoryAcademicYear"
                          className="text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 font-bold"
                        >
                          School Year:
                        </label>
                        <select
                          id="modalHistoryAcademicYear"
                          className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-slate-900 dark:text-slate-200 outline-none focus:ring-2 focus:ring-[#0b5336]/20 focus:border-[#0b5336] shadow-2xs"
                          value={historyAcademicYear}
                          onChange={(event) =>
                            setHistoryAcademicYear(event.target.value)
                          }
                        >
                          {historyAcademicYears.map((year) => (
                            <option key={year} value={year}>
                              {year === "All"
                                ? "All Academic Years"
                                : `S.Y. ${year}`}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <label
                          htmlFor="modalHistorySemester"
                          className="text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 font-bold"
                        >
                          Semester:
                        </label>
                        <select
                          id="modalHistorySemester"
                          className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-slate-900 dark:text-slate-200 outline-none focus:ring-2 focus:ring-[#0b5336]/20 focus:border-[#0b5336] shadow-2xs"
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
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={handleBulkDownload}
                        disabled={
                          isBulkDownloading ||
                          filteredPastSubmissions.length === 0
                        }
                        className="inline-flex items-center gap-2 rounded-xl border border-[#08412a] bg-[#0b5336] hover:bg-[#08412a] disabled:opacity-50 disabled:pointer-events-none text-white font-bold text-xs px-4 py-2 shadow-xs transition-all cursor-pointer active:scale-95"
                        title="Download all validated requirements in current view as ZIP"
                      >
                        {isBulkDownloading ? (
                          <AppIcon icon={SystemRestart} size="sm" color="white" className="animate-spin" />
                        ) : (
                          <AppIcon icon={Download} size="sm" color="white" />
                        )}
                        <span>
                          {isBulkDownloading
                            ? bulkDownloadProgressText
                            : "Download All (ZIP)"}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void fetchHistory()}
                        disabled={isLoadingHistory || isBulkDownloading}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-amber-600 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3.5 py-2 text-xs shadow-xs active:scale-[0.98] transition cursor-pointer disabled:opacity-50"
                      >
                        <AppIcon icon={Refresh} size="sm" color="inherit" className={isLoadingHistory ? "animate-spin text-slate-950" : "text-slate-950"} />
                        <span>{isLoadingHistory ? "Refreshing..." : "Refresh"}</span>
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 sm:p-8 bg-slate-50/50 dark:bg-slate-950/40">
                    {isLoadingHistory ? (
                      <SubmissionHistorySkeleton count={4} />
                    ) : historyError ? (
                      <div
                        role="alert"
                        className="p-3.5 my-3 rounded-xl bg-[#780000] text-white border border-[#5e0000] flex items-center gap-2.5 text-xs font-semibold shadow-xs"
                      >
                        <AppIcon icon={WarningCircle} size="md" color="white" className="shrink-0" />
                        <span className="leading-snug">{historyError}</span>
                      </div>
                    ) : (
                      <SubmissionHistoryList
                        submissions={filteredPastSubmissions}
                        onViewFile={openHistorySubmissionPreview}
                        viewedSubmissionIds={viewedSubmissionIds}
                        emptyMessage="No validated documents found for the selected academic term."
                      />
                    )}
                  </div>
                </div>
              </div>
            )}
            {isMounted && previewSubmission ? (
              <DocumentPreviewModal
                submission={previewSubmission}
                isOpen={Boolean(previewSubmission)}
                onClose={closeSubmissionPreview}
                getPreviewUrl={getSubmissionPreviewUrl}
              />
            ) : null}
            <FacultyIncompleteRequirementsModal
              isOpen={Boolean(isMounted && showIncompleteRequirementsModal)}
              onClose={dismissIncompleteRequirementsAlert}
              onGoToSubmissions={() => navigateToView("status")}
              notSubmittedCount={displayedStatusCounts?.notSubmitted ?? 0}
              rejectedCount={displayedStatusCounts?.rejected ?? 0}
              pendingValidationCount={displayedStatusCounts?.pending ?? 0}
              deadlineDisplay={windowDeadlineDisplay}
            />
            {activeView === "settings" && (
              <article className="space-y-5 p-2 sm:p-4 md:p-5">
                <FacultySettingsPanel
                  initialFacultyName={currentFacultyName || facultyName}
                  initialFacultyEmail={facultyEmail}
                  initialDepartment={departmentName}
                  initialAvatarUrl={currentAvatarUrl || avatarUrl}
                  initialAccount={
                    resolvedFirstName || resolvedLastName
                      ? {
                          profileId: "",
                          firstName: resolvedFirstName || "",
                          middleName: resolvedMiddleName || "",
                          lastName: resolvedLastName || "",
                          fullName: currentFacultyName || facultyName || "",
                          email: facultyEmail || "",
                          profileImageUrl: currentAvatarUrl || avatarUrl || null,
                          program: initialData?.program || null,
                        }
                      : null
                  }
                  onProfileUpdated={handleProfileUpdated}
                />
              </article>
            )}
            {isMounted && isSubmitModalOpen && (
              <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 p-4 sm:p-6 flex min-h-full items-center justify-center backdrop-blur-sm">
                <div className="w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl my-auto">
                  <ModalHeader
                    title="Submit Requirement"
                    icon={Upload}
                    onClose={closeSubmitModal}
                    closeAriaLabel="Close submission modal"
                  />
                  <div className="flex-1 overflow-y-auto p-6 min-h-0">
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
                            className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                            value={form.requirementCode}
                            onChange={(event) =>
                              updateField(
                                "requirementCode",
                                event.target.value,
                              )
                            }
                          >
                            {activeTemplates.map((tpl) => {
                              const status = getRequirementStatus(tpl.code);
                              const disabled =
                                status &&
                                status !== "Not Submitted" &&
                                status !== "Rejected";
                              return (
                                <option
                                  key={tpl.code}
                                  value={tpl.code}
                                  disabled={disabled}
                                >
                                  {tpl.title}
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
                            className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 outline-none file:mr-4 file:rounded-lg file:border-0 file:bg-slate-900 hover:file:bg-slate-800 dark:file:bg-white dark:hover:file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white dark:file:text-slate-900 disabled:opacity-50"
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
                            className="mt-1 min-h-24 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                            placeholder="Enter remarks or notes (optional)"
                            value={form.remarks}
                            onChange={(event) =>
                              updateField("remarks", event.target.value)
                            }
                          />
                        </div>
                        <div className="flex items-center justify-end gap-2.5 pt-2">
                          <button
                            type="button"
                            onClick={closeSubmitModal}
                            className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] shadow-xs transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={isSubmitting}
                            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50 active:scale-[0.98]"
                          >
                            <AppIcon icon={Upload} size="sm" color="inherit" />
                            <span>
                              {isSubmitting
                                ? "Submitting..."
                                : "Submit Requirements"}
                            </span>
                          </button>
                        </div>
                        {submissionMessage && (
                          <div
                            role="alert"
                            className={`rounded-xl p-3 text-xs sm:text-sm font-semibold flex items-center gap-2.5 shadow-xs ${
                              submissionMessage.toLowerCase().includes("please") ||
                              submissionMessage.toLowerCase().includes("failed") ||
                              submissionMessage.toLowerCase().includes("error")
                                ? "bg-[#780000] text-white border border-[#5e0000]"
                                : "bg-[#0b5336] text-white border border-[#08412a]"
                            }`}
                          >
                            <AppIcon
                              icon={
                                submissionMessage.toLowerCase().includes("please") ||
                                submissionMessage.toLowerCase().includes("failed") ||
                                submissionMessage.toLowerCase().includes("error")
                                  ? WarningCircle
                                  : CheckCircle
                              }
                              size="md"
                              color="white"
                              className="shrink-0"
                            />
                            <span className="leading-snug">{submissionMessage}</span>
                          </div>
                        )}
                      </form>
                    ) : (
                      <div className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-4 text-sm text-slate-700 dark:text-slate-300">
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
            {/* Faculty Extension Request Modal */}
            <FacultyExtensionRequestModal
              isOpen={isExtensionModalOpen}
              onClose={() => setIsExtensionModalOpen(false)}
              onSuccess={handleExtensionSuccess}
              academicYear={activeAY}
              semester={activeSem}
              lackings={lackingRequirements}
              preSelectedCode={selectedExtensionReqCode}
            />

            {/* Term Completion & Reset Modal */}
            <TermCompletionResetModal
              isOpen={isTermCompletionModalOpen}
              onClose={() => setIsTermCompletionModalOpen(false)}
              onConfirmReset={handleConfirmTermReset}
              onViewHistory={openHistoryModal}
              academicYear={activeAY}
              semester={activeSem}
              requirements={displayedRequirementStatuses.map((r) => ({
                code: r.code,
                submittedAt: r.submittedAt,
                reviewedAt: r.reviewedAt,
              }))}
            />

            {/* Extension Details Modal */}
            {showExtensionDetailsModal && pendingExtensionData && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="w-full max-w-md bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100">
                  <ModalHeader
                    title="Extension Request Status"
                    icon={Hourglass}
                  />
                  <div className="p-6 space-y-4">
                    <div className="space-y-3 text-xs">
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50">
                      <span className="font-semibold text-slate-600 dark:text-slate-400">Status</span>
                      <span className="px-2.5 py-0.5 rounded-full font-bold bg-amber-500 text-slate-950 text-[11px]">
                        Pending Admin Review
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="font-semibold text-slate-500 dark:text-slate-400">Academic Term:</span>
                      <p className="font-medium text-slate-900 dark:text-slate-200">
                        {pendingExtensionData.academic_year} • {pendingExtensionData.semester}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <span className="font-semibold text-slate-500 dark:text-slate-400">Requested Duration:</span>
                      <p className="font-medium text-slate-900 dark:text-slate-200">
                        {pendingExtensionData.requested_preset || "+3 Days"}
                        {pendingExtensionData.requested_date ? ` (until ${pendingExtensionData.requested_date} ${pendingExtensionData.requested_time || ""})` : ""}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <span className="font-semibold text-slate-500 dark:text-slate-400">Reason / Justification:</span>
                      <p className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 italic">
                        &ldquo;{pendingExtensionData.reason}&rdquo;
                      </p>
                    </div>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                      An administrator will review your extension request. Document uploads will be unlocked immediately once approved.
                    </p>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setShowExtensionDetailsModal(false)}
                      className="bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] px-4 py-2 text-xs font-semibold rounded-xl transition cursor-pointer shadow-xs"
                    >
                      Close
                    </button>
                  </div>
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
