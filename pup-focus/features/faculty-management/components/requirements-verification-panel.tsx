"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import Image from "next/image";
import JSZip from "jszip";
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
import {
  normalizeSemester,
} from "@/features/submissions/services/submission-window.service";
import { SubmissionStatusBadge } from "@/features/submissions/components/submission-status-badge";
import { OnlineDocumentPreview } from "@/features/submissions/components/online-document-preview";
import {
  DocumentPreviewModal,
  type DocumentPreviewSubmission,
} from "@/features/submissions/components/document-preview-modal";

export type DetectedFileType = "pdf" | "image" | "excel" | "word" | "other";

export function getFileType(fileNameOrUrl: string): {
  type: DetectedFileType;
  extension: string;
  isPdf: boolean;
  isImage: boolean;
  isExcel: boolean;
  isWord: boolean;
} {
  const cleanStr = (fileNameOrUrl || "").split("?")[0].split("#")[0].toLowerCase();
  const match = cleanStr.match(/\.([a-z0-9]+)$/i);
  const extension = match ? match[1].toLowerCase() : "";

  const isPdf = extension === "pdf";
  const isImage = ["png", "jpg", "jpeg", "webp", "gif", "bmp", "svg"].includes(extension);
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
  return name
    .replace(/^(?:v\d+_)?\d{10,}_/i, "")
    .replace(/^v\d+_/i, "");
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
  status: RequirementStatus | "rejected" | "needs_revision" | null | string
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
  status: RequirementStatus | "rejected" | "needs_revision" | null | string
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
    const s = raw.toLowerCase().trim().replace(/[-_\s]+/g, "");
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
  const clean = code.toLowerCase().trim().replace(/[-_\s]+/g, "");
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
  targetSem: SemesterOption
): boolean {
  if (!s) return false;

  // If the submission has explicit term metadata, verify it matches
  const directAy = s.academic_year || s.academicYear || s.faculty_assignment?.academic_year;
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

export function FacultyVerificationDrawer({
  faculty,
  academicYear,
  semester,
  initialTab = "current",
  initialRequirementCode,
  requirementTemplates: requirementTemplatesProp,
  onClose,
  onBack,
  onStatusUpdated,
}: FacultyVerificationDrawerProps) {
  const activeAy = academicYear || "2026-2027";
  const activeSem = semester || "1st Semester";
  const [activeTab, setActiveTab] = useState<"current" | "history">(initialTab);
  const [submissions, setSubmissions] = useState<FacultyRequirementSubmission[]>([]);
  const [facultyClasses, setFacultyClasses] = useState<
    Array<{
      id: string;
      subject_code: string;
      description: string;
      units: number;
      section_code: string;
    }>
  >([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reviewingCode, setReviewingCode] = useState<string | null>(null);
  const [submittingAction, setSubmittingAction] = useState<"validate" | "revision" | null>(null);
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
                }))
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
  }, []);

  // History Tab States
  const [historySubmissions, setHistorySubmissions] = useState<FacultyRequirementSubmission[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyAcademicYears, setHistoryAcademicYears] = useState<string[]>([]);
  const [selectedHistoryAy, setSelectedHistoryAy] = useState<string>(
    initialTab === "history" ? activeAy : ""
  );
  const [selectedHistorySem, setSelectedHistorySem] = useState<SemesterOption>(
    initialTab === "history" ? activeSem : "1st Semester"
  );
  const [isDownloadingHistoryZip, setIsDownloadingHistoryZip] = useState(false);

  // Revision Request Modal States
  const [revisionModalData, setRevisionModalData] = useState<{
    submissionId: string;
    code: string;
    reqLabel: string;
  } | null>(null);
  const [revisionInputText, setRevisionInputText] = useState("");
  const [isSubmittingRevision, setIsSubmittingRevision] = useState(false);

  // Single Requirement Validate Modal States
  const [validateModalData, setValidateModalData] = useState<{
    submissionId: string;
    code: string;
    reqLabel: string;
  } | null>(null);
  const [validateInputText, setValidateInputText] = useState("");
  const [isValidatingSingle, setIsValidatingSingle] = useState(false);

  const [previewSubmission, setPreviewSubmission] =
    useState<DocumentPreviewSubmission | null>(null);

  const [remarksInput, setRemarksInput] = useState<Record<string, string>>({});
  const [actionFeedback, setActionFeedback] = useState<{
    type: "info" | "success" | "error";
    message: string;
  } | null>(null);

  const [isValidateModalOpen, setIsValidateModalOpen] = useState(false);
  const [bulkValidateNotes, setBulkValidateNotes] = useState("");
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

  // Reset selected class whenever faculty or active term changes
  useEffect(() => {
    setSelectedClassId(null);
  }, [faculty.id, academicYear, semester]);


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
        (d) => (d.decision || "").toLowerCase() === "rejected"
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
      return matchesTerm && (sLower === "rejected" || sLower === "needs_revision");
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
      if (!seenCodes.has(tpl.code)) {
        items.push({
          code: tpl.code,
          title: tpl.title || getFriendlyRequirementName(tpl.code),
          isMandatory: tpl.is_mandatory ?? true,
        });
        seenCodes.add(tpl.code);
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
      if (rawCode && !seenCodes.has(rawCode)) {
        items.push({
          code: rawCode,
          title: getFriendlyRequirementName(rawCode),
          isMandatory: false,
        });
        seenCodes.add(rawCode);
      }
    }

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
      if (sub.faculty_class && Boolean((sub.faculty_class as any).is_archived)) {
        return;
      }

      let target: SubmissionClassGroup | undefined;
      if (sub.class_id && classMap.has(sub.class_id)) {
        target = classMap.get(sub.class_id);
      } else if (sub.faculty_class) {
        const key = sub.faculty_class.id || `${sub.faculty_class.section_code}_${sub.faculty_class.subject_code}`;
        target = classMap.get(key);
      }

      if (target) {
        target.submissions.push(sub);
      } else if (!sub.class_id) {
        // Only classify as General Requirements if the submission does not belong to any class
        unassignedSubmissions.push(sub);
      }
    });

    // 4. Provide the General Requirements group only if genuine unassigned general submissions exist
    if (unassignedSubmissions.length > 0) {
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
        (g) => g.key === selectedClassId || (g.classId && g.classId === selectedClassId)
      ) || null
    );
  }, [selectedClassId, classGroups]);

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
        (d) => (d.decision || "").toLowerCase() === "rejected"
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
      return matchesTerm && (sLower === "rejected" || sLower === "needs_revision");
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
            (s as { requirement_id?: string }).requirement_id
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
        (d) => (d.decision || "").toLowerCase() === "rejected"
      );
      const isRevisionUploaded =
        isPending &&
        (hasPriorRejection || (matchingSub?.document_versions || []).length > 1);

      if (filterMode === "pending") return isPending;
      if (filterMode === "revision_uploaded") return isRevisionUploaded;
      if (filterMode === "validated") return isValidated;
      if (filterMode === "revision") return isRevision;
      return true;
    });
  }, [selectedGroup, allRequirements, filterMode, academicYear, semester]);

  // Highlight and scroll to target requirement if requested
  useEffect(() => {
    if (!initialRequirementCode || isLoading || classGroups.length === 0) return;
    if (!selectedClassId) {
      const matchedGroup = classGroups.find((g) =>
        g.submissions.some((s) => {
          const codeMatched =
            matchRequirementCode(
              s.requirement_code,
              (s as { requirement_id?: string }).requirement_id
            ) === initialRequirementCode || s.requirement_code === initialRequirementCode;
          return codeMatched;
        })
      );
      setSelectedClassId(matchedGroup ? matchedGroup.key : classGroups[0].key);
      return;
    }
    const timeout = setTimeout(() => {
      const element = document.getElementById(`req-row-${initialRequirementCode}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        element.classList.add("ring-2", "ring-amber-400", "bg-amber-500/15", "dark:bg-amber-500/25");
        const removeTimeout = setTimeout(() => {
          element.classList.remove("ring-2", "ring-amber-400", "bg-amber-500/15", "dark:bg-amber-500/25");
        }, 4000);
        return () => clearTimeout(removeTimeout);
      }
    }, 450);
    return () => clearTimeout(timeout);
  }, [initialRequirementCode, isLoading, classGroups, selectedClassId]);

  const refreshCurrentSubmissions = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!faculty.id) {
        if (!options?.silent) setIsLoading(false);
        return;
      }
      if (!options?.silent) {
        setIsLoading(true);
      }
      try {
        const subRes = await fetch(
          `/api/staff/faculty/submissions?facultyId=${encodeURIComponent(faculty.id)}&academicYear=${encodeURIComponent(activeAy)}&semester=${encodeURIComponent(activeSem)}&_t=${Date.now()}`,
          { credentials: "include", cache: "no-store" }
        );

        if (subRes.ok) {
          const subData = await subRes.json();
          setSubmissions(subData.submissions || []);
          if (Array.isArray(subData.classes)) {
            setFacultyClasses(subData.classes);
          }
        }
      } catch (err) {
        console.error("Failed to load current submissions:", err);
      } finally {
        if (!options?.silent) {
          setIsLoading(false);
        }
      }
    },
    [faculty.id, activeAy, activeSem]
  );

  // 1. Fetch current term submissions (only on faculty/term change, without retriggering on history state updates)
  useEffect(() => {
    void refreshCurrentSubmissions();
  }, [refreshCurrentSubmissions]);

  // 2. Fetch history academic years once on mount (isolated from current submissions to prevent double reload)
  useEffect(() => {
    let isCancelled = false;
    async function loadHistoryMetadata() {
      if (!faculty.id) return;
      try {
        const verRes = await fetch(
          `/api/staff/faculty/requirements/verification?facultyId=${encodeURIComponent(faculty.id)}&academicYear=${encodeURIComponent(activeAy)}&semester=${encodeURIComponent(activeSem)}`,
          { credentials: "include" }
        );

        if (verRes.ok && !isCancelled) {
          const verData = await verRes.json();
          const years: string[] = verData.availableAcademicYears ?? [];
          if (years.length > 0) {
            setHistoryAcademicYears(Array.from(new Set([...years, activeAy])).sort().reverse());
            setSelectedHistoryAy((prev) => {
              if (prev) return prev;
              const pastYear =
                years.find((y) => y !== activeAy) || years[0] || "2025-2026";
              return pastYear;
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
  }, [faculty.id, activeAy, activeSem]);

  const refreshHistorySubmissions = useCallback(
    async (options?: { silent?: boolean }) => {
      if (activeTab !== "history" || !faculty.id || !selectedHistoryAy || !selectedHistorySem) return;
      if (!options?.silent) {
        setIsLoadingHistory(true);
      }
      try {
        const res = await fetch(
          `/api/staff/faculty/submissions?facultyId=${encodeURIComponent(faculty.id)}&academicYear=${encodeURIComponent(selectedHistoryAy)}&semester=${encodeURIComponent(selectedHistorySem)}&_t=${Date.now()}`,
          { credentials: "include", cache: "no-store" }
        );
        if (res.ok) {
          const data = await res.json();
          setHistorySubmissions(data.submissions || []);
        }
      } catch (err) {
        console.error("Failed to load history submissions:", err);
      } finally {
        if (!options?.silent) {
          setIsLoadingHistory(false);
        }
      }
    },
    [activeTab, faculty.id, selectedHistoryAy, selectedHistorySem]
  );

  // 3. Fetch history submissions on-demand when history tab is active
  useEffect(() => {
    void refreshHistorySubmissions();
  }, [refreshHistorySubmissions]);

  // 4. Realtime synchronization for subjects (faculty_classes) & requirement uploads (submissions)
  useRealtimeSync(() => {
    void refreshCurrentSubmissions({ silent: true });
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
            faculty.id
          )}&academicYear=${encodeURIComponent(
            activeAy
          )}&semester=${encodeURIComponent(activeSem)}`,
          { credentials: "include", cache: "no-store" }
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
              faculty.id
            )}&academicYear=${encodeURIComponent(
              selectedHistoryAy
            )}&semester=${encodeURIComponent(selectedHistorySem)}`,
            { credentials: "include", cache: "no-store" }
          );
          if (res.ok) {
            const data = await res.json();
            setHistorySubmissions(data.submissions || []);
          }
        }
      }
      onStatusUpdated?.();
      setActionFeedback({
        type: "info",
        message: "Requirements data refreshed successfully.",
      });
      setTimeout(() => setActionFeedback(null), 3000);
    } catch (err) {
      console.error("Failed to refresh requirements:", err);
      setActionFeedback({
        type: "error",
        message: "Failed to refresh requirements. Please try again.",
      });
      setTimeout(() => setActionFeedback(null), 3000);
    } finally {
      setIsRefreshing(false);
    }
  };

  const openValidateModal = (
    submissionId: string,
    code: string,
    reqLabel: string
  ) => {
    setValidateModalData({
      submissionId,
      code,
      reqLabel,
    });
    setValidateInputText("");
  };

  const handleSendValidateRequest = async () => {
    if (!validateModalData) return;
    setIsValidatingSingle(true);
    try {
      await handleReviewSubmission(
        validateModalData.submissionId,
        "validated",
        validateModalData.code,
        validateInputText
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
    existingRemarks: string = ""
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
    customRemarks?: string
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
              : sub
          )
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
        revisionInputText
      );
      setRevisionModalData(null);
    } finally {
      setIsSubmittingRevision(false);
    }
  };

  async function handleSingleFileDownload(
    storagePath?: string | null,
    fileName: string = "Document"
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
      message: `Fetching file "${fileName}"...`,
      progressText: "Preparing download...",
    });

    try {
      const downloadUrl = `/api/storage/download?path=${encodeURIComponent(
        storagePath
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
      const zipFilename = `${faculty.fullName}_${academicYear}_${semester}${classSuffix}_Requirements.zip`.replace(
        /[\\/:*?"<>|]+/g,
        "_"
      );

      // Check uploaded requirement files
      const targetSubmissions = selectedGroup ? selectedGroup.submissions : submissions;
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
        0
      );

      for (const sub of uploadedSubmissions) {
        const label = getFriendlyRequirementName(sub.requirement_code);
        const docs = sub.document_versions || [];
        const classFolder = sub.faculty_class
          ? `${sub.faculty_class.section_code}_${sub.faculty_class.subject_code}`.replace(/[\\/:*?"<>|]+/g, "_")
          : "General_Requirements";

        for (const doc of docs) {
          if (!doc.storage_path) continue;
          processedCount++;
          setZipProgressData({
            status: "zipping",
            title: "Packaging Requirements (ZIP)",
            message: `Fetching "${label}" (${classFolder})...`,
            progressText: `Processing file ${processedCount} of ${totalCount}...`,
          });

          const downloadUrl = `/api/storage/download?path=${encodeURIComponent(
            doc.storage_path
          )}`;
          const fileRes = await fetch(downloadUrl);
          if (fileRes.ok) {
            const fileBlob = await fileRes.blob();
            const ext = doc.storage_path.match(/\.[^.]+$/)?.[0] || ".pdf";
            const fileName = `${label}${ext}`;
            zip.file(`${classFolder}/${label}/${fileName}`, fileBlob);
          }
        }
      }

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
    } catch (err) {
      console.error("ZIP download failed:", err);
      setZipProgressData({
        status: "error",
        title: "Download Error",
        message: "Failed to generate requirement ZIP package. Please try again.",
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
      const zipFilename = `${sanitizedName}_Requirements_${selectedHistoryAy}_${selectedHistorySem}.zip`.replace(
        /[\\/:*?"<>|]+/g,
        "_"
      );

      const historySubmissionsWithDocs = historySubmissions.filter(
        (s) => Array.isArray(s.document_versions) && s.document_versions.length > 0
      );

      if (historySubmissionsWithDocs.length === 0) {
        setNoticeModalData({
          title: "No Downloadable Requirements",
          message: `There are no uploaded requirement files available for download for ${faculty.fullName} for A.Y. ${selectedHistoryAy} • ${selectedHistorySem}.`,
        });
        return;
      }

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
        0
      );

      for (const sub of historySubmissionsWithDocs) {
        const label = getFriendlyRequirementName(sub.requirement_code);
        const docs = sub.document_versions || [];

        for (const doc of docs) {
          if (!doc.storage_path) continue;
          processedCount++;
          setZipProgressData({
            status: "zipping",
            title: "Packaging History ZIP",
            message: `Fetching "${label}"...`,
            progressText: `Processing file ${processedCount} of ${totalCount}...`,
          });

          const downloadUrl = `/api/storage/download?path=${encodeURIComponent(
            doc.storage_path
          )}`;
          const fileRes = await fetch(downloadUrl);
          if (fileRes.ok) {
            const fileBlob = await fileRes.blob();
            const ext = doc.storage_path.match(/\.[^.]+$/)?.[0] || ".pdf";
            const fileName = `${label}${ext}`;
            zip.file(`${label}/${fileName}`, fileBlob);
          }
        }
      }

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
    } catch (err) {
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
    const targetSource = selectedGroup ? selectedGroup.submissions : submissions;
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
    setValidateTimerSeconds(5);
    setIsValidateModalOpen(true);
  }

  async function executeValidateAllPending() {
    const targetSource = selectedGroup ? selectedGroup.submissions : submissions;
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
          })
        )
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
            : sub
        )
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

  const departmentLabel =
    faculty.program?.name || faculty.program?.code || "Department";

  return (
    <div className="space-y-4">
      {/* Solid Amber Card Header matching Documents to be Submitted - Swapped to the top */}
      <div className="relative overflow-hidden rounded-2xl border-2 border-amber-500 dark:border-amber-500/70 bg-amber-400 dark:bg-[#2a1705] p-5 sm:p-6 shadow-md shadow-amber-500/10 space-y-3 transition-colors">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-950 dark:text-amber-100 tracking-tight">
              Assigned Classes &amp; Subject Loads
            </h1>
          </div>
          <p className="mt-1.5 text-sm sm:text-base text-amber-950/90 dark:text-amber-200/90 font-medium leading-relaxed">
            Select a class load below to review and verify submitted requirements for A.Y. {academicYear} &bull; {semester}.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-0.5">
          <p className="text-xs sm:text-sm text-amber-950/90 dark:text-amber-300/80 font-semibold">
            A.Y. {academicYear} • {semester} &bull; {classGroups.length} Registered Class Load{classGroups.length === 1 ? "" : "s"}
          </p>

          <div className="flex items-center gap-2">
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
              <AppIcon icon={Download} size="xs" color="inherit" className="text-slate-950" />
              <span>{isDownloadingZip ? "Zipping..." : "Download All (ZIP)"}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="w-full flex flex-col rounded-2xl border-2 border-amber-400 dark:border-amber-500/60 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs transition-all animate-in fade-in duration-150 overflow-hidden">
        <AlertPopup
          type={actionFeedback?.type}
          message={actionFeedback?.message}
          onClose={() => setActionFeedback(null)}
        />
        {/* Inline Section Header - Only visible when in Class Selection Step */}
        {selectedClassId === null ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800/80 px-6 py-4 bg-slate-50/50 dark:bg-slate-950/30 rounded-t-2xl">
            <div className="flex items-center gap-3.5 flex-wrap">
              <button
                type="button"
                onClick={handleClose}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
                title="Return to Faculty List"
              >
                <AppIcon icon={NavArrowLeft} size="sm" color="white" />
                <span>Back to Faculty List</span>
              </button>
              <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 shadow-2xs">
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
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      {faculty.fullName}
                    </h3>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                      {departmentLabel}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Active Term: A.Y. {academicYear} &bull; {semester}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Tab Switcher */}
        <div className="border-b border-slate-200 dark:border-slate-800/80 px-6 py-3 bg-white dark:bg-slate-900">
          <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-950/80 rounded-2xl border border-slate-200/80 dark:border-slate-800/80">
            <button
              type="button"
              onClick={() => setActiveTab("current")}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold transition cursor-pointer ${
                activeTab === "current"
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-2xs font-bold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <span>Current Submissions</span>
              {pendingSubmissionsCount > 0 ? (
                <span className="inline-flex items-center justify-center rounded-full bg-amber-500 text-slate-950 px-2 py-0.5 text-xs font-bold leading-none">
                  {pendingSubmissionsCount}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("history");
                if (historySubmissions.length === 0) {
                  setIsLoadingHistory(true);
                }
              }}
              className={`rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold transition cursor-pointer ${
                activeTab === "history"
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-2xs font-bold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              Verification History
            </button>
          </div>
        </div>

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
              <div className="space-y-5 pt-1">
                {/* Responsive Grid of Class Cards */}
                {classGroups.length === 0 ? (
                  <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs py-14 text-center text-slate-500 dark:text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                      <AppIcon icon={InfoCircle} size="lg" color="muted" />
                      <h5 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                        No Classes Registered
                      </h5>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        This faculty member does not have any classes or subject loads assigned for A.Y. {academicYear} &bull; {semester}.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 pt-3">
                    {classGroups.map((group) => {
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

                      const totalReqs = allRequirements.length;
                      const progressPct = totalReqs > 0 ? Math.round((groupValidatedCount / totalReqs) * 100) : 0;

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
                              <AppIcon icon={Folder} size="xs" color="inherit" />
                              <span className="truncate max-w-[150px]">
                                {group.isGeneral ? "General Requirements" : group.sectionCode}
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
                                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-300 px-2.5 py-0.5 text-[10.5px] font-bold">
                                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                                        {groupPendingCount} Pending
                                      </span>
                                    )}
                                    {groupRevisionCount > 0 && (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-800 dark:text-rose-300 px-2.5 py-0.5 text-[10.5px] font-bold">
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
                                      {group.isGeneral ? "General Requirements" : group.subjectCode}
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
                                      {progressPct}% ({groupValidatedCount}/{totalReqs} Validated)
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
                                <div className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/20 group-hover:bg-amber-400 group-hover:border-amber-400 transition-all duration-200">
                                  <span className="text-xs font-bold text-amber-900 dark:text-amber-200 group-hover:text-slate-950 flex items-center gap-2">
                                    <AppIcon icon={Folder} size="xs" color="inherit" />
                                    <span>View & Verify Documents</span>
                                  </span>
                                  <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-white dark:bg-slate-900 group-hover:bg-slate-950 text-amber-700 dark:text-amber-400 group-hover:text-amber-300 transition-colors shadow-2xs">
                                    <AppIcon icon={NavArrowRight} size="xs" color="inherit" />
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
                {/* Top Navigation Bar: Back Button, Header Banner & Dropdown Switcher */}
                <div className="rounded-2xl border-2 border-amber-400/80 dark:border-amber-500/60 bg-amber-50/80 dark:bg-amber-950/20 p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => setSelectedClassId(null)}
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
                              <span>{buildFacultyInitials(faculty.fullName)}</span>
                            )}
                          </div>
                          <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            {faculty.fullName}
                          </span>
                        </div>

                        <span className="text-slate-400 dark:text-slate-600 font-bold hidden sm:inline">&bull;</span>

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
                            {selectedGroup.subjectCode} &bull; {selectedGroup.description}
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
                            {g.isGeneral ? "General Requirements" : `${g.sectionCode} • ${g.subjectCode}`}
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
                          : "bg-white text-slate-600 hover:border-amber-500/50 hover:bg-amber-50/40 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-amber-950/20 border border-slate-200 dark:border-slate-800"
                      }`}
                    >
                      <span
                        className={`inline-flex items-center justify-center h-4 w-4 rounded-full shrink-0 shadow-2xs [&>svg]:h-2.5 [&>svg]:w-2.5 ${
                          filterMode === "all"
                            ? "bg-slate-950/20 text-slate-950 border border-slate-950/30"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700"
                        }`}
                      >
                        <AppIcon icon={Page} size="xs" color="inherit" />
                      </span>
                      <span>All Files</span>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10.5px] font-bold ${
                          filterMode === "all"
                            ? "bg-slate-950/20 text-slate-950"
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
                          ? "bg-amber-500 text-slate-950 shadow-xs font-bold"
                          : "bg-white text-slate-600 hover:border-amber-500/50 hover:bg-amber-50/40 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-amber-950/20 border border-slate-200 dark:border-slate-800"
                      }`}
                    >
                      <span
                        className={`inline-flex items-center justify-center h-4 w-4 rounded-full shrink-0 shadow-2xs [&>svg]:h-2.5 [&>svg]:w-2.5 ${
                          filterMode === "pending"
                            ? "bg-slate-950/20 text-slate-950 border border-slate-950/30"
                            : "bg-amber-500 text-slate-950 border border-amber-600"
                        }`}
                      >
                        <AppIcon icon={Hourglass} size="xs" color="inherit" />
                      </span>
                      <span>Need Review</span>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10.5px] font-bold ${
                          filterMode === "pending"
                            ? "bg-slate-950/20 text-slate-950"
                            : "bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300"
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
                            ? "bg-amber-500 text-slate-950 font-bold shadow-xs"
                            : "bg-white text-slate-600 hover:border-amber-500/50 hover:bg-amber-50/40 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-amber-950/20 border border-slate-200 dark:border-slate-800"
                        }`}
                      >
                        <span
                          className={`inline-flex items-center justify-center h-4 w-4 rounded-full shrink-0 shadow-2xs [&>svg]:h-2.5 [&>svg]:w-2.5 ${
                            filterMode === "revision_uploaded"
                              ? "bg-slate-950/20 text-slate-950 border border-slate-950/30"
                              : "bg-amber-500 text-slate-950 border border-amber-600"
                          }`}
                        >
                          <AppIcon icon={WarningCircle} size="xs" color="inherit" />
                        </span>
                        <span>Revisions Uploaded</span>
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[10.5px] font-bold ${
                            filterMode === "revision_uploaded"
                              ? "bg-slate-950/20 text-slate-950"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
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
                          ? "bg-[#0b5336] text-white shadow-xs ring-1 ring-[#08412a] font-bold"
                          : "bg-white text-slate-600 hover:border-emerald-500/50 hover:bg-emerald-50/40 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-emerald-950/20 border border-slate-200 dark:border-slate-800"
                      }`}
                    >
                      <span
                        className={`inline-flex items-center justify-center h-4 w-4 rounded-full shrink-0 shadow-2xs [&>svg]:h-2.5 [&>svg]:w-2.5 ${
                          filterMode === "validated"
                            ? "bg-white/20 text-white border border-white/30"
                            : "bg-[#0b5336] text-white border border-[#08412a]"
                        }`}
                      >
                        <AppIcon icon={Check} size="xs" color="white" strokeWidth={2.5} />
                      </span>
                      <span>Validated</span>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10.5px] font-bold ${
                          filterMode === "validated"
                            ? "bg-white/20 text-white"
                            : "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300"
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
                            ? "bg-[#780000] text-white shadow-xs ring-1 ring-[#5e0000] font-bold"
                            : "bg-white text-slate-600 hover:border-rose-500/50 hover:bg-rose-50/40 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-rose-950/20 border border-slate-200 dark:border-slate-800"
                        }`}
                      >
                        <span
                          className={`inline-flex items-center justify-center h-4 w-4 rounded-full shrink-0 shadow-2xs [&>svg]:h-2.5 [&>svg]:w-2.5 ${
                            filterMode === "revision"
                              ? "bg-white/20 text-white border border-white/30"
                              : "bg-[#780000] text-white border border-[#5e0000]"
                          }`}
                        >
                          <AppIcon icon={Xmark} size="xs" color="white" strokeWidth={2.5} />
                        </span>
                        <span>Needs Revision</span>
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[10.5px] font-bold ${
                            filterMode === "revision"
                              ? "bg-white/20 text-white"
                              : "bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300"
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
                      disabled={isRefreshing || isLoading}
                      onClick={handleRefresh}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer shadow-xs active:scale-[0.98] whitespace-nowrap"
                      title="Refresh current submissions"
                    >
                      <SystemRestart
                        className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`}
                      />
                      <span>{isRefreshing ? "Refreshing..." : "Refresh"}</span>
                    </button>

                    <button
                      type="button"
                      disabled={isValidatingAll || selectedGroupPendingCount === 0}
                      onClick={triggerValidateAllPendingModal}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#0b5336] hover:bg-[#073d2a] text-white border border-[#08412a] px-3 py-1.5 text-xs font-semibold whitespace-nowrap shadow-2xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-white/20 text-white border border-white/30 shrink-0 shadow-2xs [&>svg]:h-2.5 [&>svg]:w-2.5">
                        <AppIcon icon={Check} size="xs" color="white" strokeWidth={2.5} />
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
                      <AppIcon icon={Download} size="xs" color="inherit" className="text-slate-950" />
                      <span>{isDownloadingZip ? "Zipping..." : "Download ZIP"}</span>
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
                  <div className="overflow-hidden rounded-2xl border-2 border-amber-400 dark:border-amber-500/60 bg-white dark:bg-slate-900 shadow-xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300 min-w-[880px]">
                        <thead className="bg-slate-50/60 dark:bg-slate-950/50 border-b border-slate-200/80 dark:border-slate-800/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          <tr>
                            <th className="px-4 py-2.5 w-[26%]">Requirement</th>
                            <th className="px-3 py-2.5 w-[12%] text-center">Type</th>
                            <th className="px-4 py-2.5 w-[24%]">Attached File</th>
                            <th className="px-4 py-2.5 w-[22%]">Notes &amp; Feedback</th>
                            <th className="px-4 py-2.5 w-[16%] text-center">Status &amp; Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                          {selectedGroupRequirements.map((req) => {
                            const code = req.code;
                            const reqLabel = req.title;
                            const isMandatory = req.isMandatory;
                            const matchingSubmission = selectedGroup.submissions.find((s) => {
                                const codeMatched =
                                  matchRequirementCode(
                                    s.requirement_code,
                                    (s as { requirement_id?: string }).requirement_id
                                  ) === code || s.requirement_code === code;
                                return (
                                  codeMatched &&
                                  doesSubmissionMatchTerm(s, academicYear, semester)
                                );
                              });

                              const documents =
                                matchingSubmission?.document_versions ?? [];
                              const firstDoc = documents[0] ?? null;

                              const rawStatus = matchingSubmission
                                ? (matchingSubmission.status || "").toLowerCase()
                                : "not_submitted";
                              const isValidated =
                                rawStatus === "validated" || rawStatus === "approved";
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
                                (d) => (d.decision || "").toLowerCase() === "rejected"
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
                                    firstDoc!.storage_path
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
                                      matchingSubmission.created_at
                                  )
                                : null;

                              const adminNote =
                                matchingSubmission?.review_decisions?.[0]?.remarks ||
                                matchingSubmission?.admin_remarks;
                              const rawFacultyNote =
                                matchingSubmission?.notes ||
                                matchingSubmission?.remarks;
                              const facultyNote = rawFacultyNote || null;
                              const priorRejectionDecision = (
                                matchingSubmission?.review_decisions || []
                              ).find(
                                (d) => (d.decision || "").toLowerCase() === "rejected"
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
                                  <td className="px-4 py-3.5 align-middle">
                                    <div className="space-y-1">
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
                                  <td className="px-3 py-3.5 align-middle text-center">
                                    {isMandatory ? (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-[#780000] text-white border border-[#5e0000] shadow-2xs">
                                        Required
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-700 text-white border border-slate-600 shadow-2xs">
                                        Optional
                                      </span>
                                    )}
                                  </td>

                                  {/* Column 3: Attached File */}
                                  <td className="px-4 py-3.5 align-middle">
                                    {hasFile && fileDownloadUrl ? (
                                      <div className="space-y-1.5">
                                        <div>
                                          <span
                                            className="font-medium text-slate-900 dark:text-slate-100 truncate block text-xs leading-snug max-w-[200px] xl:max-w-[260px]"
                                            title={rawFileName}
                                          >
                                            {fileName}
                                          </span>
                                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                                            {fileSize ? <span>{fileSize}</span> : null}
                                            {isRevisionUploaded ? (
                                              <span className="font-sans font-bold text-amber-600 dark:text-amber-400">
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
                                                fileSize: firstDoc?.size_bytes || null,
                                                storagePath: firstDoc?.storage_path,
                                                fileUrl: fileDownloadUrl || undefined,
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
                                                  matchingSubmission?.review_decisions?.[0]
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
                                                    isRevisionRequested
                                                ),
                                                isRevision: isRevisionUploaded,
                                              });
                                            }}
                                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-750 dark:text-slate-200 px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer shadow-2xs"
                                            title="Preview File"
                                          >
                                            <AppIcon icon={Eye} size="sm" color="inherit" />
                                            <span>Preview</span>
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleSingleFileDownload(
                                                firstDoc?.storage_path,
                                                fileName
                                              )
                                            }
                                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-slate-300 px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer shadow-2xs"
                                            title="Download File"
                                          >
                                            <AppIcon icon={Download} size="sm" color="inherit" />
                                            <span>Download</span>
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <span className="text-xs text-slate-400 dark:text-slate-500 italic block">
                                        No file attached
                                      </span>
                                    )}
                                  </td>

                                  {/* Column 3: Notes & Feedback */}
                                  <td className="px-4 py-3.5 align-middle">
                                    {facultyNote ||
                                    isRevisionRequested ||
                                    (isValidated && adminNote) ||
                                    (isRevisionUploaded && priorRejectionNote) ? (
                                      <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/60 p-2.5 text-xs max-w-[320px] space-y-1.5 shadow-2xs">
                                        {facultyNote ? (
                                          <div className="flex items-start gap-1.5 leading-snug">
                                            <span className="font-bold text-[10.5px] text-amber-700 dark:text-amber-400 shrink-0 mt-0.5 flex items-center gap-1.5">
                                              <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 shrink-0 shadow-2xs [&>svg]:h-2.5 [&>svg]:w-2.5">
                                                <AppIcon icon={ChatBubble} size="xs" color="active" />
                                              </span>
                                              {isRevisionUploaded
                                                ? "Faculty Remarks (Revision):"
                                                : "Faculty Remarks:"}
                                            </span>
                                            <p
                                              className="text-slate-700 dark:text-slate-300 italic line-clamp-2"
                                              title={facultyNote}
                                            >
                                              &ldquo;{facultyNote}&rdquo;
                                            </p>
                                          </div>
                                        ) : null}

                                        {isRevisionUploaded && priorRejectionNote ? (
                                          <div
                                            className={`flex items-start gap-1.5 leading-snug ${
                                              facultyNote
                                                ? "pt-1.5 border-t border-slate-200/70 dark:border-slate-800/80"
                                                : ""
                                            }`}
                                          >
                                            <span className="font-bold text-[10.5px] text-[#780000] dark:text-rose-400 shrink-0 mt-0.5 flex items-center gap-1.5">
                                              <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-[#780000]/15 dark:bg-[#780000]/30 text-[#780000] dark:text-rose-400 border border-[#780000]/30 shrink-0 shadow-2xs [&>svg]:h-2.5 [&>svg]:w-2.5">
                                                <AppIcon
                                                  icon={Xmark}
                                                  size="xs"
                                                  color="danger"
                                                  strokeWidth={2.5}
                                                />
                                              </span>
                                              Prior Revision Request:
                                            </span>
                                            <p
                                              className="text-slate-700 dark:text-slate-300 italic line-clamp-2"
                                              title={priorRejectionNote}
                                            >
                                              &ldquo;{priorRejectionNote}&rdquo;
                                            </p>
                                          </div>
                                        ) : isRevisionRequested ? (
                                          <div
                                            className={`flex items-start gap-1.5 leading-snug ${
                                              facultyNote
                                                ? "pt-1.5 border-t border-slate-200/70 dark:border-slate-800/80"
                                                : ""
                                            }`}
                                          >
                                            <span className="font-bold text-[10.5px] text-[#780000] dark:text-rose-400 shrink-0 mt-0.5 flex items-center gap-1.5">
                                              <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-[#780000]/15 dark:bg-[#780000]/30 text-[#780000] dark:text-rose-400 border border-[#780000]/30 shrink-0 shadow-2xs [&>svg]:h-2.5 [&>svg]:w-2.5">
                                                <AppIcon
                                                  icon={Xmark}
                                                  size="xs"
                                                  color="danger"
                                                  strokeWidth={2.5}
                                                />
                                              </span>
                                              Revision Sent:
                                            </span>
                                            <p
                                              className="text-slate-700 dark:text-slate-300 italic line-clamp-2"
                                              title={adminNote || ""}
                                            >
                                              &ldquo;
                                              {adminNote ||
                                                "Please review and re-upload the corrected requirement document."}
                                              &rdquo;
                                            </p>
                                          </div>
                                        ) : isValidated && adminNote ? (
                                          <div
                                            className={`flex items-start gap-1.5 leading-snug ${
                                              facultyNote
                                                ? "pt-1.5 border-t border-slate-200/70 dark:border-slate-800/80"
                                                : ""
                                            }`}
                                          >
                                            <span className="font-bold text-[10.5px] text-[#0b5336] dark:text-emerald-400 shrink-0 mt-0.5 flex items-center gap-1.5">
                                              <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-[#0b5336]/15 dark:bg-[#0b5336]/30 text-[#0b5336] dark:text-emerald-400 border border-[#0b5336]/30 shrink-0 shadow-2xs [&>svg]:h-2.5 [&>svg]:w-2.5">
                                                <AppIcon
                                                  icon={Check}
                                                  size="xs"
                                                  color="success"
                                                  strokeWidth={2.5}
                                                />
                                              </span>
                                              Validated Remarks:
                                            </span>
                                            <p
                                              className="text-slate-700 dark:text-slate-300 italic line-clamp-2"
                                              title={adminNote}
                                            >
                                              &ldquo;{adminNote}&rdquo;
                                            </p>
                                          </div>
                                        ) : null}
                                      </div>
                                    ) : (
                                      <span className="text-slate-400 dark:text-slate-600 text-xs italic block">
                                        &mdash;
                                      </span>
                                    )}
                                  </td>

                                  {/* Column 4: Status / Action */}
                                  <td className="px-4 py-3.5 align-middle text-center">
                                    {isValidated ? (
                                      <div className="flex items-center justify-center">
                                        <SubmissionStatusBadge status="Validated" size="md" />
                                      </div>
                                    ) : isRevisionRequested ? (
                                      <div className="flex items-center justify-center">
                                        <SubmissionStatusBadge status="Needs Revision" size="md" />
                                      </div>
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
                                              reqLabel
                                            )
                                          }
                                          title="Validate Requirement"
                                          aria-label="Validate Requirement"
                                          className="inline-flex items-center justify-center h-8 w-8 rounded-full border border-[#08412a] bg-[#0b5336] hover:bg-[#073d2a] text-white shadow-2xs transition-all hover:scale-110 active:scale-95 disabled:opacity-50 cursor-pointer"
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
                                              reqLabel
                                            )
                                          }
                                          title="Request Revision"
                                          aria-label="Request Revision"
                                          className="inline-flex items-center justify-center h-8 w-8 rounded-full border border-[#5e0000] bg-[#780000] hover:bg-[#5e0000] text-white shadow-2xs transition-all hover:scale-110 active:scale-95 disabled:opacity-50 cursor-pointer"
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
                                      <div className="flex items-center justify-center">
                                        <SubmissionStatusBadge
                                          status="Not Submitted"
                                          label="Awaiting Submission"
                                          size="md"
                                        />
                                      </div>
                                    )}
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
                      setSelectedHistoryAy(e.target.value);
                      setIsLoadingHistory(true);
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
                      setSelectedHistorySem(e.target.value as SemesterOption);
                      setIsLoadingHistory(true);
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
                    disabled={isRefreshing || isLoadingHistory}
                    onClick={handleRefresh}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-xs font-semibold px-3.5 py-1.5 transition-all disabled:opacity-50 cursor-pointer shadow-xs active:scale-[0.98]"
                    title="Refresh history"
                  >
                    <SystemRestart
                      className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`}
                    />
                    <span>{isRefreshing ? "Refreshing..." : "Refresh"}</span>
                  </button>

                  <button
                    type="button"
                    disabled={isDownloadingHistoryZip}
                    onClick={handleDownloadHistoryZip}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-750 dark:text-slate-200 text-xs font-semibold px-3.5 py-1.5 transition cursor-pointer disabled:opacity-50 shadow-2xs"
                  >
                    <AppIcon icon={Download} size="sm" color="inherit" />
                    {isDownloadingHistoryZip
                      ? "Zipping..."
                      : "Download History ZIP"}
                  </button>
                </div>
              </div>



              {/* Past Submissions Compressed List Table */}
              {isLoadingHistory || !selectedHistoryAy ? (
                <div className="space-y-3 pt-2">
                  <div className="overflow-hidden rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 animate-pulse space-y-4">
                    <div className="h-5 bg-slate-200 dark:bg-slate-800 rounded w-1/4" />
                    <div className="space-y-3">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="h-10 bg-slate-100 dark:bg-slate-800/60 rounded" />
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300 min-w-[880px]">
                      <thead className="bg-slate-50 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        <tr>
                          <th className="px-4 py-3 w-[26%]">Requirement</th>
                          <th className="px-3 py-3 w-[12%] text-center">Type</th>
                          <th className="px-4 py-3 w-[24%]">File Versions</th>
                          <th className="px-4 py-3 w-[22%]">Notes &amp; Remarks</th>
                          <th className="px-4 py-3 w-[10%] text-center">Status</th>
                          <th className="px-4 py-3 w-[6%] text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                        {allRequirements.map((req) => {
                          const code = req.code;
                          const reqLabel = req.title;
                          const isMandatory = req.isMandatory;
                          const matchingSub = historySubmissions.find(
                            (s) => s.requirement_code === code
                          );
                          const docs = matchingSub?.document_versions ?? [];
                          const latestReview =
                            matchingSub?.review_decisions?.[0] ?? null;
                          const rawStatus = matchingSub?.status ?? null;
                          const submittedDateText = matchingSub
                            ? formatFullDateTime(
                                matchingSub.submitted_at || matchingSub.created_at
                              )
                            : null;
                          const adminNote =
                            latestReview?.remarks || matchingSub?.admin_remarks;
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
                              <td className="px-4 py-3.5 align-middle">
                                <div className="space-y-1">
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
                              <td className="px-3 py-3.5 align-middle text-center">
                                {isMandatory ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-[#780000] text-white border border-[#5e0000] shadow-2xs">
                                    Required
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-700 text-white border border-slate-600 shadow-2xs">
                                    Optional
                                  </span>
                                )}
                              </td>

                              {/* File Versions */}
                              <td className="px-4 py-3.5 align-middle">
                                {docs.length > 0 ? (
                                  <div className="space-y-1.5">
                                    {docs.map((doc, idx) => {
                                      const rawName =
                                        doc.storage_path?.split("/").pop() || "Document";
                                      const fileName = cleanDisplayFileName(rawName);
                                      const fileSize = formatBytes(doc.size_bytes);
                                      const versionLabel = doc.version_number
                                        ? `v${doc.version_number}`
                                        : `v1`;
                                      const downloadUrl = `/api/storage/download?path=${encodeURIComponent(
                                        doc.storage_path
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
                                                  matchingSub?.review_decisions?.[0]
                                                    ?.remarks ||
                                                  matchingSub?.admin_remarks;
                                                const vFacultyNote =
                                                  matchingSub?.notes ||
                                                  matchingSub?.remarks ||
                                                  null;
                                                const versionSuffix = doc.version_number
                                                  ? ` (v${doc.version_number})`
                                                  : idx > 0
                                                  ? ` (Revision ${docs.length - idx})`
                                                  : "";
                                                setPreviewSubmission({
                                                  code: code,
                                                  title: `${reqLabel}${versionSuffix}`,
                                                  fileName: fileName,
                                                  fileSize: doc.size_bytes || null,
                                                  storagePath: doc.storage_path,
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
                                                    matchingSub?.review_decisions?.[0]
                                                      ?.created_at,
                                                  latestSubmissionId:
                                                    matchingSub?.id,
                                                  status:
                                                    matchingSub?.status ||
                                                    "Pending",
                                                  academicYear: selectedHistoryAy,
                                                  semester: selectedHistorySem,
                                                  facultyName: faculty.fullName,
                                                  isAdminView: true,
                                                  hasPriorRevision: Boolean(idx > 0),
                                                  isRevision: Boolean(idx > 0),
                                                });
                                              }}
                                              className="p-1 rounded text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition cursor-pointer"
                                              title="Preview"
                                            >
                                              <AppIcon icon={Eye} size="sm" color="inherit" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                handleSingleFileDownload(
                                                  doc.storage_path,
                                                  fileName
                                                )
                                              }
                                              className="p-1 rounded text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition cursor-pointer"
                                              title="Download"
                                            >
                                              <AppIcon icon={Download} size="sm" color="inherit" />
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
                              <td className="px-4 py-3.5 align-middle">
                                {facultyNote || adminNote ? (
                                  <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/60 p-2.5 text-xs max-w-[320px] space-y-1.5 shadow-2xs">
                                    {facultyNote ? (
                                      <div className="flex items-start gap-1.5 leading-snug">
                                        <span className="font-bold text-[10.5px] text-amber-700 dark:text-amber-400 shrink-0 mt-0.5 flex items-center gap-1.5">
                                          <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 shrink-0 shadow-2xs [&>svg]:h-2.5 [&>svg]:w-2.5">
                                            <AppIcon icon={ChatBubble} size="xs" color="active" />
                                          </span>
                                          Faculty Remarks:
                                        </span>
                                        <p className="text-slate-700 dark:text-slate-300 italic line-clamp-2" title={facultyNote}>
                                          &ldquo;{facultyNote}&rdquo;
                                        </p>
                                      </div>
                                    ) : null}
                                    {adminNote ? (
                                      <div className={`flex items-start gap-1.5 leading-snug ${facultyNote ? "pt-1.5 border-t border-slate-200/70 dark:border-slate-800/80" : ""}`}>
                                        <span className="font-bold text-[10.5px] text-[#0b5336] dark:text-emerald-400 shrink-0 mt-0.5 flex items-center gap-1.5">
                                          <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-[#0b5336]/15 dark:bg-[#0b5336]/30 text-[#0b5336] dark:text-emerald-400 border border-[#0b5336]/30 shrink-0 shadow-2xs [&>svg]:h-2.5 [&>svg]:w-2.5">
                                            <AppIcon icon={Check} size="xs" color="success" strokeWidth={2.5} />
                                          </span>
                                          Validated Remarks:
                                        </span>
                                        <p className="text-slate-700 dark:text-slate-300 italic line-clamp-2" title={adminNote}>
                                          &ldquo;{adminNote}&rdquo;
                                        </p>
                                      </div>
                                    ) : null}
                                  </div>
                                ) : (
                                  <span className="text-slate-400 dark:text-slate-600 text-xs italic block">&mdash;</span>
                                )}
                              </td>

                              {/* Status */}
                              <td className="px-4 py-3.5 align-middle text-center whitespace-nowrap">
                                <div className="flex items-center justify-center">
                                  <SubmissionStatusBadge status={rawStatus} size="md" />
                                </div>
                              </td>

                              {/* Action */}
                              <td className="px-4 py-3.5 align-middle text-center">
                                {docs.length > 0 && docs[0]?.storage_path ? (
                                  <div className="flex items-center justify-center">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const first = docs[0];
                                        const raw =
                                          first.storage_path.split("/").pop() ||
                                          `${reqLabel}.pdf`;
                                        const clean = cleanDisplayFileName(raw);
                                        setPreviewSubmission({
                                          code: code,
                                          title: reqLabel,
                                          fileName: clean,
                                          fileSize: first.size_bytes || null,
                                          storagePath: first.storage_path,
                                          fileUrl: `/api/storage/download?path=${encodeURIComponent(
                                            first.storage_path
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
                                          latestSubmissionId:
                                            matchingSub?.id,
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
                                      <AppIcon icon={Eye} size="sm" color="inherit" />
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
              icon={Xmark}
              title="Request Requirement Revision"
              subtitle={`${revisionModalData.reqLabel} • ${faculty.fullName}`}
              className="-mx-6 -mt-6 mb-4 rounded-t-3xl"
            />

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">
                  Quick Preset Reasons:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {REVISION_PRESETS.map((preset) => {
                    const isSelected = revisionInputText.includes(preset);
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
                        }}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-medium border transition cursor-pointer ${
                          isSelected
                            ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900 font-semibold"
                            : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-slate-200"
                        }`}
                      >
                        + {preset}
                      </button>
                    );
                  })}
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
                    <AppIcon icon={SystemRestart} size="sm" color="inherit" className="animate-spin" />
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
                  This note will be saved in the verification history and visible to the faculty member.
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
                    <AppIcon icon={SystemRestart} size="sm" color="inherit" className="animate-spin" />
                    Validating...
                  </>
                ) : (
                  <>
                    <AppIcon icon={Check} size="sm" color="white" strokeWidth={2.5} />
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
            sub.fileName || sub.title || "Document"
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
                (A.Y. {academicYear} &bull; {semester}).
              </p>

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
                  This note will be saved in the verification history of each validated requirement and visible to the faculty member.
                </p>
              </div>

              {validateTimerSeconds > 0 ? (
                <p className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-2.5 text-[11px] font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <AppIcon icon={Hourglass} size="sm" color="active" className="animate-pulse" />
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
                    <AppIcon icon={SystemRestart} size="sm" color="inherit" className="animate-spin" />
                    Validating...
                  </>
                ) : validateTimerSeconds > 0 ? (
                  `Confirm (${validateTimerSeconds}s)`
                ) : (
                  <>
                    <AppIcon icon={Check} size="sm" color="white" strokeWidth={2.5} />
                    <span>Confirm &amp; Validate All ({pendingSubmissionsCount})</span>
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
            if (zipProgressData.status !== "zipping") {
              setZipProgressData(null);
            }
          }}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <ModalHeader
              icon={Package}
              title={zipProgressData.title}
              className="-mx-6 -mt-6 mb-4 rounded-t-3xl"
            />

            <div className="flex flex-col items-center justify-center py-4 text-center space-y-4">
              {zipProgressData.status === "zipping" ? (
                <>
                  <div className="relative flex h-14 w-14 items-center justify-center">
                    <div className="absolute h-full w-full animate-spin rounded-full border-4 border-slate-200 border-t-slate-700 dark:border-slate-700 dark:border-t-slate-300"></div>
                    <Package className="h-6 w-6 text-slate-600 dark:text-slate-300" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {zipProgressData.message}
                    </p>
                    {zipProgressData.progressText ? (
                      <p className="mt-1 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        {zipProgressData.progressText}
                      </p>
                    ) : null}
                  </div>
                </>
              ) : zipProgressData.status === "success" ? (
                <>
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 border border-slate-200 dark:border-slate-700 shadow-2xs">
                    <AppIcon icon={Check} size="lg" color="inherit" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                      {zipProgressData.message}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                      Check your browser's downloads folder.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 border border-slate-200 dark:border-slate-700 shadow-2xs">
                    <AppIcon icon={WarningTriangle} size="lg" color="inherit" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-rose-800 dark:text-rose-300">
                      {zipProgressData.message}
                    </p>
                  </div>
                </>
              )}
            </div>

            {zipProgressData.status !== "zipping" ? (
              <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-800 mt-2">
                <button
                  type="button"
                  onClick={() => setZipProgressData(null)}
                  className="rounded-xl bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] px-4 py-2 text-xs font-bold transition cursor-pointer shadow-xs"
                >
                  Done
                </button>
              </div>
            ) : null}
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
}

export function RequirementsPanel({
  facultyAccounts,
  selectedFaculty,
  onSelectFaculty,
  resetTrigger,
  initialReviewFacultyId,
  initialRequirementCode,
}: RequirementsPanelProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProgram, setSelectedProgram] = useState("All Programs");
  const [isProgramDropdownOpen, setIsProgramDropdownOpen] = useState(false);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "completed" | "optional_review" | "pending_review" | "needs_revision" | "not_submitted"
  >("all");

  const [activePanelTab, setActivePanelTab] = useState<"current" | "history">("current");
  const [activeTermAy, setActiveTermAy] = useState("2026-2027");
  const [activeTermSem, setActiveTermSem] = useState<SemesterOption>("2nd Semester");
  const [historyAy, setHistoryAy] = useState("2025-2026");
  const [historySem, setHistorySem] = useState<SemesterOption>("1st Semester");
  const [availableAcademicYears, setAvailableAcademicYears] = useState<string[]>([]);
  const [academicYear, setAcademicYear] = useState("2026-2027");
  const [semester, setSemester] = useState<SemesterOption>("2nd Semester");

  const [facultyStatuses, setFacultyStatuses] = useState<
    Record<string, Record<string, RequirementStatus>>
  >({});
  const [facultyClassProgress, setFacultyClassProgress] = useState<
    Record<string, FacultyClassProgress[]>
  >({});
  const [facultySubjectProgress, setFacultySubjectProgress] = useState<
    Record<string, FacultySubjectProgress>
  >({});
  const [isLoadingStatuses, setIsLoadingStatuses] = useState(false);

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
      const res = await fetch("/api/staff/requirement-templates", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.templates) && data.templates.length > 0) {
          setRequirementTemplates(
            data.templates.map((t: any) => ({
              code: t.code,
              title: t.title,
              is_mandatory: Boolean(t.is_mandatory),
              is_active: t.is_active !== false,
            }))
          );
        }
      }
    } catch {
      // Fallback
    }
  }, []);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const [reviewingFaculty, setReviewingFaculty] = useState<FacultyAccount | null>(
    selectedFaculty || null
  );

  // Sync with selectedFaculty prop from parent
  useEffect(() => {
    if (selectedFaculty !== undefined) {
      setReviewingFaculty((prev) => (prev?.id === selectedFaculty?.id ? prev : selectedFaculty));
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
      const target = facultyAccounts.find((f) => f.id === initialReviewFacultyId);
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
    ["2026-2027", "2025-2026", "2024-2025", "2023-2024"].forEach((y) => list.add(y));
    return Array.from(list).sort().reverse();
  }, [activeTermAy, availableAcademicYears]);

  // Load active term & statuses on mount
  useEffect(() => {
    let isMounted = true;
    async function loadActiveTermAndStatuses() {
      const targetFacultyId =
        reviewingFaculty?.id ||
        selectedFaculty?.id ||
        facultyAccounts[0]?.id ||
        "";

      if (!targetFacultyId) {
        setIsLoadingStatuses(false);
        return;
      }

      const hasExistingStatuses = Object.keys(facultyStatuses).length > 0;
      if (!hasExistingStatuses) {
        setIsLoadingStatuses(true);
      }
      try {
        const res = await fetch(
          `/api/staff/faculty/requirements/verification?facultyId=${encodeURIComponent(
            targetFacultyId
          )}&_t=${Date.now()}`,
          { credentials: "include", cache: "no-store" }
        );
        if (res.ok && isMounted) {
          const data = await res.json();
          const activeAy =
            data.currentAcademicYear || data.selectedAcademicYear || "2026-2027";
          const activeSem: SemesterOption =
            data.currentSemester || data.selectedSemester || "2nd Semester";

          setActiveTermAy(activeAy);
          setActiveTermSem(activeSem);
          if (activePanelTab === "current") {
            setAcademicYear(activeAy);
            setSemester(activeSem);
          }

          if (Array.isArray(data.availableAcademicYears) && data.availableAcademicYears.length > 0) {
            setAvailableAcademicYears(data.availableAcademicYears);
            const pastYear =
              data.availableAcademicYears.find((y: string) => y !== activeAy) ||
              data.availableAcademicYears[0] ||
              "2025-2026";
            setHistoryAy((prev) => prev || pastYear);
          }

          // Batch load status for all faculty
          const targetAy = activePanelTab === "history" ? historyAy : activeAy;
          const targetSem = activePanelTab === "history" ? historySem : activeSem;
          await fetchAllStatuses(targetAy, targetSem, { silent: hasExistingStatuses });
        }
      } catch (err) {
        console.error("Failed to load active term:", err);
      } finally {
        if (isMounted) setIsLoadingStatuses(false);
      }
    }

    loadActiveTermAndStatuses();

    return () => {
      isMounted = false;
    };
  }, [facultyAccounts, reviewingFaculty?.id, selectedFaculty?.id, resetTrigger]);

  async function fetchAllStatuses(
    ay: string,
    sem: SemesterOption,
    options?: { silent?: boolean }
  ) {
    if (facultyAccounts.length === 0) return;
    const safeAy = ay || "2026-2027";
    const safeSem = sem || "1st Semester";
    if (!options?.silent) {
      setIsLoadingStatuses(true);
    }
    try {
      const results = await Promise.all(
        facultyAccounts.map(async (faculty) => {
          if (!faculty?.id) return { facultyId: "", status: null, classProgress: [], subjectProgress: null };
          try {
            const res = await fetch(
              `/api/staff/faculty/requirements/verification?facultyId=${encodeURIComponent(
                faculty.id
              )}&academicYear=${encodeURIComponent(safeAy)}&semester=${encodeURIComponent(
                safeSem
              )}&_t=${Date.now()}`,
              { credentials: "include", cache: "no-store" }
            );
            if (res.ok) {
              const data = await res.json();
              return {
                facultyId: faculty.id,
                status: data.requirementStatus,
                classProgress: data.classProgress || [],
                subjectProgress: data.subjectProgress || null,
              };
            }
          } catch {
            // Handled
          }
          return { facultyId: faculty.id, status: null, classProgress: [], subjectProgress: null };
        })
      );

      const statusMap: Record<string, Record<string, RequirementStatus>> =
        {};
      const classProgressMap: Record<string, FacultyClassProgress[]> = {};
      const subjectProgressMap: Record<string, FacultySubjectProgress> = {};
      for (const item of results) {
        if (item.status) {
          statusMap[item.facultyId] = item.status;
        }
        if (item.classProgress) {
          classProgressMap[item.facultyId] = item.classProgress;
        }
        if (item.subjectProgress) {
          subjectProgressMap[item.facultyId] = item.subjectProgress;
        }
      }
      setFacultyStatuses(statusMap);
      setFacultyClassProgress(classProgressMap);
      setFacultySubjectProgress(subjectProgressMap);
    } catch (err) {
      console.error("Error fetching faculty statuses:", err);
    } finally {
      if (!options?.silent) {
        setIsLoadingStatuses(false);
      }
    }
  }

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
      const hasSubjects = (subjectProg ? subjectProg.totalSubjects : classList.length) > 0;
      const isAllSubjectsDone = hasSubjects && (subjectProg ? subjectProg.allDone : classList.every((c) => c.isDone));

      const validatedMandatoryCount = statusRecord
        ? mandatoryTemplates.filter((t) => statusRecord[t.code] === "validated").length
        : 0;

      const allStatuses = statusRecord ? Object.values(statusRecord) : [];
      const totalValidatedCount = allStatuses.filter((s) => s === "validated").length;
      const hasPendingUpload = allStatuses.some((s) => s === "uploaded");
      const hasNeedsRevision = allStatuses.some(
        (s) => s === "rejected" || s === "needs_revision"
      );

      const isAllMandatoryValidated = hasSubjects
        ? isAllSubjectsDone
        : (validatedMandatoryCount === totalMandatoryCount && totalMandatoryCount > 0);

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
      let actionButtonText = activePanelTab === "history" ? "View Validation History" : "Review Requirements";
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
        if (activePanelTab !== "history") {
          actionButtonText = "Review Requirements";
          actionButtonClass =
            "bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold";
        }
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
      });
    }

    return map;
  }, [facultyAccounts, facultyStatuses, requirementTemplates, facultyClassProgress, facultySubjectProgress]);

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
    return facultyAccounts.filter((f) => {
      const matchesSearch =
        !searchTerm ||
        f.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.email.toLowerCase().includes(searchTerm.toLowerCase());

      const progCode = f.program?.code || f.program?.name || "N/A";
      const matchesProgram =
        selectedProgram === "All Programs" || progCode === selectedProgram;

      const statInfo = facultyStatusMap.get(f.id);
      const matchesStatus =
        statusFilter === "all" || (statInfo && statInfo.category === statusFilter);

      return matchesSearch && matchesProgram && matchesStatus;
    });
  }, [facultyAccounts, searchTerm, selectedProgram, statusFilter, facultyStatusMap]);

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
    statusFilterOptions.find((opt) => opt.id === statusFilter) || statusFilterOptions[0];

  return (
    <div className="w-full">
      {reviewingFaculty ? (
        <FacultyVerificationDrawer
          faculty={reviewingFaculty}
          academicYear={academicYear}
          semester={semester}
          initialTab={activePanelTab}
          initialRequirementCode={initialRequirementCode}
          requirementTemplates={requirementTemplates}
          onBack={() => {
            initialOpenedRef.current = "__closed__";
            setReviewingFaculty(null);
            onSelectFaculty?.(null);
          }}
          onClose={() => {
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
            <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-2xs">
              <button
                type="button"
                onClick={() => {
                  setActivePanelTab("current");
                  setAcademicYear(activeTermAy);
                  setSemester(activeTermSem);
                  void fetchAllStatuses(activeTermAy, activeTermSem);
                }}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold transition cursor-pointer ${
                  activePanelTab === "current"
                    ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-2xs font-bold"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                <AppIcon icon={Page} size="xs" color="inherit" />
                <span>Current Submissions</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActivePanelTab("history");
                  setAcademicYear(historyAy);
                  setSemester(historySem);
                  void fetchAllStatuses(historyAy, historySem);
                }}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold transition cursor-pointer ${
                  activePanelTab === "history"
                    ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-2xs font-bold"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                <AppIcon icon={Archive} size="xs" color="inherit" />
                <span>Validation History</span>
              </button>
            </div>

            {/* Academic Term Selector / Status Badge */}
            {activePanelTab === "current" ? (
              <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50/80 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 text-xs font-bold shadow-2xs">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Active Term: A.Y. {activeTermAy} &bull; {activeTermSem}</span>
              </div>
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
                    void fetchAllStatuses(newAy, historySem);
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
                    void fetchAllStatuses(historyAy, newSem);
                  }}
                  className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-bold outline-none focus:border-amber-500 cursor-pointer shadow-2xs"
                >
                  <option value="1st Semester">1st Semester</option>
                  <option value="2nd Semester">2nd Semester</option>
                  <option value="Summer Semester">Summer Semester</option>
                  <option value="Summer Term">Summer Term</option>
                </select>
              </div>
            )}
          </div>

          {/* 1. Top Control Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl border-2 border-amber-400 dark:border-amber-500/60 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-200 mb-4 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5 w-full sm:w-auto flex-wrap">
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
              <NavArrowDown className={`h-4 w-4 text-slate-500 dark:text-slate-400 transition-transform ${isProgramDropdownOpen ? "rotate-180" : ""}`} />
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
                <span className="text-slate-500 dark:text-slate-400 font-medium">Status:</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {currentStatusOption.label}
                </span>
                <span className="ml-1 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
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
                          className={`ml-2 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold shrink-0 ${
                            isSelected
                              ? "bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700"
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

        {/* Term Indicator */}
        <div className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm font-medium tracking-wide shrink-0">
          {activePanelTab === "history" ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-900 dark:text-amber-200 border border-amber-500/30 font-bold text-xs shadow-2xs">
              <AppIcon icon={ClockRotateRight} size="xs" color="inherit" />
              <span>Viewing Validation History: A.Y. {academicYear} &bull; {semester}</span>
            </span>
          ) : (
            <span>A.Y. {academicYear || "2026-2027"} &bull; {semester}</span>
          )}
        </div>
      </div>

      {/* 2. Faculty List / Table View */}
      <div className="w-full overflow-x-auto rounded-2xl border-2 border-amber-400 dark:border-amber-500/60 bg-white dark:bg-slate-900 shadow-xs dark:shadow-none">
        <table className="w-full text-left border-collapse text-xs text-slate-800 dark:text-slate-300 min-w-[750px]">
            <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 uppercase tracking-wider text-[10px] text-slate-600 dark:text-slate-400">
              <tr>
                <th className="px-3 py-3 font-semibold w-10 text-center">#</th>
                <th className="px-4 py-3 font-semibold">Faculty Member</th>
                <th className="px-4 py-3 font-semibold">Program</th>
                <th className="px-4 py-3 font-semibold">Verification Progress</th>
                <th className="px-4 py-3 font-semibold text-center">Overall Status</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
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
                  const validatedMandatoryCount = statInfo?.validatedMandatoryCount ?? 0;
                  const totalMandatoryCount = statInfo?.totalMandatoryCount ?? DEFAULT_REQUIREMENTS.length;
                  const totalValidatedCount = statInfo?.totalValidatedCount ?? 0;
                  const overallStatus = statInfo?.overallStatus ?? "Not Submitted";
                  const statusBadgeClass = statInfo?.statusBadgeClass ?? "";
                  const actionButtonText = statInfo?.actionButtonText ?? "Review Requirements";
                  const actionButtonClass =
                    statInfo?.actionButtonClass ??
                    "bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold";

                  const programCode =
                    faculty.program?.code || faculty.program?.name || "N/A";

                  return (
                    <tr
                      key={faculty.id}
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
                              <span>{buildFacultyInitials(faculty.fullName)}</span>
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
                        {isLoadingStatuses && !statusRecord ? (
                          <div className="space-y-1.5 py-1">
                            <div className="h-4 w-28 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                            <div className="h-2 w-36 bg-slate-100 dark:bg-slate-800/60 rounded animate-pulse" />
                          </div>
                        ) : (() => {
                          const classList = facultyClassProgress[faculty.id] || [];
                          const subjectProg = facultySubjectProgress[faculty.id];
                          const totalClasses = subjectProg ? subjectProg.totalSubjects : classList.length;
                          const doneCount = subjectProg ? subjectProg.doneSubjects : classList.filter((c) => c.isDone).length;
                          const progressPct = totalClasses > 0 ? Math.round((doneCount / totalClasses) * 100) : 0;

                          if (totalClasses === 0) {
                            return (
                              <div className="flex flex-col">
                                <span className="text-xs text-slate-400 dark:text-slate-500 italic">
                                  No subjects assigned
                                </span>
                                {totalValidatedCount > 0 ? (
                                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                                    {totalValidatedCount} general requirements validated
                                  </span>
                                ) : null}
                              </div>
                            );
                          }

                          return (
                            <div
                              className="flex flex-col gap-1.5 py-0.5 min-w-[140px] max-w-[260px]"
                              title={classList.map((c) => `${c.subject_code}: ${c.isDone ? "Done" : "Not Done"}`).join(", ")}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                                  {doneCount}/{totalClasses} {totalClasses === 1 ? "Subject" : "Subjects"} Done
                                </span>
                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                                  {progressPct}%
                                </span>
                              </div>

                              {/* Progress Track */}
                              <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden border border-slate-200/60 dark:border-slate-700/60">
                                <div
                                  className={`h-full rounded-full transition-all duration-300 ${
                                    doneCount === totalClasses && totalClasses > 0
                                      ? "bg-[#0b5336]"
                                      : doneCount > 0
                                      ? "bg-amber-500"
                                      : "bg-transparent"
                                  }`}
                                  style={{ width: `${progressPct}%` }}
                                />
                              </div>

                              {/* Only show chips for subjects that are Done */}
                              {classList.filter((cls) => cls.isDone).length > 0 ? (
                                <div className="flex flex-wrap gap-1 pt-0.5">
                                  {classList
                                    .filter((cls) => cls.isDone)
                                    .map((cls) => (
                                      <span
                                        key={cls.id}
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10.5px] font-bold border transition-colors bg-emerald-50 dark:bg-emerald-950/40 text-[#0b5336] dark:text-emerald-300 border-emerald-300 dark:border-emerald-800/60"
                                        title={`${cls.subject_code} (${cls.section_code}): All requirements validated (Done)`}
                                      >
                                        <AppIcon icon={Check} size="xs" color="inherit" strokeWidth={2.5} />
                                        <span className="font-mono">{cls.subject_code}</span>
                                      </span>
                                    ))}
                                </div>
                              ) : null}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3 font-medium text-center">
                        {isLoadingStatuses && !statusRecord ? (
                          <div className="h-6 w-24 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse mx-auto" />
                        ) : (
                          <div className="flex items-center justify-center">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${statusBadgeClass}`}>
                              {overallStatus === "Completed / Validated" ? (
                                <AppIcon icon={CheckCircle} size="sm" color="white" />
                              ) : overallStatus === "Needs Revision" ? (
                                <AppIcon icon={Xmark} size="sm" color="white" strokeWidth={2.5} />
                              ) : overallStatus === "Optional Review Pending" ? (
                                <AppIcon icon={Hourglass} size="sm" color="white" />
                              ) : overallStatus === "Pending Review" ? (
                                <AppIcon icon={Hourglass} size="sm" color="inherit" />
                              ) : (
                                <AppIcon icon={Minus} size="sm" color="inherit" />
                              )}
                              <span>{overallStatus}</span>
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            initialOpenedRef.current = faculty.id;
                            setReviewingFaculty(faculty);
                            onSelectFaculty?.(faculty.id);
                          }}
                          className={`${actionButtonClass} px-3.5 py-1.5 rounded-xl text-xs shadow-sm active:scale-[0.98] transition cursor-pointer`}
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
