"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import Image from "next/image";
import JSZip from "jszip";
import { createClient } from "@/lib/supabase/client";
import { emitRealtimeSync, useRealtimeSync } from "@/lib/realtime";
import {
  Archive,
  ChatBubble,
  Check,
  CheckCircle,
  ClockRotateRight,
  Download,
  EditPencil,
  Eye,
  Folder,
  Group,
  Hourglass,
  InfoCircle,
  Minus,
  NavArrowDown,
  NavArrowLeft,
  NavArrowRight,
  Notes,
  OpenNewWindow,
  Package,
  Page,
  Refresh,
  Reports,
  SendMail,
  SystemRestart,
  WarningCircle,
  WarningTriangle,
  Xmark,
} from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";
import { ModalHeader } from "@/components/ui/modal-header";
import { AlertPopup } from "@/components/ui/alert-popup";
import {
  DEFAULT_REQUIREMENTS,
  REQUIREMENT_CODE,
  REQUIREMENT_LABEL,
  type RequirementCode,
} from "@/config/compliance";
import { normalizeSemester } from "@/features/submissions/services/submission-window.service";
import { SubmissionStatusBadge } from "@/features/submissions/components/submission-status-badge";
import { OnlineDocumentPreview } from "@/features/submissions/components/online-document-preview";
import {
  DocumentPreviewModal,
  type DocumentPreviewSubmission,
} from "@/features/submissions/components/document-preview-modal";
import { exportReportToExcel, exportReportToPdf } from "@/lib/report-export";

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

export function cleanDisplayFileName(name?: string | null): string {
  if (!name) return "Document";
  return name.replace(/^(?:v\d+_)?\d{10,}_/i, "").replace(/^v\d+_/i, "");
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

function normalizeAcademicYear(value: string | null | undefined): string {
  if (!value) return "";
  return value.trim();
}
import type {
  FacultyAccount,
  RequirementStatus,
  SemesterOption,
} from "@/features/faculty-management/types/faculty-dashboard.types";

interface FacultyRequirementSubmission {
  id: string;
  requirement_code: string;
  class_id?: string | null;
  faculty_class?: {
    id: string;
    subject_code: string;
    description: string;
    units: number;
    section_code: string;
  } | null;
  status: string | null;
  submitted_at?: string | null;
  created_at?: string | null;
  remarks?: string | null;
  notes?: string | null;
  admin_remarks?: string | null;
  document_versions?: Array<{
    id: string;
    version_number?: number | null;
    storage_path: string;
    mime_type?: string | null;
    size_bytes?: number | null;
    created_at?: string | null;
  }> | null;
  review_decisions?: Array<{
    decision: "validated" | "rejected";
    remarks?: string | null;
    created_at?: string | null;
  }> | null;
}

function buildFacultyInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "F";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function getPureStatusText(
  status: RequirementStatus | "rejected" | "needs_revision" | null | string,
): "Validated" | "Pending Review" | "Needs Revision" | "Not Submitted" {
  if (!status) return "Not Submitted";
  const s = String(status).toLowerCase();
  if (s === "validated" || s === "approved") return "Validated";
  if (s === "rejected" || s === "needs_revision") return "Needs Revision";
  if (
    s === "uploaded" ||
    s === "pending" ||
    s === "submitted" ||
    s === "under_review" ||
    s === "pending_review"
  ) {
    return "Pending Review";
  }
  return "Not Submitted";
}

function getStatusTextColor(
  status: RequirementStatus | "rejected" | "needs_revision" | null | string,
): string {
  if (!status) return "text-slate-400";
  const s = String(status).toLowerCase();
  if (s === "validated" || s === "approved") return "text-emerald-400";
  if (s === "rejected" || s === "needs_revision") return "text-rose-400";
  if (
    s === "uploaded" ||
    s === "pending" ||
    s === "submitted" ||
    s === "under_review" ||
    s === "pending_review"
  ) {
    return "text-amber-400";
  }
  return "text-slate-400";
}

function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatFullDateTime(dateInput?: string | null): string {
  if (!dateInput) return "N/A";
  const parsed = new Date(dateInput);
  if (Number.isNaN(parsed.getTime())) return "N/A";
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

function matchRequirementCode(
  inputCode?: string | null,
  inputReqId?: string | null,
): string | null {
  const candidates = [inputCode, inputReqId].filter(Boolean) as string[];
  for (const raw of candidates) {
    const s = raw
      .toLowerCase()
      .trim()
      .replace(/[-_\s]+/g, "");
    if (s.includes("gradesheet") || s.includes("grade"))
      return REQUIREMENT_CODE.GRADE_SHEET;
    if (s.includes("syllabus") || s.includes("enhancedsyllabus"))
      return REQUIREMENT_CODE.ENHANCED_SYLLABUS;
    if (s.includes("orientation") || s.includes("classorientation"))
      return REQUIREMENT_CODE.CLASS_ORIENTATION;
    if (s.includes("midterm") || s.includes("midtermpackage"))
      return REQUIREMENT_CODE.MIDTERM_PACKAGE;
    if (s.includes("final") || s.includes("finalpackage"))
      return REQUIREMENT_CODE.FINAL_PACKAGE;
    if (
      s.includes("classrecord") ||
      s.includes("records") ||
      s.includes("classrecords")
    )
      return REQUIREMENT_CODE.CLASS_RECORDS;
  }
  return inputCode ? inputCode.trim() : null;
}

export function getFriendlyRequirementName(code?: string): string {
  if (!code) return "Requirement Document";
  if (REQUIREMENT_LABEL[code as RequirementCode]) {
    return REQUIREMENT_LABEL[code as RequirementCode];
  }
  const clean = code
    .toLowerCase()
    .trim()
    .replace(/[-_\s]+/g, "");
  const map: Record<string, string> = {
    grade_sheet: "Grade Sheets",
    grade_sheets: "Grade Sheets",
    gradesheet: "Grade Sheets",
    gradesheets: "Grade Sheets",
    enhanced_syllabus: "Enhanced Course Syllabus",
    syllabus: "Enhanced Course Syllabus",
    class_orientation: "Class Orientation Documentation",
    orientation: "Class Orientation Documentation",
    midterm_package: "Midterm Examinations with TOS and Answer Key",
    midterm: "Midterm Examinations with TOS and Answer Key",
    final_package: "Final Examinations with TOS and Answer Key",
    final: "Final Examinations with TOS and Answer Key",
    class_records: "Class Records",
    classrecords: "Class Records",
  };
  for (const [key, label] of Object.entries(map)) {
    const cleanKey = key.toLowerCase().replace(/[-_\s]+/g, "");
    if (clean === cleanKey || clean.includes(cleanKey)) {
      return label;
    }
  }
  return code
    .split(/[_-]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function doesSubmissionMatchTerm(
  s: any,
  targetAY: string,
  targetSem: SemesterOption,
): boolean {
  if (!s) return false;

  // If the submission has explicit term metadata, verify it matches
  const directAy =
    s.academic_year || s.academicYear || s.faculty_assignment?.academic_year;
  const directSem = s.semester || s.term || s.faculty_assignment?.term;

  if (directAy && directSem) {
    return (
      normalizeAcademicYear(directAy) === normalizeAcademicYear(targetAY) &&
      normalizeSemester(directSem) === normalizeSemester(targetSem)
    );
  }

  // Backend API already scopes submissions by faculty_assignment_id for the
  // requested term.  If no explicit term metadata is embedded on the row,
  // trust the backend's assignment-ID filtering and treat as matching.
  return true;
}

export interface FacultyVerificationDrawerProps {
  faculty: FacultyAccount;
  academicYear: string;
  semester: SemesterOption;
  initialTab?: "current" | "history";
  initialRequirementCode?: string | null;
  requirementTemplates?: Array<{
    code: string;
    title: string;
    is_mandatory: boolean;
    is_active?: boolean;
  }>;
  initialClasses?: Array<{
    id: string;
    subject_code: string;
    description: string;
    units: number | null;
    section_code: string;
  }>;
  initialSubmissions?: FacultyRequirementSubmission[];
  initialAvailableAcademicYears?: string[];
  onSubmissionsLoaded?: (
    facultyId: string,
    payload: { submissions: FacultyRequirementSubmission[]; classes: any[] },
  ) => void;
  onClose?: () => void;
  onBack?: () => void;
  onStatusUpdated?: () => void;
}
export type FacultyDetailInlineSectionProps = FacultyVerificationDrawerProps;

const REVISION_PRESETS = [
  "Missing required signature(s)",
  "Incomplete document pages / sections",
  "Incorrect academic year or semester",
  "Low scan quality or unreadable text",
  "Outdated syllabus / course guide template",
  "Missing grading criteria breakdown",
];

const VALIDATION_PRESETS = [
  "Complete and compliant with all guidelines",
  "Properly accomplished with required signatures",
  "Validated and approved",
  "Submitted on time and well-organized",
  "All criteria and requirements satisfied",
];

const CANONICAL_REQUIREMENT_ORDER: Record<string, number> = {
  [REQUIREMENT_CODE.GRADE_SHEET]: 1,
  [REQUIREMENT_CODE.ENHANCED_SYLLABUS]: 2,
  [REQUIREMENT_CODE.CLASS_ORIENTATION]: 3,
  [REQUIREMENT_CODE.MIDTERM_PACKAGE]: 4,
  [REQUIREMENT_CODE.FINAL_PACKAGE]: 5,
  [REQUIREMENT_CODE.CLASS_RECORDS]: 6,
};

export function FacultyVerificationDrawer({
  faculty,
  academicYear,
  semester,
  initialTab = "current",
  initialRequirementCode,
  requirementTemplates: requirementTemplatesProp,
  initialClasses,
  initialSubmissions,
  initialAvailableAcademicYears,
  onSubmissionsLoaded,
  onClose,
  onBack,
  onStatusUpdated,
}: FacultyVerificationDrawerProps) {
  const activeAy = academicYear || "";
  const activeSem = semester || "";
  const [activeTab] = useState<"current" | "history">(initialTab);
  const [submissions, setSubmissions] = useState<
    FacultyRequirementSubmission[]
  >(initialSubmissions ?? []);
  const [facultyClasses, setFacultyClasses] = useState<
    Array<{
      id: string;
      subject_code: string;
      description: string;
      units: number;
      section_code: string;
    }>
  >(() =>
    (initialClasses ?? []).map((c) => ({
      id: c.id,
      subject_code: c.subject_code,
      description: c.description,
      units: Number(c.units ?? 0),
      section_code: c.section_code,
    })),
  );
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(
    () => initialSubmissions === undefined && initialClasses === undefined,
  );
  useEffect(() => {
    if (initialClasses !== undefined && !hasLoadedCurrentRef.current) {
      setFacultyClasses(
        initialClasses.map((c) => ({
          id: c.id,
          subject_code: c.subject_code,
          description: c.description,
          units: Number(c.units ?? 0),
          section_code: c.section_code,
        })),
      );
      setIsLoading(false);
    }
  }, [initialClasses]);
  const [reviewingCode, setReviewingCode] = useState<string | null>(null);
  const [submittingAction, setSubmittingAction] = useState<
    "validate" | "revision" | null
  >(null);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [isValidatingAll, setIsValidatingAll] = useState(false);

  // Requirement Templates
  const [dbTemplates, setDbTemplates] = useState<
    Array<{
      code: string;
      title: string;
      is_mandatory: boolean;
      is_active?: boolean;
    }>
  >(requirementTemplatesProp || []);

  useEffect(() => {
    if (requirementTemplatesProp && requirementTemplatesProp.length > 0) {
      setDbTemplates(
        requirementTemplatesProp.filter((t) => t.is_active !== false),
      );
      return;
    }
    let isCancelled = false;
    async function loadTemplates() {
      try {
        const res = await fetch("/api/staff/requirement-templates");
        if (res.ok && !isCancelled) {
          const data = await res.json();
          if (Array.isArray(data.templates) && data.templates.length > 0) {
            setDbTemplates(
              data.templates
                .filter((t: any) => t.is_active !== false)
                .map((t: any) => ({
                  code: t.code,
                  title: t.title,
                  is_mandatory: Boolean(t.is_mandatory),
                  is_active: t.is_active !== false,
                })),
            );
          }
        }
      } catch {
        // Fallback
      }
    }
    loadTemplates();
    return () => {
      isCancelled = true;
    };
  }, [requirementTemplatesProp]);

  // History Tab States
  const [historyAcademicYears, setHistoryAcademicYears] = useState<string[]>(
    () =>
      initialAvailableAcademicYears && initialAvailableAcademicYears.length > 0
        ? Array.from(
            new Set(
              [...initialAvailableAcademicYears, activeAy].filter(Boolean),
            ),
          )
            .sort()
            .reverse()
        : activeAy
          ? [activeAy]
          : [],
  );
  const [selectedHistoryAy, setSelectedHistoryAy] = useState<string>(() => {
    if (initialTab === "history" && activeAy) return activeAy;
    if (
      initialAvailableAcademicYears &&
      initialAvailableAcademicYears.length > 0
    ) {
      return activeAy && initialAvailableAcademicYears.includes(activeAy)
        ? activeAy
        : initialAvailableAcademicYears[0] || "";
    }
    return activeAy || "";
  });
  const [selectedHistorySem, setSelectedHistorySem] = useState<SemesterOption>(
    initialTab === "history" && activeSem
      ? activeSem
      : activeSem || "1st Semester",
  );

  const historyCacheRef = useRef<
    Record<
      string,
      { submissions: FacultyRequirementSubmission[]; classes: any[] }
    >
  >({
    ...(activeAy && activeSem
      ? {
          [`${activeAy}::${activeSem}`]: {
            submissions: initialSubmissions ?? [],
            classes: (initialClasses ?? []).map((c) => ({
              id: c.id,
              subject_code: c.subject_code,
              description: c.description,
              units: Number(c.units ?? 0),
              section_code: c.section_code,
            })),
          },
        }
      : {}),
  });

  const [historySubmissions, setHistorySubmissions] = useState<
    FacultyRequirementSubmission[]
  >(() => {
    const isMatchingActive =
      Boolean(activeAy && activeSem) &&
      (initialTab === "history" || (activeAy && activeSem));
    if (
      isMatchingActive &&
      initialSubmissions &&
      initialSubmissions.length > 0
    ) {
      return initialSubmissions;
    }
    return [];
  });
  const [historyClasses, setHistoryClasses] = useState<any[]>(() => {
    const isMatchingActive =
      Boolean(activeAy && activeSem) &&
      (initialTab === "history" || (activeAy && activeSem));
    if (isMatchingActive && initialClasses && initialClasses.length > 0) {
      return initialClasses.map((c) => ({
        id: c.id,
        subject_code: c.subject_code,
        description: c.description,
        units: Number(c.units ?? 0),
        section_code: c.section_code,
      }));
    }
    return [];
  });
  const [selectedHistoryClassId, setSelectedHistoryClassId] = useState<
    string | null
  >(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isDownloadingHistoryZip, setIsDownloadingHistoryZip] = useState(false);

  // Revision Request Modal States
  const [revisionModalData, setRevisionModalData] = useState<{
    submissionId: string;
    code: string;
    reqLabel: string;
  } | null>(null);
  const [revisionInputText, setRevisionInputText] = useState("");
  const [isSubmittingRevision, setIsSubmittingRevision] = useState(false);
  const [isPresetDropdownOpen, setIsPresetDropdownOpen] = useState(false);

  // Single Requirement Validate Modal States
  const [validateModalData, setValidateModalData] = useState<{
    submissionId: string;
    code: string;
    reqLabel: string;
  } | null>(null);
  const [validateInputText, setValidateInputText] = useState("");
  const [isValidatingSingle, setIsValidatingSingle] = useState(false);
  const [isValidatePresetDropdownOpen, setIsValidatePresetDropdownOpen] =
    useState(false);

  const [previewSubmission, setPreviewSubmission] =
    useState<DocumentPreviewSubmission | null>(null);

  const [remarksInput, setRemarksInput] = useState<Record<string, string>>({});
  const [actionFeedback, setActionFeedback] = useState<{
    type: "info" | "success" | "error";
    message: string;
  } | null>(null);

  const [isValidateModalOpen, setIsValidateModalOpen] = useState(false);
  const [bulkValidateNotes, setBulkValidateNotes] = useState("");
  const [
    isBulkValidatePresetDropdownOpen,
    setIsBulkValidatePresetDropdownOpen,
  ] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [validateTimerSeconds, setValidateTimerSeconds] = useState(5);
  const [noticeModalData, setNoticeModalData] = useState<{
    title: string;
    message: string;
  } | null>(null);

  const [zipProgressData, setZipProgressData] = useState<{
    status: "zipping" | "success" | "error";
    title: string;
    message: string;
    progressText?: string;
  } | null>(null);

  const zipAbortControllerRef = useRef<AbortController | null>(null);

  const handleCancelZip = useCallback(() => {
    if (zipAbortControllerRef.current) {
      zipAbortControllerRef.current.abort();
      zipAbortControllerRef.current = null;
    }
    setIsDownloadingHistoryZip(false);
    setIsDownloadingZip(false);
    setZipProgressData(null);
  }, []);

  // Reset selected class whenever faculty or active term changes
  useEffect(() => {
    setSelectedClassId(null);
    setSubjectSearchTerm("");
    setSubjectStatusFilter("all");
    setIsSubjectStatusDropdownOpen(false);
  }, [faculty.id, academicYear, semester]);

  const [subjectSearchTerm, setSubjectSearchTerm] = useState("");
  const [subjectStatusFilter, setSubjectStatusFilter] = useState<
    "all" | "completed" | "pending_review" | "needs_revision" | "not_submitted"
  >("all");
  const [isSubjectStatusDropdownOpen, setIsSubjectStatusDropdownOpen] =
    useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isValidateModalOpen && validateTimerSeconds > 0) {
      interval = setInterval(() => {
        setValidateTimerSeconds((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isValidateModalOpen, validateTimerSeconds]);

  const [filterMode, setFilterMode] = useState<
    "all" | "pending" | "revision_uploaded" | "validated" | "revision"
  >("all");

  const pendingSubmissionsCount = useMemo(() => {
    return submissions.filter((s) => {
      const matchesTerm = doesSubmissionMatchTerm(s, academicYear, semester);
      const isPending =
        s.status === "uploaded" ||
        s.status === "pending" ||
        s.status === "submitted" ||
        s.status === "under_review";
      return matchesTerm && isPending;
    }).length;
  }, [submissions, academicYear, semester]);

  const revisionsUploadedCount = useMemo(() => {
    return submissions.filter((s) => {
      const matchesTerm = doesSubmissionMatchTerm(s, academicYear, semester);
      if (!matchesTerm) return false;
      const sLower = (s.status || "").toLowerCase();
      const isPending =
        sLower === "uploaded" ||
        sLower === "pending" ||
        sLower === "submitted" ||
        sLower === "under_review";
      const hasPriorRejection = (s.review_decisions || []).some(
        (d) => (d.decision || "").toLowerCase() === "rejected",
      );
      const hasMultipleVersions = (s.document_versions || []).length > 1;
      return isPending && (hasPriorRejection || hasMultipleVersions);
    }).length;
  }, [submissions, academicYear, semester]);

  const validatedSubmissionsCount = useMemo(() => {
    return submissions.filter((s) => {
      const matchesTerm = doesSubmissionMatchTerm(s, academicYear, semester);
      const sLower = (s.status || "").toLowerCase();
      return matchesTerm && (sLower === "validated" || sLower === "approved");
    }).length;
  }, [submissions, academicYear, semester]);

  const revisionSubmissionsCount = useMemo(() => {
    return submissions.filter((s) => {
      const matchesTerm = doesSubmissionMatchTerm(s, academicYear, semester);
      const sLower = (s.status || "").toLowerCase();
      return (
        matchesTerm && (sLower === "rejected" || sLower === "needs_revision")
      );
    }).length;
  }, [submissions, academicYear, semester]);

  // All known requirements combining active templates, defaults, and any submitted custom/optional requirements
  const allRequirements = useMemo(() => {
    const items: Array<{
      code: string;
      title: string;
      isMandatory: boolean;
    }> = [];
    const seenCodes = new Set<string>();

    const templateSource =
      dbTemplates.length > 0
        ? dbTemplates
        : DEFAULT_REQUIREMENTS.map((code) => ({
            code,
            title: REQUIREMENT_LABEL[code] || code,
            is_mandatory: true,
          }));

    for (const tpl of templateSource) {
      const canonicalCode = matchRequirementCode(tpl.code) || tpl.code;
      if (!seenCodes.has(canonicalCode)) {
        items.push({
          code: canonicalCode,
          title:
            tpl.title ||
            (REQUIREMENT_LABEL as Record<string, string>)[canonicalCode] ||
            getFriendlyRequirementName(canonicalCode),
          isMandatory: tpl.is_mandatory ?? true,
        });
        seenCodes.add(canonicalCode);
      }
    }

    for (const code of DEFAULT_REQUIREMENTS) {
      if (!seenCodes.has(code)) {
        items.push({
          code,
          title: REQUIREMENT_LABEL[code] || getFriendlyRequirementName(code),
          isMandatory: true,
        });
        seenCodes.add(code);
      }
    }

    for (const sub of [...submissions, ...historySubmissions]) {
      const rawCode = sub.requirement_code;
      const canonicalCode = matchRequirementCode(rawCode) || rawCode;
      if (canonicalCode && !seenCodes.has(canonicalCode)) {
        items.push({
          code: canonicalCode,
          title:
            (REQUIREMENT_LABEL as Record<string, string>)[canonicalCode] ||
            getFriendlyRequirementName(canonicalCode),
          isMandatory: false,
        });
        seenCodes.add(canonicalCode);
      }
    }

    // Always sort stably by canonical order so rows NEVER reorder, jump, or move on new uploads
    items.sort((a, b) => {
      const orderA = CANONICAL_REQUIREMENT_ORDER[a.code] ?? 100;
      const orderB = CANONICAL_REQUIREMENT_ORDER[b.code] ?? 100;
      if (orderA !== orderB) return orderA - orderB;
      return a.title.localeCompare(b.title);
    });

    return items;
  }, [dbTemplates, submissions, historySubmissions]);

  interface SubmissionClassGroup {
    key: string;
    classId: string | null;
    sectionCode: string;
    subjectCode: string;
    description: string;
    units: number | null;
    submissions: FacultyRequirementSubmission[];
    isGeneral?: boolean;
  }

  const classGroups = useMemo<SubmissionClassGroup[]>(() => {
    const groups: SubmissionClassGroup[] = [];
    const classMap = new Map<string, SubmissionClassGroup>();

    // 1. Registered faculty classes (active only)
    facultyClasses
      .filter((fc: any) => !fc.is_archived)
      .forEach((fc) => {
        const key = fc.id || `${fc.section_code}_${fc.subject_code}`;
        const group: SubmissionClassGroup = {
          key,
          classId: fc.id || null,
          sectionCode: fc.section_code,
          subjectCode: fc.subject_code,
          description: fc.description,
          units: fc.units,
          submissions: [],
        };
        groups.push(group);
        classMap.set(key, group);
        if (fc.id) classMap.set(fc.id, group);
      });

    // 2. Discover any extra active classes directly attached to submissions
    submissions.forEach((sub) => {
      if (sub.faculty_class && !(sub.faculty_class as any).is_archived) {
        const fc = sub.faculty_class;
        const key = fc.id || `${fc.section_code}_${fc.subject_code}`;
        if (!classMap.has(key) && !(fc.id && classMap.has(fc.id))) {
          const group: SubmissionClassGroup = {
            key,
            classId: fc.id || null,
            sectionCode: fc.section_code,
            subjectCode: fc.subject_code,
            description: fc.description,
            units: fc.units,
            submissions: [],
          };
          groups.push(group);
          classMap.set(key, group);
          if (fc.id) classMap.set(fc.id, group);
        }
      }
    });

    // 3. Map submissions to their corresponding class group
    const unassignedSubmissions: FacultyRequirementSubmission[] = [];

    submissions.forEach((sub) => {
      // Exclude submissions that belong to archived classes
      if (
        sub.faculty_class &&
        Boolean((sub.faculty_class as any).is_archived)
      ) {
        return;
      }

      let target: SubmissionClassGroup | undefined;
      if (sub.class_id && classMap.has(sub.class_id)) {
        target = classMap.get(sub.class_id);
      } else if (sub.faculty_class) {
        const key =
          sub.faculty_class.id ||
          `${sub.faculty_class.section_code}_${sub.faculty_class.subject_code}`;
        target = classMap.get(key);
      } else if (!sub.class_id && groups.length > 0) {
        // If submission lacks class_id but faculty has registered class load(s),
        // route directly to the active class load instead of generating a spurious General Requirements subject
        target = groups[0];
      }

      if (target) {
        target.submissions.push(sub);
      } else if (!sub.class_id) {
        if (groups.length > 0) {
          groups[0].submissions.push(sub);
        } else {
          unassignedSubmissions.push(sub);
        }
      }
    });

    // 4. Provide the General Requirements group only if genuine unassigned general submissions exist AND no class loads exist
    if (unassignedSubmissions.length > 0 && groups.length === 0) {
      groups.unshift({
        key: "general",
        classId: null,
        sectionCode: "General Requirements",
        subjectCode: "GENERAL",
        description: "General / Institutional Requirements",
        units: null,
        submissions: unassignedSubmissions,
        isGeneral: true,
      });
    }

    return groups;
  }, [facultyClasses, submissions]);

  const selectedGroup = useMemo<SubmissionClassGroup | null>(() => {
    if (!selectedClassId) return null;
    return (
      classGroups.find(
        (g) =>
          g.key === selectedClassId ||
          (g.classId && g.classId === selectedClassId),
      ) || null
    );
  }, [selectedClassId, classGroups]);

  type SubjectStatusFilter =
    | "all"
    | "completed"
    | "pending_review"
    | "needs_revision"
    | "not_submitted";

  const subjectStatusFilterOptions: Array<{
    id: SubjectStatusFilter;
    label: string;
  }> = [
    { id: "all", label: "All Subjects" },
    { id: "completed", label: "Completed / Validated" },
    { id: "pending_review", label: "Pending Review" },
    { id: "needs_revision", label: "Needs Revision" },
    { id: "not_submitted", label: "Not Submitted" },
  ];

  const currentSubjectStatusOption =
    subjectStatusFilterOptions.find((opt) => opt.id === subjectStatusFilter) ||
    subjectStatusFilterOptions[0];

  const getGroupCategory = useCallback(
    (group: SubmissionClassGroup): SubjectStatusFilter => {
      const groupPendingCount = group.submissions.filter((s) => {
        const st = (s.status || "").toLowerCase();
        return (
          doesSubmissionMatchTerm(s, academicYear, semester) &&
          (st === "uploaded" ||
            st === "pending" ||
            st === "submitted" ||
            st === "under_review" ||
            st === "pending_review")
        );
      }).length;

      const groupRevisionCount = group.submissions.filter((s) => {
        const st = (s.status || "").toLowerCase();
        return (
          doesSubmissionMatchTerm(s, academicYear, semester) &&
          (st === "rejected" || st === "needs_revision")
        );
      }).length;

      const groupValidatedCount = group.submissions.filter((s) => {
        const st = (s.status || "").toLowerCase();
        return (
          doesSubmissionMatchTerm(s, academicYear, semester) &&
          (st === "validated" || st === "approved")
        );
      }).length;

      const termSubmissions = group.submissions.filter((s) =>
        doesSubmissionMatchTerm(s, academicYear, semester),
      );

      const mandatoryReqs = allRequirements.filter((r) => r.isMandatory);
      const reqsToCheck =
        mandatoryReqs.length > 0 ? mandatoryReqs : allRequirements;
      const isAllDone =
        reqsToCheck.length > 0 && groupValidatedCount >= reqsToCheck.length;

      if (groupPendingCount > 0) return "pending_review";
      if (groupRevisionCount > 0) return "needs_revision";
      if (isAllDone || groupValidatedCount > 0) return "completed";
      if (termSubmissions.length === 0) return "not_submitted";
      return "not_submitted";
    },
    [academicYear, semester, allRequirements],
  );

  const subjectStatusCounts = useMemo(() => {
    let completed = 0;
    let pending_review = 0;
    let needs_revision = 0;
    let not_submitted = 0;

    classGroups.forEach((group) => {
      const cat = getGroupCategory(group);
      if (cat === "completed") completed++;
      else if (cat === "pending_review") pending_review++;
      else if (cat === "needs_revision") needs_revision++;
      else if (cat === "not_submitted") not_submitted++;
    });

    return {
      all: classGroups.length,
      completed,
      pending_review,
      needs_revision,
      not_submitted,
    };
  }, [classGroups, getGroupCategory]);

  const filteredClassGroups = useMemo(() => {
    return classGroups.filter((group) => {
      const search = subjectSearchTerm.trim().toLowerCase();
      const matchesSearch =
        !search ||
        group.sectionCode.toLowerCase().includes(search) ||
        group.subjectCode.toLowerCase().includes(search) ||
        group.description.toLowerCase().includes(search);

      const cat = getGroupCategory(group);
      const matchesStatus =
        subjectStatusFilter === "all" || cat === subjectStatusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [classGroups, subjectSearchTerm, subjectStatusFilter, getGroupCategory]);

  const historyClassGroups = useMemo<SubmissionClassGroup[]>(() => {
    const groups: SubmissionClassGroup[] = [];
    const classMap = new Map<string, SubmissionClassGroup>();

    const targetClasses =
      historyClasses.length > 0 ? historyClasses : facultyClasses;

    targetClasses
      .filter((fc: any) => !fc.is_archived)
      .forEach((fc) => {
        const key = fc.id || `${fc.section_code}_${fc.subject_code}`;
        const group: SubmissionClassGroup = {
          key,
          classId: fc.id || null,
          sectionCode: fc.section_code,
          subjectCode: fc.subject_code,
          description: fc.description,
          units: fc.units,
          submissions: [],
        };
        groups.push(group);
        classMap.set(key, group);
        if (fc.id) classMap.set(fc.id, group);
      });

    historySubmissions.forEach((sub) => {
      if (sub.faculty_class && !(sub.faculty_class as any).is_archived) {
        const fc = sub.faculty_class;
        const key = fc.id || `${fc.section_code}_${fc.subject_code}`;
        if (!classMap.has(key) && !(fc.id && classMap.has(fc.id))) {
          const group: SubmissionClassGroup = {
            key,
            classId: fc.id || null,
            sectionCode: fc.section_code,
            subjectCode: fc.subject_code,
            description: fc.description,
            units: fc.units,
            submissions: [],
          };
          groups.push(group);
          classMap.set(key, group);
          if (fc.id) classMap.set(fc.id, group);
        }
      }
    });

    const unassignedSubmissions: FacultyRequirementSubmission[] = [];

    historySubmissions.forEach((sub) => {
      if (
        sub.faculty_class &&
        Boolean((sub.faculty_class as any).is_archived)
      ) {
        return;
      }

      let target: SubmissionClassGroup | undefined;
      if (sub.class_id && classMap.has(sub.class_id)) {
        target = classMap.get(sub.class_id);
      } else if (sub.faculty_class) {
        const key =
          sub.faculty_class.id ||
          `${sub.faculty_class.section_code}_${sub.faculty_class.subject_code}`;
        target = classMap.get(key);
      } else if (!sub.class_id && groups.length > 0) {
        target = groups[0];
      }

      if (target) {
        target.submissions.push(sub);
      } else if (!sub.class_id) {
        if (groups.length > 0) {
          groups[0].submissions.push(sub);
        } else {
          unassignedSubmissions.push(sub);
        }
      }
    });

    if (unassignedSubmissions.length > 0 && groups.length === 0) {
      groups.unshift({
        key: "general",
        classId: null,
        sectionCode: "General Requirements",
        subjectCode: "GENERAL",
        description: "General / Institutional Requirements",
        units: null,
        submissions: unassignedSubmissions,
        isGeneral: true,
      });
    }

    return groups;
  }, [historyClasses, facultyClasses, historySubmissions]);

  const selectedHistoryGroup = useMemo<SubmissionClassGroup | null>(() => {
    if (!selectedHistoryClassId) return null;
    return (
      historyClassGroups.find(
        (g) =>
          g.key === selectedHistoryClassId ||
          (g.classId && g.classId === selectedHistoryClassId),
      ) || null
    );
  }, [selectedHistoryClassId, historyClassGroups]);

  const selectedGroupPendingCount = useMemo(() => {
    if (!selectedGroup) return 0;
    return selectedGroup.submissions.filter((s) => {
      const matchesTerm = doesSubmissionMatchTerm(s, academicYear, semester);
      const sLower = (s.status || "").toLowerCase();
      const isPending =
        sLower === "uploaded" ||
        sLower === "pending" ||
        sLower === "submitted" ||
        sLower === "under_review" ||
        sLower === "pending_review";
      return matchesTerm && isPending;
    }).length;
  }, [selectedGroup, academicYear, semester]);

  const selectedGroupRevisionsUploadedCount = useMemo(() => {
    if (!selectedGroup) return 0;
    return selectedGroup.submissions.filter((s) => {
      const matchesTerm = doesSubmissionMatchTerm(s, academicYear, semester);
      if (!matchesTerm) return false;
      const sLower = (s.status || "").toLowerCase();
      const isPending =
        sLower === "uploaded" ||
        sLower === "pending" ||
        sLower === "submitted" ||
        sLower === "under_review" ||
        sLower === "pending_review";
      const hasPriorRejection = (s.review_decisions || []).some(
        (d) => (d.decision || "").toLowerCase() === "rejected",
      );
      const hasMultipleVersions = (s.document_versions || []).length > 1;
      return isPending && (hasPriorRejection || hasMultipleVersions);
    }).length;
  }, [selectedGroup, academicYear, semester]);

  const selectedGroupValidatedCount = useMemo(() => {
    if (!selectedGroup) return 0;
    return selectedGroup.submissions.filter((s) => {
      const matchesTerm = doesSubmissionMatchTerm(s, academicYear, semester);
      const sLower = (s.status || "").toLowerCase();
      return matchesTerm && (sLower === "validated" || sLower === "approved");
    }).length;
  }, [selectedGroup, academicYear, semester]);

  const selectedGroupRevisionCount = useMemo(() => {
    if (!selectedGroup) return 0;
    return selectedGroup.submissions.filter((s) => {
      const matchesTerm = doesSubmissionMatchTerm(s, academicYear, semester);
      const sLower = (s.status || "").toLowerCase();
      return (
        matchesTerm && (sLower === "rejected" || sLower === "needs_revision")
      );
    }).length;
  }, [selectedGroup, academicYear, semester]);

  const selectedGroupRequirements = useMemo(() => {
    if (!selectedGroup) return [];
    return allRequirements.filter((req) => {
      if (filterMode === "all") return true;
      const code = req.code;
      const matchingSub = selectedGroup.submissions.find((s) => {
        const codeMatched =
          matchRequirementCode(
            s.requirement_code,
            (s as { requirement_id?: string }).requirement_id,
          ) === code || s.requirement_code === code;
        return (
          codeMatched && doesSubmissionMatchTerm(s, academicYear, semester)
        );
      });
      const rawStatus = matchingSub
        ? (matchingSub.status || "").toLowerCase()
        : "not_submitted";
      const isValidated = rawStatus === "validated" || rawStatus === "approved";
      const isRevision =
        rawStatus === "rejected" || rawStatus === "needs_revision";
      const isPending =
        rawStatus === "uploaded" ||
        rawStatus === "pending" ||
        rawStatus === "submitted" ||
        rawStatus === "under_review" ||
        rawStatus === "pending_review";
      const hasPriorRejection = (matchingSub?.review_decisions || []).some(
        (d) => (d.decision || "").toLowerCase() === "rejected",
      );
      const isRevisionUploaded =
        isPending &&
        (hasPriorRejection ||
          (matchingSub?.document_versions || []).length > 1);

      if (filterMode === "pending") return isPending;
      if (filterMode === "revision_uploaded") return isRevisionUploaded;
      if (filterMode === "validated") return isValidated;
      if (filterMode === "revision") return isRevision;
      return true;
    });
  }, [selectedGroup, allRequirements, filterMode, academicYear, semester]);

  const hasHandledInitialTargetRef = useRef(false);

  useEffect(() => {
    hasHandledInitialTargetRef.current = false;
  }, [initialRequirementCode, faculty.id]);

  // Scroll to target requirement if requested (once on initial load, no highlight)
  useEffect(() => {
    if (!initialRequirementCode || isLoading || classGroups.length === 0)
      return;
    if (hasHandledInitialTargetRef.current) return;

    if (!selectedClassId) {
      const matchedGroup = classGroups.find((g) =>
        g.submissions.some((s) => {
          const codeMatched =
            matchRequirementCode(
              s.requirement_code,
              (s as { requirement_id?: string }).requirement_id,
            ) === initialRequirementCode ||
            s.requirement_code === initialRequirementCode;
          return codeMatched;
        }),
      );
      setSelectedClassId(matchedGroup ? matchedGroup.key : null);
      return;
    }

    hasHandledInitialTargetRef.current = true;

    const timeout = setTimeout(() => {
      const element = document.getElementById(
        `req-row-${initialRequirementCode}`,
      );
      if (element) {
        element.scrollIntoView({ behavior: "auto", block: "center" });
      }
    }, 200);

    return () => clearTimeout(timeout);
  }, [initialRequirementCode, isLoading, classGroups, selectedClassId]);

  const hasLoadedCurrentRef = useRef(
    Boolean(initialSubmissions !== undefined || initialClasses !== undefined),
  );
  const hasLoadedHistoryRef = useRef(false);
  const lastFetchedCurrentKeyRef = useRef<string | null>(null);

  const onSubmissionsLoadedRef = useRef(onSubmissionsLoaded);
  useEffect(() => {
    onSubmissionsLoadedRef.current = onSubmissionsLoaded;
  }, [onSubmissionsLoaded]);

  const refreshCurrentSubmissions = useCallback(
    async (options?: { silent?: boolean; force?: boolean }) => {
      const fetchKey = `${faculty.id}::${activeAy}::${activeSem}`;
      if (
        !options?.force &&
        lastFetchedCurrentKeyRef.current === fetchKey &&
        hasLoadedCurrentRef.current
      ) {
        return;
      }
      const isSilent = options?.silent ?? hasLoadedCurrentRef.current;
      if (!faculty.id) {
        if (!isSilent) setIsLoading(false);
        return;
      }
      if (!isSilent) {
        setIsLoading(true);
      }
      lastFetchedCurrentKeyRef.current = fetchKey;
      try {
        const subRes = await fetch(
          `/api/staff/faculty/submissions?facultyId=${encodeURIComponent(faculty.id)}&academicYear=${encodeURIComponent(activeAy)}&semester=${encodeURIComponent(activeSem)}&_t=${Date.now()}`,
          { credentials: "include", cache: "no-store" },
        );

        if (subRes.ok) {
          const subData = await subRes.json();
          const nextSubs = subData.submissions || [];
          const nextClasses = Array.isArray(subData.classes)
            ? subData.classes
            : [];
          setSubmissions(nextSubs);
          if (Array.isArray(subData.classes)) {
            setFacultyClasses(nextClasses);
          }
          onSubmissionsLoadedRef.current?.(faculty.id, {
            submissions: nextSubs,
            classes: nextClasses,
          });
          hasLoadedCurrentRef.current = true;
        }
      } catch (err) {
        console.error("Failed to load current submissions:", err);
      } finally {
        setIsLoading(false);
      }
    },
    [faculty.id, activeAy, activeSem],
  );

  // 1. Fetch current term submissions (only on faculty/term change, without retriggering on history state updates)
  useEffect(() => {
    void refreshCurrentSubmissions();
  }, [refreshCurrentSubmissions]);

  // 2. Fetch history academic years once on mount (skip if already provided from parent)
  useEffect(() => {
    if (
      initialAvailableAcademicYears &&
      initialAvailableAcademicYears.length > 0
    ) {
      const merged = Array.from(
        new Set([...initialAvailableAcademicYears, activeAy].filter(Boolean)),
      )
        .sort()
        .reverse();
      setHistoryAcademicYears(merged);
      setSelectedHistoryAy((prev) => {
        if (prev) return prev;
        return activeAy && initialAvailableAcademicYears.includes(activeAy)
          ? activeAy
          : initialAvailableAcademicYears[0] || "";
      });
      return;
    }

    let isCancelled = false;
    async function loadHistoryMetadata() {
      if (!faculty.id) return;
      try {
        const verRes = await fetch(
          `/api/staff/faculty/requirements/verification?facultyId=${encodeURIComponent(faculty.id)}&academicYear=${encodeURIComponent(activeAy)}&semester=${encodeURIComponent(activeSem)}`,
          { credentials: "include" },
        );

        if (verRes.ok && !isCancelled) {
          const verData = await verRes.json();
          const years: string[] = verData.availableAcademicYears ?? [];
          if (years.length > 0) {
            setHistoryAcademicYears(
              Array.from(new Set([...years, activeAy]))
                .sort()
                .reverse(),
            );
            setSelectedHistoryAy((prev) => {
              if (prev) return prev;
              const defaultYear =
                activeAy && years.includes(activeAy)
                  ? activeAy
                  : years[0] || "";
              return defaultYear;
            });
          }
        }
      } catch (err) {
        console.error("Failed to load verification history metadata:", err);
      }
    }

    loadHistoryMetadata();
    return () => {
      isCancelled = true;
    };
  }, [faculty.id, activeAy, activeSem, initialAvailableAcademicYears]);

  // Keep cache synced with current submissions and active term
  useEffect(() => {
    if (activeAy && activeSem) {
      const termKey = `${activeAy}::${activeSem}`;
      historyCacheRef.current[termKey] = {
        submissions,
        classes: facultyClasses,
      };
      if (selectedHistoryAy === activeAy && selectedHistorySem === activeSem) {
        setHistorySubmissions(submissions);
        setHistoryClasses(facultyClasses);
      }
    }
  }, [
    activeAy,
    activeSem,
    submissions,
    facultyClasses,
    selectedHistoryAy,
    selectedHistorySem,
  ]);

  // Background prefetch all available history academic terms so switching is instant
  useEffect(() => {
    if (!faculty.id || historyAcademicYears.length === 0) return;
    const sems: SemesterOption[] = [
      "1st Semester",
      "2nd Semester",
      "Summer Semester",
    ];
    historyAcademicYears.forEach((ay) => {
      sems.forEach((sem) => {
        const termKey = `${ay}::${sem}`;
        if (historyCacheRef.current[termKey]) return;
        fetch(
          `/api/staff/faculty/submissions?facultyId=${encodeURIComponent(faculty.id)}&academicYear=${encodeURIComponent(ay)}&semester=${encodeURIComponent(sem)}`,
          { credentials: "include" },
        )
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data) {
              const subs = data.submissions || [];
              const cls = Array.isArray(data.classes) ? data.classes : [];
              historyCacheRef.current[termKey] = {
                submissions: subs,
                classes: cls,
              };
              if (selectedHistoryAy === ay && selectedHistorySem === sem) {
                setHistorySubmissions(subs);
                setHistoryClasses(cls);
              }
            }
          })
          .catch(() => {});
      });
    });
  }, [faculty.id, historyAcademicYears, selectedHistoryAy, selectedHistorySem]);

  const refreshHistorySubmissions = useCallback(
    async (options?: { silent?: boolean }) => {
      if (
        activeTab !== "history" ||
        !faculty.id ||
        !selectedHistoryAy ||
        !selectedHistorySem
      )
        return;
      const termKey = `${selectedHistoryAy}::${selectedHistorySem}`;
      const cached = historyCacheRef.current[termKey];
      if (cached) {
        setHistorySubmissions(cached.submissions);
        setHistoryClasses(cached.classes);
      }
      const isSilent =
        options?.silent ?? (Boolean(cached) || hasLoadedHistoryRef.current);
      if (!isSilent) {
        setIsLoadingHistory(true);
      }
      try {
        const res = await fetch(
          `/api/staff/faculty/submissions?facultyId=${encodeURIComponent(faculty.id)}&academicYear=${encodeURIComponent(selectedHistoryAy)}&semester=${encodeURIComponent(selectedHistorySem)}&_t=${Date.now()}`,
          { credentials: "include", cache: "no-store" },
        );
        if (res.ok) {
          const data = await res.json();
          const subs = data.submissions || [];
          const cls = Array.isArray(data.classes) ? data.classes : [];
          historyCacheRef.current[termKey] = {
            submissions: subs,
            classes: cls,
          };
          setHistorySubmissions(subs);
          if (Array.isArray(data.classes)) {
            setHistoryClasses(cls);
          }
          hasLoadedHistoryRef.current = true;
        }
      } catch (err) {
        console.error("Failed to load history submissions:", err);
      } finally {
        if (!isSilent) {
          setIsLoadingHistory(false);
        }
      }
    },
    [activeTab, faculty.id, selectedHistoryAy, selectedHistorySem],
  );

  // 3. Fetch history submissions on-demand when history tab is active
  useEffect(() => {
    void refreshHistorySubmissions();
  }, [refreshHistorySubmissions]);

  // 4. Realtime synchronization for subjects (faculty_classes) & requirement uploads (submissions)
  useRealtimeSync(() => {
    void refreshCurrentSubmissions({ silent: true, force: true });
    if (activeTab === "history") {
      void refreshHistorySubmissions({ silent: true });
    }
    onStatusUpdated?.();
  });

  const handleClose = () => {
    setSelectedClassId(null);
    setRemarksInput({});
    setRevisionModalData(null);
    setValidateModalData(null);
    if (onBack) {
      onBack();
    } else {
      onClose?.();
    }
  };

  const handleRefresh = async () => {
    if (!faculty.id || isRefreshing) return;
    setIsRefreshing(true);
    try {
      if (activeTab === "current") {
        const subRes = await fetch(
          `/api/staff/faculty/submissions?facultyId=${encodeURIComponent(
            faculty.id,
          )}&academicYear=${encodeURIComponent(
            activeAy,
          )}&semester=${encodeURIComponent(activeSem)}&_t=${Date.now()}`,
          { credentials: "include", cache: "no-store" },
        );
        if (subRes.ok) {
          const subData = await subRes.json();
          setSubmissions(subData.submissions || []);
          if (Array.isArray(subData.classes)) {
            setFacultyClasses(subData.classes);
          }
        }
      } else {
        if (selectedHistoryAy && selectedHistorySem) {
          const res = await fetch(
            `/api/staff/faculty/submissions?facultyId=${encodeURIComponent(
              faculty.id,
            )}&academicYear=${encodeURIComponent(
              selectedHistoryAy,
            )}&semester=${encodeURIComponent(selectedHistorySem)}&_t=${Date.now()}`,
            { credentials: "include", cache: "no-store" },
          );
          if (res.ok) {
            const data = await res.json();
            setHistorySubmissions(data.submissions || []);
            if (Array.isArray(data.classes)) {
              setHistoryClasses(data.classes);
            }
          }
        }
      }
      onStatusUpdated?.();
    } catch (err) {
      console.error("Failed to refresh requirements:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const openValidateModal = (
    submissionId: string,
    code: string,
    reqLabel: string,
  ) => {
    setValidateModalData({
      submissionId,
      code,
      reqLabel,
    });
    setValidateInputText("");
    setIsValidatePresetDropdownOpen(false);
  };

  const handleSendValidateRequest = async () => {
    if (!validateModalData) return;
    setIsValidatingSingle(true);
    try {
      await handleReviewSubmission(
        validateModalData.submissionId,
        "validated",
        validateModalData.code,
        validateInputText,
      );
      setValidateModalData(null);
    } finally {
      setIsValidatingSingle(false);
    }
  };

  const openRevisionModal = (
    submissionId: string,
    code: string,
    reqLabel: string,
    existingRemarks: string = "",
  ) => {
    setRevisionModalData({
      submissionId,
      code,
      reqLabel,
    });
    setRevisionInputText(existingRemarks || "");
  };

  async function handleReviewSubmission(
    submissionId: string,
    decision: "validated" | "rejected",
    code: string,
    customRemarks?: string,
  ) {
    const actionType: "validate" | "revision" =
      decision === "validated" ? "validate" : "revision";
    setReviewingCode(code);
    setSubmittingAction(actionType);
    try {
      const remarksToSend = (
        customRemarks !== undefined ? customRemarks : remarksInput[code] || ""
      ).trim();
      const response = await fetch("/api/staff/faculty/submissions/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          submissionId,
          decision,
          remarks: remarksToSend,
        }),
      });

      if (response.ok) {
        setSubmissions((prev) =>
          prev.map((sub) =>
            sub.id === submissionId
              ? {
                  ...sub,
                  status: decision,
                  admin_remarks: remarksToSend,
                  review_decisions: [
                    {
                      decision,
                      remarks: remarksToSend,
                      created_at: new Date().toISOString(),
                    },
                    ...(sub.review_decisions || []),
                  ],
                }
              : sub,
          ),
        );
        // Reset remarks state for this requirement code on successful submission
        setRemarksInput((prev) => {
          const next = { ...prev };
          delete next[code];
          return next;
        });
        setActionFeedback({
          type: "success",
          message:
            decision === "validated"
              ? "Requirement successfully validated."
              : "Revision request submitted. Faculty has been notified.",
        });
        setTimeout(() => setActionFeedback(null), 4000);
        onStatusUpdated?.();
      } else {
        const errData = await response.json().catch(() => ({}));
        setActionFeedback({
          type: "error",
          message: `Error: ${errData.error || "Failed to submit review"}`,
        });
        setTimeout(() => setActionFeedback(null), 4000);
      }
    } catch (err) {
      console.error("Review submission error:", err);
      setActionFeedback({
        type: "error",
        message: "Failed to process review action. Please try again.",
      });
      setTimeout(() => setActionFeedback(null), 4000);
    } finally {
      setReviewingCode(null);
      setSubmittingAction(null);
    }
  }

  const handleSendRevisionRequest = async () => {
    if (!revisionModalData) return;
    setIsSubmittingRevision(true);
    try {
      await handleReviewSubmission(
        revisionModalData.submissionId,
        "rejected",
        revisionModalData.code,
        revisionInputText,
      );
      setRevisionModalData(null);
    } finally {
      setIsSubmittingRevision(false);
    }
  };

  async function handleSingleFileDownload(
    storagePath?: string | null,
    fileName: string = "Document",
  ) {
    if (!storagePath) {
      setNoticeModalData({
        title: "File Unavailable",
        message: `The file "${fileName}" is not attached or no longer exists on the server.`,
      });
      return;
    }

    setZipProgressData({
      status: "zipping",
      title: "Downloading File",
      message: `Getting "${fileName}"...`,
      progressText: "Preparing download...",
    });

    try {
      const downloadUrl = `/api/storage/download?path=${encodeURIComponent(
        storagePath,
      )}&download=true`;
      const res = await fetch(downloadUrl);

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        setZipProgressData({
          status: "success",
          title: "Download Started",
          message: `"${fileName}" has been downloaded successfully!`,
          progressText: "Complete 100%",
        });
      } else {
        setZipProgressData({
          status: "error",
          title: "Download Error",
          message: `Failed to download file "${fileName}".`,
        });
      }
    } catch (err) {
      console.error("Single file download error:", err);
      setZipProgressData({
        status: "error",
        title: "Download Error",
        message: `Failed to download "${fileName}". Please try again.`,
      });
    }
  }

  // 1. "Download All as ZIP" Action
  async function handleDownloadZip() {
    setIsDownloadingZip(true);
    try {
      const classSuffix = selectedGroup
        ? `_${selectedGroup.isGeneral ? "General" : `${selectedGroup.sectionCode}_${selectedGroup.subjectCode}`}`
        : "";
      const zipFilename =
        `${faculty.fullName}_${academicYear}_${semester}${classSuffix}_Requirements.zip`.replace(
          /[\\/:*?"<>|]+/g,
          "_",
        );

      // Check uploaded requirement files
      const targetSubmissions = selectedGroup
        ? selectedGroup.submissions
        : submissions;
      const uploadedSubmissions = targetSubmissions.filter((s) => {
        const matchesTerm = doesSubmissionMatchTerm(s, academicYear, semester);
        return matchesTerm && Boolean(s.id);
      });

      if (uploadedSubmissions.length === 0) {
        setNoticeModalData({
          title: "No Downloadable Requirements",
          message: selectedGroup
            ? `There are no uploaded requirement files available for download for ${selectedGroup.isGeneral ? "General Requirements" : `${selectedGroup.sectionCode} • ${selectedGroup.subjectCode}`}.`
            : `There are no uploaded requirement files available for download for ${faculty.fullName} for A.Y. ${academicYear} • ${semester}.`,
        });
        return;
      }

      zipAbortControllerRef.current = new AbortController();
      setZipProgressData({
        status: "zipping",
        title: "Packaging Requirements (ZIP)",
        message: `Preparing ZIP package for ${faculty.fullName}...`,
        progressText: "Initializing files...",
      });

      const zip = new JSZip();
      let processedCount = 0;
      const totalCount = uploadedSubmissions.reduce(
        (acc, s) => acc + (s.document_versions?.length || 0),
        0,
      );

      for (const sub of uploadedSubmissions) {
        const label = getFriendlyRequirementName(sub.requirement_code);
        const docs = sub.document_versions || [];
        const classFolder = sub.faculty_class
          ? `${sub.faculty_class.section_code}_${sub.faculty_class.subject_code}`.replace(
              /[\\/:*?"<>|]+/g,
              "_",
            )
          : "General_Requirements";

        for (const doc of docs) {
          if (zipAbortControllerRef.current?.signal.aborted) return;
          if (!doc.storage_path) continue;
          processedCount++;
          setZipProgressData({
            status: "zipping",
            title: "Packaging Requirements (ZIP)",
            message: `Getting "${label}" (${classFolder})...`,
            progressText: `Processing file ${processedCount} of ${totalCount}...`,
          });

          const downloadUrl = `/api/storage/download?path=${encodeURIComponent(
            doc.storage_path,
          )}`;
          const fileRes = await fetch(downloadUrl, {
            signal: zipAbortControllerRef.current?.signal,
          });
          if (fileRes.ok) {
            const fileBlob = await fileRes.blob();
            const ext = doc.storage_path.match(/\.[^.]+$/)?.[0] || ".pdf";
            const fileName = `${label}${ext}`;
            zip.file(`${classFolder}/${label}/${fileName}`, fileBlob);
          }
        }
      }

      if (zipAbortControllerRef.current?.signal.aborted) return;

      setZipProgressData({
        status: "zipping",
        title: "Packaging Requirements (ZIP)",
        message: "Compressing files into ZIP archive...",
        progressText: "Finalizing archive...",
      });

      const zipContent = await zip.generateAsync({ type: "blob" });
      const url = window.URL.createObjectURL(zipContent);
      const link = document.createElement("a");
      link.href = url;
      link.download = zipFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setZipProgressData({
        status: "success",
        title: "Download Started",
        message: `Requirement ZIP package generated successfully! (${totalCount} file(s))`,
        progressText: "Complete 100%",
      });
    } catch (err: unknown) {
      if (
        (err as Error)?.name === "AbortError" ||
        zipAbortControllerRef.current?.signal.aborted
      ) {
        return;
      }
      console.error("ZIP download failed:", err);
      setZipProgressData({
        status: "error",
        title: "Download Error",
        message:
          "Failed to generate requirement ZIP package. Please try again.",
      });
    } finally {
      setIsDownloadingZip(false);
    }
  }

  // 1b. "Download History ZIP" Action for Verification History
  async function handleDownloadHistoryZip() {
    setIsDownloadingHistoryZip(true);
    try {
      const sanitizedName = faculty.fullName.replace(/[\\/:*?"<>|]+/g, "_");
      const classSuffix = selectedHistoryGroup
        ? `_${selectedHistoryGroup.isGeneral ? "General" : `${selectedHistoryGroup.sectionCode}_${selectedHistoryGroup.subjectCode}`}`
        : "";
      const zipFilename =
        `${sanitizedName}_Requirements_${selectedHistoryAy}_${selectedHistorySem}${classSuffix}.zip`.replace(
          /[\\/:*?"<>|]+/g,
          "_",
        );

      const targetHistorySubs = selectedHistoryGroup
        ? selectedHistoryGroup.submissions
        : historySubmissions;

      const historySubmissionsWithDocs = targetHistorySubs.filter(
        (s) =>
          Array.isArray(s.document_versions) && s.document_versions.length > 0,
      );

      if (historySubmissionsWithDocs.length === 0) {
        setNoticeModalData({
          title: "No Downloadable Requirements",
          message: selectedHistoryGroup
            ? `There are no uploaded requirement files available for download for ${selectedHistoryGroup.isGeneral ? "General Requirements" : `${selectedHistoryGroup.sectionCode} • ${selectedHistoryGroup.subjectCode}`}.`
            : `There are no uploaded requirement files available for download for ${faculty.fullName} for A.Y. ${selectedHistoryAy} • ${selectedHistorySem}.`,
        });
        return;
      }

      zipAbortControllerRef.current = new AbortController();
      setZipProgressData({
        status: "zipping",
        title: "Packaging History ZIP",
        message: `Packaging past submission files for A.Y. ${selectedHistoryAy} • ${selectedHistorySem}...`,
        progressText: "Initializing history files...",
      });

      const zip = new JSZip();
      let processedCount = 0;
      const totalCount = historySubmissionsWithDocs.reduce(
        (acc, s) => acc + (s.document_versions?.length || 0),
        0,
      );

      for (const sub of historySubmissionsWithDocs) {
        const label = getFriendlyRequirementName(sub.requirement_code);
        const docs = sub.document_versions || [];
        const classFolder = sub.faculty_class
          ? `${sub.faculty_class.section_code}_${sub.faculty_class.subject_code}`.replace(
              /[\\/:*?"<>|]+/g,
              "_",
            )
          : "General_Requirements";

        for (const doc of docs) {
          if (zipAbortControllerRef.current?.signal.aborted) return;
          if (!doc.storage_path) continue;
          processedCount++;
          setZipProgressData({
            status: "zipping",
            title: "Packaging History ZIP",
            message: `Getting "${label}" (${classFolder})...`,
            progressText: `Processing file ${processedCount} of ${totalCount}...`,
          });

          const downloadUrl = `/api/storage/download?path=${encodeURIComponent(
            doc.storage_path,
          )}`;
          const fileRes = await fetch(downloadUrl, {
            signal: zipAbortControllerRef.current?.signal,
          });
          if (fileRes.ok) {
            const fileBlob = await fileRes.blob();
            const ext = doc.storage_path.match(/\.[^.]+$/)?.[0] || ".pdf";
            const fileName = `${label}${ext}`;
            zip.file(`${classFolder}/${label}/${fileName}`, fileBlob);
          }
        }
      }

      if (zipAbortControllerRef.current?.signal.aborted) return;

      setZipProgressData({
        status: "zipping",
        title: "Packaging History ZIP",
        message: "Compressing history files into ZIP archive...",
        progressText: "Finalizing archive...",
      });

      const zipContent = await zip.generateAsync({ type: "blob" });
      const url = window.URL.createObjectURL(zipContent);
      const link = document.createElement("a");
      link.href = url;
      link.download = zipFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setZipProgressData({
        status: "success",
        title: "History Download Started",
        message: `History ZIP archive generated successfully! (${totalCount} file(s))`,
        progressText: "Complete 100%",
      });
    } catch (err: unknown) {
      if (
        (err as Error)?.name === "AbortError" ||
        zipAbortControllerRef.current?.signal.aborted
      ) {
        return;
      }
      console.error("History ZIP download failed:", err);
      setZipProgressData({
        status: "error",
        title: "Download Error",
        message: "Failed to generate history ZIP archive.",
      });
    } finally {
      setIsDownloadingHistoryZip(false);
    }
  }

  // 2. "Validate All" Bulk Action Pop-up Modal Trigger
  function triggerValidateAllPendingModal() {
    const targetSource = selectedGroup
      ? selectedGroup.submissions
      : submissions;
    const pendingSubmissions = targetSource.filter((s) => {
      const matchesTerm = doesSubmissionMatchTerm(s, academicYear, semester);
      const isPending =
        s.status === "uploaded" ||
        s.status === "pending" ||
        s.status === "submitted" ||
        s.status === "under_review" ||
        s.status === "pending_review";
      return matchesTerm && isPending && Boolean(s.id);
    });

    if (pendingSubmissions.length === 0) {
      setNoticeModalData({
        title: "No Pending Requirements",
        message: selectedGroup
          ? `No pending requirement submissions are available to validate for ${selectedGroup.isGeneral ? "General Requirements" : `${selectedGroup.sectionCode} • ${selectedGroup.subjectCode}`}.`
          : `No pending requirement submissions are available to validate for ${faculty.fullName} (A.Y. ${academicYear} • ${semester}).`,
      });
      return;
    }

    setBulkValidateNotes("");
    setIsBulkValidatePresetDropdownOpen(false);
    setValidateTimerSeconds(5);
    setIsValidateModalOpen(true);
  }

  async function executeValidateAllPending() {
    const targetSource = selectedGroup
      ? selectedGroup.submissions
      : submissions;
    const pendingSubmissions = targetSource.filter((s) => {
      const matchesTerm = doesSubmissionMatchTerm(s, academicYear, semester);
      const isPending =
        s.status === "uploaded" ||
        s.status === "pending" ||
        s.status === "submitted" ||
        s.status === "under_review" ||
        s.status === "pending_review";
      return matchesTerm && isPending && Boolean(s.id);
    });

    if (pendingSubmissions.length === 0) {
      setIsValidateModalOpen(false);
      setNoticeModalData({
        title: "No Pending Requirements",
        message: selectedGroup
          ? `No pending requirement submissions are available to validate for ${selectedGroup.isGeneral ? "General Requirements" : `${selectedGroup.sectionCode} • ${selectedGroup.subjectCode}`}.`
          : `No pending requirement submissions are available to validate for ${faculty.fullName}.`,
      });
      return;
    }

    setIsValidatingAll(true);
    try {
      const remarksToSend = bulkValidateNotes.trim();
      await Promise.all(
        pendingSubmissions.map((sub) =>
          fetch("/api/staff/faculty/submissions/review", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              submissionId: sub.id,
              decision: "validated",
              remarks: remarksToSend,
            }),
          }),
        ),
      );

      const pendingIds = new Set(pendingSubmissions.map((s) => s.id));
      setSubmissions((prev) =>
        prev.map((sub) =>
          pendingIds.has(sub.id)
            ? {
                ...sub,
                status: "validated",
                admin_remarks: remarksToSend || sub.admin_remarks,
                review_decisions: remarksToSend
                  ? [
                      {
                        decision: "validated",
                        remarks: remarksToSend,
                        created_at: new Date().toISOString(),
                      },
                      ...(sub.review_decisions || []),
                    ]
                  : sub.review_decisions,
              }
            : sub,
        ),
      );
      setActionFeedback({
        type: "success",
        message: `Successfully validated ${pendingSubmissions.length} requirement(s)!`,
      });
      setTimeout(() => setActionFeedback(null), 4000);
      onStatusUpdated?.();
      setIsValidateModalOpen(false);
      setBulkValidateNotes("");
    } catch (err) {
      console.error("Bulk validate failed:", err);
      setActionFeedback({
        type: "error",
        message: "Failed to process bulk validation.",
      });
      setTimeout(() => setActionFeedback(null), 4000);
    } finally {
      setIsValidatingAll(false);
    }
  }

  const departmentLabel = useMemo(() => {
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

    const code = faculty.program?.code || "";
    let name = faculty.program?.name || "";
    const normCode = code.toUpperCase().trim();

    if (PROGRAM_EXPANSIONS[normCode]) {
      name = PROGRAM_EXPANSIONS[normCode];
    } else if (name.startsWith("BS ")) {
      name = name.replace(/^BS\s+/i, "Bachelor of Science in ");
    }

    if (code && name) {
      return `${code} — ${name}`;
    }
    return name || code || "Department";
  }, [faculty.program]);

  const facultyDisplayName = useMemo(() => {
    const rawName = faculty.fullName || "";
    let nameFormatted = rawName;
    if (faculty.lastName && faculty.firstName) {
      nameFormatted = `${faculty.lastName}, ${faculty.firstName}${faculty.middleName ? ` ${faculty.middleName}` : ""}`;
    } else {
      const tokens = rawName.trim().split(/\s+/);
      if (tokens.length > 1) {
        const last = tokens[tokens.length - 1];
        const rest = tokens.slice(0, -1).join(" ");
        nameFormatted = `${last}, ${rest}`;
      }
    }
    return nameFormatted.toUpperCase();
  }, [faculty]);

  return (
    <div className="space-y-4">
      {/* Solid Amber Card Header matching Documents to be Submitted - Swapped to the top */}
      <div className="relative overflow-hidden rounded-2xl border-2 border-amber-500 bg-amber-400 p-5 sm:p-6 shadow-md shadow-amber-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
              Assigned Classes &amp; Subject Loads
            </h1>
          </div>
          <p className="mt-1.5 text-sm sm:text-base text-amber-950/90 font-medium leading-relaxed">
            Select a class load below to review and verify submitted
            requirements.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={isRefreshing || isLoading}
            onClick={handleRefresh}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 px-3.5 py-2 text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer shadow-xs active:scale-[0.98] whitespace-nowrap"
            title="Refresh current submissions"
          >
            <SystemRestart
              className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`}
            />
            <span>{isRefreshing ? "Refreshing..." : "Refresh"}</span>
          </button>

          <button
            type="button"
            disabled={isDownloadingZip}
            onClick={handleDownloadZip}
            className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-600 px-3.5 py-2 text-xs font-semibold whitespace-nowrap shadow-2xs transition cursor-pointer disabled:opacity-50"
          >
            <AppIcon
              icon={Download}
              size="xs"
              color="inherit"
              className="text-slate-950"
            />
            <span>
              {isDownloadingZip ? "Zipping..." : "Download All (ZIP)"}
            </span>
          </button>
        </div>
      </div>

      <div className="w-full flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs transition-all animate-in fade-in duration-150 overflow-hidden">
        <AlertPopup
          type={actionFeedback?.type}
          message={actionFeedback?.message}
          onClose={() => setActionFeedback(null)}
        />
        {/* Inline Section Header - Only visible when in Class Selection Step */}
        {selectedClassId === null ? (
          <div className="border-b border-slate-200 dark:border-slate-800/80 p-5 sm:p-6 bg-slate-50/50 dark:bg-slate-950/30 rounded-t-2xl space-y-3">
            {/* Top row with Back button and PUP SIS style Faculty Name Header */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={handleClose}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
                  title="Return to Faculty List"
                >
                  <AppIcon icon={NavArrowLeft} size="sm" color="white" />
                  <span>Back to Faculty List</span>
                </button>
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-800 dark:text-slate-200 shadow-2xs">
                    {faculty.profileImageUrl ? (
                      <img
                        src={faculty.profileImageUrl}
                        alt={faculty.fullName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span>{buildFacultyInitials(faculty.fullName)}</span>
                    )}
                  </div>
                  <span className="text-xs sm:text-sm font-black text-[#780000] dark:text-rose-400 tracking-wide uppercase">
                    {facultyDisplayName}
                  </span>
                </div>
              </div>
            </div>

            {/* PUP SIS Style Academic Term & Info Card */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-2xs">
              <div className="bg-[#780000] text-white px-4 py-2 font-bold text-xs sm:text-sm tracking-wide">
                {academicYear
                  ? `School Year ${academicYear} ${semester}`
                  : "No Active Academic Term Configured"}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-3.5 gap-x-6 p-4 bg-white dark:bg-slate-900 text-xs">
                <div>
                  <span className="font-bold text-slate-900 dark:text-slate-100 block mb-0.5">
                    Faculty Department &amp; Program
                  </span>
                  <p className="font-medium text-slate-700 dark:text-slate-300">
                    {departmentLabel}
                  </p>
                </div>

                <div>
                  <span className="font-bold text-slate-900 dark:text-slate-100 block mb-0.5">
                    Assigned Class Loads
                  </span>
                  <p className="font-medium text-slate-700 dark:text-slate-300">
                    {classGroups.length} Registered Class Load
                    {classGroups.length === 1 ? "" : "s"}
                  </p>
                </div>

                <div>
                  <span className="font-bold text-slate-900 dark:text-slate-100 block mb-0.5">
                    Faculty Email
                  </span>
                  <p
                    className="font-medium text-slate-700 dark:text-slate-300 truncate"
                    title={faculty.email}
                  >
                    {faculty.email || "—"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Subject Search & Status Filter Controls */}
        {activeTab === "current" &&
          selectedClassId === null &&
          classGroups.length > 0 && (
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800/80 px-6 py-3 bg-white dark:bg-slate-900">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5 w-full lg:w-auto">
                {/* Search Input */}
                <input
                  type="text"
                  placeholder="Search subject or section..."
                  value={subjectSearchTerm}
                  onChange={(e) => setSubjectSearchTerm(e.target.value)}
                  className="w-full sm:w-60 rounded-xl border border-slate-400 dark:border-slate-800 bg-white dark:bg-slate-950 px-3.5 py-2 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                />

                {/* Custom Status Dropdown Filter */}
                <div className="relative w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() =>
                      setIsSubjectStatusDropdownOpen((prev) => !prev)
                    }
                    className="flex w-full sm:w-auto items-center justify-between gap-2.5 rounded-xl border border-slate-400 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs sm:text-sm text-slate-900 dark:text-slate-200 outline-none transition hover:border-slate-500 dark:hover:border-slate-700 focus:border-amber-500 cursor-pointer shadow-2xs"
                  >
                    <div className="flex items-center gap-1.5 text-left">
                      <span className="text-slate-500 dark:text-slate-400 font-medium">
                        Status:
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {currentSubjectStatusOption.label}
                      </span>
                      <span className="ml-1 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-slate-950 shadow-2xs">
                        ({subjectStatusCounts[subjectStatusFilter]})
                      </span>
                    </div>
                    <NavArrowDown
                      className={`h-4 w-4 text-slate-500 dark:text-slate-400 transition-transform ${
                        isSubjectStatusDropdownOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {isSubjectStatusDropdownOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-20"
                        onClick={() => setIsSubjectStatusDropdownOpen(false)}
                      />
                      <div className="absolute right-0 top-full mt-1.5 z-30 w-full sm:w-64 rounded-2xl border border-slate-400 dark:border-slate-800 bg-white dark:bg-slate-900 py-1 shadow-xl text-xs sm:text-sm text-slate-900 dark:text-slate-200 overflow-hidden">
                        {subjectStatusFilterOptions.map((opt) => {
                          const isSelected = subjectStatusFilter === opt.id;
                          const count = subjectStatusCounts[opt.id];
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => {
                                setSubjectStatusFilter(opt.id);
                                setIsSubjectStatusDropdownOpen(false);
                              }}
                              className={`w-full flex items-center justify-between gap-2.5 px-3.5 py-2 transition hover:bg-slate-100 dark:hover:bg-slate-800 text-left cursor-pointer ${
                                isSelected
                                  ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold"
                                  : "text-slate-700 dark:text-slate-300"
                              }`}
                            >
                              <span className="truncate">{opt.label}</span>
                              <span
                                className={`ml-2 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold shrink-0 shadow-2xs ${
                                  isSelected
                                    ? "bg-amber-500 text-slate-950"
                                    : count > 0
                                      ? "bg-slate-700 dark:bg-slate-600 text-white"
                                      : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                                }`}
                              >
                                ({count})
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

        {/* Body Content */}
        <div className="px-6 py-5">
          {activeTab === "current" ? (
            /* Tab 1: Current Submissions */
            isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 pt-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-64 rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 animate-pulse p-5"
                  />
                ))}
              </div>
            ) : selectedClassId === null || !selectedGroup ? (
              /* Step 1: Class Selection Step (Default) */
              <div className="space-y-4 pt-1">
                {/* Responsive Grid of Class Cards */}
                {classGroups.length === 0 ? (
                  <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs py-14 text-center text-slate-500 dark:text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                      <AppIcon icon={InfoCircle} size="lg" color="muted" />
                      <h5 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                        No Classes Registered
                      </h5>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {academicYear
                          ? `This faculty member does not have any classes or subject loads assigned for A.Y. ${academicYear} • ${semester}.`
                          : "This faculty member does not have any classes or subject loads assigned."}
                      </p>
                    </div>
                  </div>
                ) : filteredClassGroups.length === 0 ? (
                  <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs py-14 text-center text-slate-500 dark:text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                      <AppIcon icon={InfoCircle} size="lg" color="muted" />
                      <h5 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                        No Matching Subjects
                      </h5>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        No subject loads match the current search or status
                        filter.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 pt-1">
                    {filteredClassGroups.map((group) => {
                      const groupPendingCount = group.submissions.filter(
                        (s) => {
                          const st = (s.status || "").toLowerCase();
                          return (
                            doesSubmissionMatchTerm(
                              s,
                              academicYear,
                              semester,
                            ) &&
                            (st === "uploaded" ||
                              st === "pending" ||
                              st === "submitted" ||
                              st === "under_review" ||
                              st === "pending_review")
                          );
                        },
                      ).length;

                      const groupRevisionCount = group.submissions.filter(
                        (s) => {
                          const st = (s.status || "").toLowerCase();
                          return (
                            doesSubmissionMatchTerm(
                              s,
                              academicYear,
                              semester,
                            ) &&
                            (st === "rejected" || st === "needs_revision")
                          );
                        },
                      ).length;

                      const groupValidatedCount = group.submissions.filter(
                        (s) => {
                          const st = (s.status || "").toLowerCase();
                          return (
                            doesSubmissionMatchTerm(
                              s,
                              academicYear,
                              semester,
                            ) &&
                            (st === "validated" || st === "approved")
                          );
                        },
                      ).length;

                      const totalReqs = allRequirements.length;
                      const progressPct =
                        totalReqs > 0
                          ? Math.round((groupValidatedCount / totalReqs) * 100)
                          : 0;

                      return (
                        <div
                          key={group.key}
                          onClick={() => setSelectedClassId(group.key)}
                          className="group relative flex flex-col cursor-pointer text-left transition-all duration-200 hover:-translate-y-1"
                        >
                          {/* Folder Top Tab with Smooth Slanted Shoulder */}
                          <div className="flex items-end -mb-[2px] relative z-10 self-start">
                            {/* Tab Left + Content */}
                            <div className="h-7.5 px-3.5 rounded-tl-xl flex items-center gap-2 text-xs font-black tracking-wide border-t-2 border-l-2 border-amber-500 dark:border-amber-600 bg-amber-400 dark:bg-amber-500 text-slate-950 shadow-2xs group-hover:bg-amber-300 transition-colors duration-200">
                              <AppIcon
                                icon={Folder}
                                size="xs"
                                color="inherit"
                              />
                              <span className="truncate max-w-[150px]">
                                {group.isGeneral
                                  ? "General Requirements"
                                  : group.sectionCode}
                              </span>
                            </div>

                            {/* Tab Smooth Slant Shoulder */}
                            <div className="relative w-5 h-7.5 shrink-0 -ml-[1px]">
                              <svg
                                viewBox="0 0 20 30"
                                fill="none"
                                className="w-full h-full text-amber-400 dark:text-amber-500"
                              >
                                <path
                                  d="M 0,0 L 2,0 C 8,0 13,8 16,18 L 20,30 L 0,30 Z"
                                  fill="currentColor"
                                />
                                <path
                                  d="M 0,1 L 2,1 C 8,1 13,9 16,19 L 20,30"
                                  stroke="#f59e0b"
                                  strokeWidth="2"
                                  fill="none"
                                  className="text-amber-500 dark:text-amber-600"
                                />
                              </svg>
                            </div>
                          </div>

                          {/* Folder Main Body */}
                          <div className="relative flex-1 flex flex-col justify-between rounded-2xl rounded-tl-none border-2 border-amber-500 dark:border-amber-600 transition-all duration-200 overflow-hidden bg-white dark:bg-slate-900 shadow-xs group-hover:shadow-lg group-hover:border-amber-400">
                            <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                              <div className="space-y-3.5">
                                {/* Top Row: Units & Status Badges */}
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {group.units !== null ? (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                        {group.units.toFixed(1)} Units
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                        Institutional
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {groupPendingCount > 0 && (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 border border-amber-600 text-slate-950 px-2.5 py-0.5 text-[10.5px] font-bold shadow-2xs">
                                        <span className="h-1.5 w-1.5 rounded-full bg-[#780000] animate-pulse" />
                                        {groupPendingCount} Pending
                                      </span>
                                    )}
                                    {groupRevisionCount > 0 && (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-[#780000] border border-[#5e0000] text-white px-2.5 py-0.5 text-[10.5px] font-bold shadow-2xs">
                                        {groupRevisionCount} Revision
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Course Code & Subject Name Fields */}
                                <div className="space-y-2 pt-1">
                                  <div>
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-0.5">
                                      Course Code:
                                    </span>
                                    <h3 className="text-xl sm:text-2xl font-black text-slate-950 dark:text-slate-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                                      {group.isGeneral
                                        ? "General Requirements"
                                        : group.subjectCode}
                                    </h3>
                                  </div>

                                  <div>
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-0.5">
                                      Subject Name / Description:
                                    </span>
                                    <p className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-200 line-clamp-2 leading-snug">
                                      {group.description}
                                    </p>
                                  </div>
                                </div>

                                {/* Validation Progress Bar */}
                                <div className="pt-1">
                                  <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                                    <span>Validation Progress</span>
                                    <span className="font-bold text-slate-700 dark:text-slate-300">
                                      {progressPct}% ({groupValidatedCount}/
                                      {totalReqs} Validated)
                                    </span>
                                  </div>
                                  <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-300 rounded-full"
                                      style={{ width: `${progressPct}%` }}
                                    />
                                  </div>
                                </div>
                              </div>

                              {/* Bottom Action Footer */}
                              <div className="pt-2">
                                <div className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl bg-amber-400 group-hover:bg-amber-500 border border-amber-500 transition-all duration-200 shadow-2xs">
                                  <span className="text-xs font-extrabold text-amber-950 flex items-center gap-2">
                                    <AppIcon
                                      icon={Folder}
                                      size="xs"
                                      color="inherit"
                                    />
                                    <span>View & Verify Documents</span>
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
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              /* Step 2: Class Detail Step */
              <div className="space-y-4">
                {/* Class Header & Dropdown Switcher */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-1">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => {
                        hasHandledInitialTargetRef.current = true;
                        const targetEl = document.getElementById(
                          `req-row-${initialRequirementCode}`,
                        );
                        if (targetEl) {
                          targetEl.classList.remove(
                            "ring-2",
                            "ring-amber-400",
                            "bg-amber-500/15",
                            "dark:bg-amber-500/25",
                          );
                        }
                        setSelectedClassId(null);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
                      title="Return to Class List"
                    >
                      <AppIcon icon={NavArrowLeft} size="sm" color="white" />
                      <span>Back to Class List</span>
                    </button>

                    <div className="h-6 w-px bg-amber-400/60 dark:bg-amber-600/40 hidden sm:block shrink-0" />

                    {/* Faculty Profile & Active Class Header */}
                    <div className="min-w-0 flex-1 pl-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Faculty Name & Photo */}
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[10px] font-bold text-slate-800 dark:text-slate-200 shadow-2xs">
                            {faculty.profileImageUrl ? (
                              <img
                                src={faculty.profileImageUrl}
                                alt={faculty.fullName}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span>
                                {buildFacultyInitials(faculty.fullName)}
                              </span>
                            )}
                          </div>
                          <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            {faculty.fullName}
                          </span>
                        </div>

                        <span className="text-slate-400 dark:text-slate-600 font-bold hidden sm:inline">
                          &bull;
                        </span>

                        {selectedGroup.isGeneral ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold bg-slate-800 text-slate-100 tracking-wide shadow-2xs">
                            General
                          </span>
                        ) : (
                          <span className="font-mono text-xs font-black px-2.5 py-0.5 rounded-md bg-amber-400 text-slate-950 shrink-0">
                            {selectedGroup.sectionCode}
                          </span>
                        )}
                        {!selectedGroup.isGeneral && (
                          <span className="text-sm sm:text-base font-black text-slate-950 dark:text-amber-100">
                            {selectedGroup.subjectCode} &bull;{" "}
                            {selectedGroup.description}
                          </span>
                        )}
                        {selectedGroup.isGeneral && (
                          <span className="text-sm sm:text-base font-black text-slate-950 dark:text-amber-100">
                            {selectedGroup.description}
                          </span>
                        )}
                        {selectedGroup.units !== null ? (
                          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 shrink-0">
                            ({selectedGroup.units.toFixed(1)} Units)
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Quick Dropdown Select */}
                  {classGroups.length > 1 && (
                    <div className="flex items-center gap-2 shrink-0 sm:ml-auto">
                      <label
                        htmlFor="quick-class-switcher"
                        className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 shrink-0"
                      >
                        Switch Class:
                      </label>
                      <select
                        id="quick-class-switcher"
                        value={selectedGroup.key}
                        onChange={(e) => setSelectedClassId(e.target.value)}
                        className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-semibold outline-none transition focus:border-amber-500 cursor-pointer shadow-2xs"
                      >
                        {classGroups.map((g) => (
                          <option key={g.key} value={g.key}>
                            {g.isGeneral
                              ? "General Requirements"
                              : `${g.sectionCode} • ${g.subjectCode}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Scoped Filter Toolbar & Bulk Actions */}
                <div className="flex items-center justify-between gap-2.5 rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-950/40 p-2 sm:p-2.5 shadow-2xs overflow-x-auto">
                  {/* Filter Chips */}
                  <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setFilterMode("all")}
                      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition cursor-pointer shadow-2xs ${
                        filterMode === "all"
                          ? "bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-600/30 shadow-xs font-bold"
                          : "bg-white hover:bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700"
                      }`}
                    >
                      <AppIcon icon={Page} size="xs" color="inherit" />
                      <span>All Files</span>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10.5px] font-bold ${
                          filterMode === "all"
                            ? "bg-white text-slate-950 border border-amber-600/30 shadow-2xs"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                        }`}
                      >
                        {allRequirements.length}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFilterMode("pending")}
                      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition cursor-pointer shadow-2xs ${
                        filterMode === "pending"
                          ? "bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-600/30 shadow-xs font-bold"
                          : "bg-white hover:bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700"
                      }`}
                    >
                      <AppIcon icon={Hourglass} size="xs" color="inherit" />
                      <span>Need Review</span>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10.5px] font-bold ${
                          filterMode === "pending"
                            ? "bg-white text-slate-950 border border-amber-600/30 shadow-2xs"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                        }`}
                      >
                        {selectedGroupPendingCount}
                      </span>
                    </button>

                    {selectedGroupRevisionsUploadedCount > 0 ? (
                      <button
                        type="button"
                        onClick={() => setFilterMode("revision_uploaded")}
                        className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition cursor-pointer shadow-2xs ${
                          filterMode === "revision_uploaded"
                            ? "bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-600/30 shadow-xs font-bold"
                            : "bg-white hover:bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700"
                        }`}
                      >
                        <AppIcon
                          icon={WarningCircle}
                          size="xs"
                          color="inherit"
                        />
                        <span>Revisions Uploaded</span>
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[10.5px] font-bold ${
                            filterMode === "revision_uploaded"
                              ? "bg-white text-slate-950 border border-amber-600/30 shadow-2xs"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                          }`}
                        >
                          {selectedGroupRevisionsUploadedCount}
                        </span>
                      </button>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => setFilterMode("validated")}
                      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition cursor-pointer shadow-2xs ${
                        filterMode === "validated"
                          ? "bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-600/30 shadow-xs font-bold"
                          : "bg-white hover:bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700"
                      }`}
                    >
                      <AppIcon icon={Check} size="xs" color="inherit" />
                      <span>Validated</span>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10.5px] font-bold ${
                          filterMode === "validated"
                            ? "bg-white text-slate-950 border border-amber-600/30 shadow-2xs"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                        }`}
                      >
                        {selectedGroupValidatedCount}
                      </span>
                    </button>

                    {selectedGroupRevisionCount > 0 ? (
                      <button
                        type="button"
                        onClick={() => setFilterMode("revision")}
                        className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition cursor-pointer shadow-2xs ${
                          filterMode === "revision"
                            ? "bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-600/30 shadow-xs font-bold"
                            : "bg-white hover:bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700"
                        }`}
                      >
                        <AppIcon icon={Xmark} size="xs" color="inherit" />
                        <span>Needs Revision</span>
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[10.5px] font-bold ${
                            filterMode === "revision"
                              ? "bg-white text-slate-950 border border-amber-600/30 shadow-2xs"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                          }`}
                        >
                          {selectedGroupRevisionCount}
                        </span>
                      </button>
                    ) : null}
                  </div>

                  {/* Bulk Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={
                        isValidatingAll || selectedGroupPendingCount === 0
                      }
                      onClick={triggerValidateAllPendingModal}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#0b5336] hover:bg-[#073d2a] text-white border border-[#08412a] px-3 py-1.5 text-xs font-semibold whitespace-nowrap shadow-2xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-white/20 text-white border border-white/30 shrink-0 shadow-2xs [&>svg]:h-2.5 [&>svg]:w-2.5">
                        <AppIcon
                          icon={Check}
                          size="xs"
                          color="white"
                          strokeWidth={2.5}
                        />
                      </span>
                      <span>
                        {isValidatingAll
                          ? "Validating..."
                          : `Validate Class Pending (${selectedGroupPendingCount})`}
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={isDownloadingZip}
                      onClick={handleDownloadZip}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-600 px-3 py-1.5 text-xs font-semibold whitespace-nowrap shadow-2xs transition cursor-pointer disabled:opacity-50"
                    >
                      <AppIcon
                        icon={Download}
                        size="xs"
                        color="inherit"
                        className="text-slate-950"
                      />
                      <span>
                        {isDownloadingZip ? "Zipping..." : "Download ZIP"}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Class Specific Requirements Table or Empty State */}
                {selectedGroupRequirements.length === 0 ? (
                  <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs py-12 text-center text-slate-500 dark:text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AppIcon icon={CheckCircle} size="md" color="success" />
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {filterMode === "pending"
                          ? "All submitted files for this class have been reviewed and verified!"
                          : "No requirements match the selected filter."}
                      </p>
                      <button
                        type="button"
                        onClick={() => setFilterMode("all")}
                        className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                      >
                        View All Files
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
                    <div className="overflow-x-auto">
                      <table className="w-full table-fixed text-left text-xs text-slate-600 dark:text-slate-300 min-w-[880px]">
                        <thead className="bg-slate-50/60 dark:bg-slate-950/50 border-b border-slate-200/80 dark:border-slate-800/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          <tr>
                            <th className="px-4 py-3 w-[25%]">
                              Requirement
                            </th>
                            <th className="px-3 py-3 w-[10%] text-center">
                              Type
                            </th>
                            <th className="px-4 py-3 w-[25%]">
                              Attached File
                            </th>
                            <th className="px-4 py-3 w-[24%]">
                              Notes &amp; Feedback
                            </th>
                            <th className="px-4 py-3 w-[16%] text-center">
                              Status &amp; Action
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                          {selectedGroupRequirements.map((req) => {
                            const code = req.code;
                            const reqLabel = req.title;
                            const isMandatory = req.isMandatory;
                            const matchingSubmission =
                              selectedGroup.submissions.find((s) => {
                                const codeMatched =
                                  matchRequirementCode(
                                    s.requirement_code,
                                    (s as { requirement_id?: string })
                                      .requirement_id,
                                  ) === code || s.requirement_code === code;
                                return (
                                  codeMatched &&
                                  doesSubmissionMatchTerm(
                                    s,
                                    academicYear,
                                    semester,
                                  )
                                );
                              });

                            const documents =
                              matchingSubmission?.document_versions ?? [];
                            const firstDoc = documents[0] ?? null;

                            const rawStatus = matchingSubmission
                              ? (matchingSubmission.status || "").toLowerCase()
                              : "not_submitted";
                            const isValidated =
                              rawStatus === "validated" ||
                              rawStatus === "approved";
                            const isRevisionRequested =
                              rawStatus === "rejected" ||
                              rawStatus === "needs_revision";
                            const isPending =
                              rawStatus === "uploaded" ||
                              rawStatus === "pending" ||
                              rawStatus === "submitted" ||
                              rawStatus === "under_review" ||
                              rawStatus === "pending_review";
                            const hasPriorRejection = (
                              matchingSubmission?.review_decisions || []
                            ).some(
                              (d) =>
                                (d.decision || "").toLowerCase() === "rejected",
                            );
                            const isRevisionUploaded =
                              isPending &&
                              (hasPriorRejection || documents.length > 1);
                            const versionNum =
                              firstDoc?.version_number ??
                              (documents.length > 1
                                ? documents.length
                                : isRevisionUploaded
                                  ? 2
                                  : 1);

                            const hasFile =
                              documents.length > 0 &&
                              Boolean(firstDoc?.storage_path);
                            const fileDownloadUrl = hasFile
                              ? `/api/storage/download?path=${encodeURIComponent(
                                  firstDoc!.storage_path,
                                )}`
                              : null;
                            const rawFileName =
                              firstDoc?.storage_path?.split("/").pop() ||
                              `${reqLabel}.pdf`;
                            const fileName = cleanDisplayFileName(rawFileName);
                            const fileSize = formatBytes(firstDoc?.size_bytes);
                            const submittedDateText = matchingSubmission
                              ? formatFullDateTime(
                                  matchingSubmission.submitted_at ||
                                    matchingSubmission.created_at,
                                )
                              : null;

                            const adminNote =
                              matchingSubmission?.review_decisions?.[0]
                                ?.remarks || matchingSubmission?.admin_remarks;
                            const rawFacultyNote =
                              matchingSubmission?.notes ||
                              matchingSubmission?.remarks;
                            const facultyNote = rawFacultyNote || null;
                            const priorRejectionDecision = (
                              matchingSubmission?.review_decisions || []
                            ).find(
                              (d) =>
                                (d.decision || "").toLowerCase() === "rejected",
                            );
                            const priorRejectionNote =
                              priorRejectionDecision?.remarks ||
                              (isRevisionRequested ? adminNote : null);

                            return (
                              <tr
                                key={`${selectedGroup.key}-${code}`}
                                id={`req-row-${code}`}
                                className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                              >
                                {/* Column 1: Requirement */}
                                <td className="px-4 py-3.5 align-top">
                                  <div className="space-y-1 min-w-0">
                                    <span className="font-semibold text-slate-900 dark:text-slate-100 text-xs block leading-snug">
                                      {reqLabel}
                                    </span>
                                    {submittedDateText ? (
                                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                                        Submitted: {submittedDateText}
                                      </span>
                                    ) : (
                                      <span className="text-[11px] text-slate-400 dark:text-slate-500 italic block">
                                        Not submitted
                                      </span>
                                    )}
                                  </div>
                                </td>

                                {/* Column 2: Type (Centered) */}
                                <td className="px-3 py-3.5 align-top text-center">
                                  <div className="flex items-center justify-center pt-0.5">
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
                                <td className="px-4 py-3.5 align-top">
                                  {hasFile && fileDownloadUrl ? (
                                    <div className="space-y-1.5 min-w-0">
                                      <div className="min-w-0">
                                        <span
                                          className="font-medium text-slate-900 dark:text-slate-100 truncate block text-xs leading-snug"
                                          title={rawFileName}
                                        >
                                          {fileName}
                                        </span>
                                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                                          {fileSize ? (
                                            <span>{fileSize}</span>
                                          ) : null}
                                          {isRevisionUploaded ? (
                                            <span className="font-sans font-bold text-slate-600 dark:text-slate-400">
                                              • (Revised)
                                            </span>
                                          ) : null}
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-1.5 pt-0.5">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setPreviewSubmission({
                                              code: code,
                                              title: reqLabel,
                                              fileName: fileName,
                                              fileSize:
                                                firstDoc?.size_bytes || null,
                                              storagePath:
                                                firstDoc?.storage_path,
                                              fileUrl:
                                                fileDownloadUrl || undefined,
                                              submittedAt:
                                                matchingSubmission?.submitted_at ||
                                                matchingSubmission?.created_at ||
                                                undefined,
                                              note: facultyNote,
                                              notes: facultyNote,
                                              remarks: facultyNote,
                                              facultyNote: facultyNote,
                                              feedback: adminNote,
                                              admin_remarks: adminNote,
                                              adminRemarks: adminNote,
                                              reviewedAt:
                                                matchingSubmission
                                                  ?.review_decisions?.[0]
                                                  ?.created_at ||
                                                (matchingSubmission?.status ===
                                                "validated"
                                                  ? matchingSubmission?.created_at
                                                  : undefined),
                                              latestSubmissionId:
                                                matchingSubmission?.id,
                                              status: isRevisionRequested
                                                ? "Needs Revision"
                                                : isRevisionUploaded
                                                  ? "Revision Under Review"
                                                  : matchingSubmission?.status ||
                                                    "Pending",
                                              academicYear: academicYear,
                                              semester: semester,
                                              facultyName: faculty.fullName,
                                              isAdminView: true,
                                              hasPriorRevision: Boolean(
                                                priorRejectionDecision ||
                                                isRevisionRequested,
                                              ),
                                              isRevision: isRevisionUploaded,
                                            });
                                          }}
                                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-750 dark:text-slate-200 px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer shadow-2xs"
                                          title="Preview File"
                                        >
                                          <AppIcon
                                            icon={Eye}
                                            size="sm"
                                            color="inherit"
                                          />
                                          <span>Preview</span>
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleSingleFileDownload(
                                              firstDoc?.storage_path,
                                              fileName,
                                            )
                                          }
                                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-slate-300 px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer shadow-2xs"
                                          title="Download File"
                                        >
                                          <AppIcon
                                            icon={Download}
                                            size="sm"
                                            color="inherit"
                                          />
                                          <span>Download</span>
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="pt-0.5">
                                      <span className="text-xs text-slate-400 dark:text-slate-500 italic block">
                                        No file attached
                                      </span>
                                    </div>
                                  )}
                                </td>

                                {/* Column 4: Notes & Feedback */}
                                <td className="px-4 py-3.5 align-top">
                                  {facultyNote ||
                                  isRevisionRequested ||
                                  (isValidated && adminNote) ||
                                  (isRevisionUploaded && priorRejectionNote) ? (
                                    <div className="flex flex-col gap-1.5 min-w-0">
                                      {facultyNote ? (
                                        <div
                                          className="rounded-lg border border-slate-200/90 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 px-2.5 py-1.5 text-xs shadow-2xs min-w-0"
                                          title={facultyNote}
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
                                              {isRevisionUploaded
                                                ? "Faculty Revision Note"
                                                : "Faculty Remarks"}
                                            </span>
                                          </div>
                                          <p className="text-[11px] text-slate-800 dark:text-slate-200 font-medium leading-relaxed line-clamp-2 pl-5 break-words">
                                            &ldquo;{facultyNote}&rdquo;
                                          </p>
                                        </div>
                                      ) : null}

                                      {isRevisionUploaded &&
                                      priorRejectionNote ? (
                                        <div
                                          className="rounded-lg border border-slate-200/90 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 px-2.5 py-1.5 text-xs shadow-2xs min-w-0"
                                          title={priorRejectionNote}
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
                                              Prior Revision
                                            </span>
                                          </div>
                                          <p className="text-[11px] text-slate-800 dark:text-slate-200 font-medium leading-relaxed line-clamp-2 pl-5 break-words">
                                            &ldquo;{priorRejectionNote}&rdquo;
                                          </p>
                                        </div>
                                      ) : isRevisionRequested ? (
                                        <div
                                          className="rounded-lg border border-slate-200/90 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 px-2.5 py-1.5 text-xs shadow-2xs min-w-0"
                                          title={
                                            adminNote ||
                                            "Please review and re-upload the corrected requirement document."
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
                                            {adminNote ||
                                              "Please review and re-upload the corrected requirement document."}
                                            &rdquo;
                                          </p>
                                        </div>
                                      ) : isValidated && adminNote ? (
                                        <div
                                          className="rounded-lg border border-slate-200/90 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 px-2.5 py-1.5 text-xs shadow-2xs min-w-0"
                                          title={adminNote}
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
                                            &ldquo;{adminNote}&rdquo;
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

                                {/* Column 5: Status / Action */}
                                <td className="px-4 py-3.5 align-top text-center">
                                  <div className="flex items-center justify-center pt-0.5">
                                    {isValidated ? (
                                      <SubmissionStatusBadge
                                        status="Validated"
                                        size="md"
                                      />
                                    ) : isRevisionRequested ? (
                                      <SubmissionStatusBadge
                                        status="Needs Revision"
                                        size="md"
                                      />
                                    ) : matchingSubmission ? (
                                      <div className="flex items-center justify-center gap-2 whitespace-nowrap">
                                        <button
                                          type="button"
                                          disabled={
                                            submittingAction !== null ||
                                            reviewingCode !== null ||
                                            isValidatingSingle ||
                                            isSubmittingRevision
                                          }
                                          onClick={() =>
                                            openValidateModal(
                                              matchingSubmission.id,
                                              code,
                                              reqLabel,
                                            )
                                          }
                                          title="Validate Requirement"
                                          aria-label="Validate Requirement"
                                          className="inline-flex items-center justify-center h-8 w-8 rounded-full border border-[#08412a] bg-[#0b5336] hover:bg-[#073d2a] text-white shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
                                        >
                                          <AppIcon
                                            icon={Check}
                                            size="sm"
                                            color="white"
                                            strokeWidth={2.5}
                                          />
                                        </button>
                                        <button
                                          type="button"
                                          disabled={
                                            submittingAction !== null ||
                                            reviewingCode !== null ||
                                            isValidatingSingle ||
                                            isSubmittingRevision
                                          }
                                          onClick={() =>
                                            openRevisionModal(
                                              matchingSubmission.id,
                                              code,
                                              reqLabel,
                                            )
                                          }
                                          title="Request Revision"
                                          aria-label="Request Revision"
                                          className="inline-flex items-center justify-center h-8 w-8 rounded-full border border-[#5e0000] bg-[#780000] hover:bg-[#5e0000] text-white shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
                                        >
                                          <AppIcon
                                            icon={Xmark}
                                            size="sm"
                                            color="white"
                                            strokeWidth={2.5}
                                          />
                                        </button>
                                      </div>
                                    ) : (
                                      <SubmissionStatusBadge
                                        status="Not Submitted"
                                        label="Awaiting Submission"
                                        size="md"
                                      />
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )
          ) : (
            /* Tab 2: Verification History */
            <div className="space-y-4">
              {/* Term Dropdown Selector & Download Action */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-950/40 p-3.5 shadow-2xs">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    Past Academic Term:
                  </span>
                  <select
                    value={selectedHistoryAy}
                    onChange={(e) => {
                      const newAy = e.target.value;
                      setSelectedHistoryAy(newAy);
                      setSelectedHistoryClassId(null);
                      const key = `${newAy}::${selectedHistorySem}`;
                      if (historyCacheRef.current[key]) {
                        setHistorySubmissions(
                          historyCacheRef.current[key].submissions,
                        );
                        setHistoryClasses(historyCacheRef.current[key].classes);
                        setIsLoadingHistory(false);
                      }
                    }}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 outline-none transition focus:border-amber-500"
                  >
                    {historyAcademicYears.map((year) => (
                      <option key={year} value={year}>
                        A.Y. {year}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selectedHistorySem}
                    onChange={(e) => {
                      const newSem = e.target.value as SemesterOption;
                      setSelectedHistorySem(newSem);
                      setSelectedHistoryClassId(null);
                      const key = `${selectedHistoryAy}::${newSem}`;
                      if (historyCacheRef.current[key]) {
                        setHistorySubmissions(
                          historyCacheRef.current[key].submissions,
                        );
                        setHistoryClasses(historyCacheRef.current[key].classes);
                        setIsLoadingHistory(false);
                      }
                    }}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 outline-none transition focus:border-amber-500"
                  >
                    <option value="1st Semester">1st Semester</option>
                    <option value="2nd Semester">2nd Semester</option>
                    <option value="Summer Semester">Summer Semester</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isDownloadingHistoryZip}
                    onClick={handleDownloadHistoryZip}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#780000] hover:bg-[#5e0000] active:scale-[0.98] text-white border border-[#5e0000] text-xs font-bold px-3.5 py-1.5 shadow-xs hover:shadow transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                  >
                    {isDownloadingHistoryZip ? (
                      <>
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white shrink-0" />
                        <span>Zipping...</span>
                      </>
                    ) : (
                      <>
                        <AppIcon icon={Download} size="sm" color="inherit" />
                        <span>Download History ZIP</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Past Submissions Per Card Subjects or Detail View */}
              {(isLoadingHistory &&
                historySubmissions.length === 0 &&
                historyClasses.length === 0) ||
              !selectedHistoryAy ? (
                <div className="space-y-3 pt-2">
                  <div className="overflow-hidden rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 animate-pulse space-y-4">
                    <div className="h-5 bg-slate-200 dark:bg-slate-800 rounded w-1/4" />
                    <div className="space-y-3">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div
                          key={i}
                          className="h-10 bg-slate-100 dark:bg-slate-800/60 rounded"
                        />
                      ))}
                    </div>
                  </div>
                </div>
              ) : selectedHistoryClassId === null || !selectedHistoryGroup ? (
                /* History Step 1: Subject Cards Grid */
                <div className="space-y-5 pt-1">
                  {historyClassGroups.length === 0 ? (
                    <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs py-14 text-center text-slate-500 dark:text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                        <AppIcon icon={InfoCircle} size="lg" color="muted" />
                        <h5 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                          No Past Class Loads Found
                        </h5>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          No subject loads or submissions were recorded for A.Y.{" "}
                          {selectedHistoryAy} &bull; {selectedHistorySem}.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 pt-2">
                      {historyClassGroups.map((group) => {
                        const groupValidatedCount = group.submissions.filter(
                          (s) => {
                            const st = (s.status || "").toLowerCase();
                            return st === "validated" || st === "approved";
                          },
                        ).length;

                        const totalReqs = allRequirements.length;
                        const progressPct =
                          totalReqs > 0
                            ? Math.round(
                                (groupValidatedCount / totalReqs) * 100,
                              )
                            : 0;

                        return (
                          <div
                            key={group.key}
                            onClick={() => setSelectedHistoryClassId(group.key)}
                            className="group relative flex flex-col cursor-pointer text-left transition-all duration-200 hover:-translate-y-1"
                          >
                            {/* Folder Top Tab with Smooth Slanted Shoulder */}
                            <div className="flex items-end -mb-[2px] relative z-10 self-start">
                              <div className="h-7.5 px-3.5 rounded-tl-xl flex items-center gap-2 text-xs font-black tracking-wide border-t-2 border-l-2 border-amber-500 dark:border-amber-600 bg-amber-400 dark:bg-amber-500 text-slate-950 shadow-2xs group-hover:bg-amber-300 transition-colors duration-200">
                                <AppIcon
                                  icon={Folder}
                                  size="xs"
                                  color="inherit"
                                />
                                <span className="truncate max-w-[150px]">
                                  {group.isGeneral
                                    ? "General Requirements"
                                    : group.sectionCode}
                                </span>
                              </div>

                              <div className="relative w-5 h-7.5 shrink-0 -ml-[1px]">
                                <svg
                                  viewBox="0 0 20 30"
                                  fill="none"
                                  className="w-full h-full text-amber-400 dark:text-amber-500"
                                >
                                  <path
                                    d="M 0,0 L 2,0 C 8,0 13,8 16,18 L 20,30 L 0,30 Z"
                                    fill="currentColor"
                                  />
                                  <path
                                    d="M 0,1 L 2,1 C 8,1 13,9 16,19 L 20,30"
                                    stroke="#f59e0b"
                                    strokeWidth="2"
                                    fill="none"
                                    className="text-amber-500 dark:text-amber-600"
                                  />
                                </svg>
                              </div>
                            </div>

                            {/* Folder Main Body */}
                            <div className="relative flex-1 flex flex-col justify-between rounded-2xl rounded-tl-none border-2 border-amber-500 dark:border-amber-600 transition-all duration-200 overflow-hidden bg-white dark:bg-slate-900 shadow-xs group-hover:shadow-lg group-hover:border-amber-400">
                              <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                                <div className="space-y-3.5">
                                  {/* Top Row: Units & Validated Count Badge */}
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      {group.units !== null ? (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                          {group.units.toFixed(1)} Units
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                          Institutional
                                        </span>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <span className="inline-flex items-center gap-1 rounded-full bg-[#0b5336] border border-[#08412a] text-white px-2.5 py-0.5 text-[10.5px] font-bold shadow-2xs">
                                        <AppIcon
                                          icon={Check}
                                          size="xs"
                                          color="white"
                                        />
                                        {groupValidatedCount} Validated
                                      </span>
                                    </div>
                                  </div>

                                  {/* Course Code & Subject Name Fields */}
                                  <div className="space-y-2 pt-1">
                                    <div>
                                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-0.5">
                                        Course Code:
                                      </span>
                                      <h3 className="text-xl sm:text-2xl font-black text-slate-950 dark:text-slate-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                                        {group.isGeneral
                                          ? "General Requirements"
                                          : group.subjectCode}
                                      </h3>
                                    </div>

                                    <div>
                                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-0.5">
                                        Subject Name / Description:
                                      </span>
                                      <p className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-200 line-clamp-2 leading-snug">
                                        {group.description}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Validation Progress Bar */}
                                  <div className="pt-1">
                                    <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                                      <span>Validation Progress</span>
                                      <span className="font-bold text-slate-700 dark:text-slate-300">
                                        {progressPct}% ({groupValidatedCount}/
                                        {totalReqs} Validated)
                                      </span>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-300 rounded-full"
                                        style={{ width: `${progressPct}%` }}
                                      />
                                    </div>
                                  </div>
                                </div>

                                {/* Bottom Action Footer */}
                                <div className="pt-2">
                                  <div className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl bg-amber-400 group-hover:bg-amber-500 border border-amber-500 transition-all duration-200 shadow-2xs">
                                    <span className="text-xs font-extrabold text-amber-950 flex items-center gap-2">
                                      <AppIcon
                                        icon={Folder}
                                        size="xs"
                                        color="inherit"
                                      />
                                      <span>View Verified Documents</span>
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
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                /* History Step 2: Subject Historical Requirements View */
                <div className="space-y-4">
                  {/* Class Header & Switcher */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-1">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => setSelectedHistoryClassId(null)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
                        title="Return to Class List"
                      >
                        <AppIcon icon={NavArrowLeft} size="sm" color="white" />
                        <span>Back to Class List</span>
                      </button>

                      <div className="h-6 w-px bg-amber-400/60 dark:bg-amber-600/40 hidden sm:block shrink-0" />

                      <div className="min-w-0 flex-1 pl-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-black px-2.5 py-0.5 rounded-md bg-amber-400 text-amber-950 shrink-0">
                            {selectedHistoryGroup.isGeneral
                              ? "GENERAL"
                              : selectedHistoryGroup.sectionCode}
                          </span>
                          <span className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100 break-words">
                            {selectedHistoryGroup.subjectCode} &bull;{" "}
                            {selectedHistoryGroup.description}
                          </span>
                          {selectedHistoryGroup.units !== null && (
                            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 shrink-0">
                              ({selectedHistoryGroup.units} Units)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Quick History Switcher Dropdown */}
                    <div className="flex items-center gap-2 shrink-0">
                      <select
                        value={selectedHistoryClassId}
                        onChange={(e) =>
                          setSelectedHistoryClassId(e.target.value)
                        }
                        className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-amber-500 cursor-pointer shadow-2xs"
                      >
                        {historyClassGroups.map((g) => (
                          <option key={g.key} value={g.key}>
                            {g.sectionCode} - {g.subjectCode}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Historical Requirements Table for Selected Class */}
                  <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
                    <div className="overflow-x-auto">
                      <table className="w-full table-fixed text-left text-xs text-slate-600 dark:text-slate-300 min-w-[880px]">
                        <thead className="bg-slate-50 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          <tr>
                            <th className="px-4 py-3 w-[26%]">Requirement</th>
                            <th className="px-3 py-3 w-[10%] text-center">
                              Type
                            </th>
                            <th className="px-4 py-3 w-[24%]">File Versions</th>
                            <th className="px-4 py-3 w-[24%]">
                              Notes &amp; Remarks
                            </th>
                            <th className="px-4 py-3 w-[10%] text-center">
                              Status
                            </th>
                            <th className="px-4 py-3 w-[6%] text-center">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                          {allRequirements.map((req) => {
                            const code = req.code;
                            const reqLabel = req.title;
                            const isMandatory = req.isMandatory;
                            const matchingSub =
                              selectedHistoryGroup.submissions.find(
                                (s) => s.requirement_code === code,
                              );
                            const docs = matchingSub?.document_versions ?? [];
                            const latestReview =
                              matchingSub?.review_decisions?.[0] ?? null;
                            const isSubmitted = Boolean(
                              matchingSub && docs.length > 0,
                            );
                            const historyStatus = isSubmitted
                              ? matchingSub?.status || "Pending"
                              : "Not Submitted";
                            const submittedDateText = isSubmitted
                              ? formatFullDateTime(
                                  matchingSub?.submitted_at ||
                                    matchingSub?.created_at,
                                )
                              : null;
                            const adminNote =
                              latestReview?.remarks ||
                              matchingSub?.admin_remarks;
                            const facultyNote =
                              matchingSub?.remarks &&
                              matchingSub.remarks !== adminNote
                                ? matchingSub.remarks
                                : null;

                            return (
                              <tr
                                key={code}
                                className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                              >
                                {/* Requirement */}
                                <td className="px-4 py-3.5 align-top">
                                  <div className="space-y-1 min-w-0">
                                    <span className="font-semibold text-slate-900 dark:text-slate-100 text-xs block leading-snug">
                                      {reqLabel}
                                    </span>
                                    {submittedDateText ? (
                                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                                        Submitted: {submittedDateText}
                                      </span>
                                    ) : (
                                      <span className="text-[11px] text-slate-400 dark:text-slate-500 italic block">
                                        Not submitted
                                      </span>
                                    )}
                                  </div>
                                </td>

                                {/* Type */}
                                <td className="px-3 py-3.5 align-top text-center">
                                  <div className="flex items-center justify-center pt-0.5">
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

                                {/* File Versions */}
                                <td className="px-4 py-3.5 align-top">
                                  {docs.length > 0 ? (
                                    <div className="space-y-1.5 min-w-0">
                                      {docs.map((doc, idx) => {
                                        const rawName =
                                          doc.storage_path?.split("/").pop() ||
                                          "Document";
                                        const fileName =
                                          cleanDisplayFileName(rawName);
                                        const fileSize = formatBytes(
                                          doc.size_bytes,
                                        );
                                        const downloadUrl = `/api/storage/download?path=${encodeURIComponent(
                                          doc.storage_path,
                                        )}`;

                                        return (
                                          <div
                                            key={doc.id || idx}
                                            className="flex items-center justify-between gap-2 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 px-2.5 py-1 text-xs"
                                          >
                                            <div className="flex items-center gap-1.5 min-w-0">
                                              <span
                                                className="truncate font-medium text-slate-800 dark:text-slate-200 text-xs max-w-[150px] xl:max-w-[200px]"
                                                title={rawName}
                                              >
                                                {fileName}
                                              </span>
                                              {fileSize ? (
                                                <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                                                  ({fileSize})
                                                </span>
                                              ) : null}
                                            </div>

                                            <div className="flex items-center gap-1 shrink-0">
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const vAdminNote =
                                                    matchingSub
                                                      ?.review_decisions?.[0]
                                                      ?.remarks ||
                                                    matchingSub?.admin_remarks;
                                                  const vFacultyNote =
                                                    matchingSub?.notes ||
                                                    matchingSub?.remarks ||
                                                    null;
                                                  const versionSuffix =
                                                    doc.version_number
                                                      ? ` (v${doc.version_number})`
                                                      : idx > 0
                                                        ? ` (Revision ${docs.length - idx})`
                                                        : "";
                                                  setPreviewSubmission({
                                                    code: code,
                                                    title: `${reqLabel}${versionSuffix}`,
                                                    fileName: fileName,
                                                    fileSize:
                                                      doc.size_bytes || null,
                                                    storagePath:
                                                      doc.storage_path,
                                                    fileUrl: downloadUrl,
                                                    submittedAt:
                                                      doc.created_at ||
                                                      matchingSub?.submitted_at ||
                                                      matchingSub?.created_at ||
                                                      undefined,
                                                    note: vFacultyNote,
                                                    notes: vFacultyNote,
                                                    remarks: vFacultyNote,
                                                    facultyNote: vFacultyNote,
                                                    feedback: vAdminNote,
                                                    admin_remarks: vAdminNote,
                                                    adminRemarks: vAdminNote,
                                                    reviewedAt:
                                                      matchingSub
                                                        ?.review_decisions?.[0]
                                                        ?.created_at,
                                                    latestSubmissionId:
                                                      matchingSub?.id,
                                                    status:
                                                      matchingSub?.status ||
                                                      "Pending",
                                                    academicYear:
                                                      selectedHistoryAy,
                                                    semester:
                                                      selectedHistorySem,
                                                    facultyName:
                                                      faculty.fullName,
                                                    isAdminView: true,
                                                    hasPriorRevision: Boolean(
                                                      idx > 0,
                                                    ),
                                                    isRevision: Boolean(
                                                      idx > 0,
                                                    ),
                                                  });
                                                }}
                                                className="p-1 rounded text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition cursor-pointer"
                                                title="Preview"
                                              >
                                                <AppIcon
                                                  icon={Eye}
                                                  size="sm"
                                                  color="inherit"
                                                />
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  handleSingleFileDownload(
                                                    doc.storage_path,
                                                    fileName,
                                                  )
                                                }
                                                className="p-1 rounded text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition cursor-pointer"
                                                title="Download"
                                              >
                                                <AppIcon
                                                  icon={Download}
                                                  size="sm"
                                                  color="inherit"
                                                />
                                              </button>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <span className="text-xs text-slate-400 dark:text-slate-500 italic block pt-0.5">
                                      No documents
                                    </span>
                                  )}
                                </td>

                                {/* Notes */}
                                <td className="px-3.5 py-3.5 align-top">
                                  {facultyNote || adminNote ? (
                                    <div className="flex flex-col gap-1.5 max-w-[340px]">
                                      {facultyNote ? (
                                        <div
                                          className="rounded-lg border border-slate-200/90 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 px-2.5 py-1.5 text-xs shadow-2xs"
                                          title={facultyNote}
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
                                          <p className="text-[11px] text-slate-800 dark:text-slate-200 font-medium leading-relaxed line-clamp-2 pl-5">
                                            &ldquo;{facultyNote}&rdquo;
                                          </p>
                                        </div>
                                      ) : null}
                                      {adminNote ? (
                                        <div
                                          className="rounded-lg border border-slate-200/90 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 px-2.5 py-1.5 text-xs shadow-2xs"
                                          title={adminNote}
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
                                          <p className="text-[11px] text-slate-800 dark:text-slate-200 font-medium leading-relaxed line-clamp-2 pl-5">
                                            &ldquo;{adminNote}&rdquo;
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

                                {/* Status */}
                                <td className="px-4 py-3.5 align-top text-center whitespace-nowrap">
                                  <div className="flex items-center justify-center pt-0.5">
                                    <SubmissionStatusBadge
                                      status={historyStatus}
                                      label={
                                        isSubmitted
                                          ? undefined
                                          : "Not Submitted"
                                      }
                                      size="md"
                                    />
                                  </div>
                                </td>

                                {/* Action */}
                                <td className="px-4 py-3.5 align-top text-center">
                                  {docs.length > 0 && docs[0]?.storage_path ? (
                                    <div className="flex items-center justify-center pt-0.5">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const first = docs[0];
                                          const raw =
                                            first.storage_path
                                              .split("/")
                                              .pop() || `${reqLabel}.pdf`;
                                          const clean =
                                            cleanDisplayFileName(raw);
                                          setPreviewSubmission({
                                            code: code,
                                            title: reqLabel,
                                            fileName: clean,
                                            fileSize: first.size_bytes || null,
                                            storagePath: first.storage_path,
                                            fileUrl: `/api/storage/download?path=${encodeURIComponent(
                                              first.storage_path,
                                            )}`,
                                            submittedAt:
                                              matchingSub?.submitted_at ||
                                              matchingSub?.created_at ||
                                              undefined,
                                            note: facultyNote,
                                            notes: facultyNote,
                                            remarks: facultyNote,
                                            facultyNote: facultyNote,
                                            feedback: adminNote,
                                            admin_remarks: adminNote,
                                            adminRemarks: adminNote,
                                            reviewedAt:
                                              matchingSub?.review_decisions?.[0]
                                                ?.created_at ||
                                              matchingSub?.created_at ||
                                              undefined,
                                            latestSubmissionId: matchingSub?.id,
                                            status:
                                              matchingSub?.status ||
                                              "Validated",
                                            academicYear: selectedHistoryAy,
                                            semester: selectedHistorySem,
                                            facultyName: faculty.fullName,
                                            isAdminView: true,
                                          });
                                        }}
                                        className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 px-2.5 py-1 text-xs font-semibold transition cursor-pointer shadow-2xs"
                                      >
                                        <AppIcon
                                          icon={Eye}
                                          size="sm"
                                          color="inherit"
                                        />
                                        <span>Preview</span>
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-slate-400 dark:text-slate-500 italic block pt-0.5">
                                      &mdash;
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Interactive Request Revision Dialog Modal */}
      {revisionModalData ? (
        <div
          className="fixed inset-0 z-70 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
          onClick={() => setRevisionModalData(null)}
        >
          <div
            className="w-full max-w-lg rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <ModalHeader
              title="Request Requirement Revision"
              subtitle={`${revisionModalData.reqLabel} • ${faculty.fullName}`}
              className="-mx-6 -mt-6 mb-4 rounded-t-3xl"
            />

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">
                  Quick Preset Reasons:
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsPresetDropdownOpen((prev) => !prev)}
                    className="w-full flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 px-3 py-2 text-xs text-slate-700 dark:text-slate-300 outline-none hover:border-slate-300 dark:hover:border-slate-700 transition cursor-pointer shadow-2xs"
                  >
                    <span className="truncate">
                      Select a preset reason to add to notes...
                    </span>
                    <AppIcon
                      icon={NavArrowDown}
                      size="sm"
                      color="inherit"
                      className={`transition-transform duration-200 shrink-0 ${isPresetDropdownOpen ? "rotate-180" : ""}`}
                    />
                  </button>

                  {isPresetDropdownOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setIsPresetDropdownOpen(false)}
                      />
                      <div className="absolute left-0 right-0 top-full mt-1.5 z-20 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl overflow-hidden py-1 max-h-56 overflow-y-auto">
                        {REVISION_PRESETS.map((preset) => {
                          const isAlreadyAdded =
                            revisionInputText.includes(preset);
                          return (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => {
                                setRevisionInputText((prev) => {
                                  if (prev.includes(preset)) return prev;
                                  const trimmed = prev.trim();
                                  return trimmed
                                    ? `${trimmed}\n• ${preset}`
                                    : `• ${preset}`;
                                });
                                setIsPresetDropdownOpen(false);
                              }}
                              className={`w-full text-left px-3 py-2 text-xs transition flex items-center justify-between cursor-pointer ${
                                isAlreadyAdded
                                  ? "bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 font-medium"
                                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                              }`}
                            >
                              <span className="truncate">{preset}</span>
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono shrink-0 ml-2">
                                {isAlreadyAdded ? "added" : "+ add"}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">
                  Specific Instructions / Notes for Faculty (Optional):
                </label>
                <textarea
                  rows={4}
                  value={revisionInputText}
                  onChange={(e) => setRevisionInputText(e.target.value)}
                  placeholder="Explain what the faculty member needs to correct or provide before this can be approved (optional)..."
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-3 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 transition resize-none"
                />
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  The faculty member will receive an immediate notification with
                  these revision notes.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 border-t border-slate-200 dark:border-slate-800 pt-4">
              <button
                type="button"
                disabled={isSubmittingRevision}
                onClick={() => setRevisionModalData(null)}
                className="rounded-xl bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] px-4 py-2 text-xs font-semibold transition cursor-pointer shadow-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingRevision}
                onClick={handleSendRevisionRequest}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] px-4 py-2 text-xs font-semibold transition shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isSubmittingRevision ? (
                  <>
                    <AppIcon
                      icon={SystemRestart}
                      size="sm"
                      color="inherit"
                      className="animate-spin"
                    />
                    Submitting...
                  </>
                ) : (
                  <>
                    <AppIcon icon={SendMail} size="sm" color="white" />
                    <span>Send Revision Request</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Interactive Validate Requirement Dialog Modal */}
      {validateModalData ? (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
          onClick={() => setValidateModalData(null)}
        >
          <div
            className="w-full max-w-lg rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <ModalHeader
              icon={CheckCircle}
              title="Validate Requirement"
              subtitle={`${validateModalData.reqLabel} • ${faculty.fullName}`}
              className="-mx-6 -mt-6 mb-4 rounded-t-3xl"
            />

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">
                  Quick Preset Remarks:
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() =>
                      setIsValidatePresetDropdownOpen((prev) => !prev)
                    }
                    className="w-full flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 px-3 py-2 text-xs text-slate-700 dark:text-slate-300 outline-none hover:border-slate-300 dark:hover:border-slate-700 transition cursor-pointer shadow-2xs"
                  >
                    <span className="truncate">
                      Select a preset remark to add...
                    </span>
                    <AppIcon
                      icon={NavArrowDown}
                      size="sm"
                      color="inherit"
                      className={`transition-transform duration-200 shrink-0 ${isValidatePresetDropdownOpen ? "rotate-180" : ""}`}
                    />
                  </button>

                  {isValidatePresetDropdownOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setIsValidatePresetDropdownOpen(false)}
                      />
                      <div className="absolute left-0 right-0 top-full mt-1.5 z-20 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl overflow-hidden py-1 max-h-56 overflow-y-auto">
                        {VALIDATION_PRESETS.map((preset) => {
                          const isAlreadyAdded =
                            validateInputText.includes(preset);
                          return (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => {
                                setValidateInputText((prev) => {
                                  if (prev.includes(preset)) return prev;
                                  const trimmed = prev.trim();
                                  return trimmed
                                    ? `${trimmed}\n• ${preset}`
                                    : `• ${preset}`;
                                });
                                setIsValidatePresetDropdownOpen(false);
                              }}
                              className={`w-full text-left px-3 py-2 text-xs transition flex items-center justify-between cursor-pointer ${
                                isAlreadyAdded
                                  ? "bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 font-medium"
                                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                              }`}
                            >
                              <span className="truncate">{preset}</span>
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono shrink-0 ml-2">
                                {isAlreadyAdded ? "added" : "+ add"}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">
                  Remarks or Feedback for Faculty (Optional):
                </label>
                <textarea
                  rows={4}
                  value={validateInputText}
                  onChange={(e) => setValidateInputText(e.target.value)}
                  placeholder="Add remarks or feedback for faculty (optional)..."
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-3 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition resize-none"
                />
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  This note will be saved in the verification history and
                  visible to the faculty member.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 border-t border-slate-200 dark:border-slate-800 pt-4">
              <button
                type="button"
                disabled={isValidatingSingle}
                onClick={() => setValidateModalData(null)}
                className="rounded-xl bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] px-4 py-2 text-xs font-semibold transition cursor-pointer shadow-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isValidatingSingle}
                onClick={handleSendValidateRequest}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#0b5336] hover:bg-[#073d2a] text-white border border-[#08412a] px-4 py-2 text-xs font-semibold transition shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isValidatingSingle ? (
                  <>
                    <AppIcon
                      icon={SystemRestart}
                      size="sm"
                      color="inherit"
                      className="animate-spin"
                    />
                    Validating...
                  </>
                ) : (
                  <>
                    <AppIcon
                      icon={Check}
                      size="sm"
                      color="white"
                      strokeWidth={2.5}
                    />
                    <span>Confirm &amp; Validate</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Document Preview Modal (Matches Faculty Account design) */}
      <DocumentPreviewModal
        submission={previewSubmission}
        isOpen={Boolean(previewSubmission)}
        onClose={() => setPreviewSubmission(null)}
        isAdminView={true}
        onDownload={(sub) => {
          handleSingleFileDownload(
            sub.storagePath || null,
            sub.fileName || sub.title || "Document",
          );
        }}
      />

      {/* Notice Pop-up Modal */}
      {noticeModalData ? (
        <div
          className="fixed inset-0 z-70 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
          onClick={() => setNoticeModalData(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <ModalHeader
              icon={InfoCircle}
              title={noticeModalData.title}
              className="-mx-6 -mt-6 mb-4 rounded-t-3xl"
            />

            <div className="mb-5">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {noticeModalData.message}
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setNoticeModalData(null)}
                className="rounded-xl bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] px-4 py-2 text-xs font-semibold transition cursor-pointer shadow-xs"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Validate All Pending Confirmation Pop-up Modal */}
      {isValidateModalOpen ? (
        <div
          className="fixed inset-0 z-70 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
          onClick={() => {
            if (!isValidatingAll) {
              setIsValidateModalOpen(false);
              setBulkValidateNotes("");
            }
          }}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <ModalHeader
              icon={CheckCircle}
              title="Confirm Bulk Validation"
              subtitle={`Validate all ${pendingSubmissionsCount} pending requirements for ${faculty.fullName}`}
              className="-mx-6 -mt-6 mb-4 rounded-t-3xl"
            />

            <div className="space-y-4 mb-5">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                You are about to validate{" "}
                <span className="font-bold text-emerald-700 dark:text-emerald-400">
                  {pendingSubmissionsCount} pending requirement(s)
                </span>{" "}
                for{" "}
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {faculty.fullName}
                </span>{" "}
                {academicYear ? `(A.Y. ${academicYear} • ${semester}).` : "."}
              </p>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">
                  Quick Preset Remarks:
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() =>
                      setIsBulkValidatePresetDropdownOpen((prev) => !prev)
                    }
                    className="w-full flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 px-3 py-2 text-xs text-slate-700 dark:text-slate-300 outline-none hover:border-slate-300 dark:hover:border-slate-700 transition cursor-pointer shadow-2xs"
                  >
                    <span className="truncate">
                      Select a preset remark to add...
                    </span>
                    <AppIcon
                      icon={NavArrowDown}
                      size="sm"
                      color="inherit"
                      className={`transition-transform duration-200 shrink-0 ${isBulkValidatePresetDropdownOpen ? "rotate-180" : ""}`}
                    />
                  </button>

                  {isBulkValidatePresetDropdownOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() =>
                          setIsBulkValidatePresetDropdownOpen(false)
                        }
                      />
                      <div className="absolute left-0 right-0 top-full mt-1.5 z-20 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl overflow-hidden py-1 max-h-56 overflow-y-auto">
                        {VALIDATION_PRESETS.map((preset) => {
                          const isAlreadyAdded =
                            bulkValidateNotes.includes(preset);
                          return (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => {
                                setBulkValidateNotes((prev) => {
                                  if (prev.includes(preset)) return prev;
                                  const trimmed = prev.trim();
                                  return trimmed
                                    ? `${trimmed}\n• ${preset}`
                                    : `• ${preset}`;
                                });
                                setIsBulkValidatePresetDropdownOpen(false);
                              }}
                              className={`w-full text-left px-3 py-2 text-xs transition flex items-center justify-between cursor-pointer ${
                                isAlreadyAdded
                                  ? "bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 font-medium"
                                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                              }`}
                            >
                              <span className="truncate">{preset}</span>
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono shrink-0 ml-2">
                                {isAlreadyAdded ? "added" : "+ add"}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">
                  Remarks / Notes for All Files (Optional):
                </label>
                <textarea
                  rows={3}
                  value={bulkValidateNotes}
                  onChange={(e) => setBulkValidateNotes(e.target.value)}
                  placeholder="Add remarks or feedback to apply to all validated files (optional)..."
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-3 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition resize-none"
                />
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  This note will be saved in the verification history of each
                  validated requirement and visible to the faculty member.
                </p>
              </div>

              {validateTimerSeconds > 0 ? (
                <p className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-2.5 text-[11px] font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <AppIcon
                    icon={Hourglass}
                    size="sm"
                    color="active"
                    className="animate-pulse"
                  />
                  Please review for {validateTimerSeconds} second(s) before
                  confirming.
                </p>
              ) : (
                <p className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-2.5 text-[11px] font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <AppIcon icon={Check} size="sm" color="success" />
                  Ready to confirm bulk validation.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isValidatingAll}
                onClick={() => {
                  setIsValidateModalOpen(false);
                  setBulkValidateNotes("");
                }}
                className="rounded-xl bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] px-3.5 py-2 text-xs font-semibold transition cursor-pointer shadow-xs disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isValidatingAll || validateTimerSeconds > 0}
                onClick={executeValidateAllPending}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#0b5336] hover:bg-[#073d2a] text-white border border-[#08412a] px-4 py-2 text-xs font-bold transition shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {isValidatingAll ? (
                  <>
                    <AppIcon
                      icon={SystemRestart}
                      size="sm"
                      color="inherit"
                      className="animate-spin"
                    />
                    Validating...
                  </>
                ) : validateTimerSeconds > 0 ? (
                  `Confirm (${validateTimerSeconds}s)`
                ) : (
                  <>
                    <AppIcon
                      icon={Check}
                      size="sm"
                      color="white"
                      strokeWidth={2.5}
                    />
                    <span>
                      Confirm &amp; Validate All ({pendingSubmissionsCount})
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Zipping / Downloading Progress Modal */}
      {zipProgressData ? (
        <div
          className="fixed inset-0 z-70 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
          onClick={() => {
            if (zipProgressData.status === "zipping") {
              handleCancelZip();
            } else {
              setZipProgressData(null);
            }
          }}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <ModalHeader
              icon={
                zipProgressData.status === "zipping"
                  ? Archive
                  : zipProgressData.status === "success"
                    ? CheckCircle
                    : WarningTriangle
              }
              title={zipProgressData.title}
              className="-mx-6 -mt-6 mb-4 rounded-t-3xl"
            />

            <div className="flex flex-col items-center justify-center py-2 text-center space-y-4">
              {zipProgressData.status === "zipping" ? (
                <>
                  <div className="relative flex h-16 w-16 items-center justify-center">
                    <div className="absolute -inset-1 rounded-full border-3 border-slate-200 dark:border-slate-800 border-t-[#780000] dark:border-t-rose-500 animate-spin" />
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#780000] text-white shadow-md shadow-[#780000]/30">
                      <AppIcon icon={Archive} size="md" color="inherit" />
                    </div>
                  </div>

                  <div className="w-full space-y-2.5">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-relaxed">
                        {zipProgressData.message}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-[#780000] dark:bg-[#780000] text-white p-3.5 space-y-2.5 text-left shadow-sm">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/25">
                        <div className="h-full w-2/3 rounded-full bg-amber-400 animate-pulse" />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-white font-medium">
                        <span className="font-mono text-white/90">
                          {zipProgressData.progressText ||
                            "Processing files..."}
                        </span>
                        <span className="text-[10px] text-slate-950 bg-amber-400 px-2.5 py-0.5 rounded-full font-bold">
                          Please wait
                        </span>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                      Please keep this window open while the archive is being
                      created.
                    </p>
                  </div>
                </>
              ) : zipProgressData.status === "success" ? (
                <>
                  <div className="flex items-center justify-center py-1">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600 text-white shadow-md shadow-emerald-600/30">
                      <AppIcon icon={Check} size="lg" color="inherit" />
                    </div>
                  </div>

                  <div className="w-full space-y-3">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        Download Ready!
                      </h4>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Your archive has been assembled and passed to your
                        browser.
                      </p>
                    </div>

                    <div className="rounded-2xl bg-emerald-600 dark:bg-emerald-600 text-white p-3.5 space-y-1.5 text-left shadow-sm">
                      <div className="flex items-center gap-2 text-white text-xs font-bold">
                        <AppIcon icon={Download} size="sm" color="inherit" />
                        <span>{zipProgressData.message}</span>
                      </div>
                      <p className="text-[11.5px] text-emerald-100 pl-5.5 font-medium">
                        Check your device&apos;s{" "}
                        <strong className="text-white font-semibold">
                          Downloads
                        </strong>{" "}
                        folder to view the extracted files.
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="relative flex h-20 w-20 items-center justify-center">
                    <div className="absolute inset-0 rounded-full bg-rose-500/15 animate-pulse" />
                    <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-950/60 border-2 border-rose-400 text-rose-600 dark:text-rose-400 shadow-sm">
                      <AppIcon
                        icon={WarningTriangle}
                        size="lg"
                        color="inherit"
                      />
                    </div>
                  </div>

                  <div className="w-full space-y-3">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        Download Failed
                      </h4>
                      <p className="mt-1 text-xs text-rose-700 dark:text-rose-300">
                        {zipProgressData.message}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>

            {zipProgressData.status === "zipping" ? (
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 mt-2">
                <button
                  type="button"
                  onClick={handleCancelZip}
                  className="w-full inline-flex items-center justify-center rounded-xl bg-[#780000] hover:bg-[#5e0000] active:scale-[0.98] text-white border border-[#5e0000] py-2.5 px-4 text-xs font-bold transition-all cursor-pointer shadow-xs hover:shadow"
                >
                  Cancel Download
                </button>
              </div>
            ) : (
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 mt-2">
                <button
                  type="button"
                  onClick={() => setZipProgressData(null)}
                  className="w-full inline-flex items-center justify-center rounded-xl bg-[#780000] hover:bg-[#5e0000] active:scale-[0.98] text-white border border-[#5e0000] py-2.5 px-4 text-xs font-bold transition-all cursor-pointer shadow-xs hover:shadow"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export const FacultyDetailInlineSection = FacultyVerificationDrawer;

export interface FacultyClassProgress {
  id: string;
  subject_code: string;
  section_code: string;
  description: string;
  units: number | null;
  totalRequired: number;
  validatedCount: number;
  isDone: boolean;
}

export interface FacultySubjectProgress {
  totalSubjects: number;
  doneSubjects: number;
  allDone: boolean;
}

export interface RequirementsPanelProps {
  facultyAccounts: FacultyAccount[];
  selectedFaculty?: FacultyAccount | null;
  onSelectFaculty?: (facultyId: string | null) => void;
  resetTrigger?: number;
  initialReviewFacultyId?: string | null;
  initialRequirementCode?: string | null;
  initialAcademicYear?: string;
  initialSemester?: SemesterOption;
}

// Module-level global verification cache so switching views or re-renders render Verification Progress INSTANTLY
const globalVerificationCache: Record<
  string,
  {
    statusMap: Record<string, Record<string, RequirementStatus>>;
    classProgressMap: Record<string, FacultyClassProgress[]>;
    subjectProgressMap: Record<string, FacultySubjectProgress>;
    timestamp: number;
  }
> = {};

const inflightVerificationFetches = new Map<string, Promise<any>>();

// Module-level flag so it survives React StrictMode remounts.
let openedFromRowFlag = false;

export function RequirementsPanel({
  facultyAccounts,
  selectedFaculty,
  onSelectFaculty,
  resetTrigger,
  initialReviewFacultyId,
  initialRequirementCode,
  initialAcademicYear,
  initialSemester,
}: RequirementsPanelProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProgram, setSelectedProgram] = useState("All Programs");
  const [isProgramDropdownOpen, setIsProgramDropdownOpen] = useState(false);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<
    | "all"
    | "completed"
    | "optional_review"
    | "pending_review"
    | "needs_revision"
    | "not_submitted"
  >("all");

  const [activePanelTab, setActivePanelTab] = useState<"current" | "history">(
    "current",
  );
  const [activeTermAy, setActiveTermAy] = useState(initialAcademicYear || "");
  const [activeTermSem, setActiveTermSem] = useState<SemesterOption>(
    initialSemester || "1st Semester",
  );
  const [historyAy, setHistoryAy] = useState(initialAcademicYear || "");
  const [historySem, setHistorySem] = useState<SemesterOption>(
    initialSemester || "1st Semester",
  );
  const [availableAcademicYears, setAvailableAcademicYears] = useState<
    string[]
  >(initialAcademicYear ? [initialAcademicYear] : []);
  const [termsByYear, setTermsByYear] = useState<
    Record<string, SemesterOption[]>
  >({});
  const [academicYear, setAcademicYear] = useState(initialAcademicYear || "");
  const [semester, setSemester] = useState<SemesterOption>(
    initialSemester || "1st Semester",
  );

  // Sync initial term props when parent finishes loading them
  useEffect(() => {
    if (initialAcademicYear && !activeTermAy) {
      setActiveTermAy(initialAcademicYear);
      if (activePanelTab === "current") {
        setAcademicYear(initialAcademicYear);
      }
    }
    if (initialSemester && !activeTermAy) {
      setActiveTermSem(initialSemester);
      if (activePanelTab === "current") {
        setSemester(initialSemester);
      }
    }
  }, [initialAcademicYear, initialSemester, activeTermAy, activePanelTab]);

  const [facultyStatuses, setFacultyStatuses] = useState<
    Record<string, Record<string, RequirementStatus>>
  >(() => {
    const termKey = `${initialAcademicYear || ""}::${initialSemester || "1st Semester"}`;
    if (globalVerificationCache[termKey]?.statusMap) {
      return globalVerificationCache[termKey].statusMap;
    }
    const initial: Record<string, Record<string, RequirementStatus>> = {};
    for (const f of facultyAccounts) {
      if (f?.id && f.requirementStatus) {
        initial[f.id] = f.requirementStatus;
      }
    }
    return initial;
  });

  // Seed statuses from facultyAccounts whenever new accounts arrive and don't have a status entry yet
  useEffect(() => {
    if (facultyAccounts.length === 0) return;
    setFacultyStatuses((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const f of facultyAccounts) {
        if (f?.id && f.requirementStatus && !next[f.id]) {
          next[f.id] = f.requirementStatus;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [facultyAccounts]);

  const [facultyClassProgress, setFacultyClassProgress] = useState<
    Record<string, FacultyClassProgress[]>
  >(() => {
    const termKey = `${initialAcademicYear || ""}::${initialSemester || "1st Semester"}`;
    return globalVerificationCache[termKey]?.classProgressMap || {};
  });
  const [facultySubjectProgress, setFacultySubjectProgress] = useState<
    Record<string, FacultySubjectProgress>
  >(() => {
    const termKey = `${initialAcademicYear || ""}::${initialSemester || "1st Semester"}`;
    return globalVerificationCache[termKey]?.subjectProgressMap || {};
  });

  // Immediate sync when switching academic years / semesters if term is already cached
  useEffect(() => {
    const targetAy = activePanelTab === "history" ? historyAy : academicYear;
    const targetSem = activePanelTab === "history" ? historySem : semester;
    const termKey = `${targetAy}::${targetSem}`;
    if (globalVerificationCache[termKey]) {
      setFacultyStatuses(globalVerificationCache[termKey].statusMap);
      setFacultyClassProgress(
        globalVerificationCache[termKey].classProgressMap,
      );
      setFacultySubjectProgress(
        globalVerificationCache[termKey].subjectProgressMap,
      );
    }
  }, [academicYear, semester, historyAy, historySem, activePanelTab]);

  const [isLoadingStatuses, setIsLoadingStatuses] = useState(false);
  const statusesByTermRef = useRef<
    Record<
      string,
      {
        statusMap: Record<string, Record<string, RequirementStatus>>;
        classProgressMap: Record<string, FacultyClassProgress[]>;
        subjectProgressMap: Record<string, FacultySubjectProgress>;
      }
    >
  >({});

  const [submissionsCache, setSubmissionsCache] = useState<
    Record<
      string,
      { submissions: FacultyRequirementSubmission[]; classes: any[] }
    >
  >({});
  const inflightPrefetchRef = useRef<Set<string>>(new Set());

  const handleSubmissionsLoaded = useCallback(
    (
      fId: string,
      payload: { submissions: FacultyRequirementSubmission[]; classes: any[] },
    ) => {
      setSubmissionsCache((prev) => {
        const existing = prev[fId];
        if (
          existing &&
          existing.submissions.length === payload.submissions.length &&
          existing.classes.length === payload.classes.length
        ) {
          return prev;
        }
        return {
          ...prev,
          [fId]: payload,
        };
      });
    },
    [],
  );

  const prefetchFacultySubmissions = useCallback(
    async (
      targetFacultyId: string,
      ayOverride?: string,
      semOverride?: string,
    ) => {
      if (!targetFacultyId) return;
      const targetAy = ayOverride ?? academicYear ?? activeTermAy;
      const targetSem = semOverride ?? semester ?? activeTermSem;
      const cacheKey = `${targetFacultyId}::${targetAy}::${targetSem}`;
      if (inflightPrefetchRef.current.has(cacheKey)) return;
      inflightPrefetchRef.current.add(cacheKey);
      try {
        const headers: Record<string, string> = {};
        try {
          const supabase = createClient();
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData?.session?.access_token;
          if (token) headers["Authorization"] = `Bearer ${token}`;
        } catch {}

        const res = await fetch(
          `/api/staff/faculty/submissions?facultyId=${encodeURIComponent(targetFacultyId)}&academicYear=${encodeURIComponent(targetAy)}&semester=${encodeURIComponent(targetSem)}`,
          { credentials: "include", cache: "no-store", headers },
        );
        if (res.ok) {
          const data = await res.json();
          setSubmissionsCache((prev) => ({
            ...prev,
            [targetFacultyId]: {
              submissions: data.submissions || [],
              classes: Array.isArray(data.classes) ? data.classes : [],
            },
          }));
        }
      } catch {
        // Silent prefetch failure
      } finally {
        inflightPrefetchRef.current.delete(cacheKey);
      }
    },
    [academicYear, activeTermAy, semester, activeTermSem],
  );

  const [requirementTemplates, setRequirementTemplates] = useState<
    Array<{
      code: string;
      title: string;
      is_mandatory: boolean;
      is_active?: boolean;
    }>
  >([]);

  const loadTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/staff/requirement-templates", {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.templates) && data.templates.length > 0) {
          setRequirementTemplates(
            data.templates.map((t: any) => ({
              code: t.code,
              title: t.title,
              is_mandatory: Boolean(t.is_mandatory),
              is_active: t.is_active !== false,
            })),
          );
        }
      }
    } catch {
      // Fallback
    }
  }, []);

  const [reviewingFaculty, setReviewingFaculty] =
    useState<FacultyAccount | null>(selectedFaculty || null);
  // Module-level flag (openedFromRowFlag) is used instead of a ref so it
  // survives React StrictMode remounts. See module scope above.

  // Sync with selectedFaculty prop from parent
  useEffect(() => {
    if (selectedFaculty !== undefined) {
      setReviewingFaculty((prev) =>
        prev?.id === selectedFaculty?.id ? prev : selectedFaculty,
      );
    }
  }, [selectedFaculty]);

  const initialOpenedRef = useRef<string | null>(null);

  // Auto-open review drawer if initialReviewFacultyId is provided
  useEffect(() => {
    if (
      initialReviewFacultyId &&
      facultyAccounts.length > 0 &&
      initialOpenedRef.current !== initialReviewFacultyId
    ) {
      const target = facultyAccounts.find(
        (f) => f.id === initialReviewFacultyId,
      );
      if (target) {
        initialOpenedRef.current = initialReviewFacultyId;
        setReviewingFaculty(target);
        onSelectFaculty?.(target.id);
      }
    }
  }, [initialReviewFacultyId, facultyAccounts, onSelectFaculty]);

  // Derive unique programs from facultyAccounts
  const availablePrograms = useMemo(() => {
    const set = new Set<string>();
    facultyAccounts.forEach((f) => {
      const code = f.program?.code || f.program?.name;
      if (code) set.add(code);
    });
    return Array.from(set).sort();
  }, [facultyAccounts]);

  const allKnownYears = useMemo(() => {
    const list = new Set<string>();
    if (activeTermAy) list.add(activeTermAy);
    availableAcademicYears.forEach((y) => list.add(y));
    return Array.from(list).sort().reverse();
  }, [activeTermAy, availableAcademicYears]);

  const SEMESTER_SORT_ORDER: Record<string, number> = {
    "1st Semester": 1,
    "2nd Semester": 2,
    "Summer Semester": 3,
  };

  const sortSemestersList = useCallback(
    (sems: SemesterOption[]): SemesterOption[] => {
      return [...sems].sort(
        (a, b) =>
          (SEMESTER_SORT_ORDER[a] ?? 99) - (SEMESTER_SORT_ORDER[b] ?? 99),
      );
    },
    [],
  );

  const availableHistorySemesters = useMemo(() => {
    const list =
      termsByYear[historyAy] && termsByYear[historyAy].length > 0
        ? termsByYear[historyAy]
        : (["1st Semester", "2nd Semester"] as SemesterOption[]);
    return sortSemestersList(list);
  }, [termsByYear, historyAy, sortSemestersList]);

  async function fetchAllStatuses(
    ay?: string,
    sem?: SemesterOption,
    options?: { silent?: boolean; syncActiveTerm?: boolean },
  ) {
    const allIds = facultyAccounts.map((f) => f?.id).filter(Boolean);
    if (allIds.length === 0) {
      setIsLoadingStatuses(false);
      return;
    }

    const targetAy =
      ay ??
      (activePanelTab === "history" ? historyAy : academicYear) ??
      activeTermAy ??
      "";
    const targetSem =
      sem ??
      (activePanelTab === "history" ? historySem : semester) ??
      activeTermSem ??
      "1st Semester";
    const termKey = `${targetAy}::${targetSem}`;
    const cached = globalVerificationCache[termKey];

    if (cached) {
      setFacultyStatuses(cached.statusMap);
      setFacultyClassProgress(cached.classProgressMap);
      setFacultySubjectProgress(cached.subjectProgressMap);
    }

    const hasAnyData = cached || Object.keys(facultyClassProgress).length > 0;
    const isSilent = options?.silent || Boolean(hasAnyData);
    if (!isSilent) {
      setIsLoadingStatuses(true);
    }

    const inflightKey = `${allIds.slice().sort().join(",")}::${targetAy}::${targetSem}`;
    if (inflightVerificationFetches.has(inflightKey)) {
      return inflightVerificationFetches.get(inflightKey);
    }

    const fetchPromise = (async () => {
      try {
        const params = new URLSearchParams();
        params.set("facultyIds", allIds.join(","));
        if (ay) params.set("academicYear", ay);
        if (sem) params.set("semester", sem);
        params.set("_t", String(Date.now()));

        const headers: Record<string, string> = {};
        try {
          const supabase = createClient();
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData?.session?.access_token;
          if (token) {
            headers["Authorization"] = `Bearer ${token}`;
          }
        } catch {}

        const res = await fetch(
          `/api/staff/faculty/requirements/verification?${params.toString()}`,
          { credentials: "include", cache: "no-store", headers },
        );

        if (!res.ok) return;
        const data = await res.json();

        if (
          Array.isArray(data.requirementTemplates) &&
          data.requirementTemplates.length > 0
        ) {
          setRequirementTemplates(
            data.requirementTemplates.map((t: any) => ({
              code: t.code,
              title: t.title,
              is_mandatory: Boolean(t.is_mandatory),
              is_active: t.is_active !== false,
            })),
          );
        }

        if (options?.syncActiveTerm) {
          const resolvedAy =
            data.currentAcademicYear || data.selectedAcademicYear || "";
          const resolvedSem: SemesterOption =
            data.currentSemester || data.selectedSemester || "1st Semester";

          setActiveTermAy(resolvedAy);
          setActiveTermSem(resolvedSem);
          if (activePanelTab === "current") {
            setAcademicYear(resolvedAy);
            setSemester(resolvedSem);
          }

          if (data.termsByYear && typeof data.termsByYear === "object") {
            setTermsByYear(data.termsByYear);
          }

          if (
            Array.isArray(data.availableAcademicYears) &&
            data.availableAcademicYears.length > 0
          ) {
            setAvailableAcademicYears(data.availableAcademicYears);
            const chosenAy =
              historyAy && data.availableAcademicYears.includes(historyAy)
                ? historyAy
                : resolvedAy && data.availableAcademicYears.includes(resolvedAy)
                  ? resolvedAy
                  : data.availableAcademicYears[0];
            setHistoryAy(chosenAy);

            const validSemsForAy = sortSemestersList(
              (data.termsByYear && data.termsByYear[chosenAy]) || [
                "1st Semester",
                "2nd Semester",
              ],
            );
            const defaultSem = validSemsForAy.includes(resolvedSem)
              ? resolvedSem
              : validSemsForAy[0];
            setHistorySem(defaultSem);
          }
        }

        if (
          data.resultsByFacultyId &&
          typeof data.resultsByFacultyId === "object"
        ) {
          const statusMap: Record<
            string,
            Record<string, RequirementStatus>
          > = {};
          const classProgressMap: Record<string, FacultyClassProgress[]> = {};
          const subjectProgressMap: Record<string, FacultySubjectProgress> = {};

          for (const [fId, item] of Object.entries<any>(
            data.resultsByFacultyId,
          )) {
            if (item?.requirementStatus) {
              statusMap[fId] = item.requirementStatus;
            }
            if (item?.classProgress) {
              classProgressMap[fId] = item.classProgress;
            }
            if (item?.subjectProgress) {
              subjectProgressMap[fId] = item.subjectProgress;
            }
          }

          const effectiveAy =
            ay ||
            (options?.syncActiveTerm ? data.currentAcademicYear : "") ||
            academicYear ||
            activeTermAy ||
            "";
          const effectiveSem =
            sem ||
            (options?.syncActiveTerm ? data.currentSemester : "") ||
            semester ||
            activeTermSem ||
            "1st Semester";
          const resolvedKey = `${effectiveAy}::${effectiveSem}`;
          globalVerificationCache[resolvedKey] = {
            statusMap,
            classProgressMap,
            subjectProgressMap,
            timestamp: Date.now(),
          };
          statusesByTermRef.current[resolvedKey] =
            globalVerificationCache[resolvedKey];

          setFacultyStatuses(statusMap);
          setFacultyClassProgress(classProgressMap);
          setFacultySubjectProgress(subjectProgressMap);
        }
      } catch (err) {
        console.error("Error fetching faculty statuses:", err);
      } finally {
        inflightVerificationFetches.delete(inflightKey);
        setIsLoadingStatuses(false);
      }
    })();

    inflightVerificationFetches.set(inflightKey, fetchPromise);
    return fetchPromise;
  }

  // Background prefetch known past terms with debounce so primary term loads instantly
  useEffect(() => {
    if (facultyAccounts.length === 0 || allKnownYears.length === 0) return;
    const timer = setTimeout(() => {
      const sems: SemesterOption[] = ["1st Semester", "2nd Semester"];
      allKnownYears.slice(0, 1).forEach((y) => {
        sems.forEach((s) => {
          const termKey = `${y}::${s}`;
          if (
            statusesByTermRef.current[termKey] ||
            globalVerificationCache[termKey]
          )
            return;
          void fetchAllStatuses(y, s, { silent: true });
        });
      });
    }, 1200);
    return () => clearTimeout(timer);
  }, [facultyAccounts.length, allKnownYears]);

  // Load active term, templates, and all faculty statuses in a single batched request on mount
  useEffect(() => {
    if (facultyAccounts.length === 0) {
      setIsLoadingStatuses(false);
      return;
    }
    const isManualTrigger = (resetTrigger ?? 0) > 0;
    const hasClassProgress = Object.keys(facultyClassProgress).length > 0;

    const targetAy =
      activePanelTab === "history" ? historyAy : academicYear || undefined;
    const targetSem =
      activePanelTab === "history"
        ? historySem
        : academicYear
          ? semester
          : undefined;

    void fetchAllStatuses(targetAy, targetSem, {
      silent: !isManualTrigger && hasClassProgress,
      syncActiveTerm: true,
    });
  }, [facultyAccounts, resetTrigger]);

  // Realtime sync for RequirementsPanel (subjects added/edited/archived & requirements uploaded/reviewed)
  useRealtimeSync(() => {
    void loadTemplates();
    if (academicYear && semester) {
      void fetchAllStatuses(academicYear, semester, { silent: true });
    }
  });

  // Map faculty account to verification status details
  const facultyStatusMap = useMemo(() => {
    const map = new Map<
      string,
      {
        category:
          | "completed"
          | "optional_review"
          | "pending_review"
          | "needs_revision"
          | "not_submitted";
        overallStatus:
          | "Completed / Validated"
          | "Optional Review Pending"
          | "Pending Review"
          | "Needs Revision"
          | "Not Submitted";
        statusBadgeClass: string;
        actionButtonText: string;
        actionButtonClass: string;
        validatedMandatoryCount: number;
        totalMandatoryCount: number;
        totalValidatedCount: number;
        hasPendingUpload: boolean;
        isNotSubmitted: boolean;
      }
    >();

    const activeTemplates =
      requirementTemplates.length > 0
        ? requirementTemplates.filter((t) => t.is_active !== false)
        : DEFAULT_REQUIREMENTS.map((code) => ({
            code,
            title: REQUIREMENT_LABEL[code] || code,
            is_mandatory: true,
            is_active: true,
          }));

    const mandatoryTemplates = activeTemplates.filter((t) => t.is_mandatory);
    const totalMandatoryCount =
      mandatoryTemplates.length > 0
        ? mandatoryTemplates.length
        : DEFAULT_REQUIREMENTS.length;

    for (const faculty of facultyAccounts) {
      const statusRecord = facultyStatuses[faculty.id];
      const classList = facultyClassProgress[faculty.id] || [];
      const subjectProg = facultySubjectProgress[faculty.id];
      const hasSubjects =
        (subjectProg ? subjectProg.totalSubjects : classList.length) > 0;
      const isAllSubjectsDone =
        hasSubjects &&
        (subjectProg ? subjectProg.allDone : classList.every((c) => c.isDone));

      const validatedMandatoryCount = statusRecord
        ? mandatoryTemplates.filter((t) => statusRecord[t.code] === "validated")
            .length
        : 0;

      const allStatuses = statusRecord ? Object.values(statusRecord) : [];
      const totalValidatedCount = allStatuses.filter(
        (s) => s === "validated",
      ).length;
      const hasPendingUpload = allStatuses.some((s) => s === "uploaded");
      const hasNeedsRevision = allStatuses.some(
        (s) => s === "rejected" || s === "needs_revision",
      );

      const isAllMandatoryValidated = hasSubjects
        ? isAllSubjectsDone
        : validatedMandatoryCount === totalMandatoryCount &&
          totalMandatoryCount > 0;

      let category:
        | "completed"
        | "optional_review"
        | "pending_review"
        | "needs_revision"
        | "not_submitted" = "not_submitted";
      let overallStatus:
        | "Completed / Validated"
        | "Optional Review Pending"
        | "Pending Review"
        | "Needs Revision"
        | "Not Submitted" = "Not Submitted";
      let statusBadgeClass =
        "bg-white text-slate-600 border border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800 font-semibold";
      let actionButtonText =
        activePanelTab === "history"
          ? "View Validation History"
          : "Review Requirements";
      let actionButtonClass =
        activePanelTab === "history"
          ? "bg-[#0b5336] hover:bg-[#08412a] text-white font-semibold"
          : "bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold";

      if (isAllMandatoryValidated && hasPendingUpload) {
        // All mandatory documents validated, but uploaded optional documents are pending admin review
        category = "optional_review";
        overallStatus = "Optional Review Pending";
        statusBadgeClass =
          "bg-indigo-600 text-white border border-indigo-700 shadow-2xs font-semibold";
        if (activePanelTab !== "history") {
          actionButtonText = "Review Optional";
          actionButtonClass =
            "bg-indigo-600 hover:bg-indigo-500 text-white font-semibold";
        }
      } else if (hasPendingUpload) {
        // Any submission (mandatory or optional) pending admin review
        category = "pending_review";
        overallStatus = "Pending Review";
        statusBadgeClass =
          "bg-amber-500 text-slate-950 border border-amber-600 shadow-2xs font-semibold";
        if (activePanelTab !== "history") {
          actionButtonText = "Review Requirements";
          actionButtonClass =
            "bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold";
        }
      } else if (hasNeedsRevision) {
        category = "needs_revision";
        overallStatus = "Needs Revision";
        statusBadgeClass =
          "bg-[#780000] text-white border border-[#5e0000] shadow-2xs font-semibold";
        if (activePanelTab !== "history") {
          actionButtonText = "Review Requirements";
          actionButtonClass =
            "bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold";
        }
      } else if (isAllMandatoryValidated) {
        // All required documents are validated and no submissions are pending review or rejected
        category = "completed";
        overallStatus = "Completed / Validated";
        statusBadgeClass =
          "bg-[#0b5336] text-white border border-[#08412a] shadow-2xs font-semibold";
        if (activePanelTab !== "history") {
          actionButtonText = "View Requirements";
          actionButtonClass =
            "bg-[#0b5336] hover:bg-[#08412a] text-white font-semibold";
        }
      } else if (totalValidatedCount > 0) {
        category = "pending_review";
        overallStatus = "Pending Review";
        statusBadgeClass =
          "bg-amber-500 text-slate-950 border border-amber-600 shadow-2xs font-semibold";
        if (activePanelTab !== "history") {
          actionButtonText = "Review Requirements";
          actionButtonClass =
            "bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold";
        }
      } else {
        category = "not_submitted";
        overallStatus = "Not Submitted";
        statusBadgeClass =
          "bg-white text-slate-600 border border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800 font-semibold";
        actionButtonText = "Not Submitted Yet";
        actionButtonClass =
          "bg-slate-100 text-slate-400 border border-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700 font-semibold cursor-not-allowed opacity-60 shadow-none";
      }

      map.set(faculty.id, {
        category,
        overallStatus,
        statusBadgeClass,
        actionButtonText,
        actionButtonClass,
        validatedMandatoryCount,
        totalMandatoryCount,
        totalValidatedCount,
        hasPendingUpload,
        isNotSubmitted: category === "not_submitted",
      });
    }

    return map;
  }, [
    facultyAccounts,
    facultyStatuses,
    requirementTemplates,
    facultyClassProgress,
    facultySubjectProgress,
  ]);

  // Tab counters
  const statusCounts = useMemo(() => {
    let completed = 0;
    let optional_review = 0;
    let pending_review = 0;
    let needs_revision = 0;
    let not_submitted = 0;

    facultyStatusMap.forEach((val) => {
      if (val.category === "completed") completed++;
      else if (val.category === "optional_review") optional_review++;
      else if (val.category === "pending_review") pending_review++;
      else if (val.category === "needs_revision") needs_revision++;
      else if (val.category === "not_submitted") not_submitted++;
    });

    return {
      all: facultyAccounts.length,
      completed,
      optional_review,
      pending_review,
      needs_revision,
      not_submitted,
    };
  }, [facultyAccounts.length, facultyStatusMap]);

  const filteredFaculty = useMemo(() => {
    const result = facultyAccounts.filter((f) => {
      const matchesSearch =
        !searchTerm ||
        f.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.email.toLowerCase().includes(searchTerm.toLowerCase());

      const progCode = f.program?.code || f.program?.name || "N/A";
      const matchesProgram =
        selectedProgram === "All Programs" || progCode === selectedProgram;

      const statInfo = facultyStatusMap.get(f.id);
      const matchesStatus =
        statusFilter === "all" ||
        (statInfo && statInfo.category === statusFilter);

      return matchesSearch && matchesProgram && matchesStatus;
    });
    return result
      .slice()
      .sort((a, b) => (a.fullName || "").localeCompare(b.fullName || ""));
  }, [
    facultyAccounts,
    searchTerm,
    selectedProgram,
    statusFilter,
    facultyStatusMap,
  ]);

  const statusFilterOptions: Array<{
    id:
      | "all"
      | "completed"
      | "pending_review"
      | "optional_review"
      | "needs_revision"
      | "not_submitted";
    label: string;
  }> = [
    { id: "all", label: "All Faculty" },
    { id: "completed", label: "Completed / Validated" },
    { id: "pending_review", label: "Pending Review" },
    { id: "optional_review", label: "Optional Review Pending" },
    { id: "needs_revision", label: "Needs Revision" },
    { id: "not_submitted", label: "Not Submitted" },
  ];

  const currentStatusOption =
    statusFilterOptions.find((opt) => opt.id === statusFilter) ||
    statusFilterOptions[0];

  const buildVerificationReportPayload = () => {
    const baseList = filteredFaculty;

    let completedCount = 0;
    let notCompletedCount = 0;
    filteredFaculty.forEach((f) => {
      const statInfo = facultyStatusMap.get(f.id);
      if (statInfo?.category === "completed") completedCount += 1;
      else notCompletedCount += 1;
    });

    const scopeLabel =
      currentStatusOption.id === "all"
        ? "All Faculty"
        : `${currentStatusOption.label} Only`;

    return {
      title: `Requirements Verification Report — ${scopeLabel}`,
      subtitle: `Term: A.Y. ${academicYear || "2026-2027"} • ${semester} • Program: ${selectedProgram}`,
      fileName: `PUP_FOCUS_Verification_${currentStatusOption.id}_${academicYear}_${new Date()
        .toISOString()
        .slice(0, 10)}`,
      summaryStats: [
        {
          label: "Total Faculty in View",
          value: filteredFaculty.length,
          tone: "default" as const,
        },
        {
          label: "Completed (Done)",
          value: completedCount,
          tone: "success" as const,
        },
        {
          label: "Not Completed",
          value: notCompletedCount,
          tone: "danger" as const,
        },
        {
          label: "Exported Rows",
          value: baseList.length,
          tone: "warning" as const,
        },
      ],
      columns: [
        { header: "#", key: "index", align: "center" as const },
        { header: "Faculty Member", key: "name" },
        { header: "Email Address", key: "email" },
        { header: "Program", key: "program", align: "center" as const },
        {
          header: "Mandatory Progress",
          key: "progress",
          align: "center" as const,
        },
        {
          header: "Completion Status",
          key: "completion",
          align: "center" as const,
        },
        {
          header: "Detailed Status",
          key: "detailedStatus",
          align: "center" as const,
        },
      ],
      rows: baseList.map((faculty, index) => {
        const statInfo = facultyStatusMap.get(faculty.id);
        const classList = facultyClassProgress[faculty.id] || [];
        const subjectProg = facultySubjectProgress[faculty.id];
        const totalSubjects = subjectProg
          ? subjectProg.totalSubjects
          : classList.length;
        const doneSubjects = subjectProg
          ? subjectProg.doneSubjects
          : classList.filter((c) => c.isDone).length;

        const isCompleted = statInfo?.category === "completed";
        const progressText =
          totalSubjects > 0
            ? `${doneSubjects}/${totalSubjects} Subjects Done (${statInfo?.validatedMandatoryCount ?? 0}/${statInfo?.totalMandatoryCount ?? 6} Req)`
            : `${statInfo?.validatedMandatoryCount ?? 0}/${statInfo?.totalMandatoryCount ?? 6} Validated`;

        return {
          index: index + 1,
          name: faculty.fullName,
          email: faculty.email || "—",
          program: faculty.program?.code || faculty.program?.name || "N/A",
          progress: progressText,
          completion: isCompleted ? "Completed" : "Not Completed",
          detailedStatus: statInfo?.overallStatus || "Not Submitted",
        };
      }),
    };
  };

  return (
    <div className="w-full">
      {reviewingFaculty ? (
        <FacultyVerificationDrawer
          faculty={reviewingFaculty}
          academicYear={academicYear}
          semester={semester}
          initialTab={activePanelTab}
          initialRequirementCode={
            openedFromRowFlag ? null : initialRequirementCode
          }
          requirementTemplates={requirementTemplates}
          initialClasses={
            submissionsCache[reviewingFaculty.id]?.classes ??
            facultyClassProgress[reviewingFaculty.id]
          }
          initialSubmissions={
            submissionsCache[reviewingFaculty.id]?.submissions
          }
          initialAvailableAcademicYears={availableAcademicYears}
          onSubmissionsLoaded={handleSubmissionsLoaded}
          onBack={() => {
            openedFromRowFlag = false;
            initialOpenedRef.current = "__closed__";
            setReviewingFaculty(null);
            onSelectFaculty?.(null);
          }}
          onClose={() => {
            openedFromRowFlag = false;
            initialOpenedRef.current = "__closed__";
            setReviewingFaculty(null);
            onSelectFaculty?.(null);
          }}
          onStatusUpdated={() => {
            if (academicYear && semester) {
              void fetchAllStatuses(academicYear, semester, { silent: true });
            }
          }}
        />
      ) : (
        <>
          {/* Top View Mode: Current Submissions vs. Validation History */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setActivePanelTab("current");
                  setAcademicYear(activeTermAy);
                  setSemester(activeTermSem);
                  const termKey = `${activeTermAy}::${activeTermSem}`;
                  const cached = statusesByTermRef.current[termKey];
                  if (cached) {
                    setFacultyStatuses(cached.statusMap);
                    setFacultyClassProgress(cached.classProgressMap);
                    setFacultySubjectProgress(cached.subjectProgressMap);
                  }
                  void fetchAllStatuses(activeTermAy, activeTermSem, {
                    silent:
                      Boolean(cached) ||
                      Object.keys(facultyStatuses).length > 0,
                  });
                }}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  activePanelTab === "current"
                    ? "bg-[#780000] text-white border border-[#5e0000] shadow-xs"
                    : "bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-750 shadow-2xs"
                }`}
              >
                <AppIcon icon={Page} size="xs" color="inherit" />
                <span>Current Submissions</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActivePanelTab("history");
                  const validAy =
                    historyAy && allKnownYears.includes(historyAy)
                      ? historyAy
                      : activeTermAy && allKnownYears.includes(activeTermAy)
                        ? activeTermAy
                        : allKnownYears[0] || "";
                  const validSems = sortSemestersList(
                    termsByYear[validAy] || ["1st Semester", "2nd Semester"],
                  );
                  const validSem = validSems.includes(activeTermSem)
                    ? activeTermSem
                    : validSems.includes(historySem)
                      ? historySem
                      : validSems[0];
                  setHistoryAy(validAy);
                  setHistorySem(validSem);
                  setAcademicYear(validAy);
                  setSemester(validSem);

                  const termKey = `${validAy}::${validSem}`;
                  const cached = statusesByTermRef.current[termKey];
                  if (cached) {
                    setFacultyStatuses(cached.statusMap);
                    setFacultyClassProgress(cached.classProgressMap);
                    setFacultySubjectProgress(cached.subjectProgressMap);
                  }

                  void fetchAllStatuses(validAy, validSem, {
                    silent:
                      Boolean(cached) ||
                      Object.keys(facultyStatuses).length > 0,
                  });
                }}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  activePanelTab === "history"
                    ? "bg-[#780000] text-white border border-[#5e0000] shadow-xs"
                    : "bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-750 shadow-2xs"
                }`}
              >
                <AppIcon icon={Archive} size="xs" color="inherit" />
                <span>Validation History</span>
              </button>
            </div>

            {/* Academic Term Selector / Status Badge */}
            {activePanelTab === "current" ? (
              activeTermAy ? (
                <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold shadow-2xs">
                  <span className="h-2 w-2 rounded-full bg-slate-400" />
                  <span>
                    Active Term: A.Y. {activeTermAy} &bull; {activeTermSem}
                  </span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold shadow-2xs">
                  <span className="h-2 w-2 rounded-full bg-slate-400" />
                  <span>No Active Academic Term Configured</span>
                </div>
              )
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  Select Past Term:
                </span>
                <select
                  value={historyAy}
                  onChange={(e) => {
                    const newAy = e.target.value;
                    setHistoryAy(newAy);
                    setAcademicYear(newAy);
                    const validSems = sortSemestersList(
                      termsByYear[newAy] || ["1st Semester", "2nd Semester"],
                    );
                    const nextSem = validSems.includes(activeTermSem)
                      ? activeTermSem
                      : validSems.includes(historySem)
                        ? historySem
                        : validSems[0];
                    setHistorySem(nextSem);
                    setSemester(nextSem);

                    const termKey = `${newAy}::${nextSem}`;
                    const cached = statusesByTermRef.current[termKey];
                    if (cached) {
                      setFacultyStatuses(cached.statusMap);
                      setFacultyClassProgress(cached.classProgressMap);
                      setFacultySubjectProgress(cached.subjectProgressMap);
                    }

                    void fetchAllStatuses(newAy, nextSem, {
                      silent:
                        Boolean(cached) ||
                        Object.keys(facultyStatuses).length > 0,
                    });
                  }}
                  className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-bold outline-none focus:border-amber-500 cursor-pointer shadow-2xs"
                >
                  {allKnownYears.map((y) => (
                    <option key={y} value={y}>
                      A.Y. {y}
                    </option>
                  ))}
                </select>

                <select
                  value={historySem}
                  onChange={(e) => {
                    const newSem = e.target.value as SemesterOption;
                    setHistorySem(newSem);
                    setSemester(newSem);

                    const termKey = `${historyAy}::${newSem}`;
                    const cached = statusesByTermRef.current[termKey];
                    if (cached) {
                      setFacultyStatuses(cached.statusMap);
                      setFacultyClassProgress(cached.classProgressMap);
                      setFacultySubjectProgress(cached.subjectProgressMap);
                    }

                    void fetchAllStatuses(historyAy, newSem, {
                      silent:
                        Boolean(cached) ||
                        Object.keys(facultyStatuses).length > 0,
                    });
                  }}
                  className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-bold outline-none focus:border-amber-500 cursor-pointer shadow-2xs"
                >
                  {availableHistorySemesters.map((sem) => (
                    <option key={sem} value={sem}>
                      {sem}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* 1. Top Control Bar */}
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-200 mb-4 shadow-xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5 w-full lg:w-auto flex-wrap">
              {/* Search Input */}
              <input
                type="text"
                placeholder="Search faculty by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full sm:w-60 rounded-xl border border-slate-400 dark:border-slate-800 bg-white dark:bg-slate-950 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
              />

              {/* Custom Program Dropdown Filter */}
              <div className="relative w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    setIsProgramDropdownOpen((prev) => !prev);
                    setIsStatusDropdownOpen(false);
                  }}
                  className="flex w-full sm:w-auto items-center justify-between gap-2 rounded-xl border border-slate-400 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-200 outline-none transition hover:border-slate-500 dark:hover:border-slate-700 focus:border-amber-500 cursor-pointer"
                >
                  <span>{selectedProgram}</span>
                  <NavArrowDown
                    className={`h-4 w-4 text-slate-500 dark:text-slate-400 transition-transform ${isProgramDropdownOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {isProgramDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-20"
                      onClick={() => setIsProgramDropdownOpen(false)}
                    />
                    <div className="absolute left-0 top-full mt-1.5 z-30 w-full sm:w-48 rounded-2xl border border-slate-400 dark:border-slate-800 bg-white dark:bg-slate-900 py-1 shadow-xl text-sm text-slate-900 dark:text-slate-200 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedProgram("All Programs");
                          setIsProgramDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3.5 py-2 transition hover:bg-slate-100 dark:hover:bg-slate-800 ${
                          selectedProgram === "All Programs"
                            ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold"
                            : "text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        All Programs
                      </button>
                      {availablePrograms.map((prog) => (
                        <button
                          key={prog}
                          type="button"
                          onClick={() => {
                            setSelectedProgram(prog);
                            setIsProgramDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3.5 py-2 transition hover:bg-slate-100 dark:hover:bg-slate-800 ${
                            selectedProgram === prog
                              ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold"
                              : "text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          {prog}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Custom Status Dropdown Filter */}
              <div className="relative w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    setIsStatusDropdownOpen((prev) => !prev);
                    setIsProgramDropdownOpen(false);
                  }}
                  className="flex w-full sm:w-auto items-center justify-between gap-2.5 rounded-xl border border-slate-400 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-200 outline-none transition hover:border-slate-500 dark:hover:border-slate-700 focus:border-amber-500 cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 text-left">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">
                      Status:
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {currentStatusOption.label}
                    </span>
                    <span className="ml-1 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-slate-950 shadow-2xs">
                      ({statusCounts[statusFilter]})
                    </span>
                  </div>
                  <NavArrowDown
                    className={`h-4 w-4 text-slate-500 dark:text-slate-400 transition-transform ${
                      isStatusDropdownOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {isStatusDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-20"
                      onClick={() => setIsStatusDropdownOpen(false)}
                    />
                    <div className="absolute left-0 top-full mt-1.5 z-30 w-full sm:w-64 rounded-2xl border border-slate-400 dark:border-slate-800 bg-white dark:bg-slate-900 py-1 shadow-xl text-sm text-slate-900 dark:text-slate-200 overflow-hidden">
                      {statusFilterOptions.map((opt) => {
                        const isSelected = statusFilter === opt.id;
                        const count = statusCounts[opt.id];
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              setStatusFilter(opt.id);
                              setIsStatusDropdownOpen(false);
                            }}
                            className={`w-full flex items-center justify-between gap-2.5 px-3.5 py-2 transition hover:bg-slate-100 dark:hover:bg-slate-800 text-left cursor-pointer ${
                              isSelected
                                ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold"
                                : "text-slate-700 dark:text-slate-300"
                            }`}
                          >
                            <span className="truncate">{opt.label}</span>
                            <span
                              className={`ml-2 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold shrink-0 shadow-2xs ${
                                isSelected
                                  ? "bg-amber-500 text-slate-950"
                                  : count > 0
                                    ? "bg-slate-700 dark:bg-slate-600 text-white"
                                    : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                              }`}
                            >
                              ({count})
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Report Export Controls (PDF / Excel) */}
            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end shrink-0">
              <button
                type="button"
                onClick={() =>
                  exportReportToPdf(buildVerificationReportPayload())
                }
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] px-3 py-2 text-xs font-bold transition cursor-pointer shadow-xs"
                title="Export Verification Report to PDF"
              >
                <img
                  src="/icons/adobe-pdf.svg"
                  alt="PDF"
                  className="h-4 w-4 shrink-0 object-contain"
                />
                <span>Export PDF</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  exportReportToExcel(buildVerificationReportPayload())
                }
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#0b5336] hover:bg-[#08412a] text-white border border-[#08412a] px-3 py-2 text-xs font-bold transition cursor-pointer shadow-xs"
                title="Export Verification Report to Excel"
              >
                <img
                  src="/icons/microsoft-excel.svg"
                  alt="Excel"
                  className="h-4 w-4 shrink-0 object-contain"
                />
                <span>Export Excel</span>
              </button>
            </div>
          </div>

          {/* 2. Faculty List / Table View */}
          <div className="w-full overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs dark:shadow-none">
            <table className="w-full text-left border-collapse text-xs text-slate-800 dark:text-slate-300 min-w-[750px]">
              <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 uppercase tracking-wider text-[10px] text-slate-600 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-3 font-semibold w-10 text-center">
                    #
                  </th>
                  <th className="px-4 py-3 font-semibold">Faculty Member</th>
                  <th className="px-4 py-3 font-semibold">Program</th>
                  <th className="px-4 py-3 font-semibold">
                    Verification Progress
                  </th>
                  <th className="px-4 py-3 font-semibold text-center">
                    Overall Status
                  </th>
                  <th className="px-4 py-3 text-right font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                {filteredFaculty.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-12 text-center text-xs text-slate-500 dark:text-slate-400"
                    >
                      {statusFilter === "completed"
                        ? "No faculty accounts have completed all requirements yet."
                        : statusFilter === "optional_review"
                          ? "No faculty accounts currently have optional requirements awaiting review."
                          : statusFilter === "pending_review"
                            ? "No faculty accounts have submissions awaiting review."
                            : statusFilter === "needs_revision"
                              ? "No faculty accounts currently have requirements needing revision."
                              : statusFilter === "not_submitted"
                                ? "No faculty accounts with zero submissions found."
                                : "No faculty found matching the filter criteria."}
                    </td>
                  </tr>
                ) : (
                  filteredFaculty.map((faculty, index) => {
                    const statusRecord = facultyStatuses[faculty.id];
                    const statInfo = facultyStatusMap.get(faculty.id);
                    const validatedMandatoryCount =
                      statInfo?.validatedMandatoryCount ?? 0;
                    const totalMandatoryCount =
                      statInfo?.totalMandatoryCount ??
                      DEFAULT_REQUIREMENTS.length;
                    const totalValidatedCount =
                      statInfo?.totalValidatedCount ?? 0;
                    const overallStatus =
                      statInfo?.overallStatus ?? "Not Submitted";
                    const isNotSubmitted =
                      statInfo?.isNotSubmitted ??
                      (overallStatus === "Not Submitted" ||
                        statInfo?.category === "not_submitted");
                    const statusBadgeClass = statInfo?.statusBadgeClass ?? "";
                    const actionButtonText = isNotSubmitted
                      ? "Not Submitted Yet"
                      : (statInfo?.actionButtonText ?? "Review Requirements");
                    const actionButtonClass = isNotSubmitted
                      ? "bg-slate-100 text-slate-400 border border-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700 font-semibold cursor-not-allowed opacity-60 shadow-none"
                      : (statInfo?.actionButtonClass ??
                        "bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold");

                    const programCode =
                      faculty.program?.code || faculty.program?.name || "N/A";

                    return (
                      <tr
                        key={faculty.id}
                        onMouseEnter={() => {
                          if (!isNotSubmitted) {
                            void prefetchFacultySubmissions(faculty.id);
                          }
                        }}
                        className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition"
                      >
                        <td className="px-3 py-3 text-center text-xs font-mono text-slate-400 dark:text-slate-500">
                          {index + 1}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-200">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 shadow-sm">
                              {faculty.profileImageUrl ? (
                                <img
                                  src={faculty.profileImageUrl}
                                  alt={faculty.fullName}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <span>
                                  {buildFacultyInitials(faculty.fullName)}
                                </span>
                              )}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900 dark:text-slate-100">
                                {faculty.fullName}
                              </div>
                              {faculty.email ? (
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                                  {faculty.email}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium text-xs">
                          <span className="bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 px-2 py-0.5 text-xs font-semibold rounded-md inline-flex items-center">
                            {programCode}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                          {isLoadingStatuses &&
                          !facultySubjectProgress[faculty.id] &&
                          (!facultyClassProgress[faculty.id] ||
                            facultyClassProgress[faculty.id].length === 0) &&
                          !isNotSubmitted ? (
                            <div className="space-y-1.5 py-1">
                              <div className="h-4 w-28 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                              <div className="h-2 w-36 bg-slate-100 dark:bg-slate-800/60 rounded animate-pulse" />
                            </div>
                          ) : (
                            (() => {
                              const classList =
                                facultyClassProgress[faculty.id] || [];
                              const subjectProg =
                                facultySubjectProgress[faculty.id];
                              const totalClasses = subjectProg
                                ? subjectProg.totalSubjects
                                : classList.length;
                              const doneCount = subjectProg
                                ? subjectProg.doneSubjects
                                : classList.filter((c) => c.isDone).length;
                              const progressPct =
                                totalClasses > 0
                                  ? Math.round((doneCount / totalClasses) * 100)
                                  : 0;

                              if (totalClasses === 0) {
                                return (
                                  <div className="flex flex-col">
                                    <span className="text-xs text-slate-400 dark:text-slate-500 italic">
                                      No subjects assigned
                                    </span>
                                    {totalValidatedCount > 0 ? (
                                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                                        {totalValidatedCount} general
                                        requirements validated
                                      </span>
                                    ) : null}
                                  </div>
                                );
                              }

                              return (
                                <div
                                  className="flex flex-col gap-1.5 py-0.5 min-w-[140px] max-w-[260px]"
                                  title={classList
                                    .map(
                                      (c) =>
                                        `${c.subject_code}: ${c.isDone ? "Done" : "Not Done"}`,
                                    )
                                    .join(", ")}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                                      {doneCount}/{totalClasses}{" "}
                                      {totalClasses === 1
                                        ? "Subject"
                                        : "Subjects"}{" "}
                                      Done
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                                      {progressPct}%
                                    </span>
                                  </div>

                                  {/* Progress Track */}
                                  <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden border border-slate-200/60 dark:border-slate-700/60">
                                    <div
                                      className={`h-full rounded-full transition-all duration-300 ${
                                        doneCount === totalClasses &&
                                        totalClasses > 0
                                          ? "bg-[#0b5336]"
                                          : doneCount > 0
                                            ? "bg-amber-500"
                                            : "bg-transparent"
                                      }`}
                                      style={{ width: `${progressPct}%` }}
                                    />
                                  </div>

                                  {/* Only show chips for subjects that are Done when not yet fully completed */}
                                  {doneCount < totalClasses &&
                                  overallStatus !== "Completed / Validated" &&
                                  classList.filter((cls) => cls.isDone).length >
                                    0 ? (
                                    <div className="flex flex-wrap gap-1 pt-0.5">
                                      {classList
                                        .filter((cls) => cls.isDone)
                                        .map((cls) => (
                                          <span
                                            key={cls.id}
                                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10.5px] font-bold border transition-colors bg-emerald-50 dark:bg-emerald-950/40 text-[#0b5336] dark:text-emerald-300 border-emerald-300 dark:border-emerald-800/60"
                                            title={`${cls.subject_code} (${cls.section_code}): All requirements validated (Done)`}
                                          >
                                            <AppIcon
                                              icon={Check}
                                              size="xs"
                                              color="inherit"
                                              strokeWidth={2.5}
                                            />
                                            <span className="font-mono">
                                              {cls.subject_code}
                                            </span>
                                          </span>
                                        ))}
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })()
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium text-center">
                          {isLoadingStatuses && !statusRecord ? (
                            <div className="h-6 w-24 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse mx-auto" />
                          ) : (
                            <div className="flex items-center justify-center">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${statusBadgeClass}`}
                              >
                                {overallStatus === "Completed / Validated" ? (
                                  <AppIcon
                                    icon={CheckCircle}
                                    size="sm"
                                    color="white"
                                  />
                                ) : overallStatus === "Needs Revision" ? (
                                  <AppIcon
                                    icon={Xmark}
                                    size="sm"
                                    color="white"
                                    strokeWidth={2.5}
                                  />
                                ) : overallStatus ===
                                  "Optional Review Pending" ? (
                                  <AppIcon
                                    icon={Hourglass}
                                    size="sm"
                                    color="white"
                                  />
                                ) : overallStatus === "Pending Review" ? (
                                  <AppIcon
                                    icon={Hourglass}
                                    size="sm"
                                    color="inherit"
                                  />
                                ) : (
                                  <AppIcon
                                    icon={Minus}
                                    size="sm"
                                    color="inherit"
                                  />
                                )}
                                <span>{overallStatus}</span>
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            disabled={isNotSubmitted}
                            title={
                              isNotSubmitted
                                ? "This faculty member has not submitted any requirements yet"
                                : actionButtonText
                            }
                            onClick={() => {
                              if (isNotSubmitted) return;
                              openedFromRowFlag = true;
                              initialOpenedRef.current = faculty.id;
                              setReviewingFaculty(faculty);
                              onSelectFaculty?.(faculty.id);
                            }}
                            className={`${actionButtonClass} px-3.5 py-1.5 rounded-xl text-xs shadow-sm transition ${
                              isNotSubmitted
                                ? "cursor-not-allowed opacity-60"
                                : "active:scale-[0.98] cursor-pointer"
                            }`}
                          >
                            {actionButtonText}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
