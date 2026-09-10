"use client";

import { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import JSZip from "jszip";
import {
  Archive,
  Check,
  CheckCircle,
  Clock,
  Download,
  EditPencil,
  Eye,
  InfoCircle,
  NavArrowDown,
  OpenNewWindow,
  Package,
  Page,
  Reports,
  SystemRestart,
  WarningCircle,
  WarningTriangle,
  Xmark,
} from "iconoir-react";
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
      iconUrl: "https://api.iconify.design/vscode-icons:file-type-pdf2.svg",
      borderColor: "border-[#E5252A]/30 dark:border-[#E5252A]/40",
      badgeBg: "bg-[#E5252A] text-white",
    };
  }
  if (isExcel || ["xlsx", "xls", "csv"].includes(ext)) {
    return {
      label: "Microsoft Excel Spreadsheet",
      iconUrl: "https://api.iconify.design/vscode-icons:file-type-excel.svg",
      borderColor: "border-[#107C41]/30 dark:border-[#107C41]/40",
      badgeBg: "bg-[#107C41] text-white",
    };
  }
  if (isWord || ["docx", "doc"].includes(ext)) {
    return {
      label: "Microsoft Word Document",
      iconUrl: "https://api.iconify.design/vscode-icons:file-type-word.svg",
      borderColor: "border-[#185ABD]/30 dark:border-[#185ABD]/40",
      badgeBg: "bg-[#185ABD] text-white",
    };
  }
  if (["pptx", "ppt"].includes(ext)) {
    return {
      label: "Microsoft PowerPoint Presentation",
      iconUrl:
        "https://api.iconify.design/vscode-icons:file-type-powerpoint.svg",
      borderColor: "border-[#C43E1C]/30 dark:border-[#C43E1C]/40",
      badgeBg: "bg-[#C43E1C] text-white",
    };
  }
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) {
    return {
      label: "Compressed Archive",
      iconUrl: "https://api.iconify.design/vscode-icons:file-type-zip.svg",
      borderColor: "border-slate-500/30 dark:border-slate-500/40",
      badgeBg: "bg-slate-600 text-white",
    };
  }
  if (["png", "jpg", "jpeg", "webp", "gif", "bmp", "svg"].includes(ext)) {
    return {
      label: "Image File",
      iconUrl: "https://api.iconify.design/vscode-icons:file-type-image.svg",
      borderColor: "border-amber-500/30 dark:border-amber-500/40",
      badgeBg: "bg-amber-500 text-slate-950",
    };
  }
  return {
    label: "Document File",
    iconUrl: "https://api.iconify.design/vscode-icons:file-type-text.svg",
    borderColor: "border-amber-500/30 dark:border-amber-500/40",
    badgeBg: "bg-amber-500 text-slate-950",
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
): RequirementCode | null {
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
  return null;
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

interface FacultyVerificationDrawerProps {
  faculty: FacultyAccount;
  academicYear: string;
  semester: SemesterOption;
  onClose: () => void;
  onStatusUpdated: () => void;
}

const REVISION_PRESETS = [
  "Missing required signature(s)",
  "Incomplete document pages / sections",
  "Incorrect academic year or semester",
  "Low scan quality or unreadable text",
  "Outdated syllabus / course guide template",
  "Missing grading criteria breakdown",
];

function FacultyVerificationDrawer({
  faculty,
  academicYear,
  semester,
  onClose,
  onStatusUpdated,
}: FacultyVerificationDrawerProps) {
  const [activeTab, setActiveTab] = useState<"current" | "history">("current");
  const [submissions, setSubmissions] = useState<FacultyRequirementSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [reviewingCode, setReviewingCode] = useState<string | null>(null);
  const [submittingAction, setSubmittingAction] = useState<"validate" | "revision" | null>(null);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [isValidatingAll, setIsValidatingAll] = useState(false);

  // History Tab States
  const [historySubmissions, setHistorySubmissions] = useState<FacultyRequirementSubmission[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyAcademicYears, setHistoryAcademicYears] = useState<string[]>([]);
  const [selectedHistoryAy, setSelectedHistoryAy] = useState<string>("");
  const [selectedHistorySem, setSelectedHistorySem] = useState<SemesterOption>("1st Semester");
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

  const [previewingDoc, setPreviewingDoc] = useState<{
    url: string;
    name: string;
    mimeType?: string | null;
    label: string;
    storagePath?: string | null;
  } | null>(null);

  const [remarksInput, setRemarksInput] = useState<Record<string, string>>({});
  const [actionFeedback, setActionFeedback] = useState<{
    type: "info" | "success" | "error";
    message: string;
  } | null>(null);

  const [isValidateModalOpen, setIsValidateModalOpen] = useState(false);
  const [bulkValidateNotes, setBulkValidateNotes] = useState("");
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

  // Scroll lock when drawer is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

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
    "all" | "pending" | "validated" | "revision"
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

  const displayedRequirements = useMemo(() => {
    return DEFAULT_REQUIREMENTS.filter((code) => {
      if (filterMode === "all") return true;
      const matchingSub = submissions.find((s) => {
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

      if (filterMode === "pending") return isPending;
      if (filterMode === "validated") return isValidated;
      if (filterMode === "revision") return isRevision;
      return true;
    });
  }, [filterMode, submissions, academicYear, semester]);

  // 1. Fetch current term submissions (only on faculty/term change, without retriggering on history state updates)
  useEffect(() => {
    let isCancelled = false;
    async function loadCurrentSubmissions() {
      if (!faculty.id || !academicYear || !semester) return;
      setIsLoading(true);
      try {
        const subRes = await fetch(
          `/api/admin/faculty/submissions?facultyId=${encodeURIComponent(faculty.id)}&academicYear=${encodeURIComponent(academicYear)}&semester=${encodeURIComponent(semester)}`,
          { credentials: "include", cache: "no-store" }
        );

        if (subRes.ok && !isCancelled) {
          const subData = await subRes.json();
          setSubmissions(subData.submissions || []);
        }
      } catch (err) {
        console.error("Failed to load current submissions:", err);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    loadCurrentSubmissions();
    return () => {
      isCancelled = true;
    };
  }, [faculty.id, academicYear, semester]);

  // 2. Fetch history academic years once on mount (isolated from current submissions to prevent double reload)
  useEffect(() => {
    let isCancelled = false;
    async function loadHistoryMetadata() {
      if (!faculty.id) return;
      try {
        const verRes = await fetch(
          `/api/admin/faculty/requirements/verification?facultyId=${encodeURIComponent(faculty.id)}&academicYear=${encodeURIComponent(academicYear)}&semester=${encodeURIComponent(semester)}`,
          { credentials: "include" }
        );

        if (verRes.ok && !isCancelled) {
          const verData = await verRes.json();
          const years: string[] = verData.availableAcademicYears ?? [];
          if (years.length > 0) {
            setHistoryAcademicYears(years);
            setSelectedHistoryAy((prev) => {
              if (prev) return prev;
              const pastYear =
                years.find((y) => y !== academicYear) || years[0] || "2025-2026";
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
  }, [faculty.id, academicYear, semester]);

  // 3. Fetch history submissions on-demand when history tab is active
  useEffect(() => {
    if (activeTab !== "history" || !faculty.id || !selectedHistoryAy || !selectedHistorySem) return;
    let isCancelled = false;
    async function loadHistorySubmissions() {
      setIsLoadingHistory(true);
      try {
        const res = await fetch(
          `/api/admin/faculty/submissions?facultyId=${encodeURIComponent(faculty.id)}&academicYear=${encodeURIComponent(selectedHistoryAy)}&semester=${encodeURIComponent(selectedHistorySem)}`,
          { credentials: "include", cache: "no-store" }
        );
        if (res.ok && !isCancelled) {
          const data = await res.json();
          setHistorySubmissions(data.submissions || []);
        }
      } catch (err) {
        console.error("Failed to load history submissions:", err);
      } finally {
        if (!isCancelled) {
          setIsLoadingHistory(false);
        }
      }
    }

    loadHistorySubmissions();
    return () => {
      isCancelled = true;
    };
  }, [activeTab, faculty.id, selectedHistoryAy, selectedHistorySem]);

  const handleClose = () => {
    setRemarksInput({});
    setRevisionModalData(null);
    setValidateModalData(null);
    onClose();
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
      const response = await fetch("/api/admin/faculty/submissions/review", {
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
        onStatusUpdated();
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
      const zipFilename = `${faculty.fullName}_${academicYear}_${semester}_Requirements.zip`.replace(
        /[\\/:*?"<>|]+/g,
        "_"
      );

      // Check uploaded requirement files
      const uploadedSubmissions = submissions.filter((s) => {
        const matchesTerm = doesSubmissionMatchTerm(s, academicYear, semester);
        return matchesTerm && Boolean(s.id);
      });

      if (uploadedSubmissions.length === 0) {
        setNoticeModalData({
          title: "No Downloadable Requirements",
          message: `There are no uploaded requirement files available for download for ${faculty.fullName} for A.Y. ${academicYear} • ${semester}.`,
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
        const reqCode = sub.requirement_code as RequirementCode;
        const label = REQUIREMENT_LABEL[reqCode] || reqCode;
        const docs = sub.document_versions || [];

        for (const doc of docs) {
          if (!doc.storage_path) continue;
          processedCount++;
          setZipProgressData({
            status: "zipping",
            title: "Packaging Requirements (ZIP)",
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
        const reqCode = sub.requirement_code as RequirementCode;
        const label = REQUIREMENT_LABEL[reqCode] || reqCode;
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
    const pendingSubmissions = submissions.filter((s) => {
      const matchesTerm = doesSubmissionMatchTerm(s, academicYear, semester);
      const isPending =
        s.status === "uploaded" ||
        s.status === "pending" ||
        s.status === "submitted" ||
        s.status === "under_review";
      return matchesTerm && isPending && Boolean(s.id);
    });

    if (pendingSubmissions.length === 0) {
      setNoticeModalData({
        title: "No Pending Requirements",
        message: `No pending requirement submissions are available to validate for ${faculty.fullName} (A.Y. ${academicYear} • ${semester}).`,
      });
      return;
    }

    setBulkValidateNotes("");
    setValidateTimerSeconds(5);
    setIsValidateModalOpen(true);
  }

  async function executeValidateAllPending() {
    const pendingSubmissions = submissions.filter((s) => {
      const matchesTerm = doesSubmissionMatchTerm(s, academicYear, semester);
      const isPending =
        s.status === "uploaded" ||
        s.status === "pending" ||
        s.status === "submitted" ||
        s.status === "under_review";
      return matchesTerm && isPending && Boolean(s.id);
    });

    if (pendingSubmissions.length === 0) {
      setIsValidateModalOpen(false);
      setNoticeModalData({
        title: "No Pending Requirements",
        message: `No pending requirement submissions are available to validate for ${faculty.fullName}.`,
      });
      return;
    }

    setIsValidatingAll(true);
    try {
      const remarksToSend = bulkValidateNotes.trim();
      await Promise.all(
        pendingSubmissions.map((sub) =>
          fetch("/api/admin/faculty/submissions/review", {
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
      onStatusUpdated();
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 sm:p-6 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={handleClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-6xl xl:max-w-7xl flex-col overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800/80 px-6 py-4 bg-slate-50/50 dark:bg-slate-950/30">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 shadow-2xs">
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

          <button
            type="button"
            onClick={handleClose}
            className="rounded-full p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
            aria-label="Close modal"
          >
            <Xmark className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="border-b border-slate-200 dark:border-slate-800/80 px-6 py-3 bg-white dark:bg-slate-900">
          <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-950/80 rounded-2xl border border-slate-200/80 dark:border-slate-800/80">
            <button
              type="button"
              onClick={() => setActiveTab("current")}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-1.5 text-xs font-semibold transition cursor-pointer ${
                activeTab === "current"
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-2xs font-bold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <span>Current Submissions</span>
              {pendingSubmissionsCount > 0 ? (
                <span className="inline-flex items-center justify-center rounded-full bg-amber-500 text-slate-950 px-1.5 py-0.5 text-[10px] font-bold leading-none">
                  {pendingSubmissionsCount}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("history")}
              className={`rounded-xl px-4 py-1.5 text-xs font-semibold transition cursor-pointer ${
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
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-2.5">
              <SystemRestart className="h-6 w-6 animate-spin text-slate-400" />
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Loading faculty requirements...
              </p>
            </div>
          ) : activeTab === "current" ? (
            /* Tab 1: Current Submissions */
            <div className="space-y-4">
              {/* Bulk Actions & Filter Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-950/40 p-3 shadow-2xs">
                {/* Filter Chips */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setFilterMode("all")}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                      filterMode === "all"
                        ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-2xs font-bold"
                        : "bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-800"
                    }`}
                  >
                    <span>All Files</span>
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                        filterMode === "all"
                          ? "bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      {DEFAULT_REQUIREMENTS.length}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterMode("pending")}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                      filterMode === "pending"
                        ? "bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/40 shadow-2xs font-bold"
                        : "bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-800"
                    }`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                    <span>Need Review</span>
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                        filterMode === "pending"
                          ? "bg-amber-500/20 text-amber-800 dark:text-amber-300"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      {pendingSubmissionsCount}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterMode("validated")}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                      filterMode === "validated"
                        ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/40 shadow-2xs font-bold"
                        : "bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-800"
                    }`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                    <span>Validated</span>
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                        filterMode === "validated"
                          ? "bg-emerald-500/20 text-emerald-800 dark:text-emerald-300"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      {validatedSubmissionsCount}
                    </span>
                  </button>
                  {revisionSubmissionsCount > 0 ? (
                    <button
                      type="button"
                      onClick={() => setFilterMode("revision")}
                      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                        filterMode === "revision"
                          ? "bg-rose-500/15 text-rose-800 dark:text-rose-300 border border-rose-500/40 shadow-2xs font-bold"
                          : "bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-800"
                      }`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0" />
                      <span>Needs Revision</span>
                      <span
                        className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                          filterMode === "revision"
                            ? "bg-rose-500/20 text-rose-800 dark:text-rose-300"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                        }`}
                      >
                        {revisionSubmissionsCount}
                      </span>
                    </button>
                  ) : null}
                </div>

                {/* Bulk Actions */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={isValidatingAll || pendingSubmissionsCount === 0}
                    onClick={triggerValidateAllPendingModal}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                    {isValidatingAll
                      ? "Validating..."
                      : `Validate All Pending (${pendingSubmissionsCount})`}
                  </button>

                  <button
                    type="button"
                    disabled={isDownloadingZip}
                    onClick={handleDownloadZip}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-750 dark:text-slate-200 px-3.5 py-1.5 text-xs font-semibold shadow-2xs transition cursor-pointer disabled:opacity-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    {isDownloadingZip ? "Zipping..." : "Download All (ZIP)"}
                  </button>
                </div>
              </div>

              {/* Action Feedback Banner */}
              {actionFeedback ? (
                <div
                  className={`flex items-center gap-2.5 rounded-2xl border p-3 text-xs font-semibold shadow-2xs transition-all ${
                    actionFeedback.type === "info"
                      ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
                      : actionFeedback.type === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
                  }`}
                >
                  <span className="text-sm">
                    {actionFeedback.type === "info" ? (
                      <InfoCircle className="h-4 w-4" />
                    ) : actionFeedback.type === "success" ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <WarningTriangle className="h-4 w-4" />
                    )}
                  </span>
                  <span>{actionFeedback.message}</span>
                </div>
              ) : null}

              {/* Compressed List Table */}
              <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300 min-w-[880px]">
                    <thead className="bg-slate-50 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      <tr>
                        <th className="px-4 py-3 w-[28%]">Requirement</th>
                        <th className="px-4 py-3 w-[24%]">Attached File</th>
                        <th className="px-4 py-3 w-[30%]">Notes &amp; Feedback</th>
                        <th className="px-4 py-3 w-[18%] text-center">Status &amp; Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                      {displayedRequirements.length === 0 ? (
                        <tr>
                          <td
                            colSpan={4}
                            className="py-12 text-center text-slate-500 dark:text-slate-400"
                          >
                            <div className="flex flex-col items-center justify-center gap-2">
                              <CheckCircle className="h-7 w-7 text-emerald-500" />
                              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                                {filterMode === "pending"
                                  ? "All submitted files have been reviewed and verified!"
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
                          </td>
                        </tr>
                      ) : (
                        displayedRequirements.map((code) => {
                          const reqLabel = REQUIREMENT_LABEL[code];
                          const matchingSubmission = submissions.find((s) => {
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
                          const facultyNote =
                            rawFacultyNote && rawFacultyNote !== adminNote
                              ? rawFacultyNote
                              : null;

                          return (
                            <tr
                              key={code}
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

                              {/* Column 2: Attached File */}
                              <td className="px-4 py-3.5 align-middle">
                                {hasFile && fileDownloadUrl ? (
                                  <div className="flex items-center gap-2.5">
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/60 text-slate-500 dark:text-slate-400">
                                      <Page className="h-4 w-4" />
                                    </div>
                                    <div className="min-w-0 space-y-1">
                                      <div>
                                        <span
                                          className="font-medium text-slate-900 dark:text-slate-100 truncate block text-xs leading-snug max-w-[190px] xl:max-w-[240px]"
                                          title={rawFileName}
                                        >
                                          {fileName}
                                        </span>
                                        {fileSize ? (
                                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono">
                                            {fileSize}
                                          </span>
                                        ) : null}
                                      </div>

                                      <div className="flex items-center gap-1.5 pt-0.5">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setPreviewingDoc({
                                              url: fileDownloadUrl,
                                              name: fileName,
                                              mimeType: firstDoc?.mime_type,
                                              label: reqLabel,
                                              storagePath: firstDoc?.storage_path,
                                            });
                                          }}
                                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-750 dark:text-slate-200 px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer shadow-2xs"
                                          title="Preview File"
                                        >
                                          <Eye className="h-3.5 w-3.5" />
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
                                          className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-slate-300 px-2 py-1 text-[11px] font-semibold transition cursor-pointer shadow-2xs"
                                          title="Download File"
                                        >
                                          <Download className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-xs text-slate-400 dark:text-slate-500 italic block">
                                    No file attached
                                  </span>
                                )}
                              </td>

                              {/* Column 3: Notes & Feedback (Unified compact container, prevents row stretching) */}
                              <td className="px-4 py-3.5 align-middle">
                                {facultyNote || isRevisionRequested || (isValidated && adminNote) ? (
                                  <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/60 p-2.5 text-xs max-w-[320px] space-y-1.5 shadow-2xs">
                                    {facultyNote ? (
                                      <div className="flex items-start gap-1.5 leading-snug">
                                        <span className="font-semibold text-[10.5px] text-slate-500 dark:text-slate-400 shrink-0 mt-0.5">
                                          Faculty:
                                        </span>
                                        <p
                                          className="text-slate-700 dark:text-slate-300 italic line-clamp-2"
                                          title={facultyNote}
                                        >
                                          &ldquo;{facultyNote}&rdquo;
                                        </p>
                                      </div>
                                    ) : null}

                                    {isRevisionRequested ? (
                                      <div className={`flex items-start gap-1.5 leading-snug ${facultyNote ? "pt-1.5 border-t border-slate-200/70 dark:border-slate-800/80" : ""}`}>
                                        <span className="font-semibold text-[10.5px] text-rose-600 dark:text-rose-300 shrink-0 mt-0.5 flex items-center gap-1">
                                          <WarningCircle className="h-3 w-3 text-rose-500 dark:text-rose-400" />
                                          Revision:
                                        </span>
                                        <p
                                          className="text-slate-700 dark:text-slate-300 italic line-clamp-2"
                                          title={adminNote || ""}
                                        >
                                          &ldquo;{adminNote ||
                                            "Please review and re-upload the corrected requirement document."}&rdquo;
                                        </p>
                                      </div>
                                    ) : isValidated && adminNote ? (
                                      <div className={`flex items-start gap-1.5 leading-snug ${facultyNote ? "pt-1.5 border-t border-slate-200/70 dark:border-slate-800/80" : ""}`}>
                                        <span className="font-semibold text-[10.5px] text-emerald-600 dark:text-emerald-300 shrink-0 mt-0.5 flex items-center gap-1">
                                          <CheckCircle className="h-3 w-3 text-emerald-500 dark:text-emerald-400" />
                                          Remarks:
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

                              {/* Column 4: Status / Action (Centered Vertically and Horizontally) */}
                              <td className="px-4 py-3.5 align-middle text-center">
                                {isValidated ? (
                                  <div className="flex items-center justify-center">
                                    <SubmissionStatusBadge status="Validated" size="sm" />
                                  </div>
                                ) : isRevisionRequested ? (
                                  <div className="flex items-center justify-center">
                                    <SubmissionStatusBadge status="Needs Revision" size="sm" />
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
                                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 active:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 px-3.5 py-1.5 text-xs font-semibold transition disabled:opacity-50 cursor-pointer shadow-2xs"
                                    >
                                      <Check className="h-3.5 w-3.5" />
                                      <span>Validate</span>
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
                                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 active:bg-rose-500/25 text-rose-700 dark:text-rose-300 px-3.5 py-1.5 text-xs font-semibold transition disabled:opacity-50 cursor-pointer shadow-2xs"
                                    >
                                      <WarningCircle className="h-3.5 w-3.5" />
                                      <span>Revision</span>
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-center">
                                    <span className="text-xs text-slate-400 dark:text-slate-500 italic whitespace-nowrap">
                                      Awaiting Submission
                                    </span>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
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
                    onChange={(e) => setSelectedHistoryAy(e.target.value)}
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
                    onChange={(e) =>
                      setSelectedHistorySem(e.target.value as SemesterOption)
                    }
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 outline-none transition focus:border-amber-500"
                  >
                    <option value="1st Semester">1st Semester</option>
                    <option value="2nd Semester">2nd Semester</option>
                  </select>
                </div>

                <button
                  type="button"
                  disabled={isDownloadingHistoryZip}
                  onClick={handleDownloadHistoryZip}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-750 dark:text-slate-200 text-xs font-semibold px-3.5 py-1.5 transition cursor-pointer disabled:opacity-50 shadow-2xs"
                >
                  <Download className="h-3.5 w-3.5" />
                  {isDownloadingHistoryZip
                    ? "Zipping..."
                    : "Download History ZIP"}
                </button>
              </div>

              {/* Action Feedback Banner */}
              {actionFeedback ? (
                <div
                  className={`flex items-center gap-2.5 rounded-2xl border p-3 text-xs font-semibold shadow-2xs transition-all ${
                    actionFeedback.type === "info"
                      ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
                      : actionFeedback.type === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
                  }`}
                >
                  <span className="text-sm">
                    {actionFeedback.type === "info" ? (
                      <InfoCircle className="h-4 w-4" />
                    ) : actionFeedback.type === "success" ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <WarningTriangle className="h-4 w-4" />
                    )}
                  </span>
                  <span>{actionFeedback.message}</span>
                </div>
              ) : null}

              {/* Past Submissions Compressed List Table */}
              {isLoadingHistory ? (
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-2">
                  <SystemRestart className="h-5 w-5 animate-spin text-slate-400" />
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Loading history submissions...
                  </p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300 min-w-[880px]">
                      <thead className="bg-slate-50 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        <tr>
                          <th className="px-4 py-3 w-[28%]">Requirement</th>
                          <th className="px-4 py-3 w-[24%]">File Versions</th>
                          <th className="px-4 py-3 w-[30%]">Notes &amp; Remarks</th>
                          <th className="px-4 py-3 w-[10%] text-center">Status</th>
                          <th className="px-4 py-3 w-[8%] text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                        {DEFAULT_REQUIREMENTS.map((code) => {
                          const reqLabel = REQUIREMENT_LABEL[code];
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
                                            <span className="rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1 py-0.2 text-[9px] font-bold text-slate-600 dark:text-slate-300">
                                              {versionLabel}
                                            </span>
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
                                                setPreviewingDoc({
                                                  url: downloadUrl,
                                                  name: fileName,
                                                  mimeType: doc.mime_type || null,
                                                  label: reqLabel,
                                                  storagePath: doc.storage_path,
                                                });
                                              }}
                                              className="p-1 rounded text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition cursor-pointer"
                                              title="Preview"
                                            >
                                              <Eye className="h-3.5 w-3.5" />
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
                                              <Download className="h-3.5 w-3.5" />
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
                                        <span className="font-semibold text-[10.5px] text-slate-500 dark:text-slate-400 shrink-0 mt-0.5">
                                          Faculty:
                                        </span>
                                        <p className="text-slate-700 dark:text-slate-300 italic line-clamp-2" title={facultyNote}>
                                          &ldquo;{facultyNote}&rdquo;
                                        </p>
                                      </div>
                                    ) : null}
                                    {adminNote ? (
                                      <div className={`flex items-start gap-1.5 leading-snug ${facultyNote ? "pt-1.5 border-t border-slate-200/70 dark:border-slate-800/80" : ""}`}>
                                        <span className="font-semibold text-[10.5px] text-emerald-600 dark:text-emerald-300 shrink-0 mt-0.5 flex items-center gap-1">
                                          <CheckCircle className="h-3 w-3 text-emerald-500 dark:text-emerald-400" />
                                          Remarks:
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
                                  <SubmissionStatusBadge status={rawStatus} size="sm" />
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
                                        const raw = first.storage_path.split("/").pop() || `${reqLabel}.pdf`;
                                        const clean = cleanDisplayFileName(raw);
                                        setPreviewingDoc({
                                          url: `/api/storage/download?path=${encodeURIComponent(first.storage_path)}`,
                                          name: clean,
                                          mimeType: first.mime_type || null,
                                          label: reqLabel,
                                          storagePath: first.storage_path,
                                        });
                                      }}
                                      className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 px-2.5 py-1 text-xs font-semibold transition cursor-pointer shadow-2xs"
                                    >
                                      <Eye className="h-3.5 w-3.5" />
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
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60">
                  <WarningCircle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Request Requirement Revision
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {revisionModalData.reqLabel} &bull; {faculty.fullName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRevisionModalData(null)}
                className="rounded-full p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <Xmark className="h-4 w-4" />
              </button>
            </div>

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
                            ? "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
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
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingRevision}
                onClick={handleSendRevisionRequest}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 text-xs font-semibold transition shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isSubmittingRevision ? (
                  <>
                    <SystemRestart className="h-3.5 w-3.5 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <WarningCircle className="h-3.5 w-3.5" />
                    Send Revision Request
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
          className="fixed inset-0 z-70 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
          onClick={() => setValidateModalData(null)}
        >
          <div
            className="w-full max-w-lg rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60">
                  <CheckCircle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Validate Requirement
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {validateModalData.reqLabel} &bull; {faculty.fullName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setValidateModalData(null)}
                className="rounded-full p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <Xmark className="h-4 w-4" />
              </button>
            </div>

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
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isValidatingSingle}
                onClick={handleSendValidateRequest}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 text-xs font-semibold transition shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isValidatingSingle ? (
                  <>
                    <SystemRestart className="h-3.5 w-3.5 animate-spin" />
                    Validating...
                  </>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    Confirm &amp; Validate
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* File Preview Sub-Modal */}
      {previewingDoc ? (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
          onClick={() => setPreviewingDoc(null)}
        >
          <div
            className="flex h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-4 py-3">
              <div className="flex items-center gap-2 truncate max-w-[60%]">
                <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  {previewingDoc.label}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  ({previewingDoc.name})
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={previewingDoc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-750 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 transition"
                >
                  <OpenNewWindow className="w-3.5 h-3.5" />
                  Full View
                </a>

                <button
                  type="button"
                  onClick={() =>
                    handleSingleFileDownload(
                      previewingDoc.storagePath || null,
                      previewingDoc.name
                    )
                  }
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-100 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-750 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </button>

                <button
                  type="button"
                  onClick={() => setPreviewingDoc(null)}
                  className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
                  aria-label="Close preview"
                >
                  <Xmark className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="relative flex-1 overflow-hidden bg-slate-100 dark:bg-slate-900 flex items-center justify-center p-4">
              {(() => {
                const fileName = previewingDoc.name || "Document";
                const fileUrl = previewingDoc.url;
                const fileInfo = getFileType(fileName || fileUrl);
                const fileExtension =
                  fileInfo.extension ||
                  (previewingDoc.mimeType?.includes("excel") ||
                  previewingDoc.mimeType?.includes("spreadsheet")
                    ? "xlsx"
                    : previewingDoc.mimeType?.includes("word")
                    ? "docx"
                    : "file");
                const isImage =
                  fileInfo.isImage ||
                  previewingDoc.mimeType?.startsWith("image/");
                const isPdf =
                  fileInfo.isPdf || previewingDoc.mimeType === "application/pdf";
                const isExcel =
                  fileInfo.isExcel ||
                  Boolean(previewingDoc.mimeType?.includes("excel")) ||
                  Boolean(previewingDoc.mimeType?.includes("spreadsheet"));
                const isWord =
                  fileInfo.isWord ||
                  Boolean(previewingDoc.mimeType?.includes("word")) ||
                  Boolean(previewingDoc.mimeType?.includes("document"));

                if (isImage) {
                  return (
                    <img
                      src={fileUrl}
                      alt={fileName}
                      className="max-h-full max-w-full object-contain rounded-xl mx-auto"
                    />
                  );
                }

                if (isExcel || isWord || (!isPdf && !isImage)) {
                  const brand = getFileBrand(fileExtension, isExcel, isWord);

                  return (
                    <div
                      className={`flex flex-col items-center justify-center h-full w-full p-8 text-center bg-slate-50/60 dark:bg-slate-900/80 rounded-2xl border ${brand.borderColor} shadow-xs backdrop-blur-xs transition-all`}
                    >
                      <div className="relative p-4 rounded-2xl bg-white/80 dark:bg-slate-800/80 mb-4 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700/60 flex items-center justify-center">
                        <img
                          src={brand.iconUrl}
                          alt={brand.label}
                          className="w-12 h-12 object-contain select-none"
                          loading="lazy"
                        />
                        <span
                          className={`absolute -bottom-2 -right-2 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider ${brand.badgeBg} shadow-sm`}
                        >
                          {fileExtension}
                        </span>
                      </div>

                      <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1 max-w-sm truncate">
                        {fileName}
                      </h4>

                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-6 max-w-xs leading-relaxed">
                        Direct browser preview is not supported for{" "}
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {brand.label}
                        </span>
                        . You can download the file to view its contents.
                      </p>

                      <a
                        href={fileUrl}
                        download={fileName}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 font-bold text-xs uppercase tracking-wider transition-all shadow-sm cursor-pointer"
                      >
                        <Download className="w-4 h-4 stroke-[2.2]" />
                        Download & View File
                      </a>
                    </div>
                  );
                }

                return (
                  <iframe
                    title="PDF Preview"
                    src={fileUrl}
                    className="w-full h-full rounded-xl border-0"
                  />
                );
              })()}
            </div>
          </div>
        </div>
      ) : null}

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
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {noticeModalData.title}
              </h3>
              <button
                type="button"
                onClick={() => setNoticeModalData(null)}
                className="rounded-full p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
              >
                <Xmark className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-start gap-3 mb-5">
              <InfoCircle className="h-5 w-5 text-slate-500 dark:text-slate-400 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {noticeModalData.message}
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setNoticeModalData(null)}
                className="rounded-xl bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 px-4 py-2 text-xs font-semibold transition cursor-pointer shadow-xs"
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
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Confirm Bulk Validation
              </h3>
              <button
                type="button"
                onClick={() => {
                  if (!isValidatingAll) {
                    setIsValidateModalOpen(false);
                    setBulkValidateNotes("");
                  }
                }}
                className="rounded-full p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
              >
                <Xmark className="h-4 w-4" />
              </button>
            </div>

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
                <p className="rounded-xl border border-amber-200/80 bg-amber-50/80 p-2.5 text-[11px] font-medium text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300 flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 animate-pulse" />
                  Please review for {validateTimerSeconds} second(s) before
                  confirming.
                </p>
              ) : (
                <p className="rounded-xl border border-emerald-200/80 bg-emerald-50/80 p-2.5 text-[11px] font-medium text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300 flex items-center gap-2">
                  <Check className="h-3.5 w-3.5" />
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
                className="rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-750 dark:text-slate-300 px-3.5 py-2 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isValidatingAll || validateTimerSeconds > 0}
                onClick={executeValidateAllPending}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-white transition shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {isValidatingAll ? (
                  <>
                    <SystemRestart className="h-3.5 w-3.5 animate-spin" />
                    Validating...
                  </>
                ) : validateTimerSeconds > 0 ? (
                  `Confirm (${validateTimerSeconds}s)`
                ) : (
                  `Confirm & Validate All (${pendingSubmissionsCount})`
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
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {zipProgressData.title}
              </h3>
              {zipProgressData.status !== "zipping" ? (
                <button
                  type="button"
                  onClick={() => setZipProgressData(null)}
                  className="rounded-full p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
                >
                  <Xmark className="h-4 w-4" />
                </button>
              ) : null}
            </div>

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
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                    <Check className="h-6 w-6" />
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
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                    <WarningTriangle className="h-6 w-6" />
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
                  className="rounded-xl bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 px-4 py-2 text-xs font-bold transition cursor-pointer shadow-xs"
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

export interface RequirementsPanelProps {
  facultyAccounts: FacultyAccount[];
  selectedFaculty?: FacultyAccount | null;
  onSelectFaculty?: (facultyId: string) => void;
  resetTrigger?: number;
}

export function RequirementsPanel({
  facultyAccounts,
  resetTrigger,
}: RequirementsPanelProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProgram, setSelectedProgram] = useState("All Programs");
  const [isProgramDropdownOpen, setIsProgramDropdownOpen] = useState(false);

  const [academicYear, setAcademicYear] = useState("");
  const [semester, setSemester] = useState<SemesterOption>("1st Semester");

  const [facultyStatuses, setFacultyStatuses] = useState<
    Record<string, Record<RequirementCode, RequirementStatus>>
  >({});
  const [isLoadingStatuses, setIsLoadingStatuses] = useState(false);

  const [reviewingFaculty, setReviewingFaculty] = useState<FacultyAccount | null>(
    null
  );

  // Derive unique programs from facultyAccounts
  const availablePrograms = useMemo(() => {
    const set = new Set<string>();
    facultyAccounts.forEach((f) => {
      const code = f.program?.code || f.program?.name;
      if (code) set.add(code);
    });
    return Array.from(set).sort();
  }, [facultyAccounts]);

  // Load active term & statuses on mount
  useEffect(() => {
    let isMounted = true;
    async function loadActiveTermAndStatuses() {
      setIsLoadingStatuses(true);
      try {
        const dummyFacultyId = facultyAccounts[0]?.id || "";
        const res = await fetch(
          `/api/admin/faculty/requirements/verification?facultyId=${encodeURIComponent(
            dummyFacultyId
          )}`,
          { credentials: "include" }
        );
        if (res.ok && isMounted) {
          const data = await res.json();
          const activeAy =
            data.currentAcademicYear || data.selectedAcademicYear || "2026-2027";
          const activeSem: SemesterOption =
            data.currentSemester || data.selectedSemester || "1st Semester";

          setAcademicYear(activeAy);
          setSemester(activeSem);

          // Batch load status for all faculty
          await fetchAllStatuses(activeAy, activeSem);
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
  }, [facultyAccounts, resetTrigger]);

  async function fetchAllStatuses(ay: string, sem: SemesterOption) {
    if (facultyAccounts.length === 0) return;
    try {
      const results = await Promise.all(
        facultyAccounts.map(async (faculty) => {
          try {
            const res = await fetch(
              `/api/admin/faculty/requirements/verification?facultyId=${encodeURIComponent(
                faculty.id
              )}&academicYear=${encodeURIComponent(ay)}&semester=${encodeURIComponent(
                sem
              )}`,
              { credentials: "include" }
            );
            if (res.ok) {
              const data = await res.json();
              return { facultyId: faculty.id, status: data.requirementStatus };
            }
          } catch {
            // Handled
          }
          return { facultyId: faculty.id, status: null };
        })
      );

      const statusMap: Record<string, Record<RequirementCode, RequirementStatus>> =
        {};
      for (const item of results) {
        if (item.status) {
          statusMap[item.facultyId] = item.status;
        }
      }
      setFacultyStatuses(statusMap);
    } catch (err) {
      console.error("Error fetching faculty statuses:", err);
    }
  }

  const filteredFaculty = useMemo(() => {
    return facultyAccounts.filter((f) => {
      const matchesSearch =
        !searchTerm ||
        f.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.email.toLowerCase().includes(searchTerm.toLowerCase());

      const progCode = f.program?.code || f.program?.name || "N/A";
      const matchesProgram =
        selectedProgram === "All Programs" || progCode === selectedProgram;

      return matchesSearch && matchesProgram;
    });
  }, [facultyAccounts, searchTerm, selectedProgram]);

  return (
    <div className="w-full">
      {/* 1. Top Control Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl border border-slate-400/80 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-200 mb-6 shadow-sm shadow-slate-200/60 dark:shadow-none">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5 w-full sm:w-auto">
          {/* Search Input */}
          <input
            type="text"
            placeholder="Search faculty by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-56 rounded-xl border border-slate-400 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
          />

          {/* Custom Program Dropdown Filter */}
          <div className="relative w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setIsProgramDropdownOpen((prev) => !prev)}
              className="flex w-full sm:w-auto items-center justify-between gap-2 rounded-xl border border-slate-400 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-200 outline-none transition hover:border-slate-500 dark:hover:border-slate-700 focus:border-amber-500 cursor-pointer"
            >
              <span>{selectedProgram}</span>
              <NavArrowDown className={`h-3.5 w-3.5 text-slate-500 dark:text-slate-400 transition-transform ${isProgramDropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {isProgramDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setIsProgramDropdownOpen(false)}
                />
                <div className="absolute left-0 top-full mt-1.5 z-30 w-full sm:w-48 rounded-2xl border border-slate-400 dark:border-slate-800 bg-white dark:bg-slate-900 py-1 shadow-xl text-xs text-slate-900 dark:text-slate-200 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProgram("All Programs");
                      setIsProgramDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 transition hover:bg-slate-100 dark:hover:bg-slate-800 ${
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
                      className={`w-full text-left px-3 py-2 transition hover:bg-slate-100 dark:hover:bg-slate-800 ${
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
        </div>

        {/* Active Term Indicator */}
        <div className="text-slate-600 dark:text-slate-400 text-xs font-medium tracking-wide shrink-0">
          A.Y. {academicYear || "2026-2027"} &bull; {semester}
        </div>
      </div>

      {/* 2. Faculty List / Table View */}
      <div className="w-full overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs dark:shadow-none">
        <table className="w-full text-left border-collapse text-xs text-slate-800 dark:text-slate-300 min-w-[750px]">
            <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 uppercase tracking-wider text-[10px] text-slate-600 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-semibold">Faculty Member</th>
                <th className="px-4 py-3 font-semibold">Program</th>
                <th className="px-4 py-3 font-semibold">Verification Progress</th>
                <th className="px-4 py-3 font-semibold">Overall Status</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
              {filteredFaculty.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-12 text-center text-xs text-slate-500 dark:text-slate-400"
                  >
                    No faculty found matching the filter criteria.
                  </td>
                </tr>
              ) : (
                filteredFaculty.map((faculty) => {
                  const statusRecord = facultyStatuses[faculty.id];
                  const validatedCount = statusRecord
                    ? DEFAULT_REQUIREMENTS.filter(
                        (code) => statusRecord[code] === "validated"
                      ).length
                    : 0;

                  const uploadedCount = statusRecord
                    ? DEFAULT_REQUIREMENTS.filter(
                        (code) => statusRecord[code] === "uploaded"
                      ).length
                    : 0;

                  // Overall pure text status
                  let overallStatus: "Validated" | "Pending Review" | "Needs Revision" | "Not Submitted" =
                    "Not Submitted";
                  let statusBadgeClass = "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700";

                  if (validatedCount === DEFAULT_REQUIREMENTS.length) {
                    overallStatus = "Validated";
                    statusBadgeClass = "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/60";
                  } else if (uploadedCount > 0 || (validatedCount > 0 && validatedCount < DEFAULT_REQUIREMENTS.length)) {
                    overallStatus = "Pending Review";
                    statusBadgeClass = "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/60";
                  } else {
                    overallStatus = "Not Submitted";
                    statusBadgeClass = "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700";
                  }

                  const programCode =
                    faculty.program?.code || faculty.program?.name || "N/A";

                  return (
                    <tr
                      key={faculty.id}
                      className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition"
                    >
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-200">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-amber-500/30 bg-amber-500/10 text-xs font-bold text-amber-800 dark:text-amber-300 shadow-sm">
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
                            <div className="font-semibold text-slate-900 dark:text-slate-100">{faculty.fullName}</div>
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
                          <span className="text-slate-500 dark:text-slate-400 italic text-[11px]">
                            Loading...
                          </span>
                        ) : (
                          `${validatedCount}/${DEFAULT_REQUIREMENTS.length} Validated`
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {isLoadingStatuses && !statusRecord ? (
                          <span className="text-slate-500 dark:text-slate-400 italic text-[11px]">
                            ...
                          </span>
                        ) : (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${statusBadgeClass}`}>
                            {overallStatus}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setReviewingFaculty(faculty)}
                          className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-3.5 py-1.5 rounded-xl text-xs shadow-sm transition cursor-pointer"
                        >
                          Review Requirements
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
      </div>

      {/* 3. Faculty Verification Modal / Slide-over Drawer */}
      {reviewingFaculty ? (
        <FacultyVerificationDrawer
          faculty={reviewingFaculty}
          academicYear={academicYear}
          semester={semester}
          onClose={() => setReviewingFaculty(null)}
          onStatusUpdated={() => {
            if (academicYear && semester) {
              fetchAllStatuses(academicYear, semester);
            }
          }}
        />
      ) : null}
    </div>
  );
}
