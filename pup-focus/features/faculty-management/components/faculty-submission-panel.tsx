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
import { emitRealtimeSync, useRealtimeSync } from "@/lib/realtime";
import {
  DEFAULT_REQUIREMENTS,
  REQUIREMENT_LABEL,
  REQUIREMENT_CODE,
  type RequirementCode,
} from "@/config/compliance";
import {
  getTodayInManila,
  getCurrentTimeInManila,
  format24HourTo12Hour,
  buildAcademicYearOptions,
  normalizeTime24Hour,
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
import {
  Activity,
  Archive,
  Calendar,
  ChatBubble,
  Check,
  CheckCircle,
  ClockRotateRight,
  CloudUpload,
  Download,
  EditPencil,
  Eye,
  FilterList,
  Folder,
  Hourglass,
  Lock,
  Menu,
  Minus,
  NavArrowLeft,
  NavArrowRight,
  OpenNewWindow,
  Page,
  Plus,
  Refresh,
  Reports,
  Search,
  Settings,
  SidebarCollapse,
  SidebarExpand,
  SystemRestart,
  TaskList,
  Trash,
  Upload,
  ViewGrid,
  WarningCircle,
  WarningTriangle,
  Xmark,
} from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";
import { ModalHeader } from "@/components/ui/modal-header";
import { LogoutButton } from "@/components/shared/logout-button";
import { SidebarProfileCard } from "@/components/shared/sidebar-profile-card";
import { useSidebarCollapsed } from "@/components/sidebar";
import { NotificationDrawer } from "@/features/notifications/components/notification-drawer";
import { OnlineDocumentPreview } from "@/features/submissions/components/online-document-preview";
import {
  DocumentPreviewModal,
  type DocumentPreviewSubmission,
} from "@/features/submissions/components/document-preview-modal";
import { AlertPopup } from "@/components/ui/alert-popup";
import { SystemLoadingScreen } from "@/components/shared/system-loading-screen";
import { FacultyIncompleteRequirementsModal } from "./faculty-incomplete-requirements-modal";
export interface FacultyClass {
  id: string;
  faculty_profile_id?: string;
  academic_term_id?: string;
  academic_year?: string;
  semester?: string;
  subject_code: string;
  description: string;
  units: number;
  section_code: string;
  is_archived?: boolean;
  created_at?: string;
}
export const CLASS_UNIT_OPTIONS = [
  0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0,
];
export interface BackgroundUploadTask {
  id: string;
  requirementCode: string;
  requirementTitle: string;
  fileName: string;
  fileSize: number;
  progress: number;
  status: "uploading" | "done" | "error";
  errorMessage?: string;
  isRevision?: boolean;
  classId?: string | null;
  startedAt: number;
  file?: File;
  remarks?: string;
  academicYear?: string;
  semester?: string;
}
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
const SEMESTER_OPTIONS = [
  "1st Semester",
  "2nd Semester",
  "Summer Semester",
] as const;
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
  status:
    | "Validated"
    | "Rejected"
    | "Pending"
    | "Not Submitted"
    | "Exempted"
    | "Overdue"
    | "Extended";
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
  due_at?: string | null;
  customDueDate?: string | null;
  effectiveDeadline?: string | null;
  isExtended?: boolean;
  extendedUntil?: string | null;
  isIndividualClosed?: boolean;
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
  classId?: string | null;
  class_id?: string | null;
  faculty_class?: {
    id: string;
    subject_code: string;
    description: string;
    units: number;
    section_code: string;
    is_archived?: boolean;
  } | null;
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
  isGracePeriod?: boolean;
  isPersonalDeadline?: boolean;
  effectiveDeadline?: string | null;
  formattedDueAt?: string | null;
  badgeLabel?: string | null;
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

  if (month >= 6 && month <= 10) {
    return {
      academicYear: `${year}-${year + 1}`,
      semester: "1st Semester" as const,
    };
  } else if (month >= 11 || month <= 3) {
    return {
      academicYear: month >= 11 ? `${year}-${year + 1}` : `${year - 1}-${year}`,
      semester: "2nd Semester" as const,
    };
  } else {
    return {
      academicYear: `${year - 1}-${year}`,
      semester: "Summer Semester" as const,
    };
  }
}
function normalizeSemester(sem?: string | null): string {
  if (!sem) return "";
  const s = sem.toLowerCase().trim();
  if (s.includes("summer") || s.includes("midyear") || s.includes("3") || s.includes("third") || s.includes("3rd"))
    return "summer semester";
  if (s.includes("1") || s.includes("first") || s.includes("1st"))
    return "1st semester";
  if (s.includes("2") || s.includes("second") || s.includes("2nd"))
    return "2nd semester";
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
  if (status === "Rejected" || status === "Overdue") return "bg-[#780000]";
  if (status === "Extended") return "bg-indigo-600";
  if (status === "Exempted" || status === "Not Submitted")
    return "bg-slate-600";
  return "bg-amber-500";
}
function getStatusTextColor(
  status: RequirementStatus["status"] | HistorySubmissionStatus,
): string {
  if (status === "Validated")
    return "text-[#0b5336] dark:text-emerald-400 font-semibold";
  if (status === "Rejected" || status === "Overdue")
    return "text-[#780000] dark:text-rose-400 font-semibold";
  if (status === "Extended")
    return "text-indigo-600 dark:text-indigo-400 font-semibold";
  if (status === "Exempted")
    return "text-slate-600 dark:text-slate-400 font-semibold";
  if (status === "Not Submitted") return "text-slate-500 dark:text-slate-500";
  return "text-amber-700 dark:text-amber-400 font-semibold";
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
  if (status === "Rejected" || status === "Overdue")
    return "bg-[#780000] text-white border border-[#5e0000]";
  if (status === "Extended")
    return "bg-indigo-600 text-white border border-indigo-700";
  if (status === "Exempted")
    return "bg-slate-200 text-slate-800 border border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700";
  if (status === "Not Submitted")
    return "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700";
  return "bg-amber-500 text-slate-950 border border-amber-600 font-bold";
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
  if (status === "Overdue") {
    return (
      <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-[#780000] text-white border border-[#5e0000] shrink-0 shadow-2xs">
        <AppIcon icon={ClockRotateRight} size="xs" color="white" />
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
  if (status === "Extended") {
    return (
      <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-indigo-600 text-white border border-indigo-700 shrink-0 shadow-2xs">
        <AppIcon icon={Hourglass} size="xs" color="white" />
      </span>
    );
  }
  if (status === "Exempted") {
    return (
      <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 shrink-0 shadow-2xs">
        <AppIcon icon={Minus} size="xs" color="inherit" />
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
  if (status === "Overdue") return "Overdue";
  if (status === "Extended") return "Extended";
  if (status === "Exempted") return "Exempted";
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
  const {
    collapsed: isSidebarCollapsed,
    toggle: toggleSidebarCollapsed,
  } = useSidebarCollapsed();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handledHighlightRef = useRef<string | null>(null);
  const academicYears = useMemo(() => buildAcademicYearOptions(), []);
  const [currentFacultyName, setCurrentFacultyName] = useState<string | null>(
    facultyName ?? null,
  );
  const resolvedFirstName = initialFirstName ?? propFacultyFirstName ?? null;
  const resolvedMiddleName = initialMiddleName ?? propFacultyMiddleName ?? null;
  const resolvedLastName = initialLastName ?? propFacultyLastName ?? null;
  const departmentName = useMemo(() => {
    const PROGRAM_EXPANSIONS: Record<string, string> = {
      BSIT: "Bachelor of Science in Information Technology",
      BSIE: "Bachelor of Science in Industrial Engineering",
      BSA: "Bachelor of Science in Accountancy",
      BSMA: "Bachelor of Science in Management Accounting",
      BEED: "Bachelor of Elementary Education",
      BSBAHRM:
        "Bachelor of Science in Business Administration major in Human Resource Management",
      BSEnt: "Bachelor of Science in Entrepreneurship",
      BSE: "Bachelor of Science in Entrepreneurship",
      BSBA: "Bachelor of Science in Business Administration",
      DIT: "Diploma in Information Technology",
      "DOMT-LOM":
        "Diploma in Office Management Technology major in Legal Office Management",
    };

    let code = initialData?.program?.code || "";
    let name = initialData?.program?.name || "";
    const raw = initialData?.department || "";

    if (!code && raw.includes("—")) {
      const parts = raw.split("—").map((s) => s.trim());
      code = parts[0] || "";
      name = parts[1] || "";
    } else if (!code && !name && raw) {
      name = raw;
    }

    const normalizedCode = code.toUpperCase().trim();
    if (PROGRAM_EXPANSIONS[normalizedCode]) {
      name = PROGRAM_EXPANSIONS[normalizedCode];
    } else if (name.startsWith("BS ")) {
      name = name.replace(/^BS\s+/i, "Bachelor of Science in ");
    }

    if (code && name) {
      return `${code} — ${name}`;
    }
    return name || code || raw || "Unassigned";
  }, [initialData?.department, initialData?.program]);

  const facultyDisplayName = useMemo(() => {
    if (resolvedLastName && resolvedFirstName) {
      return `${resolvedLastName}, ${resolvedFirstName}${resolvedMiddleName ? ` ${resolvedMiddleName}` : ""}`.toUpperCase();
    }
    const rawName = currentFacultyName || facultyName || "Faculty Member";
    const tokens = rawName.trim().split(/\s+/);
    if (tokens.length > 1) {
      const last = tokens[tokens.length - 1];
      const rest = tokens.slice(0, -1).join(" ");
      return `${last}, ${rest}`.toUpperCase();
    }
    return rawName.toUpperCase();
  }, [
    resolvedLastName,
    resolvedFirstName,
    resolvedMiddleName,
    currentFacultyName,
    facultyName,
  ]);
  const avatarUrl = useMemo(() => {
    return (
      facultyAvatarUrl ??
      initialData?.avatarUrl ??
      initialData?.profileImageUrl ??
      null
    );
  }, [facultyAvatarUrl, initialData?.avatarUrl, initialData?.profileImageUrl]);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null>(
    avatarUrl,
  );
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
  const refreshFacultyProfile = useCallback(async () => {
    try {
      const res = await fetch(`/api/faculty/account?_t=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.fullName) {
          setCurrentFacultyName(data.fullName);
        }
        if (data.profileImageUrl !== undefined) {
          setCurrentAvatarUrl(data.profileImageUrl);
          setHasAvatarError(false);
        }
      }
    } catch {
      // safe fallback
    }
  }, []);
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
    const v = searchParams?.get("view");
    if (v && (PANEL_VIEWS as readonly string[]).includes(v)) {
      return v as PanelView;
    }
    const highlight =
      searchParams?.get("highlight") || searchParams?.get("requirement");
    const hist = searchParams?.get("history");
    if (v === "history" || (v === "status" && hist === "true") || highlight) {
      return "status";
    }
    return initialView || "dashboard";
  }, [initialView, searchParams]);

  const [activeView, setActiveView] = useState<PanelView>(() =>
    resolveInitialView(),
  );

  // Restore saved view from sessionStorage only after client has hydrated
  useEffect(() => {
    setIsMounted(true);
    const v = searchParams?.get("view");
    const highlight =
      searchParams?.get("highlight") || searchParams?.get("requirement");
    const hist = searchParams?.get("history");
    if (
      !v &&
      !highlight &&
      !hist &&
      (!initialView || initialView === "dashboard")
    ) {
      try {
        const savedView = sessionStorage.getItem(
          "pup_focus_faculty_active_view",
        );
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
    academicYear: initialData?.academicYear || "",
    semester:
      (initialData?.semester as (typeof SEMESTER_OPTIONS)[number]) || "",
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
  const [historyAcademicYear, setHistoryAcademicYear] = useState<string>(
    () =>
      initialData?.academicYear ||
      initialData?.availableAcademicYears?.[0] ||
      "",
  );
  const [historySemester, setHistorySemester] = useState<
    (typeof SEMESTER_OPTIONS)[number] | "All"
  >(
    () =>
      (initialData?.semester as (typeof SEMESTER_OPTIONS)[number]) ||
      "1st Semester",
  );
  const [historyDbYears, setHistoryDbYears] = useState<string[]>(
    () => initialData?.availableAcademicYears ?? [],
  );
  const [historyTermsByYear, setHistoryTermsByYear] = useState<
    Record<string, (typeof SEMESTER_OPTIONS)[number][]>
  >(() => initialData?.termsByYear ?? {});
  const [historyCurrentTerm, setHistoryCurrentTerm] = useState<{
    academicYear: string;
    semester: (typeof SEMESTER_OPTIONS)[number];
  } | null>(() =>
    initialData?.academicYear && initialData?.semester
      ? {
          academicYear: initialData.academicYear,
          semester: initialData.semester as (typeof SEMESTER_OPTIONS)[number],
        }
      : null,
  );
  const hasManuallyChangedHistoryTermRef = useRef(false);
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
  >(
    () =>
      (initialData?.requirementTemplates as RequirementTemplateData[]) || [],
  );
  const [isTemplatesFetched, setIsTemplatesFetched] = useState<boolean>(
    () =>
      Boolean(
        initialData && Array.isArray(initialData.requirementTemplates),
      ),
  );
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
    overdue?: number;
    extended?: number;
    exempted?: number;
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
  const [currentAcademicTerm, setCurrentAcademicTerm] = useState<{
    academic_year: string;
    semester: string;
  } | null>(null);
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
  // ─── Mobile menu & pending navigation state ──────────────────────
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pendingNavViewRef = useRef<PanelView | null>(null);
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevHtmlOverscroll = html.style.overscrollBehavior;
    const prevBodyOverscroll = body.style.overscrollBehavior;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    body.style.overscrollBehavior = "none";
    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      html.style.overscrollBehavior = prevHtmlOverscroll;
      body.style.overscrollBehavior = prevBodyOverscroll;
    };
  }, [isMobileMenuOpen]);
  // ─── Page-load overlay state ───────────────────────────────────────
  const [isPageLoading, setIsPageLoading] = useState(!initialData);
  useEffect(() => {
    if (!initialData) {
      const timer = setTimeout(() => setIsPageLoading(false), 400);
      return () => clearTimeout(timer);
    }
  }, [initialData]);
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>(
    () => initialData?.academicYear || academicYears[0] || "",
  );
  const [selectedSemester, setSelectedSemester] =
    useState<(typeof SEMESTER_OPTIONS)[number]>(
      () =>
        (initialData?.semester as (typeof SEMESTER_OPTIONS)[number]) ||
        "Summer Semester",
    );
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
  const [uploadTasks, setUploadTasks] = useState<BackgroundUploadTask[]>([]);
  const [isUploadSectionVisible, setIsUploadSectionVisible] = useState(false);
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
  const [selectedExtensionReqCode, setSelectedExtensionReqCode] = useState<
    RequirementCode | string | null
  >(null);
  const [isTermCompletionModalOpen, setIsTermCompletionModalOpen] =
    useState(false);
  const [isTermResetAcknowledged, setIsTermResetAcknowledged] = useState(false);
  const [showResetArchivedView, setShowResetArchivedView] = useState(false);
  const [hasPendingExtensionRequest, setHasPendingExtensionRequest] =
    useState(false);
  const [pendingExtensionData, setPendingExtensionData] = useState<any | null>(
    null,
  );
  const [latestApprovedExtension, setLatestApprovedExtension] = useState<
    any | null
  >(null);
  const [allExtensionRequests, setAllExtensionRequests] = useState<any[]>([]);
  const [showExtensionDetailsModal, setShowExtensionDetailsModal] =
    useState(false);
  const [extensionRequestToast, setExtensionRequestToast] = useState<
    string | null
  >(null);
  // ─── Class / Subject Load Management States ──────────────────────
  const [facultyClasses, setFacultyClasses] = useState<FacultyClass[]>([]);
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const selectedClassIdRef = useRef<string | null>(null);
  selectedClassIdRef.current = selectedClassId;
  const facultyClassesRef = useRef<FacultyClass[]>([]);
  facultyClassesRef.current = facultyClasses;
  const classStatusesCacheRef = useRef<Record<string, RequirementStatus[]>>({});
  const [isAddClassModalOpen, setIsAddClassModalOpen] = useState(false);
  const [isSubmittingClass, setIsSubmittingClass] = useState(false);
  const [classForm, setClassForm] = useState({
    subject_code: "",
    description: "",
    units: 3.0,
    section_code: "",
  });
  const [classFormError, setClassFormError] = useState<string | null>(null);
  const [isConfirmCreateClassModalOpen, setIsConfirmCreateClassModalOpen] =
    useState(false);
  const [isCreateClassSuccessModalOpen, setIsCreateClassSuccessModalOpen] =
    useState(false);
  const [createdClassSuccessData, setCreatedClassSuccessData] = useState<{
    id: string;
    subject_code: string;
    description: string;
    section_code: string;
    units: number;
  } | null>(null);

  // Class Edit, Archive, Delete, and Filter States
  const [classTab, setClassTab] = useState<"active" | "archived">("active");
  const [step2FilterMode, setStep2FilterMode] = useState<
    "all" | "pending" | "validated" | "revision" | "not_submitted"
  >("all");
  const [classSearchQuery, setClassSearchQuery] = useState("");
  const [classSectionFilter, setClassSectionFilter] = useState<string>("ALL");
  const [isEditClassModalOpen, setIsEditClassModalOpen] = useState(false);
  const [classToEdit, setClassToEdit] = useState<FacultyClass | null>(null);
  const [classToView, setClassToView] = useState<FacultyClass | null>(null);
  const [isViewClassModalOpen, setIsViewClassModalOpen] = useState(false);
  const [editClassForm, setEditClassForm] = useState({
    subject_code: "",
    description: "",
    units: 3.0,
    section_code: "",
  });
  const [editClassError, setEditClassError] = useState<string | null>(null);
  const [isUpdatingClass, setIsUpdatingClass] = useState(false);
  const [classToArchive, setClassToArchive] = useState<FacultyClass | null>(
    null,
  );
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [isArchivingClass, setIsArchivingClass] = useState(false);
  const [classToDelete, setClassToDelete] = useState<FacultyClass | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeletingClass, setIsDeletingClass] = useState(false);
  const [deleteCountdown, setDeleteCountdown] = useState(0);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [classActionLoadingId, setClassActionLoadingId] = useState<
    string | null
  >(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRefreshingHistory, setIsRefreshingHistory] = useState(false);

  useEffect(() => {
    if (!isDeleteModalOpen || !classToDelete) {
      setDeleteCountdown(0);
      setDeleteConfirmText("");
      return;
    }
    setDeleteCountdown(5);
    setDeleteConfirmText("");
    const interval = setInterval(() => {
      setDeleteCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isDeleteModalOpen, classToDelete]);

  const activeFacultyClasses = useMemo(() => {
    return facultyClasses.filter((c) => !c.is_archived);
  }, [facultyClasses]);

  const archivedFacultyClasses = useMemo(() => {
    return facultyClasses.filter((c) => Boolean(c.is_archived));
  }, [facultyClasses]);

  const uniqueClassSections = useMemo(() => {
    const baseList =
      classTab === "active" ? activeFacultyClasses : archivedFacultyClasses;
    return Array.from(
      new Set(baseList.map((c) => c.section_code.trim()).filter(Boolean)),
    ).sort();
  }, [classTab, activeFacultyClasses, archivedFacultyClasses]);

  const displayedClasses = useMemo(() => {
    const baseList =
      classTab === "active" ? activeFacultyClasses : archivedFacultyClasses;
    const trimmedSearch = classSearchQuery.trim().toLowerCase();
    return baseList.filter((cls) => {
      if (
        classSectionFilter !== "ALL" &&
        cls.section_code.trim() !== classSectionFilter
      ) {
        return false;
      }
      if (!trimmedSearch) return true;
      return (
        cls.subject_code.toLowerCase().includes(trimmedSearch) ||
        cls.description.toLowerCase().includes(trimmedSearch) ||
        cls.section_code.toLowerCase().includes(trimmedSearch)
      );
    });
  }, [
    classTab,
    activeFacultyClasses,
    archivedFacultyClasses,
    classSectionFilter,
    classSearchQuery,
  ]);

  const [hasPromptedTermCompletion, setHasPromptedTermCompletion] =
    useState(false);
  const hasSubmissionWindowAcademicTerm = Boolean(
    submissionWindow?.isConfigured &&
    submissionWindow.academicYear &&
    submissionWindow.semester,
  );
  const historyAcademicYears = useMemo(() => {
    const yearsSet = new Set<string>();
    historyDbYears.forEach((ay) => {
      if (ay) yearsSet.add(ay);
    });
    if (initialData?.availableAcademicYears) {
      initialData.availableAcademicYears.forEach((ay) => {
        if (ay) yearsSet.add(ay);
      });
    }
      const preferredActiveAy =
      historyCurrentTerm?.academicYear ||
      currentAcademicTerm?.academic_year ||
      submissionWindow?.academicYear ||
      initialData?.academicYear ||
      "";
    if (preferredActiveAy) {
      yearsSet.add(preferredActiveAy);
    }
    pastSubmissions.forEach((sub) => {
      if (sub.academicYear) yearsSet.add(sub.academicYear);
    });
    const sortedYears = Array.from(yearsSet).sort((a, b) =>
      b.localeCompare(a),
    );
    if (sortedYears.length === 0 && academicYears[0]) {
      return [academicYears[0]];
    }
    return sortedYears;
  }, [
    historyDbYears,
    initialData?.availableAcademicYears,
    initialData?.academicYear,
    historyCurrentTerm?.academicYear,
    currentAcademicTerm?.academic_year,
    submissionWindow?.academicYear,
    pastSubmissions,
    academicYears,
  ]);
  const historySemesterOptions = useMemo<
    Array<(typeof SEMESTER_OPTIONS)[number]>
  >(() => {
    const sortOrder: Record<string, number> = {
      "1st Semester": 1,
      "2nd Semester": 2,
      "Summer Semester": 3,
    };
    const semestersSet = new Set<(typeof SEMESTER_OPTIONS)[number]>();
    const dbSemesters = historyAcademicYear
      ? historyTermsByYear[historyAcademicYear] ??
        initialData?.termsByYear?.[historyAcademicYear] ??
        []
      : [];
    dbSemesters.forEach((sem) => {
      if (sem) semestersSet.add(sem);
    });
    const preferredActiveAy =
      historyCurrentTerm?.academicYear ||
      currentAcademicTerm?.academic_year ||
      submissionWindow?.academicYear ||
      initialData?.academicYear ||
      "";
    const preferredActiveSem = (historyCurrentTerm?.semester ||
      currentAcademicTerm?.semester ||
      submissionWindow?.semester ||
      initialData?.semester ||
      "") as (typeof SEMESTER_OPTIONS)[number] | "";
    if (
      preferredActiveSem &&
      (!historyAcademicYear ||
        !preferredActiveAy ||
        historyAcademicYear === preferredActiveAy)
    ) {
      semestersSet.add(preferredActiveSem as (typeof SEMESTER_OPTIONS)[number]);
    }
    pastSubmissions.forEach((sub) => {
      if (
        sub.semester &&
        (!historyAcademicYear || sub.academicYear === historyAcademicYear)
      ) {
        semestersSet.add(sub.semester);
      }
    });
    const sorted = Array.from(semestersSet).sort(
      (a, b) => (sortOrder[a] ?? 99) - (sortOrder[b] ?? 99),
    );
    return sorted.length > 0 ? sorted : [...SEMESTER_OPTIONS];
  }, [
    historyAcademicYear,
    historyTermsByYear,
    initialData?.termsByYear,
    initialData?.academicYear,
    initialData?.semester,
    historyCurrentTerm?.academicYear,
    historyCurrentTerm?.semester,
    currentAcademicTerm?.academic_year,
    currentAcademicTerm?.semester,
    submissionWindow?.academicYear,
    submissionWindow?.semester,
    pastSubmissions,
  ]);
  const [isRequirementAlertOpen, setIsRequirementAlertOpen] = useState(false);
  const [hasTriggeredRequirementAlert, setHasTriggeredRequirementAlert] =
    useState(false);
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
  async function fetchHistory(options?: { silent?: boolean }) {
    try {
      if (!options?.silent) {
        setIsLoadingHistory(true);
      }
      setHistoryError(null);
      const response = await fetch(
        `/api/faculty/submissions/history?_t=${Date.now()}`,
        {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
        },
      );
      if (!response.ok) {
        setHistoryError("Failed to load submission history");
        return;
      }
      const data = await response.json();
      const historyList: PastSubmission[] = data.submissions || [];
      setPastSubmissions(historyList);
      if (Array.isArray(data.availableAcademicYears)) {
        setHistoryDbYears(data.availableAcademicYears);
      }
      if (data.termsByYear && typeof data.termsByYear === "object") {
        setHistoryTermsByYear(data.termsByYear);
      }
      if (
        data.currentAcademicTerm?.academicYear &&
        data.currentAcademicTerm?.semester
      ) {
        setHistoryCurrentTerm({
          academicYear: data.currentAcademicTerm.academicYear,
          semester: data.currentAcademicTerm.semester,
        });
        if (!hasManuallyChangedHistoryTermRef.current) {
          setHistoryAcademicYear(data.currentAcademicTerm.academicYear);
          setHistorySemester(data.currentAcademicTerm.semester);
        }
      }
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
      if (!options?.silent) {
        setIsLoadingHistory(false);
      }
    }
  }
  async function handleBulkDownload() {
    const downloadableSubs = filteredPastSubmissions.filter((s) =>
      Boolean(s.storagePath && !s.storagePath.startsWith("__cleaned__")),
    );
    if (downloadableSubs.length === 0 || isBulkDownloading) return;
    try {
      setIsBulkDownloading(true);
      setBulkDownloadProgressText("Preparing...");
      const zip = new JSZip();
      let processed = 0;
      const total = downloadableSubs.length;
      for (const sub of downloadableSubs) {
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
  async function fetchStatuses(
    year?: string,
    sem?: string,
    classId?: string | null,
    options?: { silent?: boolean },
  ) {
    try {
      if (!options?.silent) {
        setIsLoadingStatuses(true);
      }
      setStatusError(null);
      const params = new URLSearchParams();
      const targetYear =
        year ||
        activeAY ||
        (submissionWindow?.academicYear
          ? submissionWindow.academicYear
          : statusAcademicYear);
      const targetSem =
        sem ||
        activeSem ||
        (submissionWindow?.semester
          ? submissionWindow.semester
          : statusSemester);
      if (targetYear) {
        params.set("academicYear", targetYear);
      }
      if (targetSem) {
        params.set("semester", targetSem);
      }
      const targetClassId =
        classId !== undefined ? classId : selectedClassIdRef.current;
      if (targetClassId) {
        params.set("classId", targetClassId);
      }
      params.set("_t", String(Date.now()));
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
        if (targetClassId) {
          classStatusesCacheRef.current[targetClassId] = statuses;
          if (targetYear && targetSem) {
            classStatusesCacheRef.current[`${targetClassId}_${targetYear}_${targetSem}`] = statuses;
          }
        }
        if ((targetClassId || null) === (selectedClassIdRef.current || null)) {
          setRequirementStatuses(statuses);
          setStatusCounts(data.counts || null);
        }
        if (Array.isArray(data.requirementTemplates)) {
          setRequirementTemplates(data.requirementTemplates);
          setIsTemplatesFetched(true);
        }
        if (data.academicYear && !currentAcademicTerm?.academic_year) {
          setStatusAcademicYear(data.academicYear);
        }
        if (data.semester && !currentAcademicTerm?.semester) {
          setStatusSemester(data.semester);
        }
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
      if (!options?.silent) {
        setIsLoadingStatuses(false);
      }
    }
  }
  const refetchSubmissionWindow = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!options?.silent) {
        setIsLoadingSubmissionWindow(true);
      }
      try {
        const response = await fetch(
          `/api/faculty/submissions/window?_t=${Date.now()}`,
          {
            cache: "no-store",
            headers: { "Cache-Control": "no-cache" },
          },
        );
        if (response.ok) {
          const data = (await response.json()) as SubmissionWindowState;
          setSubmissionWindow(data);
        }
      } catch {
        // Keep UI usable even if window info fails to load.
      } finally {
        if (!options?.silent) {
          setIsLoadingSubmissionWindow(false);
        }
      }
    },
    [],
  );
  const handleWindowExpired = useCallback(() => {
    void refetchSubmissionWindow({ silent: true });
    void fetchStatuses(undefined, undefined, undefined, { silent: true });
  }, [refetchSubmissionWindow]);
  useEffect(() => {
    void refetchSubmissionWindow({ silent: Boolean(initialData) });
    if (!initialData) {
      void fetchHistory();
      void fetchStatuses();
    } else {
      void fetchHistory({ silent: true });
    }
  }, [initialData, refetchSubmissionWindow]);
  // Deep-linking, view routing, and auto-scrolling with highlight
  const scrollToAndHighlightRequirement = useCallback((code: string) => {
    const mobileEl = document.getElementById(`requirement-mobile-${code}`);
    const desktopEl = document.getElementById(`requirement-${code}`);
    const targetElement =
      (mobileEl && mobileEl.offsetParent !== null ? mobileEl : null) ||
      (desktopEl && desktopEl.offsetParent !== null ? desktopEl : null) ||
      desktopEl ||
      mobileEl ||
      document.getElementById(code);
    if (!targetElement) return;
    targetElement.scrollIntoView({ behavior: "smooth", block: "center" });
    targetElement.classList.add(
      "ring-4",
      "ring-amber-400",
      "bg-amber-500/10",
      "transition-all",
      "duration-500",
    );
    setTimeout(() => {
      targetElement.classList.remove(
        "ring-4",
        "ring-amber-400",
        "bg-amber-500/10",
        "transition-all",
        "duration-500",
      );
    }, 3500);
  }, []);

  useEffect(() => {
    try {
      const liveParams = new URLSearchParams(window.location.search);
      const spView = searchParams?.get("view");
      const view = liveParams.get("view") || spView;
      const highlightParam =
        liveParams.get("highlight") ||
        liveParams.get("requirement") ||
        searchParams?.get("highlight") ||
        searchParams?.get("requirement");
      const historyParam =
        liveParams.get("history") || searchParams?.get("history");

      if (pendingNavViewRef.current) {
        if (spView === pendingNavViewRef.current) {
          pendingNavViewRef.current = null;
        } else {
          return;
        }
      }

      if (liveParams.get("view") && spView && liveParams.get("view") !== spView) {
        return;
      }

      if (
        view === "history" ||
        (view === "status" && historyParam === "true")
      ) {
        setActiveView((prev) => (prev !== "status" ? "status" : prev));
        setIsHistoryModalOpen(true);
      } else if (view && (PANEL_VIEWS as readonly string[]).includes(view)) {
        setActiveView((prev) => (prev !== view ? (view as PanelView) : prev));
      } else if (highlightParam) {
        setActiveView((prev) => (prev !== "status" ? "status" : prev));
      }
    } catch {
      // ignore
    }
  }, [searchParams]);

  useEffect(() => {
    try {
      const liveParams = new URLSearchParams(window.location.search);
      const highlightParam =
        liveParams.get("highlight") ||
        liveParams.get("requirement") ||
        searchParams?.get("highlight") ||
        searchParams?.get("requirement");

      if (highlightParam && handledHighlightRef.current !== highlightParam) {
        handledHighlightRef.current = highlightParam;
        const timer = setTimeout(() => {
          scrollToAndHighlightRequirement(highlightParam);

          // Clean up highlight params from the URL so future tab switches don't get trapped
          try {
            const cleanParams = new URLSearchParams(window.location.search);
            if (
              cleanParams.has("highlight") ||
              cleanParams.has("requirement")
            ) {
              cleanParams.delete("highlight");
              cleanParams.delete("requirement");
              const newSearch = cleanParams.toString();
              const newUrl = newSearch
                ? `${window.location.pathname}?${newSearch}${window.location.hash}`
                : `${window.location.pathname}${window.location.hash}`;
              window.history.replaceState(null, "", newUrl);
            }
          } catch {
            // ignore
          }
        }, 350);
        return () => clearTimeout(timer);
      }
    } catch {
      // ignore
    }
  }, [searchParams, requirementStatuses, scrollToAndHighlightRequirement]);

  // Listener for instant in-page view navigation requests from notification drawer
  useEffect(() => {
    function handleCustomSelectView(e: Event) {
      const customEvent = e as CustomEvent<{
        view?: PanelView;
        highlight?: string;
      }>;
      if (customEvent.detail?.view) {
        navigateToView(customEvent.detail.view);
      }
      if (customEvent.detail?.highlight) {
        const h = customEvent.detail.highlight;
        handledHighlightRef.current = null;
        setTimeout(() => {
          scrollToAndHighlightRequirement(h);
        }, 300);
      }
    }
    window.addEventListener("pup-focus-select-view", handleCustomSelectView);
    return () =>
      window.removeEventListener(
        "pup-focus-select-view",
        handleCustomSelectView,
      );
  }, [scrollToAndHighlightRequirement]);

  // Browser back/forward popstate listener for accurate history navigation in faculty dashboard
  useEffect(() => {
    function handlePopState() {
      try {
        pendingNavViewRef.current = null;
        const params = new URLSearchParams(window.location.search);
        const v = params.get("view");
        if (v && (PANEL_VIEWS as readonly string[]).includes(v)) {
          setActiveView(v as PanelView);
        } else if (!v) {
          setActiveView("dashboard");
        }
      } catch {}
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);
  useEffect(() => {
    if (initialData?.requirementTemplates !== undefined) {
      return;
    }
    fetch("/api/staff/requirement-templates?active=true", {
      cache: "no-store",
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.templates)
            ? data.templates
            : Array.isArray(data?.requirementTemplates)
              ? data.requirementTemplates
              : [];
        setRequirementTemplates(
          list
            .filter((t: any) => t.is_active !== false)
            .map((t: any) => ({
              code: t.code,
              title: t.title,
              is_mandatory: t.is_mandatory !== false,
              is_active: t.is_active !== false,
              max_size_mb: t.max_size_mb ? Number(t.max_size_mb) : 50,
              allowed_formats:
                Array.isArray(t.allowed_formats) && t.allowed_formats.length > 0
                  ? t.allowed_formats
                  : ["PDF", "DOCX", "XLSX", "PNG", "JPG", "ZIP"],
            })),
        );
        setIsTemplatesFetched(true);
      })
      .catch(() => {});
  }, [initialData?.requirementTemplates]);
  const hasHydratedInitialStatusesRef = useRef(
    Boolean(initialData?.requirementStatuses),
  );
  const lastFetchedWindowKeyRef = useRef<string>("");
  useEffect(() => {
    if (hasHydratedInitialStatusesRef.current) {
      hasHydratedInitialStatusesRef.current = false;
      return;
    }
    const winAy = submissionWindow?.academicYear;
    const winSem = submissionWindow?.semester;
    if (winAy && winSem) {
      const key = `${winAy}_${winSem}`;
      if (lastFetchedWindowKeyRef.current === key) return;
      lastFetchedWindowKeyRef.current = key;
      void fetchStatuses(
        winAy,
        winSem,
        undefined,
        { silent: true },
      );
    }
  }, [submissionWindow?.academicYear, submissionWindow?.semester]);
  useEffect(() => {
    if (isHistoryModalOpen) {
      void fetchHistory({ silent: pastSubmissions.length > 0 });
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
    const preferredAy =
      historyCurrentTerm?.academicYear ||
      currentAcademicTerm?.academic_year ||
      submissionWindow?.academicYear ||
      initialData?.academicYear ||
      "";
    const preferredSem = (historyCurrentTerm?.semester ||
      currentAcademicTerm?.semester ||
      submissionWindow?.semester ||
      initialData?.semester ||
      "") as (typeof SEMESTER_OPTIONS)[number] | "";

    if (
      isHistoryModalOpen &&
      !hasManuallyChangedHistoryTermRef.current &&
      preferredAy &&
      preferredSem
    ) {
      if (
        historyAcademicYears.includes(preferredAy) &&
        historyAcademicYear !== preferredAy
      ) {
        setHistoryAcademicYear(preferredAy);
      }
      if (
        historySemesterOptions.includes(
          preferredSem as (typeof SEMESTER_OPTIONS)[number],
        ) &&
        historySemester !== preferredSem
      ) {
        setHistorySemester(preferredSem as (typeof SEMESTER_OPTIONS)[number]);
      }
      return;
    }

    if (
      historyAcademicYears.length > 0 &&
      !historyAcademicYears.includes(historyAcademicYear)
    ) {
      setHistoryAcademicYear(
        preferredAy && historyAcademicYears.includes(preferredAy)
          ? preferredAy
          : historyAcademicYears[0],
      );
    }
    if (
      historySemesterOptions.length > 0 &&
      (historySemester === "All" ||
        !historySemesterOptions.includes(historySemester))
    ) {
      setHistorySemester(
        preferredSem &&
          historySemesterOptions.includes(
            preferredSem as (typeof SEMESTER_OPTIONS)[number],
          )
          ? (preferredSem as (typeof SEMESTER_OPTIONS)[number])
          : historySemesterOptions[0],
      );
    }
  }, [
    isHistoryModalOpen,
    historyAcademicYears,
    historyAcademicYear,
    historySemesterOptions,
    historySemester,
    historyCurrentTerm?.academicYear,
    historyCurrentTerm?.semester,
    currentAcademicTerm?.academic_year,
    currentAcademicTerm?.semester,
    submissionWindow?.academicYear,
    submissionWindow?.semester,
    initialData?.academicYear,
    initialData?.semester,
  ]);
  function openHistoryModal() {
    hasManuallyChangedHistoryTermRef.current = false;
    const preferredAy =
      historyCurrentTerm?.academicYear ||
      currentAcademicTerm?.academic_year ||
      submissionWindow?.academicYear ||
      initialData?.academicYear ||
      "";
    const preferredSem = (historyCurrentTerm?.semester ||
      currentAcademicTerm?.semester ||
      submissionWindow?.semester ||
      initialData?.semester ||
      "") as (typeof SEMESTER_OPTIONS)[number] | "";
    if (preferredAy) {
      setHistoryAcademicYear(preferredAy);
    }
    if (preferredSem) {
      setHistorySemester(preferredSem);
    }
    pendingNavViewRef.current = "status";
    setIsHistoryModalOpen(true);
    void fetchHistory({ silent: pastSubmissions.length > 0 });
    try {
      const params = new URLSearchParams(
        window.location.search || (searchParams?.toString() ?? ""),
      );
      params.set("view", "status");
      params.set("history", "true");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    } catch {
      // fallback
    }
  }
  function closeHistoryModal() {
    pendingNavViewRef.current = "status";
    setIsHistoryModalOpen(false);
    try {
      const params = new URLSearchParams(
        window.location.search || (searchParams?.toString() ?? ""),
      );
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
      hasManuallyChangedHistoryTermRef.current = false;
      const preferredAy =
        historyCurrentTerm?.academicYear ||
        currentAcademicTerm?.academic_year ||
        submissionWindow?.academicYear ||
        initialData?.academicYear ||
        "";
      const preferredSem = (historyCurrentTerm?.semester ||
        currentAcademicTerm?.semester ||
        submissionWindow?.semester ||
        initialData?.semester ||
        "") as (typeof SEMESTER_OPTIONS)[number] | "";
      if (preferredAy) setHistoryAcademicYear(preferredAy);
      if (preferredSem) setHistorySemester(preferredSem);
    }
    pendingNavViewRef.current = targetView;
    setActiveView(targetView);
    setIsHistoryModalOpen(openHistory);
    setIsMobileMenuOpen(false);
    // Reset handled highlight ref when user manually navigates to another tab
    handledHighlightRef.current = null;
    try {
      sessionStorage.setItem("pup_focus_faculty_active_view", targetView);
      const params = new URLSearchParams(
        window.location.search || (searchParams?.toString() ?? ""),
      );
      params.set("view", targetView);
      params.delete("highlight");
      params.delete("requirement");
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
      if (submission.status !== "Validated") return false;
      const matchesYear =
        historyAcademicYear === "All" ||
        submission.academicYear === historyAcademicYear;
      const matchesSemester =
        historySemester === "All" || submission.semester === historySemester;
      return matchesYear && matchesSemester;
    });
  }, [historyAcademicYear, historySemester, pastSubmissions]);
  const historyScopedClasses = useMemo(() => {
    const classIdsWithSubmissions = new Set(
      filteredPastSubmissions
        .map((s) => s.classId || s.class_id)
        .filter((id): id is string => Boolean(id)),
    );
    const normTargetSem = historySemester.toLowerCase().trim();
    return facultyClasses.filter((cls) => {
      if (classIdsWithSubmissions.has(cls.id)) {
        return true;
      }
      if (!cls.academic_year && !cls.semester) {
        return false;
      }
      const matchesYear =
        historyAcademicYear === "All" ||
        !cls.academic_year ||
        cls.academic_year === historyAcademicYear;
      const matchesSem =
        historySemester === "All" ||
        !cls.semester ||
        cls.semester.toLowerCase().trim() === normTargetSem;
      return matchesYear && matchesSem;
    });
  }, [facultyClasses, filteredPastSubmissions, historyAcademicYear, historySemester]);
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
      currentAcademicTerm?.academic_year ||
      submissionWindow?.academicYear ||
      initialData?.academicYear ||
      statusAcademicYear ||
      ""
    );
  }, [
    currentAcademicTerm?.academic_year,
    submissionWindow?.academicYear,
    initialData?.academicYear,
    statusAcademicYear,
  ]);

  const activeSem = useMemo(() => {
    return (
      currentAcademicTerm?.semester ||
      submissionWindow?.semester ||
      initialData?.semester ||
      statusSemester ||
      ""
    );
  }, [
    currentAcademicTerm?.semester,
    submissionWindow?.semester,
    initialData?.semester,
    statusSemester,
  ]);

  const hasActiveAcademicTerm = Boolean(
    (currentAcademicTerm?.academic_year &&
      currentAcademicTerm.academic_year.trim() !== "") ||
    (submissionWindow?.isConfigured && submissionWindow?.academicYear) ||
    (initialData?.academicYear && initialData.academicYear.trim() !== ""),
  );

  const activeTemplates = useMemo<RequirementTemplateData[]>(() => {
    if (requirementTemplates && requirementTemplates.length > 0) {
      return requirementTemplates.filter((t: any) => t.is_active !== false);
    }
    if (isTemplatesFetched) {
      return [];
    }
    if (
      initialData?.requirementTemplates &&
      initialData.requirementTemplates.length > 0
    ) {
      return initialData.requirementTemplates.filter(
        (t: any) => t.is_active !== false,
      );
    }
    return [];
  }, [
    requirementTemplates,
    isTemplatesFetched,
    initialData?.requirementTemplates,
  ]);

  const templateTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of activeTemplates) {
      map.set(t.code, t.title);
    }
    return map;
  }, [activeTemplates]);

  const templateMandatoryMap = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const t of activeTemplates) {
      map.set(t.code, t.is_mandatory !== false);
    }
    return map;
  }, [activeTemplates]);

  const mandatoryTemplates = useMemo(() => {
    return activeTemplates.filter((t) => t.is_mandatory !== false);
  }, [activeTemplates]);

  const optionalTemplates = useMemo(() => {
    return activeTemplates.filter((t) => t.is_mandatory === false);
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

  const formatDeadlineDate = useCallback(
    (isoOrDateStr: string | null | undefined): string => {
      if (!isoOrDateStr) return "";
      try {
        const d = new Date(isoOrDateStr);
        if (Number.isNaN(d.getTime())) return isoOrDateStr;
        return d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
          timeZone: "Asia/Manila",
        });
      } catch {
        return isoOrDateStr;
      }
    },
    [],
  );

  const selectedClass = useMemo(() => {
    return facultyClasses.find((c) => c.id === selectedClassId) || null;
  }, [facultyClasses, selectedClassId]);

  const fetchFacultyClasses = useCallback(
    async (options?: { silent?: boolean }) => {
      try {
        if (!options?.silent) {
          setIsLoadingClasses(true);
        }
        const res = await fetch(`/api/faculty/classes?_t=${Date.now()}`, {
          cache: "no-store",
        });
        if (res.ok) {
          const data = await res.json();
          setFacultyClasses(data.classes || []);
          if (data.activeTerm) {
            setCurrentAcademicTerm(data.activeTerm);
          }
        }
      } catch (err) {
        console.error("Failed to load faculty classes:", err);
      } finally {
        if (!options?.silent) {
          setIsLoadingClasses(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    if (isMounted) {
      void fetchFacultyClasses();
    }
  }, [isMounted, fetchFacultyClasses]);

  useEffect(() => {
    if (!isMounted || facultyClasses.length === 0 || !activeAY || !activeSem) return;
    for (const cls of facultyClasses) {
      const cacheKey = `${cls.id}_${activeAY}_${activeSem}`;
      if (!classStatusesCacheRef.current[cacheKey]) {
        classStatusesCacheRef.current[cacheKey] = [];
        void fetchStatuses(activeAY, activeSem, cls.id, { silent: true });
      }
    }
  }, [isMounted, facultyClasses, activeAY, activeSem]);

  // Realtime synchronization for classes, submissions, reviews, windows, templates, and faculty profile
  useRealtimeSync(() => {
    void refreshFacultyProfile();
    void fetchFacultyClasses({ silent: true });
    void fetchStatuses(activeAY, activeSem, selectedClassIdRef.current, {
      silent: true,
    });
    if (facultyClassesRef.current.length > 0) {
      for (const cls of facultyClassesRef.current) {
        if (cls.id !== selectedClassIdRef.current) {
          void fetchStatuses(activeAY, activeSem, cls.id, { silent: true });
        }
      }
    }
    void fetchHistory({ silent: true });
    void refetchSubmissionWindow({ silent: true });
  });

  const handleManualRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await Promise.all([
        refreshFacultyProfile(),
        fetchFacultyClasses({ silent: true }),
        fetchStatuses(activeAY, activeSem, selectedClassId, { silent: true }),
        ...facultyClasses
          .filter((c) => c.id !== selectedClassId)
          .map((c) =>
            fetchStatuses(activeAY, activeSem, c.id, { silent: true }),
          ),
        fetchHistory({ silent: true }),
        refetchSubmissionWindow({ silent: true }),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRefreshHistory = async () => {
    if (isRefreshingHistory) return;
    setIsRefreshingHistory(true);
    try {
      await fetchHistory({ silent: true });
    } finally {
      setIsRefreshingHistory(false);
    }
  };

  const handleAddClassSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasActiveAcademicTerm) {
      setClassFormError(
        "No active academic term configured by the administrator yet. Subject loads cannot be registered until an administrator sets the current academic year and semester.",
      );
      return;
    }
    if (!classForm.subject_code.trim()) {
      setClassFormError("Subject Code is required.");
      return;
    }
    if (!classForm.description.trim()) {
      setClassFormError("Description is required.");
      return;
    }
    if (!classForm.section_code.trim()) {
      setClassFormError("Section Code is required.");
      return;
    }
    setClassFormError(null);
    setIsSubmittingClass(false);
    setIsConfirmCreateClassModalOpen(true);
  };

  const handleConfirmCreateClass = async () => {
    if (!hasActiveAcademicTerm) {
      setClassFormError(
        "No active academic term configured by the administrator yet.",
      );
      setIsConfirmCreateClassModalOpen(false);
      return;
    }
    setIsSubmittingClass(true);
    setClassFormError(null);
    try {
      const res = await fetch("/api/faculty/classes/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject_code: classForm.subject_code.trim(),
          description: classForm.description.trim(),
          units: Number(classForm.units) || 3.0,
          section_code: classForm.section_code.trim(),
          academic_year: activeAY,
          semester: activeSem,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(
          errData.error || `Failed to create class load (HTTP ${res.status})`,
        );
      }

      const resData = await res.json();
      const newClass: FacultyClass = resData.class;
      await fetchFacultyClasses({ silent: true });
      classStatusesCacheRef.current[`${newClass.id}_${activeAY}_${activeSem}`] =
        [];
      classStatusesCacheRef.current[newClass.id] = [];
      selectedClassIdRef.current = null;
      setSelectedClassId(null);
      setClassTab("active");
      setClassSectionFilter("ALL");
      setClassSearchQuery("");
      setIsUploadSectionVisible(false);
      void fetchStatuses(activeAY, activeSem, null, { silent: true });
      emitRealtimeSync({
        source: "class-created",
        table: "faculty_classes",
        classId: newClass.id,
        timestamp: Date.now(),
      });
      setIsConfirmCreateClassModalOpen(false);
      setIsAddClassModalOpen(false);
      setCreatedClassSuccessData({
        id: newClass.id,
        subject_code: newClass.subject_code,
        description: newClass.description,
        section_code: newClass.section_code,
        units: Number(newClass.units) || Number(classForm.units) || 3.0,
      });
      setIsCreateClassSuccessModalOpen(true);
      setClassForm({
        subject_code: "",
        description: "",
        units: 3.0,
        section_code: "",
      });
      setSubmissionMessage(
        `Class ${newClass.subject_code} (${newClass.section_code}) created successfully.`,
      );
    } catch (err) {
      setClassFormError(
        err instanceof Error ? err.message : "Failed to create class load.",
      );
      setIsConfirmCreateClassModalOpen(false);
    } finally {
      setIsSubmittingClass(false);
    }
  };

  const handleOpenViewClass = (cls: FacultyClass, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setClassToView(cls);
    setIsViewClassModalOpen(true);
  };

  const handleOpenEditClass = (cls: FacultyClass, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setClassToEdit(cls);
    setEditClassForm({
      subject_code: cls.subject_code,
      description: cls.description,
      units: cls.units || 3.0,
      section_code: cls.section_code,
    });
    setEditClassError(null);
    setIsEditClassModalOpen(true);
  };

  const handleEditClassSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classToEdit) return;
    if (!editClassForm.subject_code.trim()) {
      setEditClassError("Subject Code is required.");
      return;
    }
    if (!editClassForm.description.trim()) {
      setEditClassError("Description is required.");
      return;
    }
    if (!editClassForm.section_code.trim()) {
      setEditClassError("Section Code is required.");
      return;
    }
    setIsUpdatingClass(true);
    setEditClassError(null);
    try {
      const res = await fetch("/api/faculty/classes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: classToEdit.id,
          subject_code: editClassForm.subject_code.trim(),
          description: editClassForm.description.trim(),
          units: Number(editClassForm.units) || 3.0,
          section_code: editClassForm.section_code.trim(),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(
          errData.error || `Failed to update class (HTTP ${res.status})`,
        );
      }

      await fetchFacultyClasses({ silent: true });
      emitRealtimeSync({
        source: "class-updated",
        table: "faculty_classes",
        classId: classToEdit.id,
        timestamp: Date.now(),
      });
      setIsEditClassModalOpen(false);
      setClassToEdit(null);
      setSubmissionMessage(
        `Class ${editClassForm.subject_code.trim()} updated successfully.`,
      );
    } catch (err) {
      setEditClassError(
        err instanceof Error ? err.message : "Failed to update class.",
      );
    } finally {
      setIsUpdatingClass(false);
    }
  };

  const handleToggleArchiveClass = async (
    cls: FacultyClass,
    e?: React.MouseEvent,
  ) => {
    if (e) e.stopPropagation();
    const willArchive = !cls.is_archived;
    setClassActionLoadingId(cls.id);
    try {
      const res = await fetch("/api/faculty/classes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: cls.id,
          is_archived: willArchive,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to update archive status");
      }

      setFacultyClasses((prev) =>
        prev.map((c) =>
          c.id === cls.id ? { ...c, is_archived: willArchive } : c,
        ),
      );
      if (willArchive && selectedClassId === cls.id) {
        setSelectedClassId(null);
      }
      emitRealtimeSync({
        source: "class-archived",
        table: "faculty_classes",
        classId: cls.id,
        timestamp: Date.now(),
      });
      setSubmissionMessage(
        willArchive
          ? `Class ${cls.subject_code} (${cls.section_code}) has been archived.`
          : `Class ${cls.subject_code} (${cls.section_code}) unarchived and restored to active loads.`,
      );
    } catch (err) {
      alert(
        err instanceof Error ? err.message : "Failed to update archive status",
      );
    } finally {
      setClassActionLoadingId(null);
    }
  };

  const handleOpenArchiveModal = (cls: FacultyClass, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setClassToArchive(cls);
    setIsArchiveModalOpen(true);
  };

  const handleArchiveClassConfirm = async () => {
    if (!classToArchive) return;
    setIsArchivingClass(true);
    try {
      await handleToggleArchiveClass(classToArchive);
      setIsArchiveModalOpen(false);
      setClassToArchive(null);
    } finally {
      setIsArchivingClass(false);
    }
  };

  const handleOpenDeleteModal = (cls: FacultyClass, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setClassToDelete(cls);
    setDeleteCountdown(5);
    setDeleteConfirmText("");
    setIsDeleteModalOpen(true);
  };

  const handleDeleteClassConfirm = async () => {
    if (
      !classToDelete ||
      deleteCountdown > 0 ||
      deleteConfirmText.trim().toLowerCase() !== "delete"
    ) {
      return;
    }
    setIsDeletingClass(true);
    try {
      const res = await fetch(
        `/api/faculty/classes?id=${encodeURIComponent(classToDelete.id)}`,
        {
          method: "DELETE",
        },
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(
          errData.error || `Failed to delete class (HTTP ${res.status})`,
        );
      }

      setFacultyClasses((prev) =>
        prev.filter((c) => c.id !== classToDelete.id),
      );
      if (selectedClassId === classToDelete.id) {
        setSelectedClassId(null);
      }
      emitRealtimeSync({
        source: "class-deleted",
        table: "faculty_classes",
        classId: classToDelete.id,
        timestamp: Date.now(),
      });
      setIsDeleteModalOpen(false);
      setDeleteCountdown(0);
      setDeleteConfirmText("");
      setSubmissionMessage(
        `Class ${classToDelete.subject_code} (${classToDelete.section_code}) deleted.`,
      );
      setClassToDelete(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete class");
    } finally {
      setIsDeletingClass(false);
    }
  };

  const displayedRequirementStatuses = useMemo<RequirementStatus[]>(() => {
    const normActiveAY = normalizeAcademicYear(activeAY);
    const normActiveSem = normalizeSemester(activeSem);
    const activeCodes = activeTemplates.map((t) => t.code);
    const nowMs = Date.now();

    // Schedule global deadline
    const globalDeadlineIso = submissionWindow?.endDate
      ? `${submissionWindow.endDate}T${submissionWindow.endTime ? normalizeTime24Hour(submissionWindow.endTime) || "23:59:59" : "23:59:59"}+08:00`
      : null;
    const globalDeadlineMs = globalDeadlineIso
      ? new Date(globalDeadlineIso).getTime()
      : null;
    const isGlobalScheduleClosed = Boolean(
      submissionWindow?.isConfigured &&
      !submissionWindow?.isOpen &&
      (submissionWindow?.status === "Closed" ||
        (globalDeadlineMs && nowMs > globalDeadlineMs)),
    );

    // Filter approved extension requests for active term
    const approvedExtList = (allExtensionRequests || []).filter((ext: any) => {
      if (
        ext.status !== "approved" ||
        (!ext.approved_date && !ext.approved_extension_date)
      )
        return false;
      const matchAY =
        !ext.academic_year ||
        normalizeAcademicYear(ext.academic_year) === normActiveAY;
      const matchSem =
        !ext.semester || normalizeSemester(ext.semester) === normActiveSem;
      return matchAY && matchSem;
    });
    if (
      approvedExtList.length === 0 &&
      latestApprovedExtension?.status === "approved" &&
      (latestApprovedExtension?.approved_date ||
        latestApprovedExtension?.approved_extension_date)
    ) {
      approvedExtList.push(latestApprovedExtension);
    }

    return activeCodes.map((code) => {
      const liveCandidate = requirementStatuses.find((r) => r.code === code);
      const live =
        selectedClassId && liveCandidate
          ? ((liveCandidate as any).classId ||
              (liveCandidate as any).class_id) === selectedClassId
            ? liveCandidate
            : undefined
          : liveCandidate;
      const match = pastSubmissions.find((s) => {
        if (s.requirementCode !== code) return false;
        const subSem = normalizeSemester(s.semester);
        const subYear = normalizeAcademicYear(s.academicYear);
        const matchTerm = subSem === normActiveSem && subYear === normActiveAY;
        if (!matchTerm) return false;
        if (selectedClassId) {
          const sClass = (s as any).classId || (s as any).class_id;
          return sClass === selectedClassId;
        }
        return true;
      });

      // Find matching approved extension for this requirement code
      const matchingExt = approvedExtList.find((ext: any) => {
        if (ext.status !== "approved") return false;
        const reqCodes = Array.isArray(ext.requirement_codes)
          ? ext.requirement_codes
          : [];
        return reqCodes.length === 0 || reqCodes.includes(code);
      });

      const targetExtDate =
        matchingExt?.approved_date || matchingExt?.approved_extension_date;
      const targetExtTime = matchingExt?.approved_time;
      const extDeadlineIso = targetExtDate
        ? `${targetExtDate}T${targetExtTime ? normalizeTime24Hour(targetExtTime) || "23:59:59" : "23:59:59"}+08:00`
        : null;
      const extDeadlineMs = extDeadlineIso
        ? new Date(extDeadlineIso).getTime()
        : null;
      const isExtensionActive = Boolean(
        matchingExt?.status === "approved" &&
        extDeadlineMs &&
        nowMs <= extDeadlineMs,
      );

      // Effective deadline determination:
      // Individual custom due date if one exists; otherwise, approved extension date, personal deadline, or schedule's global deadline
      const existingCustomDue =
        live?.customDueDate || live?.due_at || (match as any)?.due_at;
      const windowDeadlineIso =
        submissionWindow?.effectiveDeadline || globalDeadlineIso;
      const windowDeadlineMs = windowDeadlineIso
        ? new Date(windowDeadlineIso).getTime()
        : globalDeadlineMs;
      let effectiveDeadlineIso = windowDeadlineIso;
      let effectiveDeadlineMs = windowDeadlineMs;
      let customDueDate: string | null = null;

      if (isExtensionActive && extDeadlineIso && extDeadlineMs) {
        effectiveDeadlineIso = extDeadlineIso;
        effectiveDeadlineMs = extDeadlineMs;
        if (existingCustomDue) {
          customDueDate = existingCustomDue;
        }
      } else if (existingCustomDue) {
        customDueDate = existingCustomDue;
        const customIso = existingCustomDue.includes("T")
          ? existingCustomDue
          : `${existingCustomDue}T23:59:59+08:00`;
        const customMs = new Date(customIso).getTime();
        if (!Number.isNaN(customMs)) {
          effectiveDeadlineIso = customIso;
          effectiveDeadlineMs = customMs;
        }
      } else if (extDeadlineIso && extDeadlineMs) {
        effectiveDeadlineIso = extDeadlineIso;
        effectiveDeadlineMs = extDeadlineMs;
      }

      const isPastEffectiveDeadline = Boolean(
        effectiveDeadlineMs && nowMs > effectiveDeadlineMs,
      );

      const subSource =
        live?.submittedAt ||
        (live as any)?.submitted_at ||
        live?.latestSubmissionId
          ? live
          : match || live;

      const hasFile = Boolean(
        subSource?.submittedAt ||
        (subSource as any)?.submitted_at ||
        (subSource as any)?.storagePath ||
        (subSource as any)?.storage_path ||
        (subSource as any)?.fileName ||
        (subSource as any)?.file_name ||
        (match as any)?.submitted_at ||
        (match as any)?.submittedAt ||
        (match as any)?.storagePath ||
        (match as any)?.storage_path,
      );

      const subId = hasFile
        ? (subSource as RequirementStatus)?.latestSubmissionId ||
          (subSource as any)?.id ||
          (subSource as PastSubmission)?.id ||
          (match as any)?.id
        : undefined;

      const rawStatus = (subSource?.status || "").toLowerCase().trim();
      const isExempted = rawStatus === "exempted" || rawStatus === "exempt";

      // Status Evaluation Rules:
      // 1. EXEMPTED: Display an "Exempted" badge. Disable both file uploads and extension requests.
      // 2. PENDING: Current date is on or before effective deadline, and no file is submitted.
      // 3. OVERDUE: Current date is past effective deadline, and no file is submitted.
      // 4. EXTENDED: Extension request approved, temporarily unlocked until approved date.
      const remarksStr =
        typeof subSource?.remarks === "string"
          ? subSource.remarks
          : (match as any)?.remarks || "";
      const isIndividualClosed = Boolean(
        remarksStr.includes("[origin:CLOSED]") ||
        remarksStr.includes("closed by admin"),
      );

      let evaluatedStatus: RequirementStatus["status"] = "Pending";

      if (isExempted) {
        evaluatedStatus = "Exempted";
      } else if (
        subSource &&
        (subSource.status === "Validated" ||
          rawStatus === "validated" ||
          rawStatus === "approved")
      ) {
        evaluatedStatus = "Validated";
      } else if (
        subSource &&
        (subSource.status === "Rejected" || rawStatus === "rejected")
      ) {
        evaluatedStatus = "Rejected";
      } else if (hasFile) {
        evaluatedStatus = "Pending";
      } else {
        // No file is submitted
        const isCustomDueExtended = Boolean(
          !isIndividualClosed &&
          customDueDate &&
          effectiveDeadlineMs &&
          nowMs <= effectiveDeadlineMs &&
          (!globalDeadlineMs || effectiveDeadlineMs > globalDeadlineMs),
        );
        if (isExtensionActive || isCustomDueExtended) {
          evaluatedStatus = "Extended";
        } else if (isIndividualClosed) {
          evaluatedStatus = "Not Submitted";
        } else if (!submissionWindow?.isConfigured) {
          evaluatedStatus = "Not Submitted";
        } else if (isPastEffectiveDeadline || isGlobalScheduleClosed) {
          evaluatedStatus = "Overdue";
        } else {
          evaluatedStatus = "Not Submitted";
        }
      }

      const adminRemarks =
        subSource?.adminRemarks ||
        subSource?.admin_remarks ||
        subSource?.feedback ||
        null;

      const userNote =
        subSource?.note ||
        (subSource as { notes?: string })?.notes ||
        subSource?.remarks ||
        null;

      const resolvedSubmittedAt =
        subSource?.submittedAt ||
        (subSource as any)?.submitted_at ||
        (match as any)?.submitted_at ||
        (match as any)?.submittedAt ||
        undefined;

      const resolvedFileName =
        (subSource as any)?.fileName ||
        (subSource as any)?.file_name ||
        (match as any)?.fileName ||
        (match as any)?.file_name ||
        undefined;

      const resolvedStoragePath =
        (subSource as any)?.storagePath ||
        (subSource as any)?.storage_path ||
        (match as any)?.storagePath ||
        (match as any)?.storage_path ||
        undefined;

      return {
        code,
        status: evaluatedStatus,
        submittedAt: resolvedSubmittedAt,
        reviewedAt: subSource?.reviewedAt,
        note: userNote,
        remarks: userNote || undefined,
        latestSubmissionId: subId,
        adminRemarks: adminRemarks,
        admin_remarks: adminRemarks || undefined,
        feedback: adminRemarks || undefined,
        storagePath: resolvedStoragePath,
        fileName: resolvedFileName,
        is_read: subSource?.is_read,
        isViewed: subSource?.isViewed,
        viewed_at: subSource?.viewed_at,
        isRevision: Boolean((subSource as RequirementStatus)?.isRevision),
        hasPriorRevision: Boolean(
          (subSource as RequirementStatus)?.hasPriorRevision,
        ),
        due_at: existingCustomDue || null,
        customDueDate,
        effectiveDeadline: isIndividualClosed ? null : effectiveDeadlineIso,
        isExtended: isIndividualClosed ? false : isExtensionActive,
        extendedUntil: isIndividualClosed ? null : extDeadlineIso,
        isIndividualClosed,
      };
    });
  }, [
    activeAY,
    activeSem,
    pastSubmissions,
    requirementStatuses,
    activeTemplates,
    submissionWindow,
    allExtensionRequests,
    latestApprovedExtension,
    selectedClassId,
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
    const overdue = displayedRequirementStatuses.filter(
      (r) => r.status === "Overdue",
    ).length;
    const extended = displayedRequirementStatuses.filter(
      (r) => r.status === "Extended",
    ).length;
    const exempted = displayedRequirementStatuses.filter(
      (r) => r.status === "Exempted",
    ).length;
    const notSubmitted = displayedRequirementStatuses.filter(
      (r) => r.status === "Not Submitted",
    ).length;
    return {
      total,
      validated,
      rejected,
      pending,
      overdue,
      extended,
      exempted,
      notSubmitted,
    };
  }, [displayedRequirementStatuses, activeTemplates.length]);

  const mandatoryValidatedCount = useMemo(() => {
    return displayedRequirementStatuses.filter((r) => {
      const isMandatory = templateMandatoryMap.get(r.code) !== false;
      return (
        isMandatory && (r.status === "Validated" || r.status === "Exempted")
      );
    }).length;
  }, [displayedRequirementStatuses, templateMandatoryMap]);

  const totalRequirements =
    displayedStatusCounts?.total ?? activeTemplates.length;
  const validatedCount = displayedStatusCounts?.validated ?? 0;

  const isSelectedClassAllValidated =
    mandatoryTemplates.length > 0
      ? mandatoryValidatedCount >= mandatoryTemplates.length
      : totalRequirements > 0 && validatedCount === totalRequirements;

  // Semester compliance across the entire term is met only when ALL active classes have all required/mandatory requirements Validated!
  const isAllClassesValidated = useMemo(() => {
    const activeClasses = facultyClasses.filter((c) => !c.is_archived);
    if (activeClasses.length === 0) return false;

    const normActiveAY = normalizeAcademicYear(activeAY);
    const normActiveSem = normalizeSemester(activeSem);
    const mandatoryCodes = mandatoryTemplates.map((t) => t.code);
    if (mandatoryCodes.length === 0) return false;

    return activeClasses.every((cls) => {
      return mandatoryCodes.every((code) => {
        const hasValidatedInPast = pastSubmissions.some((s) => {
          if (s.requirementCode !== code || s.status !== "Validated")
            return false;
          const matchTerm =
            normalizeSemester(s.semester) === normActiveSem &&
            normalizeAcademicYear(s.academicYear) === normActiveAY;
          if (!matchTerm) return false;
          const sClass = (s as any).classId || (s as any).class_id;
          return sClass === cls.id;
        });
        if (hasValidatedInPast) return true;

        const hasValidatedInLive = requirementStatuses.some((r) => {
          if (r.code !== code) return false;
          if (r.status !== "Validated" && r.status !== "Exempted") return false;
          const rClass = (r as any).classId || (r as any).class_id;
          return rClass === cls.id;
        });
        if (hasValidatedInLive) return true;

        const cached =
          classStatusesCacheRef.current[`${cls.id}_${activeAY}_${activeSem}`] ||
          classStatusesCacheRef.current[cls.id] ||
          [];
        return cached.some((r) => {
          if (r.code !== code) return false;
          return r.status === "Validated" || r.status === "Exempted";
        });
      });
    });
  }, [
    facultyClasses,
    activeAY,
    activeSem,
    mandatoryTemplates,
    pastSubmissions,
    requirementStatuses,
  ]);

  const isAllValidated = selectedClassId
    ? isSelectedClassAllValidated
    : isAllClassesValidated;

  // True strictly when the API explicitly reports an active personal deadline or grace period
  const now = Date.now();
  const hasActiveGracePeriod =
    Boolean(submissionWindow?.isGracePeriod) &&
    Boolean(submissionWindow?.isPersonalDeadline) &&
    Boolean(submissionWindow?.isOpen);

  const isWindowConfigured =
    Boolean(submissionWindow?.isConfigured) || hasActiveSchedule || hasActiveGracePeriod;
  const isSubmissionAvailable =
    !isLoadingSubmissionWindow &&
    (Boolean(submissionWindow?.isOpen) || hasActiveSchedule || hasActiveGracePeriod);
  // Only considered closed if a schedule was actually configured in the database and not open
  const isWindowClosed =
    isWindowConfigured &&
    !Boolean(submissionWindow?.isOpen) &&
    !hasActiveSchedule &&
    !hasActiveGracePeriod;
  // True when admin has not configured any schedule (e.g. schedules deleted from database) and no personal deadline
  const isWindowNotConfigured =
    !isLoadingSubmissionWindow && !isWindowConfigured && !hasActiveGracePeriod;

  const earliestGracePeriodDeadline = hasActiveGracePeriod
    ? (displayedRequirementStatuses
        .map((r) => {
          const due = (r as any).due_at || (r as any).customDueDate;
          if (!due) return null;
          const dueIso = due.includes("T") ? due : `${due}T23:59:59+08:00`;
          const ms = new Date(dueIso).getTime();
          return !Number.isNaN(ms) && now <= ms ? new Date(dueIso) : null;
        })
        .filter(Boolean)
        .sort(
          (a, b) => (a as Date).getTime() - (b as Date).getTime(),
        )[0] as Date | null) ||
      (submissionWindow?.effectiveDeadline
        ? new Date(submissionWindow.effectiveDeadline)
        : null) ||
      (submissionWindow?.endDate
        ? new Date(`${submissionWindow.endDate}T23:59:59+08:00`)
        : null)
    : null;

  const gracePeriodDeadlineLabel = earliestGracePeriodDeadline
    ? earliestGracePeriodDeadline.toLocaleDateString("en-PH", {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "Asia/Manila",
      })
    : null;

  const personalDeadlineFormatted =
    submissionWindow?.formattedDueAt ||
    (gracePeriodDeadlineLabel
      ? `${gracePeriodDeadlineLabel} at 11:59 PM`
      : null) ||
    (submissionWindow?.endDate
      ? `${submissionWindow.endDate} at 11:59 PM`
      : null);

  const isEffectivelyOpen = isSubmissionAvailable || hasActiveGracePeriod;

  const effectiveSubmissionWindow = useMemo(() => {
    if (
      isSubmissionAvailable &&
      submissionWindow?.isOpen &&
      !submissionWindow?.isGracePeriod &&
      !submissionWindow?.isPersonalDeadline
    ) {
      return submissionWindow;
    }
    if (hasActiveGracePeriod && earliestGracePeriodDeadline) {
      const iso = earliestGracePeriodDeadline.toISOString();
      const datePart = iso.split("T")[0];
      return {
        isConfigured: true,
        isOpen: true,
        status: "Open" as const,
        today: getTodayInManila(),
        currentTime: getCurrentTimeInManila(),
        startDate: submissionWindow?.startDate || getTodayInManila(),
        endDate: datePart,
        startTime: "00:00:00",
        endTime: "23:59:59",
        academicYear:
          statusAcademicYear || submissionWindow?.academicYear || null,
        semester: (statusSemester || submissionWindow?.semester || null) as any,
        startTimeLabel: "12:00 AM",
        endTimeLabel: "11:59 PM",
        currentTimeLabel: format24HourTo12Hour(getCurrentTimeInManila()),
        isGracePeriod: true,
        isPersonalDeadline: true,
        badgeLabel: "Schedule Extension Active",
        effectiveDeadline: iso,
        formattedDueAt: personalDeadlineFormatted,
      };
    }
    if (
      submissionWindow?.isGracePeriod ||
      submissionWindow?.isPersonalDeadline
    ) {
      return {
        ...submissionWindow,
        isConfigured: true,
        isOpen: true,
        status: "Open" as const,
        badgeLabel: "Schedule Extension Active",
      };
    }
    if (!submissionWindow || !submissionWindow.isConfigured) {
      if (hasActiveSchedule) {
        return {
          isConfigured: true,
          isOpen: true,
          status: "Open" as const,
          today: getTodayInManila(),
          currentTime: getCurrentTimeInManila(),
          startDate: getTodayInManila(),
          endDate: getTodayInManila(),
          startTime: "00:00:00",
          endTime: "23:59:59",
          academicYear: statusAcademicYear || null,
          semester: (statusSemester || null) as any,
        };
      }
      return {
        isConfigured: false,
        isOpen: false,
        status: "Closed" as const,
        today: getTodayInManila(),
        currentTime: getCurrentTimeInManila(),
        startDate: null,
        endDate: null,
        startTime: null,
        endTime: null,
        academicYear: statusAcademicYear || null,
        semester: (statusSemester || null) as any,
      };
    }
    return {
      ...submissionWindow,
      isOpen: false,
      status: "Closed" as const,
    };
  }, [
    isSubmissionAvailable,
    submissionWindow,
    hasActiveGracePeriod,
    earliestGracePeriodDeadline,
    statusAcademicYear,
    statusSemester,
    personalDeadlineFormatted,
  ]);

  // Lacking requirements only count mandatory requirements that are unsubmitted or rejected
  const lackingRequirements = useMemo(() => {
    if (isAllValidated) return [];
    return displayedRequirementStatuses
      .filter((r) => {
        const isMandatory = templateMandatoryMap.get(r.code) !== false;
        // Optional and Exempted requirements are NOT lackings!
        if (!isMandatory) return false;
        if (r.status === "Validated" || r.status === "Exempted") return false;
        return true;
      })
      .map((r) => ({
        code: r.code,
        status: (r.status as any) || "Pending",
        label: getRequirementTitle(r.code),
        adminRemarks: r.adminRemarks || r.admin_remarks || r.feedback,
      }));
  }, [
    displayedRequirementStatuses,
    templateMandatoryMap,
    getRequirementTitle,
    isAllValidated,
  ]);

  const hasLackings = !isAllValidated && lackingRequirements.length > 0;

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
          let isPending = Boolean(data.hasPendingRequest);
          let pendingReq = data.pendingRequest;

          // If the global schedule was opened/updated after the request was created, or if the window has now expired/closed
          if (isPending && pendingReq) {
            const reqTime = pendingReq.created_at
              ? new Date(pendingReq.created_at).getTime()
              : 0;
            const windowStartTime = submissionWindow?.startDate
              ? new Date(`${submissionWindow.startDate}T00:00:00+08:00`).getTime()
              : 0;
            const windowEndTime = submissionWindow?.endDate
              ? new Date(
                  `${submissionWindow.endDate}T${submissionWindow.endTime || "23:59:59"}+08:00`,
                ).getTime()
              : 0;

            if (
              (windowStartTime > 0 && reqTime < windowStartTime) ||
              (windowEndTime > 0 && Date.now() >= windowEndTime && reqTime <= windowEndTime)
            ) {
              isPending = false;
              pendingReq = null;
            }
          }

          setHasPendingExtensionRequest(isPending);
          setPendingExtensionData(
            isPending ? pendingReq : (data.latestRequest || null),
          );
          setLatestApprovedExtension(data.latestApprovedRequest || null);
          setAllExtensionRequests(
            Array.isArray(data.requests) ? data.requests : [],
          );
          if (
            (data.isApproved ||
              data.latestApprovedRequest ||
              data.latestRequest?.status === "approved") &&
            !submissionWindow?.isOpen
          ) {
            void refetchSubmissionWindow();
          }
        }
      } catch {
        // safe
      }
    }
    void checkPendingExtension();
  }, [
    isMounted,
    activeAY,
    activeSem,
    refetchSubmissionWindow,
    submissionWindow?.startDate,
    submissionWindow?.endDate,
    submissionWindow?.endTime,
    submissionWindow?.isOpen,
  ]);

  useEffect(() => {
    if (
      isMounted &&
      isAllClassesValidated &&
      !isTermResetAcknowledged &&
      !hasPromptedTermCompletion
    ) {
      setHasPromptedTermCompletion(true);
      const timer = setTimeout(() => setIsTermCompletionModalOpen(true), 1200);
      return () => clearTimeout(timer);
    }
  }, [
    isMounted,
    isAllClassesValidated,
    isTermResetAcknowledged,
    hasPromptedTermCompletion,
  ]);

  function openExtensionRequestModal(code?: RequirementCode | string) {
    if (!isWindowConfigured) return;
    if (code) {
      const match = displayedRequirementStatuses.find((r) => r.code === code);
      if (match?.status === "Exempted") return;
    }
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
          setPendingExtensionData(
            data.pendingRequest || data.latestRequest || null,
          );
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
    if (submissionWindow.endDate.startsWith("2099"))
      return "Always Open (No Deadline)";
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
      !isAllValidated &&
      lackingRequirements.length > 0
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
    isAllValidated,
    lackingRequirements.length,
  ]);
  const showIncompleteRequirementsModal = isMounted && isRequirementAlertOpen;
  function openDirectUploadModal(
    code: RequirementCode | string,
    isRevision: boolean = false,
  ) {
    if (selectedClass?.is_archived) {
      alert(
        "This class load is archived and locked. Please unarchive it before uploading or modifying documents.",
      );
      return;
    }
    const matched = displayedRequirementStatuses.find((r) => r.code === code);
    const currentStatus = matched?.status || getRequirementStatus(code);
    if (currentStatus === "Validated" || currentStatus === "Exempted") return;
    if (currentStatus === "Overdue" && !matched?.isExtended) return;
    if (!isEffectivelyOpen && !matched?.isExtended && !matched?.customDueDate)
      return;
    setSelectedRequirementForUpload(code);
    setIsRevisionUpload(isRevision);
    setDirectUploadFile(null);
    setDirectUploadRemarks("");
    setDirectUploadMessage(null);

    // Refresh active templates immediately so any recent change in admin is active
    fetch("/api/staff/requirement-templates?active=true", {
      cache: "no-store",
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.templates)
            ? data.templates
            : Array.isArray(data?.requirementTemplates)
              ? data.requirementTemplates
              : [];
        setRequirementTemplates(
          list
            .filter((t: any) => t.is_active !== false)
            .map((t: any) => ({
              code: t.code,
              title: t.title,
              is_mandatory: t.is_mandatory !== false,
              is_active: t.is_active !== false,
              max_size_mb: t.max_size_mb ? Number(t.max_size_mb) : 50,
              allowed_formats:
                Array.isArray(t.allowed_formats) && t.allowed_formats.length > 0
                  ? t.allowed_formats
                  : ["PDF", "DOCX", "XLSX", "PNG", "JPG", "ZIP"],
            })),
        );
        setIsTemplatesFetched(true);
      })
      .catch(() => {});
  }
  function closeDirectUploadModal() {
    setSelectedRequirementForUpload(null);
    setIsRevisionUpload(false);
    setDirectUploadFile(null);
    setDirectUploadRemarks("");
    setDirectUploadMessage(null);
    setDirectUploadPercent(0);
  }

  async function executeBackgroundUpload({
    taskId,
    file,
    requirementCode,
    requirementTitle,
    remarks,
    isRevision,
    classId,
    academicYear,
    semester,
  }: {
    taskId: string;
    file: File;
    requirementCode: string;
    requirementTitle: string;
    remarks: string;
    isRevision: boolean;
    classId: string | null;
    academicYear: string;
    semester: string;
  }) {
    let progressTimer: NodeJS.Timeout | null = null;
    let currentProgress = 15;

    const setTaskProgress = (percent: number) => {
      setUploadTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, progress: Math.max(t.progress, percent) }
            : t,
        ),
      );
    };

    // Smooth ticker for responsive visual feedback
    progressTimer = setInterval(() => {
      currentProgress = Math.min(
        94,
        currentProgress + Math.floor(Math.random() * 8 + 4),
      );
      setTaskProgress(currentProgress);
    }, 180);

    try {
      let result: { submissionId: string } = { submissionId: "" };
      let directUploadSucceeded = false;

      // 1. Try direct-to-storage signed URL upload first
      try {
        const urlRes = await fetch("/api/faculty/submissions/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            requirementCode,
            fileSize: file.size,
          }),
        });

        if (urlRes.ok) {
          const urlData = await urlRes.json();
          if (urlData?.path && urlData?.token) {
            const supabase = createClient();
            const { error: storageErr } = await supabase.storage
              .from("faculty-submissions")
              .uploadToSignedUrl(urlData.path, urlData.token, file, {
                contentType: file.type || "application/octet-stream",
              });

            if (storageErr) {
              throw new Error(
                storageErr.message || "Failed to upload file to storage.",
              );
            }

            const createRes = await fetch("/api/faculty/submissions/create", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                storagePath: urlData.storagePath,
                fileName: file.name,
                fileSize: file.size,
                mimeType: file.type || "application/octet-stream",
                academicYear,
                semester,
                requirementCode,
                remarks,
                class_id: classId,
                classId,
              }),
            });

            if (!createRes.ok) {
              const errData = await createRes.json().catch(() => ({}));
              throw new Error(
                errData.error ||
                  `Failed to submit requirement (HTTP ${createRes.status})`,
              );
            }

            result = await createRes.json();
            directUploadSucceeded = true;
          }
        }
      } catch (directErr) {
        console.warn(
          "Direct signed upload fallback to standard POST:",
          directErr,
        );
      }

      // 2. Standard XHR fallback with real progress
      if (!directUploadSucceeded) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("academicYear", academicYear);
        formData.append("semester", semester);
        formData.append("requirementCode", requirementCode);
        formData.append("requirement_type", requirementCode);
        formData.append("remarks", remarks);
        formData.append("notes", remarks);
        if (classId) {
          formData.append("class_id", classId);
          formData.append("classId", classId);
        }

        result = await new Promise<{ submissionId: string }>(
          (resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("POST", "/api/faculty/submissions/create");

            xhr.upload.onprogress = (event) => {
              if (event.lengthComputable && event.total > 0) {
                const rawPercent = Math.min(
                  95,
                  Math.round((event.loaded / event.total) * 95),
                );
                setTaskProgress(rawPercent);
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
              } else if (xhr.status === 413) {
                reject(
                  new Error(
                    "File size exceeds server upload limit (HTTP 413 Payload Too Large).",
                  ),
                );
              } else {
                try {
                  const err = JSON.parse(xhr.responseText);
                  reject(
                    new Error(
                      err.error ||
                        `Failed to submit requirement (HTTP ${xhr.status})`,
                    ),
                  );
                } catch {
                  reject(
                    new Error(
                      `Failed to submit requirement (HTTP ${xhr.status})`,
                    ),
                  );
                }
              }
            };

            xhr.onerror = () =>
              reject(new Error("Network error during document upload"));
            xhr.onabort = () => reject(new Error("Upload cancelled"));

            xhr.send(formData);
          },
        );
      }

      if (progressTimer) clearInterval(progressTimer);

      // Mark task as done (100%)
      setUploadTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, progress: 100, status: "done" } : t,
        ),
      );

      // Update requirement statuses with real submission ID
      const nowIso = new Date().toISOString();
      setRequirementStatuses((prev) => {
        const exists = prev.some((r) => r.code === requirementCode);
        const updated = exists
          ? prev.map((r) =>
              r.code === requirementCode
                ? {
                    ...r,
                    status: "Pending" as const,
                    submittedAt: nowIso,
                    latestSubmissionId: result.submissionId,
                    fileName: file.name,
                    isRevision: isRevision || Boolean(r.feedback),
                    hasPriorRevision: true,
                    classId,
                    class_id: classId,
                  }
                : r,
            )
          : [
              ...prev,
              {
                code: requirementCode,
                status: "Pending" as const,
                submittedAt: nowIso,
                latestSubmissionId: result.submissionId,
                fileName: file.name,
                isRevision,
                hasPriorRevision: isRevision,
                classId,
                class_id: classId,
              } as RequirementStatus,
            ];
        if (classId) {
          classStatusesCacheRef.current[classId] = updated;
        }
        return updated;
      });

      setPastSubmissions((prev) => {
        const filtered = prev.filter(
          (s) =>
            !(
              s.requirementCode === requirementCode &&
              ((s as any).classId || (s as any).class_id) === classId
            ),
        );
        return [
          {
            id: result.submissionId || `temp-${taskId}`,
            academicYear,
            semester: semester as "1st Semester" | "2nd Semester",
            requirementCode,
            status: "Pending",
            submittedAt: nowIso,
            fileName: file.name,
            note: remarks || undefined,
            remarks: remarks || undefined,
            classId: classId || undefined,
            class_id: classId || undefined,
          } as PastSubmission,
          ...filtered,
        ];
      });

      // Background sync
      emitRealtimeSync({
        source: "submission-uploaded",
        table: "submissions",
        classId,
        requirementCode,
        timestamp: Date.now(),
      });
      router.refresh();
      void fetchStatuses(academicYear, semester, classId, { silent: true });
      void fetchHistory({ silent: true });
    } catch (error) {
      if (progressTimer) clearInterval(progressTimer);
      const errMsg =
        error instanceof Error ? error.message : "An unexpected error occurred";
      setUploadTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status: "error",
                errorMessage: errMsg,
              }
            : t,
        ),
      );
    } finally {
      if (progressTimer) clearInterval(progressTimer);
    }
  }

  async function handleDirectUploadSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (selectedClass?.is_archived) {
      setDirectUploadMessage(
        "This class load is archived and locked. Unarchive it before uploading documents.",
      );
      return;
    }
    if (!selectedRequirementForUpload || !directUploadFile) {
      setDirectUploadMessage("Please select a file to submit.");
      return;
    }
    const reqCodeClean = (selectedRequirementForUpload || "")
      .toLowerCase()
      .trim()
      .replace(/[-_\s]+/g, "");
    const currentTemplate =
      activeTemplates.find((t) => t.code === selectedRequirementForUpload) ||
      activeTemplates.find(
        (t) =>
          t.code.toLowerCase().trim() ===
          (selectedRequirementForUpload || "").toLowerCase().trim(),
      ) ||
      activeTemplates.find(
        (t) =>
          t.code
            .toLowerCase()
            .trim()
            .replace(/[-_\s]+/g, "") === reqCodeClean,
      ) ||
      activeTemplates.find(
        (t) =>
          t.title.toLowerCase().trim() ===
          (selectedRequirementForUpload || "").toLowerCase().trim(),
      ) ||
      activeTemplates.find(
        (t) =>
          t.title
            .toLowerCase()
            .trim()
            .replace(/[-_\s]+/g, "") === reqCodeClean,
      );

    const maxAllowedMb = currentTemplate?.max_size_mb
      ? Number(currentTemplate.max_size_mb)
      : 50;
    if (directUploadFile.size > maxAllowedMb * 1024 * 1024) {
      setDirectUploadMessage(`File size exceeds ${maxAllowedMb}MB limit.`);
      return;
    }

    const targetFile = directUploadFile;
    const targetReqCode = selectedRequirementForUpload;
    const targetReqTitle =
      currentTemplate?.title ||
      getFriendlyRequirementName(selectedRequirementForUpload) ||
      selectedRequirementForUpload;
    const targetRemarks = directUploadRemarks;
    const isRev = isRevisionUpload;
    const targetClassId = selectedClassId;
    const taskId = `upload-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const activeAY =
      currentAcademicTerm?.academic_year ||
      submissionWindow?.academicYear ||
      selectedAcademicYear ||
      form.academicYear ||
      "2026-2027";
    const activeSem =
      currentAcademicTerm?.semester ||
      submissionWindow?.semester ||
      selectedSemester ||
      form.semester ||
      "2nd Semester";

    // Immediately close modal so user can upload other documents without waiting
    closeDirectUploadModal();

    // Register upload task with initial progress
    setUploadTasks((prev) => [
      {
        id: taskId,
        requirementCode: targetReqCode,
        requirementTitle: targetReqTitle,
        fileName: targetFile.name,
        fileSize: targetFile.size,
        progress: 10,
        status: "uploading",
        isRevision: isRev,
        classId: targetClassId,
        startedAt: Date.now(),
        file: targetFile,
        remarks: targetRemarks,
        academicYear: activeAY,
        semester: activeSem,
      },
      ...prev,
    ]);
    setIsUploadSectionVisible(true);

    // Optimistically update requirement status to Pending immediately
    const optimisticIso = new Date().toISOString();
    setRequirementStatuses((prev) => {
      const exists = prev.some((r) => r.code === targetReqCode);
      const updated = exists
        ? prev.map((r) =>
            r.code === targetReqCode
              ? {
                  ...r,
                  status: "Pending" as const,
                  submittedAt: optimisticIso,
                  fileName: targetFile.name,
                  isRevision: isRev || Boolean(r.feedback),
                  hasPriorRevision: true,
                  classId: targetClassId,
                  class_id: targetClassId,
                }
              : r,
          )
        : [
            ...prev,
            {
              code: targetReqCode,
              status: "Pending" as const,
              submittedAt: optimisticIso,
              fileName: targetFile.name,
              isRevision: isRev,
              hasPriorRevision: isRev,
              classId: targetClassId,
              class_id: targetClassId,
            } as RequirementStatus,
          ];
      if (targetClassId) {
        classStatusesCacheRef.current[targetClassId] = updated;
      }
      return updated;
    });

    setPastSubmissions((prev) => {
      const filtered = prev.filter(
        (s) =>
          !(
            s.requirementCode === targetReqCode &&
            ((s as any).classId || (s as any).class_id) === targetClassId
          ),
      );
      return [
        {
          id: `temp-${taskId}`,
          academicYear: activeAY,
          semester: activeSem as "1st Semester" | "2nd Semester",
          requirementCode: targetReqCode,
          status: "Pending",
          submittedAt: optimisticIso,
          fileName: targetFile.name,
          note: targetRemarks || undefined,
          remarks: targetRemarks || undefined,
          classId: targetClassId || undefined,
          class_id: targetClassId || undefined,
        } as PastSubmission,
        ...filtered,
      ];
    });

    // Execute upload in background
    void executeBackgroundUpload({
      taskId,
      file: targetFile,
      requirementCode: targetReqCode,
      requirementTitle: targetReqTitle,
      remarks: targetRemarks,
      isRevision: isRev,
      classId: targetClassId,
      academicYear: activeAY,
      semester: activeSem,
    });
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
      item.note || (item as { notes?: string }).notes || item.remarks || null;
    const fileName =
      item.fileName ||
      item.storagePath ||
      (item as { file_name?: string }).file_name ||
      (item as { original_name?: string }).original_name ||
      undefined;
    const activeAY =
      currentAcademicTerm?.academic_year ||
      submissionWindow?.academicYear ||
      selectedAcademicYear ||
      form.academicYear ||
      "2026-2027";
    const activeSem =
      currentAcademicTerm?.semester ||
      submissionWindow?.semester ||
      selectedSemester ||
      form.semester ||
      "2nd Semester";
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
      submission.note ||
      (submission as { notes?: string }).notes ||
      submission.remarks ||
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
      if (isLoadingSubmissionWindow || !isEffectivelyOpen) {
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
      let result: any = null;
      let directUploadDone = false;

      try {
        const urlRes = await fetch("/api/faculty/submissions/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            requirementCode: form.requirementCode,
            fileSize: file.size,
          }),
        });

        if (urlRes.ok) {
          const urlData = await urlRes.json();
          if (urlData?.path && urlData?.token) {
            const supabase = createClient();
            const { error: storageErr } = await supabase.storage
              .from("faculty-submissions")
              .uploadToSignedUrl(urlData.path, urlData.token, file, {
                contentType: file.type || "application/octet-stream",
              });

            if (storageErr) {
              throw new Error(
                storageErr.message || "Failed to upload file to storage.",
              );
            }

            const createRes = await fetch("/api/faculty/submissions/create", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                storagePath: urlData.storagePath,
                fileName: file.name,
                fileSize: file.size,
                mimeType: file.type || "application/octet-stream",
                academicYear: form.academicYear,
                semester: form.semester,
                requirementCode: form.requirementCode,
                remarks: form.remarks,
                class_id: selectedClassId,
                classId: selectedClassId,
              }),
            });

            if (!createRes.ok) {
              const errorData = await createRes.json().catch(() => ({}));
              throw new Error(
                errorData.error ||
                  `Failed to submit requirement (HTTP ${createRes.status})`,
              );
            }

            result = await createRes.json();
            directUploadDone = true;
          }
        }
      } catch (directErr) {
        console.warn("Direct upload fallback:", directErr);
      }

      if (!directUploadDone) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("academicYear", form.academicYear);
        formData.append("semester", form.semester);
        formData.append("requirementCode", form.requirementCode);
        formData.append("remarks", form.remarks);
        if (selectedClassId) {
          formData.append("class_id", selectedClassId);
          formData.append("classId", selectedClassId);
        }
        const response = await fetch("/api/faculty/submissions/create", {
          method: "POST",
          body: formData,
        });
        if (!response.ok) {
          if (response.status === 413) {
            setSubmissionMessage(
              "Error: File size exceeds server upload limit (HTTP 413 Payload Too Large). Please ensure the file is under the allowed limit.",
            );
          } else {
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
          }
          return;
        }
        result = await response.json();
      }
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
      emitRealtimeSync({
        source: "submission-uploaded",
        table: "submissions",
        classId: selectedClassId,
        requirementCode: form.requirementCode,
        timestamp: Date.now(),
      });
      await Promise.all([
        fetchStatuses(activeAY, activeSem, selectedClassId, { silent: true }),
        fetchHistory({ silent: true }),
      ]);
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

  const handleRetryTask = (task: BackgroundUploadTask) => {
    if (!task.file) {
      openDirectUploadModal(task.requirementCode, Boolean(task.isRevision));
      return;
    }

    setUploadTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? {
              ...t,
              status: "uploading" as const,
              progress: 15,
              errorMessage: undefined,
            }
          : t,
      ),
    );

    void executeBackgroundUpload({
      taskId: task.id,
      file: task.file,
      requirementCode: task.requirementCode,
      requirementTitle: task.requirementTitle,
      remarks: task.remarks || "",
      isRevision: Boolean(task.isRevision),
      classId: task.classId ?? null,
      academicYear:
        task.academicYear ||
        currentAcademicTerm?.academic_year ||
        submissionWindow?.academicYear ||
        selectedAcademicYear ||
        form.academicYear ||
        "2026-2027",
      semester:
        task.semester ||
        currentAcademicTerm?.semester ||
        submissionWindow?.semester ||
        selectedSemester ||
        form.semester ||
        "2nd Semester",
    });
  };

  const renderUploadNotificationSection = () => {
    const classUploadTasks = selectedClassId
      ? uploadTasks.filter((t) => t.classId === selectedClassId)
      : uploadTasks;

    if (!isUploadSectionVisible) {
      return (
        <div className="my-2 flex items-center justify-start">
          <button
            type="button"
            onClick={() => setIsUploadSectionVisible(true)}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-950 dark:text-amber-100 text-xs font-extrabold shadow-xs transition cursor-pointer active:scale-95"
            title="Show document upload progress and status"
          >
            <div className="p-1 rounded-md bg-amber-500 text-slate-950 font-bold shrink-0">
              <AppIcon icon={CloudUpload} size="xs" color="inherit" />
            </div>
            <span>Document Upload Progress & Status</span>
            {classUploadTasks.some((t) => t.status === "uploading") && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500 text-slate-950 animate-pulse shrink-0">
                <AppIcon
                  icon={SystemRestart}
                  size="xs"
                  color="inherit"
                  className="animate-spin"
                />
                (
                {
                  classUploadTasks.filter((t) => t.status === "uploading")
                    .length
                }
                )
              </span>
            )}
            {classUploadTasks.some((t) => t.status === "error") && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#780000] text-white shrink-0">
                <AppIcon icon={WarningCircle} size="xs" color="inherit" />
                {
                  classUploadTasks.filter((t) => t.status === "error").length
                }{" "}
                Failed
              </span>
            )}
            {classUploadTasks.length > 0 ? (
              <span className="text-[11px] text-slate-600 dark:text-slate-400 font-semibold shrink-0">
                ({classUploadTasks.filter((t) => t.status === "done").length}/
                {classUploadTasks.length} Done)
              </span>
            ) : (
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium shrink-0">
                (0 Active)
              </span>
            )}
            <AppIcon
              icon={NavArrowRight}
              size="xs"
              color="inherit"
              className="ml-0.5 text-slate-500 dark:text-slate-400"
            />
          </button>
        </div>
      );
    }

    return (
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm space-y-3 transition-all my-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500 text-slate-950 font-bold shadow-xs">
              <AppIcon icon={CloudUpload} size="sm" color="inherit" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-950 dark:text-amber-100 flex items-center gap-2">
                Document Upload Progress & Status
                {classUploadTasks.some((t) => t.status === "uploading") && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-slate-950 animate-pulse">
                    <AppIcon
                      icon={SystemRestart}
                      size="xs"
                      color="inherit"
                      className="animate-spin"
                    />
                    Uploading in background
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                Files upload in the background so you can continue submitting
                other documents without waiting.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => setIsUploadSectionVisible(false)}
              className="text-xs font-extrabold px-3 py-1.5 rounded-xl border border-amber-600 bg-amber-500 hover:bg-amber-400 text-slate-950 transition cursor-pointer shadow-xs active:scale-95 inline-flex items-center gap-1.5"
              title="Hide document upload progress section"
            >
              <AppIcon icon={Minus} size="xs" color="inherit" />
              <span>Hide</span>
            </button>
            {classUploadTasks.some(
              (t) => t.status === "done" || t.status === "error",
            ) && (
              <button
                type="button"
                onClick={() =>
                  setUploadTasks((prev) =>
                    prev.filter(
                      (t) =>
                        (selectedClassId && t.classId !== selectedClassId) ||
                        t.status === "uploading",
                    ),
                  )
                }
                className="text-xs font-extrabold px-3 py-1.5 rounded-xl border border-[#5e0000] bg-[#780000] hover:bg-[#5e0000] text-white transition cursor-pointer shadow-xs active:scale-95"
              >
                Clear Completed
              </button>
            )}
          </div>
        </div>

        {/* Task items list or empty state */}
        {classUploadTasks.length === 0 ? (
          <div className="p-5 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-950/40 text-center space-y-1">
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
              No Active Document Uploads
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              When you submit compliance documents, real-time percentage
              progress and completion status will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {classUploadTasks.map((task) => (
              <div
                key={task.id}
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border transition-all ${
                  task.status === "done"
                    ? "bg-[#0b5336]/10 border-[#0b5336]/30 dark:bg-[#0b5336]/20 dark:border-[#0b5336]/40"
                    : task.status === "error"
                      ? "bg-[#780000]/10 border-[#780000]/30 dark:bg-[#780000]/20 dark:border-[#780000]/40"
                      : "bg-white dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 shadow-2xs"
                }`}
              >
                <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                  <div
                    className={`p-2 rounded-xl shrink-0 ${
                      task.status === "done"
                        ? "bg-[#0b5336] text-white"
                        : task.status === "error"
                          ? "bg-[#780000] text-white"
                          : "bg-amber-500 text-slate-950"
                    }`}
                  >
                    <AppIcon
                      icon={
                        task.status === "done"
                          ? CheckCircle
                          : task.status === "error"
                            ? WarningCircle
                            : CloudUpload
                      }
                      size="sm"
                      color="inherit"
                      className={
                        task.status === "uploading" ? "animate-pulse" : ""
                      }
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 truncate">
                        {task.requirementTitle}
                      </span>
                      {task.isRevision && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-500/20 text-amber-900 dark:text-amber-200 border border-amber-500/30">
                          Revision
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {task.fileName} •{" "}
                      {(task.fileSize / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto shrink-0 justify-between sm:justify-end">
                  {task.status === "uploading" && (
                    <div className="flex items-center gap-3 w-full sm:w-56">
                      <div className="flex-1 h-2.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber-500 to-amber-600 rounded-full transition-all duration-200"
                          style={{ width: `${task.progress}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-amber-700 dark:text-amber-300 w-12 text-right">
                        {task.progress}%
                      </span>
                    </div>
                  )}
                  {task.status === "done" && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0b5336] text-white text-xs font-bold shadow-xs">
                      <AppIcon icon={CheckCircle} size="xs" color="inherit" />
                      Done (100%)
                    </span>
                  )}
                  {task.status === "error" && (
                    <div className="flex items-center gap-1.5">
                      <span
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#780000] text-white text-xs font-bold shadow-xs"
                        title={task.errorMessage}
                      >
                        <AppIcon
                          icon={WarningCircle}
                          size="xs"
                          color="inherit"
                        />
                        Failed
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRetryTask(task)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 text-xs font-extrabold shadow-xs transition cursor-pointer"
                        title="Retry upload"
                      >
                        <AppIcon
                          icon={SystemRestart}
                          size="xs"
                          color="inherit"
                        />
                        <span>Retry</span>
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      setUploadTasks((prev) =>
                        prev.filter((t) => t.id !== task.id),
                      )
                    }
                    className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                    title="Dismiss"
                  >
                    <AppIcon icon={Xmark} size="xs" color="inherit" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="relative flex min-h-full md:h-full w-full items-stretch gap-0">
      {/* ─── Initial page-load overlay ─────────────────────────────── */}
      {isPageLoading && (
        <SystemLoadingScreen text="Loading faculty academic portal..." />
      )}
      {/* Mobile Menu Button (visible only on small screens when drawer is closed) */}
      {!isMobileMenuOpen && (
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(true)}
          className="fixed left-3 top-2 z-[45] md:hidden inline-flex h-9 w-9 items-center justify-center rounded-xl border border-amber-400 bg-[#680000] hover:bg-[#550000] text-amber-100 hover:text-white transition-all focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer shadow-xs"
          aria-label="Open Navigation Menu"
        >
          <AppIcon icon={Menu} size="md" color="inherit" />
        </button>
      )}
      {/* Desktop Sidebar (hidden on mobile) */}
      <aside
        className={`hidden md:flex md:flex-col fixed left-0 top-0 h-screen ${
          isSidebarCollapsed ? "w-20" : "w-72"
        } rounded-none bg-[#800000] text-amber-50 shadow-md z-50 transition-all duration-200`}
      >
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3.5 flex flex-col">
          {/* Brand Header */}
          <div
            className={`flex ${
              isSidebarCollapsed
                ? "flex-col items-center gap-2 px-0 py-1 pb-3"
                : "items-center justify-between gap-2 px-1 py-1 pb-3"
            } mb-1 border-b border-white/10 shrink-0`}
          >
            <div
              className={`flex items-center ${
                isSidebarCollapsed ? "justify-center" : "gap-2.5 min-w-0"
              }`}
            >
              <BrandMark size={isSidebarCollapsed ? 32 : 38} className="shrink-0" />
              {!isSidebarCollapsed && (
                <div className="flex flex-col min-w-0">
                  <span className="font-extrabold text-white text-lg tracking-tight whitespace-nowrap leading-tight">
                    <span className="text-amber-400">PUP</span> FOCUS
                  </span>
                  <span className="text-[10px] text-amber-200/80 font-medium tracking-wide truncate">
                    Bataan Campus
                  </span>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={toggleSidebarCollapsed}
              title={isSidebarCollapsed ? "Expand side panel" : "Minimize side panel"}
              aria-label={isSidebarCollapsed ? "Expand side panel" : "Minimize side panel"}
              className="group inline-flex h-8 w-8 items-center justify-center rounded-lg border border-amber-300/50 bg-[#660000]/90 hover:bg-white/15 text-amber-300 hover:text-white transition-colors cursor-pointer shadow-2xs shrink-0"
            >
              {isSidebarCollapsed ? (
                <SidebarExpand strokeWidth={2.2} className="h-4 w-4 text-amber-300 group-hover:text-white transition-colors" />
              ) : (
                <SidebarCollapse strokeWidth={2.2} className="h-4 w-4 text-amber-300 group-hover:text-white transition-colors" />
              )}
            </button>
          </div>

          <div className="my-1.5">
            <SidebarProfileCard
              name={facultyFirstName}
              roleTitle="Faculty"
              avatarUrl={currentAvatarUrl}
              initials={facultyInitials}
              onClick={() => navigateToView("settings")}
              collapsed={isSidebarCollapsed}
            />
          </div>
          <div className="my-2.5 h-px w-full bg-white/10" />
          <div className="my-1.5">
            <SubmissionWindowCountdown
              window={effectiveSubmissionWindow}
              isLoading={isLoadingSubmissionWindow}
              onExpired={handleWindowExpired}
              isAllValidated={isAllClassesValidated}
              collapsed={isSidebarCollapsed}
            />
          </div>
          <div className="my-2.5 h-px w-full bg-white/10" />
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
                  title={isSidebarCollapsed ? label : undefined}
                  aria-label={isSidebarCollapsed ? label : undefined}
                  className={`relative flex w-full items-center ${
                    isSidebarCollapsed
                      ? "justify-center px-0 py-3"
                      : "gap-3 px-4 py-3 text-left"
                  } text-sm font-medium transition-colors cursor-pointer rounded-lg ${
                    isActive
                      ? "bg-amber-500 text-slate-900 font-bold shadow-sm"
                      : "text-amber-100/80 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon
                    strokeWidth={isActive ? 2.5 : 2}
                    className={`h-5 w-5 shrink-0 ${
                      isActive ? "text-slate-900" : "text-amber-200/70"
                    }`}
                  />
                  {!isSidebarCollapsed && (
                    <span className="truncate">{label}</span>
                  )}
                  {!isSidebarCollapsed &&
                    key === "status" &&
                    isAllClassesValidated && (
                      <span className="ml-auto inline-flex items-center px-2 py-0.5 rounded-full bg-[#0b5336] text-[10px] font-bold text-white shadow-2xs">
                        Done
                      </span>
                    )}
                  {isSidebarCollapsed &&
                    key === "status" &&
                    isAllClassesValidated && (
                      <span
                        title="Done"
                        className="absolute top-1.5 right-2 h-2 w-2 rounded-full bg-emerald-400"
                      />
                    )}
                </button>
              );
            })}
          </nav>
        </div>
        {/* Amber vertical border that starts at the top edge of the header's bottom border (y=52px) to form a seamless 90-degree corner */}
        <div className="absolute right-0 top-[calc(3.5rem-4px)] bottom-0 w-1 bg-amber-500 pointer-events-none" />
      </aside>
      {/* Mobile Drawer (visible only on small screens when drawer is open) */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-[60] h-dvh overflow-hidden overscroll-none bg-slate-950/80 backdrop-blur-sm md:hidden flex"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <div
            className="fixed inset-0 h-lvh touch-none overscroll-none"
            aria-hidden="true"
          />
          <aside
            className="relative z-10 flex flex-col h-dvh w-72 max-w-[85%] overflow-y-auto overscroll-contain bg-[#800000] text-amber-50 border-r-4 border-amber-500 p-4 shadow-2xl transition-colors duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-2">
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                <BrandMark size={38} className="shrink-0" />
                <span className="text-lg font-black tracking-tight text-white leading-tight">
                  <span className="text-amber-400">PUP</span> FOCUS
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1.5 rounded-lg border border-[#5e0000] bg-[#780000] hover:bg-[#5e0000] text-white transition-colors cursor-pointer shadow-xs shrink-0"
                aria-label="Close navigation"
              >
                <AppIcon icon={Xmark} size="md" color="inherit" />
              </button>
            </div>
            <div className="my-1.5">
              <SidebarProfileCard
                name={facultyFirstName}
                roleTitle="Faculty"
                avatarUrl={currentAvatarUrl}
                initials={facultyInitials}
                onClick={() => {
                  navigateToView("settings");
                  setIsMobileMenuOpen(false);
                }}
              />
            </div>
            <div className="my-2 h-px w-full bg-amber-400/50" />
            <div className="my-1.5">
              <SubmissionWindowCountdown
                window={effectiveSubmissionWindow}
                isLoading={isLoadingSubmissionWindow}
                onExpired={handleWindowExpired}
                isAllValidated={isAllClassesValidated}
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
                        ? "bg-amber-500 text-slate-900 font-bold shadow-sm"
                        : "text-amber-100/80 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <Icon
                      strokeWidth={isActive ? 2.5 : 2}
                      className={`h-5 w-5 shrink-0 ${
                        isActive ? "text-slate-900" : "text-amber-200/70"
                      }`}
                    />
                    <span className="truncate">{label}</span>
                    {key === "status" && isAllClassesValidated && (
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
      <div
        className={`${
          isSidebarCollapsed
            ? "md:ml-20 md:w-[calc(100%-5rem)]"
            : "md:ml-72 md:w-[calc(100%-18rem)]"
        } flex min-h-full md:h-full w-full flex-col transition-all duration-200`}
      >
        <div className="flex flex-1 flex-col md:min-h-0 md:overflow-hidden border-l-0 bg-slate-100 dark:bg-[#0b0f19] shadow-sm transition-colors duration-200">
          <div className="flex-1 md:min-h-0 md:overflow-y-auto overflow-x-clip p-4 pb-8 sm:p-6 lg:p-8 bg-slate-100 dark:bg-[#0b0f19] text-slate-900 dark:text-slate-100 transition-colors duration-200">
            {activeView === "submit" ? (
              <div className="relative overflow-hidden rounded-2xl border-2 border-amber-500 bg-amber-400 p-4 sm:p-6 shadow-md shadow-amber-500/10 mb-4 sm:mb-6">
                <div>
                  <h1 className="text-xl sm:text-3xl font-black text-slate-950 tracking-tight">
                    Submit Requirements
                  </h1>
                  <p className="mt-1.5 text-xs sm:text-base text-amber-950/90 font-medium leading-relaxed">
                    Upload and submit required academic and administrative
                    compliance documents.
                  </p>
                </div>
              </div>
            ) : null}
            {activeView === "dashboard" && (
              <article className="space-y-4 sm:space-y-6">
                {/* Solid Amber Card Header matching Admin Dashboard */}
                <div className="relative overflow-hidden rounded-2xl border-2 border-amber-500 bg-amber-400 p-4 sm:p-6 shadow-md shadow-amber-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="min-w-0">
                    <h1 className="text-xl sm:text-3xl font-black text-slate-950 tracking-tight flex items-center gap-2.5 flex-wrap">
                      <span>Dashboard</span>
                      {isAllValidated && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0b5336] text-white text-xs font-bold shadow-xs">
                          <AppIcon
                            icon={CheckCircle}
                            size="sm"
                            color="inherit"
                          />
                          Done All for This Semester
                        </span>
                      )}
                    </h1>
                    <p className="mt-1.5 text-xs sm:text-base text-amber-950/90 font-medium leading-relaxed">
                      {hasActiveAcademicTerm && activeAY
                        ? `Track your compliance requirements, class submissions, and upcoming deadlines for A.Y. ${activeAY} • ${activeSem}.`
                        : "Track your compliance requirements, class submissions, and upcoming deadlines."}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                    <button
                      type="button"
                      onClick={() => void handleManualRefresh()}
                      disabled={isRefreshing}
                      title="Refresh dashboard"
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 px-3.5 py-2 sm:py-1.5 text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer shadow-xs active:scale-[0.98]"
                    >
                      <Refresh
                        className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`}
                      />
                      <span>{isRefreshing ? "Refreshing..." : "Refresh"}</span>
                    </button>
                  </div>
                </div>

                {/* Top Stat Summary Grid (3 Cards) matching Admin Dashboard */}
                <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {/* Card 1: Overall Compliance */}
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs space-y-3 transition-colors flex flex-col justify-between min-w-0">
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                          Overall Compliance
                        </span>
                        <CheckCircle className="h-5 w-5 text-slate-400 shrink-0" strokeWidth={2} />
                      </div>

                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight min-w-0 break-words">
                          {mandatoryValidatedCount} of {mandatoryTemplates.length} Validated
                        </h3>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                            isAllValidated
                              ? "bg-[#0b5336] text-white border border-[#08412a]"
                              : "bg-amber-500 text-white border border-amber-600"
                          }`}
                        >
                          {isAllValidated
                            ? 100
                            : Math.round(
                                (mandatoryValidatedCount /
                                  (mandatoryTemplates.length || 1)) *
                                  100,
                              )}
                          % Complete
                        </span>
                      </div>

                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                        <div
                          className="h-full rounded-full bg-[#0b5336] transition-all duration-500"
                          style={{
                            width: `${isAllValidated ? 100 : Math.min(100, Math.round((mandatoryValidatedCount / (mandatoryTemplates.length || 1)) * 100))}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 mt-auto">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 min-w-0 truncate">
                        {isAllValidated
                          ? `All ${mandatoryTemplates.length} requirements approved`
                          : `${mandatoryTemplates.length - mandatoryValidatedCount} left to complete`}
                      </p>
                      <button
                        type="button"
                        onClick={() => navigateToView("status")}
                        className="inline-flex items-center gap-1 text-xs font-bold text-[#800000] dark:text-amber-400 hover:underline cursor-pointer shrink-0"
                      >
                        <span>View documents</span>
                        <NavArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Card 2: Submission Schedule */}
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs space-y-3 transition-colors flex flex-col justify-between min-w-0">
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                          Submission Schedule
                        </span>
                        <Calendar className="h-5 w-5 text-slate-400 shrink-0" strokeWidth={2} />
                      </div>

                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight min-w-0 break-words">
                          {hasActiveGracePeriod
                            ? "Personal Schedule"
                            : isWindowNotConfigured
                              ? "Schedule Not Set"
                              : isWindowClosed
                                ? "Window Closed"
                                : "Submissions Open"}
                        </h3>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                            hasActiveGracePeriod
                              ? "bg-[#0b5336] text-white border border-[#08412a]"
                              : isWindowClosed
                                ? "bg-[#780000] text-white border border-[#5e0000]"
                                : isWindowNotConfigured
                                  ? "bg-slate-600 text-white border border-slate-500"
                                  : "bg-[#0b5336] text-white border border-[#08412a]"
                          }`}
                        >
                          {hasActiveGracePeriod
                            ? "Extended"
                            : isWindowClosed
                              ? "Closed"
                              : isWindowNotConfigured
                                ? "Pending"
                                : "Active"}
                        </span>
                      </div>

                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            hasActiveGracePeriod || (hasActiveSchedule && !isWindowClosed)
                              ? "bg-[#0b5336]"
                              : isWindowClosed
                                ? "bg-[#780000]"
                                : "bg-slate-400"
                          }`}
                          style={{ width: "100%" }}
                        />
                      </div>
                    </div>

                    <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 mt-auto">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 min-w-0 truncate">
                        {hasActiveGracePeriod && personalDeadlineFormatted
                          ? `Due: ${personalDeadlineFormatted}`
                          : windowDeadlineDisplay
                            ? `Deadline: ${windowDeadlineDisplay}`
                            : "Waiting for admin schedule"}
                      </p>
                      {hasLackings && !isEffectivelyOpen && !hasActiveGracePeriod ? (
                        <button
                          type="button"
                          onClick={() => openExtensionRequestModal()}
                          className="inline-flex items-center gap-1 text-xs font-bold text-[#800000] dark:text-amber-400 hover:underline cursor-pointer shrink-0"
                        >
                          <span>Request extension</span>
                          <NavArrowRight className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => navigateToView("status")}
                          className="inline-flex items-center gap-1 text-xs font-bold text-[#800000] dark:text-amber-400 hover:underline cursor-pointer shrink-0"
                        >
                          <span>View schedule</span>
                          <NavArrowRight className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Card 3: Action Items */}
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs space-y-3 transition-colors flex flex-col justify-between min-w-0">
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                          Action Items
                        </span>
                        <TaskList className="h-5 w-5 text-slate-400 shrink-0" strokeWidth={2} />
                      </div>

                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight min-w-0 break-words">
                          {isAllValidated
                            ? "All Caught Up"
                            : `${lackingRequirements.length} ${lackingRequirements.length === 1 ? "Item" : "Items"} Left`}
                        </h3>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                            isAllValidated
                              ? "bg-[#0b5336] text-white border border-[#08412a]"
                              : lackingRequirements.filter((r) => r.status === "Overdue").length > 0
                                ? "bg-[#780000] text-white border border-[#5e0000]"
                                : "bg-amber-500 text-white border border-amber-600"
                          }`}
                        >
                          {isAllValidated
                            ? "Done"
                            : lackingRequirements.filter((r) => r.status === "Overdue").length > 0
                              ? "Overdue"
                              : "To Submit"}
                        </span>
                      </div>

                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isAllValidated
                              ? "bg-[#0b5336]"
                              : lackingRequirements.filter((r) => r.status === "Overdue").length > 0
                                ? "bg-[#780000]"
                                : "bg-amber-500"
                          }`}
                          style={{
                            width: `${Math.min(100, Math.max(10, (lackingRequirements.length / (mandatoryTemplates.length || 1)) * 100))}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 mt-auto">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 min-w-0 truncate">
                        {isAllValidated
                          ? "No action needed"
                          : `${displayedStatusCounts.notSubmitted} to submit • ${displayedStatusCounts.pending} in review`}
                      </p>
                      <button
                        type="button"
                        onClick={() => navigateToView("status")}
                        className="inline-flex items-center gap-1 text-xs font-bold text-[#800000] dark:text-amber-400 hover:underline cursor-pointer shrink-0"
                      >
                        <span>{isAllValidated ? "View summary" : "Upload now"}</span>
                        <NavArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </section>

                {/* 4 Status Blocks matching SuperAdmin Compliance Analytics */}
                <section className="grid grid-cols-1 min-[360px]:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                  {/* Validated */}
                  <div className="rounded-2xl bg-[#0b5336] text-white border border-[#08412a] p-3.5 sm:p-4.5 shadow-xs space-y-2 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-white truncate">Validated</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white shrink-0">
                        {isAllValidated
                          ? (totalRequirements || mandatoryTemplates.length)
                          : displayedStatusCounts.validated}
                      </span>
                    </div>
                    <p className="text-2xl font-black text-white tracking-tight">
                      {isAllValidated
                        ? "100%"
                        : `${Math.round(((displayedStatusCounts.validated || 0) / Math.max(totalRequirements || mandatoryTemplates.length, 1)) * 100)}%`}
                    </p>
                    <p className="text-[11px] text-emerald-100/90 font-medium truncate">
                      Verified &amp; approved
                    </p>
                  </div>

                  {/* In Review / Pending */}
                  <div className="rounded-2xl bg-amber-500 text-white border border-amber-600 p-3.5 sm:p-4.5 shadow-xs space-y-2 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-white truncate">In Review</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white shrink-0">
                        {isAllValidated ? 0 : displayedStatusCounts.pending}
                      </span>
                    </div>
                    <p className="text-2xl font-black text-white tracking-tight">
                      {isAllValidated
                        ? "0%"
                        : `${Math.round(((displayedStatusCounts.pending || 0) / Math.max(totalRequirements || mandatoryTemplates.length, 1)) * 100)}%`}
                    </p>
                    <p className="text-[11px] text-amber-100 font-medium truncate">
                      Awaiting verification
                    </p>
                  </div>

                  {/* Needs Revision */}
                  <div className="rounded-2xl bg-[#780000] text-white border border-[#5e0000] p-3.5 sm:p-4.5 shadow-xs space-y-2 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-white truncate">Needs Revision</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white shrink-0">
                        {isAllValidated ? 0 : displayedStatusCounts.rejected}
                      </span>
                    </div>
                    <p className="text-2xl font-black text-white tracking-tight">
                      {isAllValidated
                        ? "0%"
                        : `${Math.round(((displayedStatusCounts.rejected || 0) / Math.max(totalRequirements || mandatoryTemplates.length, 1)) * 100)}%`}
                    </p>
                    <p className="text-[11px] text-red-200 font-medium truncate">
                      Corrections requested
                    </p>
                  </div>

                  {/* Not Submitted */}
                  <div className="rounded-2xl bg-slate-600 dark:bg-slate-800 text-white border border-slate-500 dark:border-slate-700 p-3.5 sm:p-4.5 shadow-xs space-y-2 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-white truncate">Not Submitted</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white shrink-0">
                        {isAllValidated ? 0 : displayedStatusCounts.notSubmitted}
                      </span>
                    </div>
                    <p className="text-2xl font-black text-white tracking-tight">
                      {isAllValidated
                        ? "0%"
                        : `${Math.round(((displayedStatusCounts.notSubmitted || 0) / Math.max(totalRequirements || mandatoryTemplates.length, 1)) * 100)}%`}
                    </p>
                    <p className="text-[11px] text-slate-300 font-medium truncate">
                      No document uploaded yet
                    </p>
                  </div>
                </section>

                {/* Extension Request Feedback Toast in Dashboard */}
                <AlertPopup
                  type="success"
                  message={extensionRequestToast}
                  onClose={() => setExtensionRequestToast(null)}
                />


              </article>
            )}
            {activeView === "submit" && (
              <article className="space-y-4 sm:space-y-5">
                {isEffectivelyOpen ? (
                  <form className="space-y-4" onSubmit={handleSubmit}>
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
                          updateField("requirementCode", event.target.value)
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
                      <DocumentUploadZone
                        selectedFile={directUploadFile}
                        onFileSelect={(file) => {
                          setDirectUploadFile(file);
                          updateField("fileName", file?.name ?? "");
                        }}
                        maxSizeMb={
                          activeTemplates.find(
                            (t) => t.code === form.requirementCode,
                          )?.max_size_mb || 10
                        }
                        allowedFormats={
                          activeTemplates.find(
                            (t) => t.code === form.requirementCode,
                          )?.allowed_formats || [
                            "PDF",
                            "DOCX",
                            "XLSX",
                            "JPG",
                            "PNG",
                          ]
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
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/60 px-4 py-3 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                      <span>
                        Submission will be queued for review after upload.
                      </span>
                      <div className="grid grid-cols-2 sm:flex w-full sm:w-auto gap-2 shrink-0">
                        <Button
                          type="button"
                          variant="secondary"
                          className="w-full sm:w-auto justify-center"
                          onClick={() => setIsGuideOpen(true)}
                        >
                          Submission Guide
                        </Button>
                        <Button
                          type="submit"
                          className="w-full sm:w-auto justify-center"
                          disabled={
                            isSubmitting ||
                            !form.fileName ||
                            (effectiveSubmissionWindow
                              ? !effectiveSubmissionWindow.isOpen
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
                  <div className="flex min-h-[50dvh] items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-8">
                    <div className="w-full max-w-2xl rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/80 p-5 sm:p-8 text-center shadow-2xl">
                      <div className="mx-auto flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        <WarningTriangle className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={2} />
                      </div>
                      <h3 className="mt-4 sm:mt-5 text-lg sm:text-2xl font-semibold text-slate-900 dark:text-slate-100">
                        Submission Is Currently Unavailable
                      </h3>
                      {isLoadingSubmissionWindow ? (
                        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                          Checking submission availability...
                        </p>
                      ) : submissionWindow?.isConfigured ? (
                        <p className="mt-3 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
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
                        <p className="mt-3 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
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
                    className="fixed inset-0 z-[60] h-dvh overflow-hidden overscroll-none flex items-center justify-center p-3 sm:p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="submission-guide-title"
                    onClick={() => setIsGuideOpen(false)}
                  >
                    <div
                      className="fixed inset-0 h-lvh bg-black/60 backdrop-blur-sm touch-none overscroll-none"
                      aria-hidden="true"
                    />
                    <div
                      className="relative z-10 w-full max-w-2xl max-h-[90dvh] overflow-y-auto overflow-x-hidden overscroll-contain rounded-2xl border border-slate-200 dark:border-slate-700 bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100 p-4 sm:p-6 shadow-2xl"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <ModalHeader
                        icon={Page}
                        title="Submission Guide"
                        subtitle="Instructions and guidelines for uploading compliance documents"
                        onClose={() => setIsGuideOpen(false)}
                        className="-mx-4 sm:-mx-6 -mt-4 sm:-mt-6 mb-4 sm:mb-5 rounded-t-2xl shrink-0"
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
              <article className="space-y-4 sm:space-y-5">
                {selectedClassId === null ? (
                  /* ─── STEP 1: CLASS / SUBJECT LOAD SELECTION ─────────────────── */
                  <div className="space-y-4 sm:space-y-5">
                    {/* Solid Amber Card Header */}
                    <div className="relative overflow-hidden rounded-2xl border-2 border-amber-500 bg-amber-400 p-4 sm:p-6 shadow-md shadow-amber-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h1 className="text-xl sm:text-3xl font-black text-slate-950 tracking-tight">
                            Documents to be Submitted
                          </h1>
                        </div>
                        <p className="mt-1.5 text-xs sm:text-base text-amber-950/90 font-medium leading-relaxed">
                          Select your assigned class or subject load below
                          before viewing and uploading required compliance
                          documents for this term.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2 sm:gap-2.5 w-full sm:w-auto shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setClassFormError(null);
                            setIsAddClassModalOpen(true);
                          }}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] rounded-xl px-4 py-2 sm:px-4.5 sm:py-2.5 text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap shadow-xs active:scale-[0.98]"
                        >
                          <AppIcon icon={Plus} size="sm" color="white" />
                          <span>Add Class / Subject Load</span>
                        </button>
                        <button
                          type="button"
                          onClick={openHistoryModal}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#0b5336] hover:bg-[#08412a] text-white border border-[#08412a] rounded-xl px-4 py-2 sm:px-4.5 sm:py-2.5 text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap shadow-xs active:scale-[0.98]"
                          title="View validated documents history"
                        >
                          <AppIcon icon={CheckCircle} size="md" color="white" />
                          <span>Validation History</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleManualRefresh()}
                          disabled={isRefreshing}
                          title="Refresh status and classes"
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 px-4 py-2 sm:px-4.5 sm:py-2.5 text-xs sm:text-sm font-semibold transition-all disabled:opacity-50 cursor-pointer whitespace-nowrap shadow-xs active:scale-[0.98]"
                        >
                          <Refresh
                            className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
                          />
                          <span>
                            {isRefreshing ? "Refreshing..." : "Refresh"}
                          </span>
                        </button>
                      </div>
                    </div>

                    <div className="w-full flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs transition-all animate-in fade-in duration-150 overflow-hidden">
                      {/* Header Info Box matching Requirements Verification */}
                      <div className="border-b border-slate-200 dark:border-slate-800/80 p-4 sm:p-6 bg-slate-50/50 dark:bg-slate-950/30 rounded-t-2xl space-y-3">
                        {/* Top row with PUP SIS style Faculty Name Header */}
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-800 dark:text-slate-200 shadow-2xs">
                              {avatarUrl ? (
                                <img
                                  src={avatarUrl}
                                  alt={currentFacultyName || "Faculty Profile"}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <span>
                                  {buildFacultyInitials(
                                    currentFacultyName || "Faculty",
                                  )}
                                </span>
                              )}
                            </div>
                            <span className="text-xs sm:text-sm font-black text-[#780000] dark:text-rose-400 tracking-wide uppercase">
                              {facultyDisplayName}
                            </span>
                          </div>
                        </div>

                        {/* PUP SIS Style Academic Term & Info Card */}
                        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-2xs">
                          <div className="bg-[#780000] text-white px-4 py-2 font-bold text-xs sm:text-sm tracking-wide">
                            {hasActiveAcademicTerm && activeAY
                              ? `School Year ${activeAY} ${activeSem}`
                              : "No Active Academic Term Configured"}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-3.5 gap-x-6 p-3.5 sm:p-4 bg-white dark:bg-slate-900 text-xs">
                            <div>
                              <span className="font-bold text-slate-900 dark:text-slate-100 block mb-0.5">
                                Faculty Department &amp; Program
                              </span>
                              <p className="font-medium text-slate-700 dark:text-slate-300">
                                {departmentName}
                              </p>
                            </div>

                            <div>
                              <span className="font-bold text-slate-900 dark:text-slate-100 block mb-0.5">
                                Assigned Class Loads
                              </span>
                              <p className="font-medium text-slate-700 dark:text-slate-300">
                                {facultyClasses.length} Registered Class Load
                                {facultyClasses.length === 1 ? "" : "s"}
                              </p>
                            </div>

                            <div>
                              <span className="font-bold text-slate-900 dark:text-slate-100 block mb-0.5">
                                Faculty Email
                              </span>
                              <p
                                className="font-medium text-slate-700 dark:text-slate-300 break-all sm:truncate"
                                title={facultyEmail || undefined}
                              >
                                {facultyEmail || "—"}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Tabs & Search/Filter Controls matching Requirements Verification */}
                      {facultyClasses.length > 0 && (
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800/80 px-4 sm:px-6 py-3 bg-white dark:bg-slate-900">
                          {/* Active / Archive Toggle Pills with Solid Highlight */}
                          <div className="grid grid-cols-2 sm:inline-flex p-1 bg-slate-100 dark:bg-slate-950/80 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shrink-0 w-full lg:w-auto self-stretch lg:self-auto">
                            <button
                              type="button"
                              onClick={() => {
                                setClassTab("active");
                                setClassSectionFilter("ALL");
                              }}
                              className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 sm:px-4 py-1.5 text-xs font-bold transition cursor-pointer ${
                                classTab === "active"
                                  ? "bg-amber-500 text-slate-950 border border-amber-600 shadow-xs"
                                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                              }`}
                            >
                              <span>Active Loads</span>
                              <span
                                className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-black leading-none ${
                                  classTab === "active"
                                    ? "bg-white text-slate-950 border border-amber-600/30 shadow-2xs"
                                    : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                                }`}
                              >
                                {activeFacultyClasses.length}
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setClassTab("archived");
                                setClassSectionFilter("ALL");
                              }}
                              className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3 sm:px-4 py-1.5 text-xs font-bold transition cursor-pointer ${
                                classTab === "archived"
                                  ? "bg-amber-500 text-slate-950 border border-amber-600 shadow-xs"
                                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                              }`}
                            >
                              <AppIcon
                                icon={Archive}
                                size="xs"
                                color="inherit"
                              />
                              <span>Archived</span>
                              <span
                                className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-black leading-none ${
                                  classTab === "archived"
                                    ? "bg-white text-slate-950 border border-amber-600/30 shadow-2xs"
                                    : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                                }`}
                              >
                                {archivedFacultyClasses.length}
                              </span>
                            </button>
                          </div>

                          {/* Search & Section Filter in the Same Row */}
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
                            <div className="relative flex-1 sm:w-64">
                              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                                <AppIcon
                                  icon={Search}
                                  size="sm"
                                  color="inherit"
                                />
                              </span>
                              <input
                                type="text"
                                value={classSearchQuery}
                                onChange={(e) =>
                                  setClassSearchQuery(e.target.value)
                                }
                                placeholder="Search subject or section..."
                                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 pl-9 pr-8 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                              />
                              {classSearchQuery && (
                                <button
                                  type="button"
                                  onClick={() => setClassSearchQuery("")}
                                  className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                                  title="Clear search"
                                >
                                  <AppIcon
                                    icon={Xmark}
                                    size="sm"
                                    color="inherit"
                                  />
                                </button>
                              )}
                            </div>

                            <div className="relative flex items-center">
                              <span className="pointer-events-none absolute left-3 text-slate-400">
                                <AppIcon
                                  icon={FilterList}
                                  size="sm"
                                  color="inherit"
                                />
                              </span>
                              <select
                                value={classSectionFilter}
                                onChange={(e) =>
                                  setClassSectionFilter(e.target.value)
                                }
                                aria-label="Filter by section"
                                className="w-full sm:w-auto rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-9 pr-8 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:border-amber-500 outline-none cursor-pointer shadow-2xs"
                              >
                                <option value="ALL">
                                  All Sections (
                                  {classTab === "active"
                                    ? activeFacultyClasses.length
                                    : archivedFacultyClasses.length}
                                  )
                                </option>
                                {uniqueClassSections.map((sec) => (
                                  <option key={sec} value={sec}>
                                    {sec}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {(classSearchQuery.trim() !== "" ||
                              classSectionFilter !== "ALL") && (
                              <button
                                type="button"
                                onClick={() => {
                                  setClassSearchQuery("");
                                  setClassSectionFilter("ALL");
                                }}
                                className="w-full sm:w-auto inline-flex items-center justify-center gap-1 rounded-xl bg-amber-400 hover:bg-amber-500 px-3 py-2 text-xs font-bold text-amber-950 border border-amber-500 transition-colors cursor-pointer shrink-0"
                              >
                                <AppIcon
                                  icon={Xmark}
                                  size="xs"
                                  color="inherit"
                                />
                                <span>Reset</span>
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Body Content */}
                      <div className="px-4 sm:px-6 py-4 sm:py-5">
                        {isLoadingClasses ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 pt-1">
                            {[1, 2, 3].map((i) => (
                              <div
                                key={i}
                                className="h-64 rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 animate-pulse p-5"
                              />
                            ))}
                          </div>
                        ) : facultyClasses.length === 0 ? (
                          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-8 sm:p-14 text-center">
                            <div className="h-16 w-16 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center mb-4 shadow-md">
                              <AppIcon icon={TaskList} size="lg" color="inherit" />
                            </div>
                            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">
                              No Classes or Subject Loads Added Yet
                            </h3>
                            <p className="mt-2 max-w-md text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                              Faculty requirements are organized per assigned
                              subject load. Please add your first class section
                              (e.g., COMP 023 • BSIT 4-1) to unlock the document
                              upload zone.
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                setClassFormError(null);
                                setIsAddClassModalOpen(true);
                              }}
                              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-5 py-2.5 text-xs sm:text-sm shadow-md transition-all cursor-pointer active:scale-95"
                            >
                              <AppIcon icon={Plus} size="sm" color="inherit" />
                              <span>Add Class / Subject Load</span>
                            </button>
                          </div>
                        ) : displayedClasses.length === 0 ? (
                          <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs py-14 text-center text-slate-500 dark:text-slate-400">
                            <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                              <AppIcon
                                icon={
                                  classTab === "archived" ? Archive : TaskList
                                }
                                size="lg"
                                color="muted"
                              />
                              <h5 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                {classSearchQuery.trim() !== "" ||
                                classSectionFilter !== "ALL"
                                  ? "No Matching Subjects"
                                  : classTab === "archived"
                                    ? "No Archived Subject Loads"
                                    : "No Active Subject Loads"}
                              </h5>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {classSearchQuery.trim() !== "" ||
                                classSectionFilter !== "ALL"
                                  ? "No subject loads match the current search or section filter."
                                  : classTab === "archived"
                                    ? "Classes you archive when completed will appear here."
                                    : "All assigned classes have been archived or none match."}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 pt-1">
                            {displayedClasses.map((cls) => {
                              const isArchived = Boolean(cls.is_archived);
                              const cachedClassStatuses =
                                classStatusesCacheRef.current[
                                  `${cls.id}_${activeAY}_${activeSem}`
                                ] ||
                                classStatusesCacheRef.current[cls.id] ||
                                [];
                              const clsTotalReqs = activeTemplates.length;
                              const clsValidatedCount =
                                cachedClassStatuses.filter((s) => {
                                  const st = (s.status || "").toLowerCase();
                                  return st === "validated" || st === "approved";
                                }).length;
                              const clsPendingCount =
                                cachedClassStatuses.filter((s) => {
                                  const st = (s.status || "").toLowerCase();
                                  return (
                                    (st === "pending" ||
                                      st === "uploaded" ||
                                      st === "submitted") &&
                                    Boolean(s.latestSubmissionId || s.submittedAt)
                                  );
                                }).length;
                              const clsRevisionCount =
                                cachedClassStatuses.filter((s) => {
                                  const st = (s.status || "").toLowerCase();
                                  return (
                                    st === "rejected" ||
                                    st === "needs_revision"
                                  );
                                }).length;
                              const clsProgressPct =
                                clsTotalReqs > 0
                                  ? Math.min(
                                      100,
                                      Math.round(
                                        (clsValidatedCount / clsTotalReqs) *
                                          100,
                                      ),
                                    )
                                  : 0;

                              return (
                                <div
                                  key={cls.id}
                                  onClick={() => {
                                    const cacheKey = `${cls.id}_${activeAY}_${activeSem}`;
                                    selectedClassIdRef.current = cls.id;
                                    setRequirementStatuses(
                                      classStatusesCacheRef.current[cacheKey] ||
                                        classStatusesCacheRef.current[cls.id] ||
                                        [],
                                    );
                                    setStep2FilterMode("all");
                                    setIsUploadSectionVisible(false);
                                    setSelectedClassId(cls.id);
                                    void fetchStatuses(
                                      activeAY,
                                      activeSem,
                                      cls.id,
                                      { silent: true },
                                    );
                                  }}
                                  className="group relative flex flex-col cursor-pointer text-left transition-all duration-200 hover:-translate-y-1"
                                >
                                  {/* Folder Top Tab with Smooth Slanted Shoulder */}
                                  <div className="flex items-end -mb-[2px] relative z-10 self-start">
                                    <div
                                      className={`h-7.5 px-3.5 rounded-tl-xl flex items-center gap-2 text-xs font-black tracking-wide border-t-2 border-l-2 transition-colors duration-200 ${
                                        isArchived
                                          ? "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-400 dark:border-slate-600"
                                          : "bg-amber-400 dark:bg-amber-500 text-slate-950 border-amber-500 dark:border-amber-600 shadow-2xs group-hover:bg-amber-300"
                                      }`}
                                    >
                                      <AppIcon
                                        icon={Folder}
                                        size="xs"
                                        color="inherit"
                                      />
                                      <span className="truncate max-w-[150px]">
                                        {cls.section_code}
                                      </span>
                                    </div>

                                    {/* Tab Smooth Slant Shoulder */}
                                    <div className="relative w-5 h-7.5 shrink-0 -ml-[1px]">
                                      <svg
                                        viewBox="0 0 20 30"
                                        fill="none"
                                        className={`w-full h-full ${
                                          isArchived
                                            ? "text-slate-200 dark:text-slate-800"
                                            : "text-amber-400 dark:text-amber-500"
                                        }`}
                                      >
                                        <path
                                          d="M 0,0 L 2,0 C 8,0 13,8 16,18 L 20,30 L 0,30 Z"
                                          fill="currentColor"
                                        />
                                        <path
                                          d="M 0,1 L 2,1 C 8,1 13,9 16,19 L 20,30"
                                          stroke={
                                            isArchived
                                              ? "currentColor"
                                              : "#f59e0b"
                                          }
                                          strokeWidth="2"
                                          fill="none"
                                          className={
                                            isArchived
                                              ? "text-slate-400 dark:text-slate-600"
                                              : "text-amber-500 dark:text-amber-600"
                                          }
                                        />
                                      </svg>
                                    </div>
                                  </div>

                                  {/* Folder Main Body */}
                                  <div
                                    className={`relative flex-1 flex flex-col justify-between rounded-2xl rounded-tl-none border-2 transition-all duration-200 overflow-hidden bg-white dark:bg-slate-900 shadow-xs group-hover:shadow-lg ${
                                      isArchived
                                        ? "border-slate-400 dark:border-slate-600 group-hover:border-slate-500"
                                        : "border-amber-500 dark:border-amber-600 group-hover:border-amber-400"
                                    }`}
                                  >
                                    <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between gap-4">
                                      <div className="space-y-3.5">
                                        {/* Top Row: Units, Status Badges & Class Controls */}
                                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                              {Number(cls.units || 0).toFixed(1)} Units
                                            </span>
                                            {clsPendingCount > 0 && (
                                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 border border-amber-600 text-slate-950 px-2 py-0.5 text-[10px] font-bold shadow-2xs">
                                                <span className="h-1.5 w-1.5 rounded-full bg-[#780000] animate-pulse" />
                                                {clsPendingCount} Pending
                                              </span>
                                            )}
                                            {clsRevisionCount > 0 && (
                                              <span className="inline-flex items-center gap-1 rounded-full bg-[#780000] border border-[#5e0000] text-white px-2 py-0.5 text-[10px] font-bold shadow-2xs">
                                                {clsRevisionCount} Revision
                                              </span>
                                            )}
                                            {isArchived && (
                                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700">
                                                <AppIcon
                                                  icon={Archive}
                                                  size="xs"
                                                  color="inherit"
                                                />
                                                Archived
                                              </span>
                                            )}
                                          </div>

                                          {/* Action Buttons Toolbar */}
                                          <div
                                            className="flex flex-wrap items-center justify-end gap-1"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <button
                                              type="button"
                                              onClick={(e) =>
                                                handleOpenViewClass(cls, e)
                                              }
                                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition cursor-pointer shadow-2xs active:scale-95"
                                              title="View subject details"
                                            >
                                              <AppIcon
                                                icon={Eye}
                                                size="xs"
                                                color="inherit"
                                              />
                                              <span>Details</span>
                                            </button>

                                            <button
                                              type="button"
                                              onClick={(e) =>
                                                handleOpenEditClass(cls, e)
                                              }
                                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition cursor-pointer shadow-2xs active:scale-95"
                                              title="Edit class load"
                                            >
                                              <AppIcon
                                                icon={EditPencil}
                                                size="xs"
                                                color="inherit"
                                              />
                                              <span>Edit</span>
                                            </button>

                                            <button
                                              type="button"
                                              disabled={
                                                classActionLoadingId === cls.id
                                              }
                                              onClick={(e) => {
                                                if (isArchived) {
                                                  handleToggleArchiveClass(
                                                    cls,
                                                    e,
                                                  );
                                                } else {
                                                  handleOpenArchiveModal(
                                                    cls,
                                                    e,
                                                  );
                                                }
                                              }}
                                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer shadow-2xs active:scale-95 border ${
                                                isArchived
                                                  ? "bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-600/50 shadow-xs"
                                                  : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:border-slate-700"
                                              }`}
                                              title={
                                                isArchived
                                                  ? "Unarchive / Restore to active loads"
                                                  : "Archive class (Mark done)"
                                              }
                                            >
                                              {classActionLoadingId ===
                                              cls.id ? (
                                                <AppIcon
                                                  icon={SystemRestart}
                                                  size="xs"
                                                  color="inherit"
                                                  className="animate-spin"
                                                />
                                              ) : isArchived ? (
                                                <AppIcon
                                                  icon={Refresh}
                                                  size="xs"
                                                  color="inherit"
                                                />
                                              ) : (
                                                <AppIcon
                                                  icon={Archive}
                                                  size="xs"
                                                  color="inherit"
                                                />
                                              )}
                                              <span>
                                                {isArchived
                                                  ? "Unarchive"
                                                  : "Archive"}
                                              </span>
                                            </button>

                                            <button
                                              type="button"
                                              onClick={(e) =>
                                                handleOpenDeleteModal(cls, e)
                                              }
                                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-white bg-[#780000] hover:bg-[#5e0000] border border-[#5e0000] transition cursor-pointer shadow-2xs active:scale-95"
                                              title="Delete class load"
                                            >
                                              <AppIcon
                                                icon={Trash}
                                                size="xs"
                                                color="inherit"
                                              />
                                              <span>Delete</span>
                                            </button>
                                          </div>
                                        </div>

                                        {/* Course Code & Subject Name Fields */}
                                        <div className="space-y-2 pt-1">
                                          <div>
                                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-0.5">
                                              Course Code:
                                            </span>
                                            <h3 className="text-xl sm:text-2xl font-black text-slate-950 dark:text-slate-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                                              {cls.subject_code}
                                            </h3>
                                          </div>

                                          <div>
                                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-0.5">
                                              Subject Name / Description:
                                            </span>
                                            <p className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-200 line-clamp-2 leading-snug">
                                              {cls.description}
                                            </p>
                                          </div>
                                        </div>

                                        {/* Validation Progress Bar matching Requirements Verification */}
                                        {clsTotalReqs > 0 && (
                                          <div className="pt-1">
                                            <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                                              <span>Validation Progress</span>
                                              <span className="font-bold text-slate-700 dark:text-slate-300">
                                                {clsProgressPct}% (
                                                {clsValidatedCount}/
                                                {clsTotalReqs} Validated)
                                              </span>
                                            </div>
                                            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                              <div
                                                className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-300 rounded-full"
                                                style={{
                                                  width: `${clsProgressPct}%`,
                                                }}
                                              />
                                            </div>
                                          </div>
                                        )}
                                      </div>

                                      {/* Bottom Footer */}
                                      {isArchived ? (
                                        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
                                          <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                                            <AppIcon
                                              icon={Archive}
                                              size="sm"
                                              color="inherit"
                                            />
                                            <span>Archived Load</span>
                                          </span>
                                          <button
                                            type="button"
                                            onClick={(e) =>
                                              handleToggleArchiveClass(cls, e)
                                            }
                                            className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 hover:underline font-bold"
                                          >
                                            <span>
                                              Restore to Active &rarr;
                                            </span>
                                          </button>
                                        </div>
                                      ) : (
                                        <div className="pt-2">
                                          <div className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl bg-amber-400 group-hover:bg-amber-500 border border-amber-500 transition-all duration-200 shadow-2xs">
                                            <span className="text-xs font-extrabold text-amber-950 flex items-center gap-2">
                                              <AppIcon
                                                icon={Folder}
                                                size="xs"
                                                color="inherit"
                                              />
                                              <span>
                                                View &amp; Upload Documents
                                              </span>
                                            </span>
                                            <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-[#780000] text-white group-hover:bg-[#5e0000] transition-colors shadow-2xs">
                                              <AppIcon
                                                icon={NavArrowRight}
                                                size="xs"
                                                color="white"
                                              />
                                            </span>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* ─── STEP 2: CLASS REQUIREMENTS UPLOAD ZONE ─────────────────── */
                  <div className="space-y-5">
                    {/* Solid Amber Card Header */}
                    <div className="relative overflow-hidden rounded-2xl border-2 border-amber-500 bg-amber-400 p-4 sm:p-6 shadow-md shadow-amber-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h1 className="text-xl sm:text-3xl font-black text-slate-950 tracking-tight">
                            Documents to be Submitted
                          </h1>
                        </div>
                        <p className="mt-1.5 text-xs sm:text-base text-amber-950/90 font-medium leading-relaxed">
                          View, upload, and track the status of your required
                          faculty compliance documents for this academic term.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2 sm:gap-2.5 w-full sm:w-auto shrink-0">
                        <button
                          type="button"
                          onClick={openHistoryModal}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#0b5336] hover:bg-[#08412a] text-white border border-[#08412a] rounded-xl px-4 py-2 sm:px-4.5 sm:py-2.5 text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap shadow-xs active:scale-[0.98]"
                          title="View validated documents history"
                        >
                          <AppIcon icon={CheckCircle} size="md" color="white" />
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
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] rounded-xl px-4 py-2 sm:px-4.5 sm:py-2.5 text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap shadow-xs active:scale-[0.98]"
                        >
                          <Logo size={18} className="shrink-0" />
                          <span>University Calendar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleManualRefresh()}
                          disabled={isRefreshing}
                          title="Refresh status"
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 px-4 py-2 sm:px-4.5 sm:py-2.5 text-xs sm:text-sm font-semibold transition-all disabled:opacity-50 cursor-pointer whitespace-nowrap shadow-xs active:scale-[0.98]"
                        >
                          <Refresh
                            className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
                          />
                          <span>
                            {isRefreshing ? "Refreshing..." : "Refresh"}
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Unified White Container matching Requirements Verification */}
                    <div className="w-full flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs transition-all animate-in fade-in duration-150 overflow-hidden">
                      <div className="px-4 sm:px-6 py-4 sm:py-5 space-y-4">
                    {/* Class Context Navigation Bar (Between Header & Status Filter/Counts) */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 py-1">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 min-w-0 flex-1">
                        {/* Mobile Top Row: Back Button + Edit/Archive Actions */}
                        <div className="flex flex-wrap items-center justify-between sm:justify-start gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              selectedClassIdRef.current = null;
                              setStep2FilterMode("all");
                              setIsUploadSectionVisible(false);
                              setSelectedClassId(null);
                              void fetchStatuses(activeAY, activeSem, null, {
                                silent: true,
                              });
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
                            title="Return to Class List"
                          >
                            <AppIcon
                              icon={NavArrowLeft}
                              size="sm"
                              color="white"
                            />
                            <span>Back to Class List</span>
                          </button>

                          <div className="h-6 w-px bg-amber-400/60 dark:bg-amber-600/40 hidden sm:block shrink-0" />

                          {selectedClass && (
                            <div className="flex sm:hidden items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={(e) =>
                                  handleOpenViewClass(selectedClass, e)
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-extrabold text-slate-700 dark:text-slate-200 transition cursor-pointer shadow-2xs active:scale-95"
                                title="View subject details"
                              >
                                <AppIcon icon={Eye} size="xs" color="inherit" />
                                <span>Details</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) =>
                                  handleOpenEditClass(selectedClass, e)
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-amber-600 bg-amber-500 hover:bg-amber-400 text-xs font-extrabold text-amber-950 transition cursor-pointer shadow-2xs active:scale-95"
                                title="Edit this class load"
                              >
                                <AppIcon
                                  icon={EditPencil}
                                  size="xs"
                                  color="inherit"
                                />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                disabled={
                                  classActionLoadingId === selectedClass.id
                                }
                                onClick={(e) => {
                                  if (selectedClass.is_archived) {
                                    handleToggleArchiveClass(selectedClass, e);
                                  } else {
                                    handleOpenArchiveModal(selectedClass, e);
                                  }
                                }}
                                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-extrabold transition cursor-pointer shadow-2xs active:scale-95 ${
                                  selectedClass.is_archived
                                    ? "bg-amber-500 hover:bg-amber-400 text-amber-950 border-amber-600"
                                    : "border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700"
                                }`}
                                title={
                                  selectedClass.is_archived
                                    ? "Restore to active loads"
                                    : "Archive class load"
                                }
                              >
                                <AppIcon
                                  icon={
                                    selectedClass.is_archived
                                      ? Refresh
                                      : Archive
                                  }
                                  size="xs"
                                  color="inherit"
                                />
                                <span>
                                  {selectedClass.is_archived
                                    ? "Unarchive"
                                    : "Archive"}
                                </span>
                              </button>
                            </div>
                          )}
                        </div>

                        {selectedClass && (
                          <div className="min-w-0 flex-1 sm:pl-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs font-black px-2.5 py-0.5 rounded-md bg-amber-400 text-amber-950 shrink-0">
                                {selectedClass.section_code}
                              </span>
                              <span className="text-sm sm:text-base font-black text-[#780000] break-words">
                                {selectedClass.subject_code} &bull;{" "}
                                {selectedClass.description}
                              </span>
                              <span className="text-xs font-semibold text-slate-600 shrink-0">
                                ({selectedClass.units} Units)
                              </span>
                              {selectedClass.is_archived && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                                  Archived
                                </span>
                              )}
                              <div className="hidden sm:inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={(e) =>
                                    handleOpenViewClass(selectedClass, e)
                                  }
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[11px] font-extrabold text-slate-700 dark:text-slate-200 transition cursor-pointer shadow-2xs active:scale-95"
                                  title="View subject details"
                                >
                                  <AppIcon
                                    icon={Eye}
                                    size="xs"
                                    color="inherit"
                                  />
                                  <span>Details</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) =>
                                    handleOpenEditClass(selectedClass, e)
                                  }
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-amber-600 bg-amber-500 hover:bg-amber-400 text-[11px] font-extrabold text-amber-950 transition cursor-pointer shadow-2xs active:scale-95"
                                  title="Edit this class load"
                                >
                                  <AppIcon
                                    icon={EditPencil}
                                    size="xs"
                                    color="inherit"
                                  />
                                  <span>Edit</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={
                                    classActionLoadingId === selectedClass.id
                                  }
                                  onClick={(e) => {
                                    if (selectedClass.is_archived) {
                                      handleToggleArchiveClass(
                                        selectedClass,
                                        e,
                                      );
                                    } else {
                                      handleOpenArchiveModal(selectedClass, e);
                                    }
                                  }}
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-extrabold transition cursor-pointer shadow-2xs active:scale-95 ${
                                    selectedClass.is_archived
                                      ? "bg-amber-500 hover:bg-amber-400 text-amber-950 border-amber-600"
                                      : "border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700"
                                  }`}
                                  title={
                                    selectedClass.is_archived
                                      ? "Restore to active loads"
                                      : "Archive class load"
                                  }
                                >
                                  <AppIcon
                                    icon={
                                      selectedClass.is_archived
                                        ? Refresh
                                        : Archive
                                    }
                                    size="xs"
                                    color="inherit"
                                  />
                                  <span>
                                    {selectedClass.is_archived
                                      ? "Unarchive"
                                      : "Archive"}
                                  </span>
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Quick Switcher dropdown & Add class */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto shrink-0 lg:ml-auto pt-2 lg:pt-0 border-t border-slate-100 dark:border-slate-800/80 lg:border-t-0">
                        <select
                          value={selectedClassId}
                          onChange={(e) => {
                            const newClassId = e.target.value;
                            selectedClassIdRef.current = newClassId;
                            setRequirementStatuses(
                              classStatusesCacheRef.current[newClassId] || [],
                            );
                            setIsUploadSectionVisible(false);
                            setSelectedClassId(newClassId);
                            void fetchStatuses(
                              activeAY,
                              activeSem,
                              newClassId,
                              { silent: true },
                            );
                          }}
                          className="w-full sm:w-auto sm:flex-1 lg:flex-initial min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-800 outline-none focus:border-[#780000] cursor-pointer shadow-2xs"
                        >
                          {facultyClasses.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.section_code} - {c.subject_code}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            setClassFormError(null);
                            setIsAddClassModalOpen(true);
                          }}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-1 px-3.5 py-2 rounded-xl bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
                          title="Add another class load"
                        >
                          <AppIcon icon={Plus} size="xs" color="white" />
                          <span>Add Class</span>
                        </button>
                      </div>
                    </div>

                    {/* Archived Class Warning Banner */}
                    {selectedClass?.is_archived && (
                      <div className="rounded-2xl border-2 border-amber-500 bg-amber-100 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-amber-950 shadow-md">
                        <div className="flex items-center gap-3.5">
                          <div className="p-2.5 rounded-xl bg-amber-400 text-amber-950 shrink-0 shadow-xs">
                            <AppIcon icon={Lock} size="md" color="inherit" />
                          </div>
                          <div>
                            <p className="font-extrabold text-sm sm:text-base text-amber-950">
                              Archived Class Load (Uploads Locked)
                            </p>
                            <p className="text-xs sm:text-sm text-amber-900 font-medium">
                              This class is currently in the archive. Document
                              uploads, revisions, and extension requests are
                              locked. Unarchive the class to resume submitting
                              documents.
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            handleToggleArchiveClass(selectedClass)
                          }
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-amber-950 text-xs sm:text-sm font-bold transition shadow-sm cursor-pointer shrink-0 border border-amber-600/40 active:scale-95"
                        >
                          <AppIcon icon={Archive} size="sm" color="inherit" />
                          <span>Unarchive Class</span>
                        </button>
                      </div>
                    )}

                    {/* Scoped Filter Toolbar matching Requirements Verification */}
                    {displayedStatusCounts && !isLoadingStatuses && (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-950/40 p-2 sm:p-2.5 shadow-2xs overflow-x-hidden">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0">
                          <button
                            type="button"
                            onClick={() => setStep2FilterMode("all")}
                            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition cursor-pointer shadow-2xs ${
                              step2FilterMode === "all"
                                ? "bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-600/30 shadow-xs font-bold"
                                : "bg-white hover:bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700"
                            }`}
                          >
                            <AppIcon icon={Page} size="xs" color="inherit" />
                            <span>All Files</span>
                            <span
                              className={`rounded-full px-1.5 py-0.5 text-[10.5px] font-bold ${
                                step2FilterMode === "all"
                                  ? "bg-white text-slate-950 border border-amber-600/30 shadow-2xs"
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                              }`}
                            >
                              {displayedRequirementStatuses.length}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setStep2FilterMode("pending")}
                            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition cursor-pointer shadow-2xs ${
                              step2FilterMode === "pending"
                                ? "bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-600/30 shadow-xs font-bold"
                                : "bg-white hover:bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700"
                            }`}
                          >
                            <AppIcon icon={Hourglass} size="xs" color="inherit" />
                            <span>Pending Review</span>
                            <span
                              className={`rounded-full px-1.5 py-0.5 text-[10.5px] font-bold ${
                                step2FilterMode === "pending"
                                  ? "bg-white text-slate-950 border border-amber-600/30 shadow-2xs"
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                              }`}
                            >
                              {isAllValidated ? 0 : displayedStatusCounts.pending}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setStep2FilterMode("validated")}
                            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition cursor-pointer shadow-2xs ${
                              step2FilterMode === "validated"
                                ? "bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-600/30 shadow-xs font-bold"
                                : "bg-white hover:bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700"
                            }`}
                          >
                            <AppIcon icon={Check} size="xs" color="inherit" />
                            <span>Validated</span>
                            <span
                              className={`rounded-full px-1.5 py-0.5 text-[10.5px] font-bold ${
                                step2FilterMode === "validated"
                                  ? "bg-white text-slate-950 border border-amber-600/30 shadow-2xs"
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                              }`}
                            >
                              {displayedStatusCounts.validated}
                            </span>
                          </button>

                          {!isAllValidated && displayedStatusCounts.rejected > 0 ? (
                            <button
                              type="button"
                              onClick={() => setStep2FilterMode("revision")}
                              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition cursor-pointer shadow-2xs ${
                                step2FilterMode === "revision"
                                  ? "bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-600/30 shadow-xs font-bold"
                                  : "bg-white hover:bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700"
                              }`}
                            >
                              <AppIcon icon={Xmark} size="xs" color="inherit" />
                              <span>Needs Revision</span>
                              <span
                                className={`rounded-full px-1.5 py-0.5 text-[10.5px] font-bold ${
                                  step2FilterMode === "revision"
                                    ? "bg-white text-slate-950 border border-amber-600/30 shadow-2xs"
                                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                                }`}
                              >
                                {displayedStatusCounts.rejected}
                              </span>
                            </button>
                          ) : null}

                          {!isAllValidated &&
                          displayedStatusCounts.notSubmitted +
                            displayedStatusCounts.overdue >
                            0 ? (
                            <button
                              type="button"
                              onClick={() => setStep2FilterMode("not_submitted")}
                              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition cursor-pointer shadow-2xs ${
                                step2FilterMode === "not_submitted"
                                  ? "bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-600/30 shadow-xs font-bold"
                                  : "bg-white hover:bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700"
                              }`}
                            >
                              <AppIcon icon={Minus} size="xs" color="inherit" />
                              <span>Not Submitted</span>
                              <span
                                className={`rounded-full px-1.5 py-0.5 text-[10.5px] font-bold ${
                                  step2FilterMode === "not_submitted"
                                    ? "bg-white text-slate-950 border border-amber-600/30 shadow-2xs"
                                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                                }`}
                              >
                                {displayedStatusCounts.notSubmitted +
                                  displayedStatusCounts.overdue}
                              </span>
                            </button>
                          ) : null}
                        </div>
                      </div>
                    )}

                    {renderUploadNotificationSection()}

                    {/* 0. Personal Deadline Active Banner / Lock Banner */}
                    {!isAllValidated && hasActiveGracePeriod && (
                      <SubmissionLockBanner
                        isLocked={false}
                        isConfigured={isWindowConfigured}
                        isOpen={isEffectivelyOpen}
                        isPersonalDeadline={true}
                        formattedDueAt={personalDeadlineFormatted}
                      />
                    )}

                    {/* 1. Schedule Not Set Banner (No Schedule Configured in Database) */}
                    {isWindowNotConfigured &&
                      !isAllValidated &&
                      !hasActiveGracePeriod &&
                      !isEffectivelyOpen && (
                        <div className="p-3 sm:p-4 rounded-xl border border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-700 dark:text-slate-300">
                          <div className="flex items-start sm:items-center gap-2.5">
                            <div className="p-1.5 rounded-lg bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shrink-0">
                              <AppIcon
                                icon={Calendar}
                                size="md"
                                color="inherit"
                              />
                            </div>
                            <div>
                              <span className="font-bold text-slate-900 dark:text-slate-200 mr-1.5">
                                Submission Schedule Not Set:
                              </span>
                              <span className="text-slate-600 dark:text-slate-400">
                                There is currently no active academic schedule
                                set for document submissions. Uploads will
                                unlock once the administrator announces the
                                submission schedule.
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
                    {isWindowClosed &&
                      !isAllValidated &&
                      !hasActiveGracePeriod &&
                      !isEffectivelyOpen && (
                        <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm transition-all">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                              <div className="flex shrink-0 items-center justify-center text-slate-700 dark:text-slate-300">
                                <AppIcon
                                  icon={Hourglass}
                                  size="md"
                                  color="inherit"
                                  strokeWidth={2.2}
                                />
                              </div>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className="text-sm font-black text-slate-900 dark:text-slate-100 tracking-tight">
                                    Submission Window Closed
                                  </h4>
                                </div>
                                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
                                  Submission window is currently closed and document uploads are locked for this term. If you need additional time to submit requirements, you may request an extension.
                                </p>
                                {hasPendingExtensionRequest && (
                                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[11px] font-bold">
                                      <AppIcon
                                        icon={Hourglass}
                                        size="xs"
                                        color="inherit"
                                      />
                                      Extension Request Pending Admin Review
                                    </span>
                                    {pendingExtensionData?.reason && (
                                      <span className="text-[11px] text-slate-500 dark:text-slate-400 italic truncate max-w-full sm:max-w-md font-medium">
                                        &ldquo;{pendingExtensionData.reason}
                                        &rdquo;
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                            {hasLackings && (
                              <div className="w-full sm:w-auto shrink-0 flex items-center gap-2 self-stretch sm:self-center">
                                {hasPendingExtensionRequest ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setShowExtensionDetailsModal(true)
                                    }
                                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#780000] hover:bg-[#5e0000] text-white font-bold px-4.5 py-2.5 rounded-xl text-xs sm:text-sm shadow-sm hover:shadow-md transition-all cursor-pointer border border-[#5e0000]"
                                  >
                                    <AppIcon
                                      icon={Hourglass}
                                      size="sm"
                                      color="inherit"
                                    />
                                    <span>View Request Details</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => openExtensionRequestModal()}
                                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#780000] hover:bg-[#5e0000] text-white font-bold px-4.5 py-2.5 rounded-xl text-xs sm:text-sm shadow-sm hover:shadow-md active:scale-[0.98] transition-all cursor-pointer border border-[#5e0000]"
                                  >
                                    <AppIcon
                                      icon={Hourglass}
                                      size="sm"
                                      color="inherit"
                                    />
                                    <span>Request Extension</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
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
                        <AppIcon
                          icon={WarningCircle}
                          size="md"
                          color="white"
                          className="shrink-0"
                        />
                        <span className="leading-snug">{statusError}</span>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {isAllValidated && (
                          <div className="py-2.5 px-4 rounded-xl border border-[#08412a] bg-[#0b5336] text-white flex items-center gap-2.5 text-xs shadow-xs">
                            <div className="p-1 rounded-md bg-white/15 text-white shrink-0">
                              <AppIcon
                                icon={CheckCircle}
                                size="sm"
                                color="white"
                              />
                            </div>
                            <span className="font-bold text-white">
                              All Required Documents Validated
                            </span>
                            <span className="inline-flex items-center text-[11px] font-extrabold text-slate-950 bg-amber-400 px-2.5 py-0.5 rounded-full shadow-2xs">
                              {`${mandatoryValidatedCount}/${mandatoryTemplates.length} Completed`}
                            </span>
                          </div>
                        )}
                        {(() => {
                          const filteredStep2Reqs =
                            displayedRequirementStatuses.filter((req) => {
                              if (step2FilterMode === "all") return true;
                              if (step2FilterMode === "validated")
                                return req.status === "Validated";
                              if (step2FilterMode === "pending")
                                return (
                                  req.status === "Pending" &&
                                  Boolean(
                                    req.submittedAt || req.latestSubmissionId,
                                  )
                                );
                              if (step2FilterMode === "revision")
                                return req.status === "Rejected";
                              if (step2FilterMode === "not_submitted")
                                return (
                                  req.status === "Not Submitted" ||
                                  req.status === "Overdue" ||
                                  (req.status === "Pending" &&
                                    !req.latestSubmissionId &&
                                    !req.submittedAt)
                                );
                              return true;
                            });

                          if (filteredStep2Reqs.length === 0) {
                            return (
                              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-12 text-center text-xs text-slate-500 dark:text-slate-400 font-medium shadow-xs">
                                <div className="flex flex-col items-center justify-center gap-2">
                                  <p className="font-bold text-slate-700 dark:text-slate-300 text-sm">
                                    {displayedRequirementStatuses.length === 0
                                      ? "No Active Documents Required"
                                      : "No requirements match the selected filter."}
                                  </p>
                                  {step2FilterMode !== "all" ? (
                                    <button
                                      type="button"
                                      onClick={() => setStep2FilterMode("all")}
                                      className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                                    >
                                      View All Files
                                    </button>
                                  ) : (
                                    <p className="text-xs text-slate-400 dark:text-slate-500">
                                      All compliance document requirements are currently hidden or not active for this term.
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          }

                          const enrichedReqs = filteredStep2Reqs.map((req) => {
                            const submittedDateText =
                              req.submittedAt &&
                              formatSubmittedDateTime(req.submittedAt)
                                ? formatSubmittedDateTime(req.submittedAt)
                                : null;
                            const tpl = activeTemplates.find(
                              (t) => t.code === req.code,
                            );
                            const maxMb = tpl?.max_size_mb
                              ? Number(tpl.max_size_mb)
                              : 10;
                            const isMandatory =
                              templateMandatoryMap.get(req.code) !== false;
                            const isCleanedFile = Boolean(
                              req.storagePath?.startsWith("__cleaned__"),
                            );
                            const rawDisplayFileName =
                              req.fileName ||
                              (isCleanedFile
                                ? req.storagePath
                                    ?.replace(/^__cleaned__\/?/, "")
                                    .trim() || ""
                                : req.storagePath?.split("/").pop() || "") ||
                              "Uploaded Document";
                            const displayFileName = rawDisplayFileName.replace(
                              /^\d+_/,
                              "",
                            );
                            const hasUploadedFile = Boolean(
                              !isCleanedFile &&
                                req.status !== "Not Submitted" &&
                                req.status !== "Exempted" &&
                                req.status !== "Overdue" &&
                                req.latestSubmissionId &&
                                (req.submittedAt ||
                                  req.storagePath ||
                                  req.fileName),
                            );
                            const facultyRemarksText =
                              req.remarks || req.note || null;
                            const reviewerFeedbackText =
                              req.adminRemarks ||
                              req.admin_remarks ||
                              req.feedback ||
                              null;
                            const badgeStatus =
                              req.status === "Pending" &&
                              req.submittedAt &&
                              req.latestSubmissionId &&
                              (req.hasPriorRevision || req.isRevision)
                                ? "Revision Under Review"
                                : req.status === "Pending" &&
                                    req.submittedAt &&
                                    req.latestSubmissionId
                                  ? "Pending Review"
                                  : isWindowNotConfigured &&
                                      (req.status === "Not Submitted" ||
                                        req.status === "Pending" ||
                                        req.status === "Overdue")
                                    ? "Not Submitted"
                                    : req.isIndividualClosed
                                      ? "Not Submitted"
                                      : isWindowClosed &&
                                          (req.status === "Not Submitted" ||
                                            req.status === "Pending")
                                        ? "Overdue"
                                        : req.status;

                            const renderActions = (mobileCard: boolean) => {
                              const btnPad = mobileCard
                                ? "px-3 py-2 text-xs"
                                : "px-2.5 py-1 text-[11px]";
                              const fullCls = mobileCard ? "w-full" : "";

                              if (selectedClass?.is_archived) {
                                return (
                                  <div
                                    className={
                                      mobileCard
                                        ? "flex flex-col gap-2 w-full"
                                        : "flex flex-col items-center gap-1.5"
                                    }
                                  >
                                    {hasUploadedFile && (
                                      <button
                                        type="button"
                                        onClick={() => openSubmissionPreview(req)}
                                        className={`inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-750 dark:text-slate-200 font-semibold transition cursor-pointer shadow-2xs ${btnPad} ${fullCls}`}
                                      >
                                        <AppIcon
                                          icon={Eye}
                                          size="sm"
                                          color="inherit"
                                        />
                                        <span>View File</span>
                                      </button>
                                    )}
                                    <span
                                      className={`inline-flex items-center justify-center gap-1 bg-slate-200/80 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-semibold rounded-lg cursor-not-allowed border border-slate-300 dark:border-slate-700 select-none ${btnPad} ${fullCls}`}
                                      title="This class is archived. Unarchive it to upload or request extensions."
                                    >
                                      <AppIcon
                                        icon={Lock}
                                        size="xs"
                                        color="inherit"
                                      />
                                      <span>Class Archived</span>
                                    </span>
                                  </div>
                                );
                              }

                              const ongoingUpload = uploadTasks.find(
                                (t) =>
                                  t.requirementCode === req.code &&
                                  t.status === "uploading" &&
                                  (selectedClassId
                                    ? t.classId === selectedClassId
                                    : !t.classId),
                              );
                              if (ongoingUpload) {
                                return (
                                  <div
                                    className={`inline-flex items-center justify-center gap-1.5 bg-amber-500 border border-amber-600 text-slate-950 font-bold rounded-lg shadow-xs ${mobileCard ? "w-full px-3 py-2 text-xs" : "px-3 py-1 text-[11px]"}`}
                                  >
                                    <AppIcon
                                      icon={SystemRestart}
                                      size="xs"
                                      color="inherit"
                                      className="animate-spin shrink-0"
                                    />
                                    <span className="truncate">
                                      Uploading {ongoingUpload.progress}%
                                    </span>
                                  </div>
                                );
                              }

                              return (
                                <div
                                  className={
                                    mobileCard
                                      ? "flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 w-full"
                                      : "flex flex-wrap items-center justify-center gap-1.5"
                                  }
                                >
                                  {req.status === "Exempted" && (
                                    <button
                                      type="button"
                                      disabled
                                      className={`inline-flex items-center justify-center gap-1 bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-slate-300 dark:border-slate-700 font-medium rounded-lg cursor-not-allowed ${btnPad} ${fullCls}`}
                                      title="This requirement is exempted."
                                    >
                                      <AppIcon
                                        icon={Minus}
                                        size="xs"
                                        color="inherit"
                                      />
                                      <span>Exempted</span>
                                    </button>
                                  )}

                                  {req.status === "Rejected" &&
                                    ((isWindowNotConfigured ||
                                      req.isIndividualClosed) &&
                                    !req.isExtended &&
                                    !hasActiveGracePeriod &&
                                    !isEffectivelyOpen ? (
                                      <button
                                        type="button"
                                        disabled
                                        className={`inline-flex items-center justify-center gap-1 bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-slate-300 dark:border-slate-700 font-medium rounded-lg cursor-not-allowed ${btnPad} ${fullCls}`}
                                        title="Submissions will open once the administration announces the submission schedule."
                                      >
                                        <AppIcon
                                          icon={Calendar}
                                          size="xs"
                                          color="inherit"
                                        />
                                        <span>Awaiting Schedule</span>
                                      </button>
                                    ) : req.isExtended ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          openDirectUploadModal(req.code, true)
                                        }
                                        className={`inline-flex items-center justify-center gap-1 bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-700 font-semibold rounded-lg shadow-2xs transition-all cursor-pointer ${btnPad} ${fullCls}`}
                                        title={`Upload revision unlocked until ${formatDeadlineDate(req.extendedUntil)}`}
                                      >
                                        <AppIcon
                                          icon={Upload}
                                          size="xs"
                                          color="white"
                                        />
                                        <span>Upload Revision</span>
                                      </button>
                                    ) : (isWindowClosed ||
                                        Boolean(
                                          req.effectiveDeadline &&
                                            Date.now() >
                                              new Date(
                                                req.effectiveDeadline,
                                              ).getTime(),
                                        )) &&
                                      !hasActiveGracePeriod &&
                                      !isEffectivelyOpen &&
                                      !req.customDueDate ? (
                                      <button
                                        type="button"
                                        disabled
                                        className={`inline-flex items-center justify-center gap-1 bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-slate-300 dark:border-slate-700 font-medium rounded-lg cursor-not-allowed ${btnPad} ${fullCls}`}
                                        title="Uploads are locked because the submission window is closed."
                                      >
                                        <AppIcon
                                          icon={Lock}
                                          size="xs"
                                          color="inherit"
                                        />
                                        <span>Uploads Locked</span>
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          openDirectUploadModal(req.code, true)
                                        }
                                        className={`inline-flex items-center justify-center gap-1 bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-600/40 font-semibold rounded-lg shadow-2xs transition-all cursor-pointer ${btnPad} ${fullCls}`}
                                      >
                                        <AppIcon
                                          icon={Upload}
                                          size="xs"
                                          color="inherit"
                                        />
                                        <span>Upload Revision</span>
                                      </button>
                                    ))}

                                  {hasUploadedFile ? (
                                    <button
                                      type="button"
                                      onClick={() => openSubmissionPreview(req)}
                                      className={`inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-750 dark:text-slate-200 font-semibold transition cursor-pointer shadow-2xs ${btnPad} ${fullCls}`}
                                    >
                                      <AppIcon
                                        icon={Eye}
                                        size="xs"
                                        color="inherit"
                                      />
                                      <span>View File</span>
                                    </button>
                                  ) : null}

                                  {req.status === "Extended" &&
                                    !req.latestSubmissionId && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          openDirectUploadModal(req.code)
                                        }
                                        className={`inline-flex items-center justify-center gap-1 bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-600/40 font-semibold rounded-lg shadow-2xs transition-all cursor-pointer ${btnPad} ${fullCls}`}
                                      >
                                        <AppIcon
                                          icon={Upload}
                                          size="xs"
                                          color="inherit"
                                        />
                                        <span>Upload</span>
                                      </button>
                                    )}

                                  {req.status === "Overdue" && (
                                    <button
                                      type="button"
                                      disabled
                                      className={`inline-flex items-center justify-center gap-1 bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-slate-300 dark:border-slate-700 font-medium rounded-lg cursor-not-allowed ${btnPad} ${fullCls}`}
                                      title={
                                        isWindowNotConfigured ||
                                        req.isIndividualClosed
                                          ? "Submissions will open once the administration announces the submission schedule."
                                          : "Uploads are locked because the submission window is closed."
                                      }
                                    >
                                      <AppIcon
                                        icon={
                                          isWindowNotConfigured ||
                                          req.isIndividualClosed
                                            ? Calendar
                                            : Lock
                                        }
                                        size="xs"
                                        color="inherit"
                                      />
                                      <span>
                                        {isWindowNotConfigured ||
                                        req.isIndividualClosed
                                          ? "Awaiting Schedule"
                                          : "Uploads Locked"}
                                      </span>
                                    </button>
                                  )}

                                  {((req.status === "Pending" &&
                                    (!req.latestSubmissionId ||
                                      !req.submittedAt)) ||
                                    req.status === "Not Submitted") &&
                                    ((isWindowClosed ||
                                      isWindowNotConfigured ||
                                      req.isIndividualClosed) &&
                                    !req.customDueDate &&
                                    !hasActiveGracePeriod &&
                                    !isEffectivelyOpen ? (
                                      <button
                                        type="button"
                                        disabled
                                        className={`inline-flex items-center justify-center gap-1 bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-slate-300 dark:border-slate-700 font-medium rounded-lg cursor-not-allowed ${btnPad} ${fullCls}`}
                                        title={
                                          isWindowClosed &&
                                          !req.isIndividualClosed
                                            ? "Uploads are locked because the submission window is closed."
                                            : "Submissions will open once the administration announces the submission schedule."
                                        }
                                      >
                                        <AppIcon
                                          icon={
                                            isWindowClosed &&
                                            !req.isIndividualClosed
                                              ? Lock
                                              : Calendar
                                          }
                                          size="xs"
                                          color="inherit"
                                        />
                                        <span>
                                          {isWindowClosed &&
                                          !req.isIndividualClosed
                                            ? "Uploads Locked"
                                            : "Awaiting Schedule"}
                                        </span>
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          openDirectUploadModal(req.code)
                                        }
                                        className={`inline-flex items-center justify-center gap-1 bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-600/40 font-semibold rounded-lg shadow-2xs transition-all cursor-pointer ${btnPad} ${fullCls}`}
                                      >
                                        <AppIcon
                                          icon={Upload}
                                          size="xs"
                                          color="inherit"
                                        />
                                        <span>Upload</span>
                                      </button>
                                    ))}
                                </div>
                              );
                            };

                            return {
                              req,
                              submittedDateText,
                              maxMb,
                              isMandatory,
                              isCleanedFile,
                              rawDisplayFileName,
                              displayFileName,
                              hasUploadedFile,
                              facultyRemarksText,
                              reviewerFeedbackText,
                              badgeStatus,
                              renderActions,
                            };
                          });

                          return (
                            <>
                              {/* Mobile Stacked Requirement Cards */}
                              <div className="md:hidden space-y-3">
                                {enrichedReqs.map(
                                  ({
                                    req,
                                    submittedDateText,
                                    maxMb,
                                    isMandatory,
                                    isCleanedFile,
                                    rawDisplayFileName,
                                    displayFileName,
                                    hasUploadedFile,
                                    facultyRemarksText,
                                    reviewerFeedbackText,
                                    badgeStatus,
                                    renderActions,
                                  }) => (
                                    <div
                                      key={`mob-${req.code}`}
                                      id={`requirement-mobile-${req.code}`}
                                      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3 shadow-xs min-w-0"
                                    >
                                      <div className="flex flex-wrap items-start justify-between gap-2">
                                        <div className="min-w-0 flex-1 space-y-1">
                                          <div className="flex flex-wrap items-center gap-1.5">
                                            {isMandatory ? (
                                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-[#780000] text-white border border-[#5e0000]">
                                                Required
                                              </span>
                                            ) : (
                                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-700 text-white border border-slate-600">
                                                Optional
                                              </span>
                                            )}
                                          </div>
                                          <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm leading-snug break-words">
                                            {getRequirementTitle(req.code)}
                                          </h4>
                                          {submittedDateText ? (
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                              Submitted: {submittedDateText}
                                            </p>
                                          ) : (
                                            <p className="text-[11px] text-slate-400 dark:text-slate-500 italic">
                                              Not submitted
                                            </p>
                                          )}
                                          <p className="text-[11px] text-slate-400 dark:text-slate-500">
                                            {req.effectiveDeadline &&
                                            !req.submittedAt &&
                                            req.status !== "Exempted" ? (
                                              <span
                                                className={
                                                  req.status === "Overdue"
                                                    ? "text-[#780000] dark:text-rose-400 font-semibold"
                                                    : req.status === "Extended"
                                                      ? "text-indigo-600 dark:text-indigo-400 font-semibold"
                                                      : ""
                                                }
                                              >
                                                Due:{" "}
                                                {formatDeadlineDate(
                                                  req.effectiveDeadline,
                                                )}{" "}
                                                &bull;{" "}
                                              </span>
                                            ) : null}
                                            Max {maxMb} MB
                                          </p>
                                        </div>
                                        <div className="shrink-0">
                                          <SubmissionStatusBadge
                                            status={badgeStatus}
                                            size="sm"
                                          />
                                        </div>
                                      </div>

                                      {(isCleanedFile || hasUploadedFile) && (
                                        <div className="rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 px-3 py-2 space-y-1.5 min-w-0">
                                          <p
                                            className="font-medium text-slate-800 dark:text-slate-200 text-xs break-all leading-snug"
                                            title={rawDisplayFileName}
                                          >
                                            {displayFileName}
                                          </p>
                                          {isCleanedFile && (
                                            <span className="inline-flex items-center gap-1 rounded-md border border-amber-600 bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-slate-950 shadow-2xs">
                                              Cleaned (Archived to ZIP)
                                            </span>
                                          )}
                                        </div>
                                      )}

                                      {(facultyRemarksText ||
                                        reviewerFeedbackText ||
                                        req.status === "Rejected") && (
                                        <div className="space-y-1.5 min-w-0">
                                          {facultyRemarksText && (
                                            <div className="rounded-lg border border-slate-200/90 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 px-2.5 py-1.5 text-xs min-w-0">
                                              <p className="text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-0.5">
                                                Faculty Remarks
                                              </p>
                                              <p className="text-[11px] text-slate-800 dark:text-slate-200 font-medium leading-relaxed break-words">
                                                &ldquo;{facultyRemarksText}&rdquo;
                                              </p>
                                            </div>
                                          )}
                                          {req.status === "Rejected" ? (
                                            <div className="rounded-lg border border-rose-200 dark:border-rose-900/50 bg-rose-50/60 dark:bg-rose-950/30 px-2.5 py-1.5 text-xs min-w-0">
                                              <p className="text-[10px] font-bold text-rose-700 dark:text-rose-300 mb-0.5">
                                                Revision Sent
                                              </p>
                                              <p className="text-[11px] text-slate-800 dark:text-slate-200 font-medium leading-relaxed break-words">
                                                &ldquo;
                                                {reviewerFeedbackText ||
                                                  "Revision requested. Please check and resubmit."}
                                                &rdquo;
                                              </p>
                                            </div>
                                          ) : req.status === "Validated" &&
                                            reviewerFeedbackText ? (
                                            <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/60 dark:bg-emerald-950/30 px-2.5 py-1.5 text-xs min-w-0">
                                              <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 mb-0.5">
                                                Validated Remarks
                                              </p>
                                              <p className="text-[11px] text-slate-800 dark:text-slate-200 font-medium leading-relaxed break-words">
                                                &ldquo;{reviewerFeedbackText}
                                                &rdquo;
                                              </p>
                                            </div>
                                          ) : null}
                                        </div>
                                      )}

                                      <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                                        {renderActions(true)}
                                      </div>
                                    </div>
                                  ),
                                )}
                              </div>

                              {/* Desktop Requirements Table */}
                              <div className="hidden md:block overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
                                <div className="overflow-x-auto">
                                  <table className="w-full table-fixed text-left text-xs text-slate-600 dark:text-slate-300 min-w-[880px]">
                                    <thead className="bg-slate-50/60 dark:bg-slate-950/50 border-b border-slate-200/80 dark:border-slate-800/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                      <tr>
                                        <th className="px-4 py-3 w-[25%] text-center">
                                          Requirement
                                        </th>
                                        <th className="px-3 py-3 w-[10%] text-center">
                                          Type
                                        </th>
                                        <th className="px-4 py-3 w-[25%] text-center">
                                          Attached File
                                        </th>
                                        <th className="px-4 py-3 w-[24%]">
                                          Notes &amp; Feedback
                                        </th>
                                        <th className="px-4 py-3 w-[16%] text-center">
                                          Status
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                                      {enrichedReqs.map(
                                        ({
                                          req,
                                          submittedDateText,
                                          maxMb,
                                          isMandatory,
                                          isCleanedFile,
                                          rawDisplayFileName,
                                          displayFileName,
                                          hasUploadedFile,
                                          facultyRemarksText,
                                          reviewerFeedbackText,
                                          badgeStatus,
                                          renderActions,
                                        }) => (
                                          <tr
                                            key={req.code}
                                            id={`requirement-${req.code}`}
                                            className="bg-white hover:bg-slate-50/70 dark:bg-slate-900 dark:hover:bg-slate-800/30 transition-colors"
                                          >
                                            {/* Column 1: Requirement */}
                                            <td className="px-4 py-3.5 align-middle text-center">
                                              <div className="space-y-1 min-w-0 text-center">
                                                <span className="font-semibold text-slate-900 dark:text-slate-100 text-xs block leading-snug">
                                                  {getRequirementTitle(req.code)}
                                                </span>
                                                {submittedDateText ? (
                                                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                                                    Submitted:{" "}
                                                    {submittedDateText}
                                                  </span>
                                                ) : (
                                                  <span className="text-[11px] text-slate-400 dark:text-slate-500 italic block">
                                                    Not submitted
                                                  </span>
                                                )}
                                                <span className="text-[10.5px] text-slate-400 dark:text-slate-500 block">
                                                  {req.effectiveDeadline &&
                                                  !req.submittedAt &&
                                                  req.status !== "Exempted" ? (
                                                    <span
                                                      className={
                                                        req.status === "Overdue"
                                                          ? "text-[#780000] dark:text-rose-400 font-semibold"
                                                          : req.status ===
                                                              "Extended"
                                                            ? "text-indigo-600 dark:text-indigo-400 font-semibold"
                                                            : ""
                                                      }
                                                    >
                                                      Due:{" "}
                                                      {formatDeadlineDate(
                                                        req.effectiveDeadline,
                                                      )}{" "}
                                                      &bull;{" "}
                                                    </span>
                                                  ) : null}
                                                  Max {maxMb} MB
                                                </span>
                                              </div>
                                            </td>

                                            {/* Column 2: Type */}
                                            <td className="px-3 py-3.5 align-middle text-center">
                                              <div className="flex items-center justify-center">
                                                {isMandatory ? (
                                                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-[#780000] text-white border border-[#5e0000] shadow-2xs">
                                                    Required
                                                  </span>
                                                ) : (
                                                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-700 text-white border border-slate-600 shadow-2xs">
                                                    Optional
                                                  </span>
                                                )}
                                              </div>
                                            </td>

                                            {/* Column 3: Attached File */}
                                            <td className="px-4 py-3.5 align-middle text-center">
                                              <div className="flex flex-col items-center justify-center gap-1.5 min-w-0 text-center">
                                                {isCleanedFile ? (
                                                  <>
                                                    <span
                                                      className="font-medium text-slate-700 dark:text-slate-300 break-words text-xs leading-snug"
                                                      title={rawDisplayFileName}
                                                    >
                                                      {displayFileName}
                                                    </span>
                                                    <span className="inline-flex items-center gap-1 rounded-md border border-amber-600 bg-amber-500 px-2.5 py-0.5 text-[10px] font-bold text-slate-950 shadow-2xs">
                                                      Cleaned (Archived to ZIP)
                                                    </span>
                                                  </>
                                                ) : hasUploadedFile ? (
                                                  <span
                                                    className="font-medium text-slate-900 dark:text-slate-100 truncate max-w-full block text-xs leading-snug"
                                                    title={rawDisplayFileName}
                                                  >
                                                    {displayFileName}
                                                  </span>
                                                ) : null}
                                                {renderActions(false)}
                                              </div>
                                            </td>

                                            {/* Column 4: Notes & Feedback */}
                                            <td className="px-4 py-3.5 align-top">
                                              {facultyRemarksText ||
                                              reviewerFeedbackText ||
                                              req.status === "Rejected" ? (
                                                <div className="flex flex-col gap-1.5 min-w-0">
                                                  {facultyRemarksText ? (
                                                    <div
                                                      className="rounded-lg border border-slate-200/90 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 px-2.5 py-1.5 text-xs shadow-2xs min-w-0"
                                                      title={facultyRemarksText}
                                                    >
                                                      <div className="flex items-center gap-1.5 mb-1">
                                                        <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shrink-0 [&>svg]:h-2.5 [&>svg]:w-2.5">
                                                          <AppIcon
                                                            icon={ChatBubble}
                                                            size="xs"
                                                            color="inherit"
                                                          />
                                                        </span>
                                                        <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 tracking-tight">
                                                          Faculty Remarks
                                                        </span>
                                                      </div>
                                                      <p className="text-[11px] text-slate-800 dark:text-slate-200 font-medium leading-relaxed line-clamp-2 pl-5 break-words">
                                                        &ldquo;
                                                        {facultyRemarksText}
                                                        &rdquo;
                                                      </p>
                                                    </div>
                                                  ) : null}

                                                  {req.status === "Rejected" ? (
                                                    <div
                                                      className="rounded-lg border border-slate-200/90 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 px-2.5 py-1.5 text-xs shadow-2xs min-w-0"
                                                      title={
                                                        reviewerFeedbackText ||
                                                        "Revision requested. Please check and resubmit."
                                                      }
                                                    >
                                                      <div className="flex items-center gap-1.5 mb-1">
                                                        <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shrink-0 [&>svg]:h-2.5 [&>svg]:w-2.5">
                                                          <AppIcon
                                                            icon={Xmark}
                                                            size="xs"
                                                            color="inherit"
                                                            strokeWidth={2.5}
                                                          />
                                                        </span>
                                                        <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 tracking-tight">
                                                          Revision Sent
                                                        </span>
                                                      </div>
                                                      <p className="text-[11px] text-slate-800 dark:text-slate-200 font-medium leading-relaxed line-clamp-2 pl-5 break-words">
                                                        &ldquo;
                                                        {reviewerFeedbackText ||
                                                          "Revision requested. Please check and resubmit."}
                                                        &rdquo;
                                                      </p>
                                                    </div>
                                                  ) : req.status ===
                                                      "Validated" &&
                                                    reviewerFeedbackText ? (
                                                    <div
                                                      className="rounded-lg border border-slate-200/90 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 px-2.5 py-1.5 text-xs shadow-2xs min-w-0"
                                                      title={
                                                        reviewerFeedbackText
                                                      }
                                                    >
                                                      <div className="flex items-center gap-1.5 mb-1">
                                                        <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shrink-0 [&>svg]:h-2.5 [&>svg]:w-2.5">
                                                          <AppIcon
                                                            icon={Check}
                                                            size="xs"
                                                            color="inherit"
                                                            strokeWidth={2.5}
                                                          />
                                                        </span>
                                                        <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 tracking-tight">
                                                          Validated Remarks
                                                        </span>
                                                      </div>
                                                      <p className="text-[11px] text-slate-800 dark:text-slate-200 font-medium leading-relaxed line-clamp-2 pl-5 break-words">
                                                        &ldquo;
                                                        {reviewerFeedbackText}
                                                        &rdquo;
                                                      </p>
                                                    </div>
                                                  ) : null}
                                                </div>
                                              ) : (
                                                <div className="pt-0.5">
                                                  <span className="text-slate-400 dark:text-slate-600 text-xs italic block">
                                                    &mdash;
                                                  </span>
                                                </div>
                                              )}
                                            </td>

                                            {/* Column 5: Status */}
                                            <td className="px-4 py-3.5 align-middle text-center">
                                              <div className="flex items-center justify-center">
                                                <SubmissionStatusBadge
                                                  status={badgeStatus}
                                                  size="md"
                                                />
                                              </div>
                                            </td>
                                          </tr>
                                        ),
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    )}
                      </div>
                    </div>
                  </div>
                )}
              </article>
            )}
            {isMounted && selectedRequirementForUpload && (
              <div
                className="fixed inset-0 z-[60] h-dvh overflow-hidden overscroll-none flex items-center justify-center p-3 sm:p-4"
                role="dialog"
                aria-modal="true"
                aria-labelledby="upload-modal-title"
                onClick={closeDirectUploadModal}
              >
                <div
                  className="fixed inset-0 h-lvh bg-slate-950/80 backdrop-blur-sm touch-none overscroll-none"
                  aria-hidden="true"
                />
                <div
                  className="relative z-10 w-full max-w-2xl max-h-[90dvh] flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
                  onClick={(event) => event.stopPropagation()}
                >
                  {/* Modal Header (Pinned Top) */}
                  <ModalHeader
                    className="shrink-0"
                    icon={
                      isRevisionUpload ||
                      (selectedRequirementForUpload &&
                        getRequirementStatus(selectedRequirementForUpload) ===
                          "Rejected")
                        ? WarningCircle
                        : Upload
                    }
                    title={
                      isRevisionUpload ||
                      (selectedRequirementForUpload &&
                        getRequirementStatus(selectedRequirementForUpload) ===
                          "Rejected")
                        ? `Resubmit Revision: ${selectedRequirementForUpload ? getRequirementTitle(selectedRequirementForUpload) : ""}`
                        : `Upload ${selectedRequirementForUpload ? getRequirementTitle(selectedRequirementForUpload) : ""}`
                    }
                    subtitle={
                      isRevisionUpload ||
                      (selectedRequirementForUpload &&
                        getRequirementStatus(selectedRequirementForUpload) ===
                          "Rejected")
                        ? "Upload your revised compliance document addressing the reviewer's feedback below."
                        : selectedRequirementForUpload &&
                            templateMandatoryMap.get(
                              selectedRequirementForUpload,
                            ) === false
                          ? "Optional submission for this academic term."
                          : "Required compliance document for admin review and validation."
                    }
                    onClose={closeDirectUploadModal}
                    closeAriaLabel="Close upload modal"
                  />

                  {/* Modal Form with Scrollable Content */}
                  <form
                    onSubmit={handleDirectUploadSubmit}
                    className="flex flex-col flex-1 min-h-0 overflow-hidden"
                  >
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                      {/* Reviewer Feedback / Revision Request Alert Box */}
                      {(isRevisionUpload ||
                        (selectedRequirementForUpload &&
                          getRequirementStatus(selectedRequirementForUpload) ===
                            "Rejected")) &&
                        (() => {
                          const statusItem = selectedRequirementForUpload
                            ? getRequirementStatusItem(
                                selectedRequirementForUpload,
                              )
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
                                <span>
                                  Reviewer Feedback / Revision Request:
                                </span>
                              </div>
                              <p className="text-xs text-slate-800 dark:text-slate-200 italic font-medium leading-relaxed pl-5.5">
                                &ldquo;{reviewerRemarks}&rdquo;
                              </p>
                            </div>
                          );
                        })()}

                      <div>
                        {(() => {
                          const reqCodeClean = (
                            selectedRequirementForUpload || ""
                          )
                            .toLowerCase()
                            .trim()
                            .replace(/[-_\s]+/g, "");
                          const currentTemplate =
                            activeTemplates.find(
                              (t) => t.code === selectedRequirementForUpload,
                            ) ||
                            activeTemplates.find(
                              (t) =>
                                t.code.toLowerCase().trim() ===
                                (selectedRequirementForUpload || "")
                                  .toLowerCase()
                                  .trim(),
                            ) ||
                            activeTemplates.find(
                              (t) =>
                                t.code
                                  .toLowerCase()
                                  .trim()
                                  .replace(/[-_\s]+/g, "") === reqCodeClean,
                            ) ||
                            activeTemplates.find(
                              (t) =>
                                t.title.toLowerCase().trim() ===
                                (selectedRequirementForUpload || "")
                                  .toLowerCase()
                                  .trim(),
                            ) ||
                            activeTemplates.find(
                              (t) =>
                                t.title
                                  .toLowerCase()
                                  .trim()
                                  .replace(/[-_\s]+/g, "") === reqCodeClean,
                            );

                          const maxSizeMb = currentTemplate?.max_size_mb
                            ? Number(currentTemplate.max_size_mb)
                            : 50;
                          const allowedFormats =
                            Array.isArray(currentTemplate?.allowed_formats) &&
                            currentTemplate.allowed_formats.length > 0
                              ? currentTemplate.allowed_formats
                              : ["PDF", "DOCX", "XLSX", "PNG", "JPG", "ZIP"];

                          return (
                            <DocumentUploadZone
                              selectedFile={directUploadFile}
                              onFileSelect={setDirectUploadFile}
                              isUploading={isUploadingDirect}
                              uploadProgress={directUploadPercent}
                              maxSizeMb={maxSizeMb}
                              allowedFormats={allowedFormats}
                              currentStatus={
                                isRevisionUpload ||
                                (selectedRequirementForUpload &&
                                  getRequirementStatus(
                                    selectedRequirementForUpload,
                                  ) === "Rejected")
                                  ? undefined
                                  : selectedRequirementForUpload
                                    ? getRequirementStatus(
                                        selectedRequirementForUpload,
                                      )
                                    : null
                              }
                              reviewerFeedback={
                                isRevisionUpload ||
                                (selectedRequirementForUpload &&
                                  getRequirementStatus(
                                    selectedRequirementForUpload,
                                  ) === "Rejected")
                                  ? undefined
                                  : selectedRequirementForUpload
                                    ? getRequirementStatusItem(
                                        selectedRequirementForUpload,
                                      )?.adminRemarks ||
                                      getRequirementStatusItem(
                                        selectedRequirementForUpload,
                                      )?.admin_remarks ||
                                      getRequirementStatusItem(
                                        selectedRequirementForUpload,
                                      )?.feedback
                                    : null
                              }
                            />
                          );
                        })()}
                      </div>

                      <div>
                        <label
                          htmlFor="directUploadRemarks"
                          className="block text-xs uppercase tracking-[0.18em] font-semibold text-slate-700 dark:text-amber-300 mb-1.5"
                        >
                          {isRevisionUpload ||
                          (selectedRequirementForUpload &&
                            getRequirementStatus(
                              selectedRequirementForUpload,
                            ) === "Rejected")
                            ? "Notes on Corrections Made (Optional)"
                            : "Notes / Remarks for Reviewer (Optional)"}
                        </label>
                        <textarea
                          id="directUploadRemarks"
                          rows={3}
                          className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-3 text-xs text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition resize-none placeholder:text-slate-400"
                          placeholder={
                            isRevisionUpload ||
                            (selectedRequirementForUpload &&
                              getRequirementStatus(
                                selectedRequirementForUpload,
                              ) === "Rejected")
                              ? "Explain the corrections made in this revision (e.g., Added missing signatures, updated section codes)..."
                              : "Add optional notes or remarks for the reviewer..."
                          }
                          value={directUploadRemarks}
                          onChange={(e) =>
                            setDirectUploadRemarks(e.target.value)
                          }
                        />
                      </div>

                      {directUploadMessage && (
                        <div
                          role="alert"
                          className={`rounded-xl p-3 text-xs sm:text-sm font-semibold flex items-center gap-2.5 shadow-xs ${
                            directUploadMessage
                              .toLowerCase()
                              .includes("error") ||
                            directUploadMessage
                              .toLowerCase()
                              .includes("failed") ||
                            directUploadMessage
                              .toLowerCase()
                              .includes("please") ||
                            directUploadMessage
                              .toLowerCase()
                              .includes("exceeds")
                              ? "bg-[#780000] text-white border border-[#5e0000]"
                              : "bg-[#0b5336] text-white border border-[#08412a]"
                          }`}
                        >
                          <AppIcon
                            icon={
                              directUploadMessage
                                .toLowerCase()
                                .includes("error") ||
                              directUploadMessage
                                .toLowerCase()
                                .includes("failed") ||
                              directUploadMessage
                                .toLowerCase()
                                .includes("please") ||
                              directUploadMessage
                                .toLowerCase()
                                .includes("exceeds")
                                ? WarningCircle
                                : CheckCircle
                            }
                            size="md"
                            color="white"
                            className="shrink-0"
                          />
                          <span className="leading-snug">
                            {directUploadMessage}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Modal Footer (Pinned Bottom) */}
                    <div className="grid grid-cols-2 sm:flex sm:items-center sm:justify-end gap-2.5 px-4 sm:px-6 py-3 sm:py-3.5 border-t border-slate-200 dark:border-slate-800 shrink-0 bg-slate-50/70 dark:bg-slate-950/50">
                      <button
                        type="button"
                        onClick={closeDirectUploadModal}
                        disabled={isUploadingDirect}
                        className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2.5 sm:py-2 rounded-xl text-xs font-semibold bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] shadow-xs transition-colors cursor-pointer disabled:opacity-50 active:scale-[0.98]"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isUploadingDirect || !directUploadFile}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2.5 sm:py-2 rounded-xl text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-amber-500 disabled:shadow-none active:scale-[0.98]"
                      >
                        {isUploadingDirect ? (
                          <>
                            <AppIcon
                              icon={SystemRestart}
                              size="sm"
                              color="inherit"
                              className="animate-spin"
                            />
                            <span>
                              {isRevisionUpload ||
                              (selectedRequirementForUpload &&
                                getRequirementStatus(
                                  selectedRequirementForUpload,
                                ) === "Rejected")
                                ? "Uploading Revision..."
                                : "Uploading..."}
                            </span>
                          </>
                        ) : (
                          <>
                            <AppIcon icon={Upload} size="sm" color="inherit" />
                            <span>
                              {isRevisionUpload ||
                              (selectedRequirementForUpload &&
                                getRequirementStatus(
                                  selectedRequirementForUpload,
                                ) === "Rejected")
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
            {isMounted &&
              isSubmittingModalOpen &&
              (isUploadingDirect ? (
                <SystemLoadingScreen
                  fullScreen={true}
                  text={
                    isRevisionUpload
                      ? "Submitting Revision..."
                      : "Submitting Document..."
                  }
                  subtitle={directUploadFile?.name}
                  progress={directUploadPercent}
                />
              ) : isSubmitSuccess ? (
                <div
                  role="dialog"
                  aria-modal="true"
                  className="fixed inset-0 z-[70] h-dvh overflow-hidden overscroll-none flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
                >
                  <div
                    className="fixed inset-0 h-lvh bg-slate-950/80 backdrop-blur-sm touch-none overscroll-none"
                    aria-hidden="true"
                  />
                  <div className="relative z-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-10 max-w-lg max-h-[90dvh] overflow-y-auto overflow-x-hidden overscroll-contain w-full text-center shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
                    <div className="space-y-6 py-2">
                      {/* Large Solid PUP Green Icon Badge */}
                      <div className="mx-auto flex h-20 w-20 sm:h-28 sm:w-28 items-center justify-center rounded-3xl bg-[#0b5336] text-white shadow-xl shadow-[#0b5336]/30 border-2 border-[#08412a] animate-in zoom-in duration-300">
                        <CheckCircle className="w-10 h-10 sm:w-14 sm:h-14 stroke-[2.5]" />
                      </div>

                      {/* Title & Description */}
                      <div className="space-y-2">
                        <h3 className="text-xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                          Submitted Successfully!
                        </h3>
                        <p className="text-xs sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-md mx-auto px-2">
                          Your requirement has been uploaded and queued for
                          admin validation.
                        </p>
                      </div>

                      {/* File Card Pill */}
                      {directUploadFile && (
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3.5 sm:p-4 text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-center gap-2.5 shadow-xs">
                          <Page className="w-5 h-5 text-[#0b5336] dark:text-emerald-400 shrink-0" />
                          <span className="truncate max-w-full sm:max-w-[360px]">
                            {directUploadFile.name}
                          </span>
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
              ) : null)}
            {isMounted && successModalData.isOpen && (
              <div
                className="fixed inset-0 z-[70] h-dvh overflow-hidden overscroll-none flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
                role="dialog"
                aria-modal="true"
                aria-labelledby="success-modal-title"
                onClick={() =>
                  setSuccessModalData({ isOpen: false, requirementTitle: "" })
                }
              >
                <div
                  className="fixed inset-0 h-lvh bg-slate-950/80 backdrop-blur-sm touch-none overscroll-none"
                  aria-hidden="true"
                />
                <div
                  className="relative z-10 w-full max-w-lg max-h-[90dvh] overflow-y-auto overflow-x-hidden overscroll-contain rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-10 text-center shadow-2xl space-y-6 animate-in zoom-in-95 duration-200"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="mx-auto flex h-20 w-20 sm:h-28 sm:w-28 items-center justify-center rounded-3xl bg-[#0b5336] text-white shadow-xl shadow-[#0b5336]/30 border-2 border-[#08412a] animate-in zoom-in duration-300">
                    <CheckCircle className="w-10 h-10 sm:w-14 sm:h-14 stroke-[2.5]" />
                  </div>
                  <div className="space-y-2">
                    <h3
                      id="success-modal-title"
                      className="text-xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight"
                    >
                      Upload Successful!
                    </h3>
                    <p className="text-xs sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-md mx-auto px-2">
                      Your requirement has been uploaded and queued for admin
                      validation.
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
                className="fixed inset-0 z-[70] flex flex-col w-full h-dvh bg-white dark:bg-slate-900 overflow-hidden overscroll-none"
                role="dialog"
                aria-modal="true"
                aria-labelledby="submission-history-title"
                onClick={closeHistoryModal}
              >
                <div
                  className="relative flex w-full h-full flex-col bg-white dark:bg-slate-900 overflow-hidden"
                  onClick={(event) => event.stopPropagation()}
                >
                  <ModalHeader
                    title="Validation History"
                    subtitle="Official verified submissions and reviewer remarks"
                    titleId="submission-history-title"
                    icon={ClockRotateRight}
                    onClose={closeHistoryModal}
                    closeAriaLabel="Close history modal"
                    className="shrink-0"
                  />
                  <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-2.5 sm:gap-3 border-b border-slate-200 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-950/60 px-4 sm:px-6 py-3 shrink-0">
                    <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
                      <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                        Academic Term:
                      </span>
                      <select
                        id="modalHistoryAcademicYear"
                        aria-label="School Year"
                        className="w-full sm:w-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 sm:py-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100 outline-none transition focus:border-amber-500 shadow-2xs"
                        value={historyAcademicYear}
                        onChange={(event) => {
                          hasManuallyChangedHistoryTermRef.current = true;
                          setHistoryAcademicYear(event.target.value);
                        }}
                      >
                        {historyAcademicYears.map((year) => {
                          const currentAy =
                            historyCurrentTerm?.academicYear || activeAY;
                          const isCurrentYear = Boolean(
                            currentAy && year === currentAy,
                          );
                          return (
                            <option key={year} value={year}>
                              {year === "All"
                                ? "All Academic Years"
                                : `A.Y. ${year}${isCurrentYear ? " (Current)" : ""}`}
                            </option>
                          );
                        })}
                      </select>

                      <select
                        id="modalHistorySemester"
                        aria-label="Semester"
                        className="w-full sm:w-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 sm:py-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100 outline-none transition focus:border-amber-500 shadow-2xs"
                        value={historySemester}
                        onChange={(event) => {
                          hasManuallyChangedHistoryTermRef.current = true;
                          setHistorySemester(
                            event.target.value as
                              | (typeof SEMESTER_OPTIONS)[number]
                              | "All",
                          );
                        }}
                      >
                        {historySemesterOptions.map((semester) => {
                          const currentAy =
                            historyCurrentTerm?.academicYear || activeAY;
                          const currentSem =
                            historyCurrentTerm?.semester || activeSem;
                          const isCurrentSemester = Boolean(
                            currentSem &&
                              semester === currentSem &&
                              (!currentAy || historyAcademicYear === currentAy),
                          );
                          return (
                            <option key={semester} value={semester}>
                              {`${semester}${isCurrentSemester ? " (Current)" : ""}`}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto">
                      {(() => {
                        const hasDownloadableHistory =
                          filteredPastSubmissions.some((s) =>
                            Boolean(
                              s.storagePath &&
                                !s.storagePath.startsWith("__cleaned__"),
                            ),
                          );
                        return (
                          <button
                            type="button"
                            onClick={handleBulkDownload}
                            disabled={
                              isBulkDownloading || !hasDownloadableHistory
                            }
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 sm:gap-2 rounded-xl bg-[#780000] hover:bg-[#5e0000] active:scale-[0.98] text-white border border-[#5e0000] text-xs font-bold px-3 sm:px-3.5 py-2 sm:py-1.5 shadow-xs hover:shadow transition-all cursor-pointer disabled:bg-slate-200 disabled:text-slate-400 disabled:border-slate-300 dark:disabled:bg-slate-800 dark:disabled:text-slate-500 dark:disabled:border-slate-700 disabled:shadow-none disabled:cursor-not-allowed disabled:hover:bg-slate-200 dark:disabled:hover:bg-slate-800 disabled:active:scale-100 shrink-0"
                            title={
                              hasDownloadableHistory
                                ? "Download History ZIP"
                                : "Files have been cleaned (archived to ZIP backup)"
                            }
                          >
                            {isBulkDownloading ? (
                              <>
                                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white shrink-0" />
                                <span className="truncate">
                                  {bulkDownloadProgressText || "Zipping..."}
                                </span>
                              </>
                            ) : (
                              <>
                                <AppIcon
                                  icon={Download}
                                  size="sm"
                                  color="inherit"
                                />
                                <span className="truncate">Download ZIP</span>
                              </>
                            )}
                          </button>
                        );
                      })()}
                      <button
                        type="button"
                        onClick={() => void handleRefreshHistory()}
                        disabled={isRefreshingHistory || isBulkDownloading}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 font-semibold px-3 sm:px-3.5 py-2 sm:py-1.5 text-xs shadow-xs active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
                      >
                        <AppIcon
                          icon={Refresh}
                          size="sm"
                          color="inherit"
                          className={isRefreshingHistory ? "animate-spin" : ""}
                        />
                        <span>
                          {isRefreshingHistory ? "Refreshing..." : "Refresh"}
                        </span>
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 lg:p-8 bg-slate-50/50 dark:bg-slate-950/40 space-y-4 sm:space-y-5">
                    <div
                      role="note"
                      className="flex items-start gap-2.5 rounded-2xl border border-amber-600 bg-amber-500 px-3.5 sm:px-4 py-3 text-xs font-semibold text-slate-950 shadow-sm"
                    >
                      <AppIcon
                        icon={WarningCircle}
                        size="sm"
                        color="inherit"
                        className="mt-0.5 shrink-0 text-slate-950"
                      />
                      <span className="leading-relaxed">
                        Only subjects with validated documents for{" "}
                        <strong className="font-black">
                          A.Y. {historyAcademicYear} &bull; {historySemester}
                        </strong>{" "}
                        are shown here. New subjects added in other semesters
                        will not appear in this term&apos;s history unless they
                        have validated submissions in this term.
                      </span>
                    </div>
                    {isLoadingHistory ? (
                      <SubmissionHistorySkeleton count={4} />
                    ) : historyError ? (
                      <div
                        role="alert"
                        className="p-3.5 my-3 rounded-xl bg-[#780000] text-white border border-[#5e0000] flex items-center gap-2.5 text-xs font-semibold shadow-xs"
                      >
                        <AppIcon
                          icon={WarningCircle}
                          size="md"
                          color="white"
                          className="shrink-0"
                        />
                        <span className="leading-snug">{historyError}</span>
                      </div>
                    ) : (
                      <SubmissionHistoryList
                        submissions={filteredPastSubmissions}
                        classes={historyScopedClasses}
                        onViewFile={openHistorySubmissionPreview}
                        viewedSubmissionIds={viewedSubmissionIds}
                        getRequirementTitle={getRequirementTitle}
                        templateMandatoryMap={templateMandatoryMap}
                        totalRequiredCount={activeTemplates.length}
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
              <article className="space-y-4 sm:space-y-5">
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
                          profileImageUrl:
                            currentAvatarUrl || avatarUrl || null,
                          program: initialData?.program || null,
                        }
                      : null
                  }
                  onProfileUpdated={handleProfileUpdated}
                />
              </article>
            )}
            {isMounted && isSubmitModalOpen && (
              <div
                role="dialog"
                aria-modal="true"
                className="fixed inset-0 z-[60] h-dvh overflow-hidden overscroll-none flex items-center justify-center p-3 sm:p-4"
              >
                <div
                  className="fixed inset-0 h-lvh bg-slate-950/80 backdrop-blur-sm touch-none overscroll-none"
                  aria-hidden="true"
                />
                <div className="relative z-10 w-full max-w-3xl max-h-[90dvh] flex flex-col overflow-hidden rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl">
                  <ModalHeader title="Submit Requirement" icon={Upload} className="shrink-0" />
                  <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain p-4 sm:p-6 min-h-0">
                    {isEffectivelyOpen ? (
                      <form className="space-y-4" onSubmit={handleSubmit}>
                        <div className="grid gap-4 sm:grid-cols-2">
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
                              updateField("requirementCode", event.target.value)
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
                        <div className="grid grid-cols-2 sm:flex sm:items-center sm:justify-end gap-2.5 pt-2">
                          <button
                            type="button"
                            onClick={closeSubmitModal}
                            className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] shadow-xs transition-colors cursor-pointer text-center"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50 active:scale-[0.98]"
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
                              submissionMessage
                                .toLowerCase()
                                .includes("please") ||
                              submissionMessage
                                .toLowerCase()
                                .includes("failed") ||
                              submissionMessage.toLowerCase().includes("error")
                                ? "bg-[#780000] text-white border border-[#5e0000]"
                                : "bg-[#0b5336] text-white border border-[#08412a]"
                            }`}
                          >
                            <AppIcon
                              icon={
                                submissionMessage
                                  .toLowerCase()
                                  .includes("please") ||
                                submissionMessage
                                  .toLowerCase()
                                  .includes("failed") ||
                                submissionMessage
                                  .toLowerCase()
                                  .includes("error")
                                  ? WarningCircle
                                  : CheckCircle
                              }
                              size="md"
                              color="white"
                              className="shrink-0"
                            />
                            <span className="leading-snug">
                              {submissionMessage}
                            </span>
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
              <div
                role="dialog"
                aria-modal="true"
                className="fixed inset-0 z-[60] h-dvh overflow-hidden overscroll-none flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
              >
                <div
                  className="fixed inset-0 h-lvh bg-black/70 backdrop-blur-sm touch-none overscroll-none"
                  aria-hidden="true"
                  onClick={() => setShowExtensionDetailsModal(false)}
                />
                <div className="relative z-10 w-full max-w-md max-h-[90dvh] flex flex-col bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100">
                  <ModalHeader
                    title="Extension Request Status"
                    icon={Hourglass}
                    className="shrink-0"
                  />
                  <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain p-4 sm:p-6 space-y-4">
                    <div className="space-y-3 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <span className="font-semibold text-xs text-slate-700 dark:text-slate-300">
                          Status
                        </span>
                        <span
                          className={`px-3 py-1 rounded-lg font-bold text-xs ${
                            pendingExtensionData.status === "approved"
                              ? "bg-emerald-500 text-white"
                              : pendingExtensionData.status === "rejected"
                                ? "bg-[#780000] text-white"
                                : pendingExtensionData.status === "superseded"
                                  ? "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                                  : "bg-amber-500 text-slate-950"
                          } shadow-xs`}
                        >
                          {pendingExtensionData.status === "approved"
                            ? "Approved"
                            : pendingExtensionData.status === "rejected"
                              ? "Declined"
                              : pendingExtensionData.status === "superseded"
                                ? "Superseded"
                                : "Pending Admin Review"}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <span className="font-semibold text-slate-500 dark:text-slate-400">
                          Academic Term:
                        </span>
                        <p className="font-medium text-slate-900 dark:text-slate-200">
                          {pendingExtensionData.academic_year} •{" "}
                          {pendingExtensionData.semester}
                        </p>
                      </div>

                      {pendingExtensionData.approved_date && (
                        <div className="space-y-1 p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50">
                          <span className="font-semibold text-emerald-800 dark:text-emerald-300">
                            Approved Custom Deadline:
                          </span>
                          <p className="font-medium text-emerald-900 dark:text-emerald-200">
                            {pendingExtensionData.approved_date} at{" "}
                            {pendingExtensionData.approved_time || "11:59 PM"}
                          </p>
                        </div>
                      )}

                      <div className="space-y-1">
                        <span className="font-semibold text-slate-500 dark:text-slate-400">
                          Reason / Justification:
                        </span>
                        <p className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 italic break-words">
                          &ldquo;{pendingExtensionData.reason}&rdquo;
                        </p>
                      </div>

                      {/* Supporting Document Link */}
                      {(pendingExtensionData.supporting_document_url ||
                        pendingExtensionData.supporting_document_name) && (
                        <div className="space-y-1">
                          <span className="font-semibold text-slate-500 dark:text-slate-400">
                            Supporting Document:
                          </span>
                          <div>
                            <a
                              href={`/api/faculty/submissions/extension-request/document?requestId=${pendingExtensionData.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 dark:text-amber-200 text-xs font-semibold transition max-w-full"
                            >
                              <AppIcon icon={Page} size="xs" color="inherit" className="shrink-0" />
                              <span className="truncate">
                                {pendingExtensionData.supporting_document_name ||
                                  "Download Supporting Document"}
                              </span>
                            </a>
                          </div>
                        </div>
                      )}

                      {/* Approver Remarks */}
                      {pendingExtensionData.admin_remarks && (
                        <div className="space-y-1 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            Approver Feedback Remarks:
                          </span>
                          <p className="text-slate-800 dark:text-slate-200 break-words">
                            &ldquo;{pendingExtensionData.admin_remarks}&rdquo;
                          </p>
                        </div>
                      )}

                      <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                        {pendingExtensionData.status === "approved"
                          ? "Your extension request was approved. The submission portal is unlocked until the approved deadline date."
                          : pendingExtensionData.status === "rejected"
                            ? "Your extension request was declined. File uploads remain locked for overdue requirements."
                            : "An administrator will review your extension request. Document uploads will be unlocked immediately once approved."}
                      </p>
                    </div>

                    <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2.5 pt-2">
                      {isWindowClosed && hasLackings && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowExtensionDetailsModal(false);
                            openExtensionRequestModal();
                          }}
                          className="w-full sm:w-auto bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-600 px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer shadow-xs inline-flex items-center justify-center gap-1.5"
                        >
                          <AppIcon icon={Hourglass} size="xs" color="inherit" />
                          <span>Request Again</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowExtensionDetailsModal(false)}
                        className="w-full sm:w-auto bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] px-4 py-2 text-xs font-semibold rounded-xl transition cursor-pointer shadow-xs text-center"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Add Class / Subject Load Modal */}
            {isAddClassModalOpen && (
              <div
                className="fixed inset-0 z-[60] h-dvh overflow-hidden overscroll-none flex items-center justify-center p-3 sm:p-4"
                role="dialog"
                aria-modal="true"
                aria-labelledby="add-class-modal-title"
                onClick={() => {
                  if (!isSubmittingClass) {
                    setIsAddClassModalOpen(false);
                    setClassFormError(null);
                  }
                }}
              >
                <div
                  className="fixed inset-0 h-lvh bg-slate-950/80 backdrop-blur-sm touch-none overscroll-none"
                  aria-hidden="true"
                />
                <div
                  className="relative z-10 w-full max-w-lg max-h-[90dvh] flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ModalHeader
                    icon={Plus}
                    title="Add Class / Subject Load"
                    subtitle={
                      hasActiveAcademicTerm
                        ? `Register a subject load for A.Y. ${activeAY} • ${activeSem}`
                        : "No active academic term configured"
                    }
                    className="shrink-0"
                  />

                  <form
                    onSubmit={handleAddClassSubmit}
                    className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain p-4 sm:p-6 space-y-4"
                  >
                    {!hasActiveAcademicTerm && (
                      <div className="rounded-xl border-2 border-amber-400 bg-[#780000] p-3.5 flex items-start gap-2.5 text-xs text-white shadow-lg shadow-black/20">
                        <AppIcon
                          icon={WarningCircle}
                          size="md"
                          color="white"
                          className="shrink-0 mt-0.5 text-amber-300 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]"
                        />
                        <div className="space-y-0.5">
                          <p className="font-bold text-amber-300 uppercase tracking-wide text-[11px]">
                            No Active Academic Term Configured
                          </p>
                          <p className="text-xs leading-relaxed text-amber-50 font-medium">
                            Subject loads cannot be registered until a campus
                            administrator sets the current academic year and
                            semester. Please contact your campus administrator.
                          </p>
                        </div>
                      </div>
                    )}

                    {classFormError && (
                      <div className="rounded-xl border-2 border-amber-400 bg-[#780000] p-3.5 flex items-start sm:items-center gap-2.5 text-xs text-white font-semibold shadow-lg shadow-black/20">
                        <AppIcon
                          icon={WarningCircle}
                          size="md"
                          color="white"
                          className="shrink-0 text-amber-300 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]"
                        />
                        <span className="leading-relaxed text-amber-50">
                          {classFormError}
                        </span>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Subject Code <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={classForm.subject_code}
                        onChange={(e) =>
                          setClassForm((prev) => ({
                            ...prev,
                            subject_code: e.target.value,
                          }))
                        }
                        placeholder="Enter subject code"
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-xs sm:text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Description / Subject Title{" "}
                        <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={classForm.description}
                        onChange={(e) =>
                          setClassForm((prev) => ({
                            ...prev,
                            description: e.target.value,
                          }))
                        }
                        placeholder="Enter description / subject title"
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-xs sm:text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Section Code <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={classForm.section_code}
                          onChange={(e) =>
                            setClassForm((prev) => ({
                              ...prev,
                              section_code: e.target.value,
                            }))
                          }
                          placeholder="e.g. BSIT 4-1"
                          className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-xs sm:text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Units <span className="text-rose-500">*</span>
                        </label>
                        <select
                          required
                          value={classForm.units}
                          onChange={(e) =>
                            setClassForm((prev) => ({
                              ...prev,
                              units: Number(e.target.value),
                            }))
                          }
                          className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-xs sm:text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition cursor-pointer"
                        >
                          {CLASS_UNIT_OPTIONS.map((u) => (
                            <option
                              key={u}
                              value={u}
                              className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                            >
                              {u.toFixed(1)} Units
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:flex sm:items-center sm:justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
                      <button
                        type="button"
                        disabled={isSubmittingClass}
                        onClick={() => {
                          setIsAddClassModalOpen(false);
                          setClassFormError(null);
                        }}
                        className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] shadow-xs transition-colors cursor-pointer disabled:opacity-50 text-center"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={!hasActiveAcademicTerm}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50 active:scale-[0.98]"
                      >
                        <AppIcon icon={Check} size="sm" color="inherit" />
                        <span>Save Class Load</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Confirm Create Class / Subject Load Modal */}
            {isConfirmCreateClassModalOpen && (
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="confirm-create-class-title"
                className="fixed inset-0 z-[70] h-dvh overflow-hidden overscroll-none flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
              >
                <div
                  className="fixed inset-0 h-lvh bg-slate-950/75 backdrop-blur-xs touch-none overscroll-none"
                  aria-hidden="true"
                />
                <div
                  className="relative z-10 w-full max-w-md max-h-[90dvh] overflow-y-auto overflow-x-hidden overscroll-contain rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-4 sm:p-6 space-y-4 animate-in zoom-in-95 duration-200"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-slate-950 shadow-md border-2 border-amber-600">
                      <AppIcon icon={TaskList} size="md" color="inherit" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3
                        id="confirm-create-class-title"
                        className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100"
                      >
                        Confirm Subject Load Registration
                      </h3>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        Are you sure you want to save and register this subject
                        load for this academic term?
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border-2 border-amber-500 bg-amber-400 p-4 space-y-2.5 text-xs shadow-md shadow-amber-500/20 text-slate-950">
                    <div className="flex items-center justify-between gap-2 border-b border-amber-500/50 pb-2">
                      <span className="text-amber-950 font-bold">
                        Subject Code:
                      </span>
                      <span className="font-mono font-black text-slate-950 text-sm">
                        {classForm.subject_code.trim().toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-2 border-b border-amber-500/50 pb-2">
                      <span className="text-amber-950 font-bold shrink-0">
                        Description:
                      </span>
                      <span className="font-bold text-slate-950 text-right break-words">
                        {classForm.description.trim()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 border-b border-amber-500/50 pb-2">
                      <span className="text-amber-950 font-bold">Section:</span>
                      <span className="font-mono font-black text-slate-950">
                        {classForm.section_code.trim().toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 border-b border-amber-500/50 pb-2">
                      <span className="text-amber-950 font-bold">
                        Credit Units:
                      </span>
                      <span className="font-black text-slate-950">
                        {Number(classForm.units || 3.0).toFixed(1)} Units
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-amber-950 font-bold">
                        Academic Term:
                      </span>
                      <span className="font-black text-slate-950">
                        A.Y. {activeAY} • {activeSem}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:flex sm:items-center sm:justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
                    <button
                      type="button"
                      disabled={isSubmittingClass}
                      onClick={() => {
                        setIsSubmittingClass(false);
                        setIsConfirmCreateClassModalOpen(false);
                      }}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] shadow-sm transition-all cursor-pointer disabled:cursor-not-allowed active:scale-[0.98] text-center"
                    >
                      Back to Edit
                    </button>
                    <button
                      type="button"
                      disabled={isSubmittingClass}
                      onClick={handleConfirmCreateClass}
                      className={`w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-md border border-amber-600/40 transition-all cursor-pointer ${
                        isSubmittingClass
                          ? "opacity-50 cursor-not-allowed"
                          : "active:scale-[0.98]"
                      }`}
                    >
                      {isSubmittingClass ? (
                        <>
                          <AppIcon
                            icon={SystemRestart}
                            size="sm"
                            color="inherit"
                            className="animate-spin"
                          />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <AppIcon icon={Check} size="sm" color="inherit" />
                          <span>Save</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Create Class Success Modal */}
            {isCreateClassSuccessModalOpen && createdClassSuccessData && (
              <div
                className="fixed inset-0 z-[70] h-dvh overflow-hidden overscroll-none flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
                role="dialog"
                aria-modal="true"
                aria-labelledby="class-created-success-title"
                onClick={() => {
                  setIsCreateClassSuccessModalOpen(false);
                  setCreatedClassSuccessData(null);
                }}
              >
                <div
                  className="fixed inset-0 h-lvh bg-slate-950/80 backdrop-blur-sm touch-none overscroll-none"
                  aria-hidden="true"
                />
                <div
                  className="relative z-10 w-full max-w-lg max-h-[90dvh] overflow-y-auto overflow-x-hidden overscroll-contain rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-10 text-center shadow-2xl space-y-6 animate-in zoom-in-95 duration-200"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="mx-auto flex h-20 w-20 sm:h-28 sm:w-28 items-center justify-center rounded-3xl bg-[#0b5336] text-white shadow-xl shadow-[#0b5336]/30 border-2 border-[#08412a] animate-in zoom-in duration-300">
                    <CheckCircle className="w-10 h-10 sm:w-14 sm:h-14 stroke-[2.5]" />
                  </div>
                  <div className="space-y-2">
                    <h3
                      id="class-created-success-title"
                      className="text-xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight"
                    >
                      Subject Load Created!
                    </h3>
                    <p className="text-xs sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-md mx-auto px-2">
                      <strong className="text-slate-900 dark:text-slate-100">
                        {createdClassSuccessData.subject_code} &bull;{" "}
                        {createdClassSuccessData.section_code}
                      </strong>{" "}
                      ({createdClassSuccessData.description}) has been
                      registered successfully.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreateClassSuccessModalOpen(false);
                        setCreatedClassSuccessData(null);
                      }}
                      className="w-full sm:w-1/2 py-3 px-4 rounded-xl border border-[#5e0000] bg-[#780000] hover:bg-[#5e0000] text-white font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer active:scale-[0.98]"
                    >
                      Done
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const targetId = createdClassSuccessData.id;
                        setIsCreateClassSuccessModalOpen(false);
                        setCreatedClassSuccessData(null);
                        setSelectedClassId(targetId);
                        selectedClassIdRef.current = targetId;
                      }}
                      className="w-full sm:w-1/2 py-3 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all cursor-pointer active:scale-[0.98]"
                    >
                      Upload Documents
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* View Subject Load Details Modal */}
            {isViewClassModalOpen && classToView && (
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="view-class-modal-title"
                className="fixed inset-0 z-[60] h-dvh overflow-hidden overscroll-none flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
                onClick={() => {
                  setIsViewClassModalOpen(false);
                  setClassToView(null);
                }}
              >
                <div
                  className="fixed inset-0 h-lvh bg-slate-950/75 backdrop-blur-xs touch-none overscroll-none"
                  aria-hidden="true"
                />
                <div
                  className="relative z-10 w-full max-w-lg max-h-[90dvh] overflow-y-auto overflow-x-hidden overscroll-contain rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-4 sm:p-6 space-y-4 animate-in zoom-in-95 duration-200"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-slate-950 shadow-md border-2 border-amber-600">
                        <AppIcon icon={Eye} size="md" color="inherit" />
                      </div>
                      <div className="min-w-0">
                        <h3
                          id="view-class-modal-title"
                          className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100"
                        >
                          Subject Load Details
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
                          {classToView.subject_code} &bull;{" "}
                          {classToView.section_code}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Solid Amber Card Content */}
                  <div className="rounded-2xl border-2 border-amber-500 bg-amber-400 p-4 space-y-2.5 text-xs shadow-md shadow-amber-500/20 text-slate-950">
                    <div className="flex items-center justify-between gap-2 border-b border-amber-500/50 pb-2">
                      <span className="text-amber-950 font-bold">
                        Course / Subject Code:
                      </span>
                      <span className="font-mono font-black text-slate-950 text-sm">
                        {classToView.subject_code}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-2 border-b border-amber-500/50 pb-2">
                      <span className="text-amber-950 font-bold shrink-0">
                        Subject Name / Description:
                      </span>
                      <span className="font-bold text-slate-950 text-right break-words">
                        {classToView.description}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 border-b border-amber-500/50 pb-2">
                      <span className="text-amber-950 font-bold">
                        Assigned Section:
                      </span>
                      <span className="font-mono font-black text-slate-950">
                        {classToView.section_code}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 border-b border-amber-500/50 pb-2">
                      <span className="text-amber-950 font-bold">
                        Credit Units:
                      </span>
                      <span className="font-black text-slate-950">
                        {Number(classToView.units || 3.0).toFixed(1)} Units
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/50 pb-2">
                      <span className="text-amber-950 font-bold">
                        Academic Term:
                      </span>
                      <span className="font-black text-slate-950">
                        A.Y.{" "}
                        {classToView.academic_year || activeAY || "Active Term"}{" "}
                        &bull; {classToView.semester || activeSem || ""}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-amber-950 font-bold">Status:</span>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[11px] font-black uppercase tracking-wider ${
                          classToView.is_archived
                            ? "bg-slate-700 text-white"
                            : "bg-[#0b5336] text-white"
                        }`}
                      >
                        {classToView.is_archived ? "Archived" : "Active"}
                      </span>
                    </div>
                  </div>

                  {/* Modal Footer Actions */}
                  <div className="flex flex-col-reverse sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setIsViewClassModalOpen(false);
                        setClassToView(null);
                      }}
                      className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] shadow-sm transition cursor-pointer active:scale-95 text-center"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const target = classToView;
                        setIsViewClassModalOpen(false);
                        setClassToView(null);
                        handleOpenEditClass(target);
                      }}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 shadow-2xs transition cursor-pointer active:scale-95"
                    >
                      <AppIcon icon={EditPencil} size="xs" color="inherit" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const targetId = classToView.id;
                        setIsViewClassModalOpen(false);
                        setClassToView(null);
                        selectedClassIdRef.current = targetId;
                        setRequirementStatuses(
                          classStatusesCacheRef.current[targetId] || [],
                        );
                        setIsUploadSectionVisible(false);
                        setSelectedClassId(targetId);
                        void fetchStatuses(activeAY, activeSem, targetId, {
                          silent: true,
                        });
                      }}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-md border border-amber-600/40 transition cursor-pointer active:scale-95"
                    >
                      <AppIcon icon={Folder} size="xs" color="inherit" />
                      <span>View &amp; Upload Documents</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Edit Class / Subject Load Modal */}
            {isEditClassModalOpen && classToEdit && (
              <div
                role="dialog"
                aria-modal="true"
                className="fixed inset-0 z-[60] h-dvh overflow-hidden overscroll-none flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
              >
                <div
                  className="fixed inset-0 h-lvh bg-slate-950/70 backdrop-blur-xs touch-none overscroll-none"
                  aria-hidden="true"
                />
                <div className="relative z-10 w-full max-w-lg max-h-[90dvh] overflow-y-auto overflow-x-hidden overscroll-contain rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-4 sm:p-6 space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                        <AppIcon icon={EditPencil} size="md" color="inherit" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">
                          Edit Class / Subject Load
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Update the subject code, title, section, or unit
                          weighting.
                        </p>
                      </div>
                    </div>
                  </div>

                  {editClassError && (
                    <div className="rounded-xl border-2 border-amber-400 bg-[#780000] p-3.5 text-xs text-white font-semibold flex items-center gap-2.5 shadow-lg shadow-black/20 mb-4">
                      <AppIcon
                        icon={WarningCircle}
                        size="md"
                        color="white"
                        className="shrink-0 text-amber-300 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]"
                      />
                      <span className="leading-relaxed text-amber-50">
                        {editClassError}
                      </span>
                    </div>
                  )}

                  <form onSubmit={handleEditClassSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Subject Code <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={editClassForm.subject_code}
                        onChange={(e) =>
                          setEditClassForm((prev) => ({
                            ...prev,
                            subject_code: e.target.value,
                          }))
                        }
                        placeholder="Enter subject code"
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-xs sm:text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition font-mono font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Description / Subject Title{" "}
                        <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={editClassForm.description}
                        onChange={(e) =>
                          setEditClassForm((prev) => ({
                            ...prev,
                            description: e.target.value,
                          }))
                        }
                        placeholder="Enter description / subject title"
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-xs sm:text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Section Code <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={editClassForm.section_code}
                          onChange={(e) =>
                            setEditClassForm((prev) => ({
                              ...prev,
                              section_code: e.target.value,
                            }))
                          }
                          placeholder="e.g. BSIT 4-1"
                          className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-xs sm:text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Units <span className="text-rose-500">*</span>
                        </label>
                        <select
                          required
                          value={editClassForm.units}
                          onChange={(e) =>
                            setEditClassForm((prev) => ({
                              ...prev,
                              units: Number(e.target.value),
                            }))
                          }
                          className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-xs sm:text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition cursor-pointer"
                        >
                          {(() => {
                            const current = Number(editClassForm.units);
                            const options =
                              current && !CLASS_UNIT_OPTIONS.includes(current)
                                ? [...CLASS_UNIT_OPTIONS, current].sort(
                                    (a, b) => a - b,
                                  )
                                : CLASS_UNIT_OPTIONS;
                            return options.map((u) => (
                              <option
                                key={u}
                                value={u}
                                className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                              >
                                {u.toFixed(1)} Units
                              </option>
                            ));
                          })()}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:flex sm:items-center sm:justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
                      <button
                        type="button"
                        disabled={isUpdatingClass}
                        onClick={() => {
                          setIsEditClassModalOpen(false);
                          setClassToEdit(null);
                          setEditClassError(null);
                        }}
                        className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] shadow-xs transition-colors cursor-pointer disabled:opacity-50 text-center"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isUpdatingClass}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
                      >
                        {isUpdatingClass ? (
                          <>
                            <AppIcon
                              icon={SystemRestart}
                              size="sm"
                              color="inherit"
                              className="animate-spin"
                            />
                            <span>Updating...</span>
                          </>
                        ) : (
                          <>
                            <AppIcon icon={Check} size="sm" color="inherit" />
                            <span>Save Changes</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Archive Confirmation Modal */}
            {isArchiveModalOpen && classToArchive && (
              <div
                role="dialog"
                aria-modal="true"
                className="fixed inset-0 z-[60] h-dvh overflow-hidden overscroll-none flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
              >
                <div
                  className="fixed inset-0 h-lvh bg-slate-950/70 backdrop-blur-xs touch-none overscroll-none"
                  aria-hidden="true"
                />
                <div className="relative z-10 w-full max-w-md max-h-[90dvh] overflow-y-auto overflow-x-hidden overscroll-contain rounded-3xl border border-amber-300 dark:border-amber-700/60 bg-white dark:bg-slate-900 shadow-2xl p-4 sm:p-6 space-y-4">
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-slate-950 shadow-md border-2 border-amber-600">
                      <AppIcon icon={Archive} size="md" color="inherit" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">
                        Archive Subject Load?
                      </h3>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        Are you sure you want to archive{" "}
                        <strong className="text-slate-900 dark:text-slate-200">
                          {classToArchive.subject_code} (
                          {classToArchive.section_code})
                        </strong>
                        ?
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border-2 border-amber-500 bg-amber-400 p-3.5 text-xs text-slate-950 font-medium leading-relaxed shadow-xs">
                    Archiving will hide this subject load from your active list
                    and lock requirement uploads until unarchived. You can find
                    and unarchive it anytime under the{" "}
                    <strong className="font-black text-slate-950">
                      Archived
                    </strong>{" "}
                    tab.
                  </div>

                  <div className="grid grid-cols-2 sm:flex sm:items-center sm:justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
                    <button
                      type="button"
                      disabled={isArchivingClass}
                      onClick={() => {
                        setIsArchiveModalOpen(false);
                        setClassToArchive(null);
                      }}
                      className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] shadow-xs transition-colors cursor-pointer disabled:opacity-50 text-center"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isArchivingClass}
                      onClick={handleArchiveClassConfirm}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50 border border-amber-600/40"
                    >
                      {isArchivingClass ? (
                        <>
                          <AppIcon
                            icon={SystemRestart}
                            size="sm"
                            color="inherit"
                            className="animate-spin"
                          />
                          <span>Archiving...</span>
                        </>
                      ) : (
                        <>
                          <AppIcon icon={Archive} size="sm" color="inherit" />
                          <span>Archive Class</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Delete Confirmation Modal */}
            {isDeleteModalOpen && classToDelete && (
              <div
                role="dialog"
                aria-modal="true"
                className="fixed inset-0 z-[60] h-dvh overflow-hidden overscroll-none flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
              >
                <div
                  className="fixed inset-0 h-lvh bg-slate-950/70 backdrop-blur-xs touch-none overscroll-none"
                  aria-hidden="true"
                />
                <div className="relative z-10 w-full max-w-md max-h-[90dvh] overflow-y-auto overflow-x-hidden overscroll-contain rounded-3xl border border-rose-200 dark:border-rose-900/60 bg-white dark:bg-slate-900 shadow-2xl p-4 sm:p-6 space-y-4">
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#780000] text-white shadow-md border-2 border-[#5e0000]">
                      <AppIcon icon={Trash} size="md" color="inherit" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">
                        Delete Subject Load?
                      </h3>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        Are you sure you want to delete{" "}
                        <strong className="text-slate-900 dark:text-slate-200">
                          {classToDelete.subject_code} (
                          {classToDelete.section_code})
                        </strong>
                        ?
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border-2 border-amber-500 bg-amber-400 p-3.5 text-xs text-slate-950 font-medium leading-relaxed shadow-xs">
                    <strong className="font-black text-slate-950">Note:</strong>{" "}
                    Previously uploaded documents will remain preserved in your
                    submission history, but will no longer be linked to this
                    deleted subject load.
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      Type{" "}
                      <span className="font-mono font-black text-rose-600 dark:text-rose-400 select-all">
                        Delete
                      </span>{" "}
                      to confirm:
                    </label>
                    <input
                      type="text"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder='Type "Delete" here'
                      disabled={isDeletingClass}
                      autoFocus
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-xs sm:text-sm text-slate-900 dark:text-slate-100 font-mono outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 transition"
                    />
                    {deleteCountdown > 0 && (
                      <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1 pt-0.5">
                        <AppIcon icon={Hourglass} size="xs" color="inherit" />
                        <span>
                          Please wait <strong>{deleteCountdown}s</strong> before
                          confirming deletion...
                        </span>
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:flex sm:items-center sm:justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
                    <button
                      type="button"
                      disabled={isDeletingClass}
                      onClick={() => {
                        setIsDeleteModalOpen(false);
                        setClassToDelete(null);
                        setDeleteCountdown(0);
                        setDeleteConfirmText("");
                      }}
                      className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] shadow-xs transition-colors cursor-pointer disabled:opacity-50 active:scale-95 text-center"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={
                        isDeletingClass ||
                        deleteCountdown > 0 ||
                        deleteConfirmText.trim().toLowerCase() !== "delete"
                      }
                      onClick={handleDeleteClassConfirm}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 border border-rose-700 text-white text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                    >
                      {isDeletingClass ? (
                        <>
                          <AppIcon
                            icon={SystemRestart}
                            size="sm"
                            color="inherit"
                            className="animate-spin"
                          />
                          <span>Deleting...</span>
                        </>
                      ) : (
                        <>
                          <AppIcon icon={Trash} size="sm" color="inherit" />
                          <span>
                            {deleteCountdown > 0
                              ? `Delete Class (${deleteCountdown}s)`
                              : "Delete Class"}
                          </span>
                        </>
                      )}
                    </button>
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
