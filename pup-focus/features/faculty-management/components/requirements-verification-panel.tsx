"use client";

import { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import JSZip from "jszip";
import { ExternalLink } from "lucide-react";
import {
  DEFAULT_REQUIREMENTS,
  REQUIREMENT_LABEL,
  type RequirementCode,
} from "@/config/compliance";
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

interface FacultyVerificationDrawerProps {
  faculty: FacultyAccount;
  academicYear: string;
  semester: SemesterOption;
  onClose: () => void;
  onStatusUpdated: () => void;
}

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
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [isValidatingAll, setIsValidatingAll] = useState(false);

  // History Tab States
  const [historyAcademicYears, setHistoryAcademicYears] = useState<string[]>([]);
  const [selectedHistoryAy, setSelectedHistoryAy] = useState<string>("");
  const [selectedHistorySem, setSelectedHistorySem] = useState<SemesterOption>("1st Semester");
  const [isDownloadingHistoryZip, setIsDownloadingHistoryZip] = useState(false);

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

  const pendingSubmissionsCount = useMemo(() => {
    return submissions.filter((s) => {
      const term = toAcademicYearAndSemester(s.submitted_at || s.created_at);
      const matchesTerm =
        term.academicYear === academicYear && term.semester === semester;
      const isPending =
        s.status === "uploaded" ||
        s.status === "pending" ||
        s.status === "submitted" ||
        s.status === "under_review";
      return (
        matchesTerm &&
        isPending &&
        Array.isArray(s.document_versions) &&
        s.document_versions.length > 0
      );
    }).length;
  }, [submissions, academicYear, semester]);

  useEffect(() => {
    async function loadDrawerData() {
      setIsLoading(true);
      try {
        const [subRes, verRes] = await Promise.all([
          fetch(
            `/api/admin/faculty/submissions?facultyId=${encodeURIComponent(faculty.id)}`,
            { credentials: "include" }
          ),
          fetch(
            `/api/admin/faculty/requirements/verification?facultyId=${encodeURIComponent(faculty.id)}`,
            { credentials: "include" }
          ),
        ]);

        if (subRes.ok) {
          const subData = await subRes.json();
          setSubmissions(subData.submissions || []);
        }

        if (verRes.ok) {
          const verData = await verRes.json();
          const years: string[] = verData.availableAcademicYears ?? [];
          setHistoryAcademicYears(years);
          const pastYear =
            years.find((y) => y !== academicYear) || years[0] || "2025-2026";
          setSelectedHistoryAy(pastYear);
        }
      } catch (err) {
        console.error("Failed to load drawer data:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadDrawerData();
  }, [faculty.id, academicYear]);

  async function handleReviewSubmission(
    submissionId: string,
    decision: "validated" | "rejected",
    code: string
  ) {
    setReviewingCode(code);
    try {
      const response = await fetch("/api/admin/faculty/submissions/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          submissionId,
          decision,
          remarks: remarksInput[code] || "",
        }),
      });

      if (response.ok) {
        setSubmissions((prev) =>
          prev.map((sub) =>
            sub.id === submissionId ? { ...sub, status: decision } : sub
          )
        );
        setRemarksInput((prev) => ({ ...prev, [code]: "" }));
        onStatusUpdated();
      } else {
        const errData = await response.json().catch(() => ({}));
        alert(`Error: ${errData.error || "Failed to submit review"}`);
      }
    } catch (err) {
      console.error("Review submission error:", err);
      alert("Failed to process review action.");
    } finally {
      setReviewingCode(null);
    }
  }

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
        const term = toAcademicYearAndSemester(s.submitted_at || s.created_at);
        const matchesTerm =
          term.academicYear === academicYear && term.semester === semester;
        return (
          matchesTerm &&
          Array.isArray(s.document_versions) &&
          s.document_versions.length > 0
        );
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
      const term = toAcademicYearAndSemester(s.submitted_at || s.created_at);
      const matchesTerm =
        term.academicYear === academicYear && term.semester === semester;
      const isPending =
        s.status === "uploaded" ||
        s.status === "pending" ||
        s.status === "submitted" ||
        s.status === "under_review";
      return matchesTerm && isPending && Array.isArray(s.document_versions) && s.document_versions.length > 0;
    });

    if (pendingSubmissions.length === 0) {
      setNoticeModalData({
        title: "No Pending Requirements",
        message: `No pending requirement submissions are available to validate for ${faculty.fullName} (A.Y. ${academicYear} • ${semester}).`,
      });
      return;
    }

    setValidateTimerSeconds(5);
    setIsValidateModalOpen(true);
  }

  async function executeValidateAllPending() {
    const pendingSubmissions = submissions.filter((s) => {
      const term = toAcademicYearAndSemester(s.submitted_at || s.created_at);
      const matchesTerm =
        term.academicYear === academicYear && term.semester === semester;
      const isPending =
        s.status === "uploaded" ||
        s.status === "pending" ||
        s.status === "submitted" ||
        s.status === "under_review";
      return matchesTerm && isPending && Array.isArray(s.document_versions) && s.document_versions.length > 0;
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
      await Promise.all(
        pendingSubmissions.map((sub) =>
          fetch("/api/admin/faculty/submissions/review", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              submissionId: sub.id,
              decision: "validated",
              remarks: "Bulk validated by admin",
            }),
          })
        )
      );

      const pendingIds = new Set(pendingSubmissions.map((s) => s.id));
      setSubmissions((prev) =>
        prev.map((sub) =>
          pendingIds.has(sub.id) ? { ...sub, status: "validated" } : sub
        )
      );
      setActionFeedback({
        type: "success",
        message: `Successfully validated ${pendingSubmissions.length} requirement(s)!`,
      });
      setTimeout(() => setActionFeedback(null), 4000);
      onStatusUpdated();
      setIsValidateModalOpen(false);
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

  const historySubmissions = useMemo(() => {
    return submissions.filter((sub) => {
      const term = toAcademicYearAndSemester(sub.submitted_at || sub.created_at);
      return (
        term.academicYear === selectedHistoryAy &&
        term.semester === selectedHistorySem
      );
    });
  }, [submissions, selectedHistoryAy, selectedHistorySem]);

  const departmentLabel =
    faculty.program?.name || faculty.program?.code || "Department";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-3 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-950 text-slate-100 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-amber-500/30 bg-amber-500/10 text-xs font-bold text-amber-300 shadow-md">
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
              <h3 className="text-base font-semibold text-slate-100">
                {faculty.fullName}
              </h3>
              <p className="mt-0.5 text-xs text-slate-400">
                {departmentLabel} &bull; Active Term: A.Y. {academicYear} &bull; {semester}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-800 p-1.5 text-slate-400 transition hover:bg-slate-900 hover:text-slate-200 cursor-pointer"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* 1. Tab Navigation Bar */}
        <div className="flex items-center gap-2 border-b border-slate-800 px-6 py-3 bg-slate-900/60">
          <button
            type="button"
            onClick={() => setActiveTab("current")}
            className={`rounded-xl px-4 py-2 text-xs font-semibold transition cursor-pointer border ${
              activeTab === "current"
                ? "border-amber-500/40 bg-amber-500/10 text-amber-300 shadow-sm"
                : "border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:text-slate-200"
            }`}
          >
            Current Submissions
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`rounded-xl px-4 py-2 text-xs font-semibold transition cursor-pointer border ${
              activeTab === "history"
                ? "border-amber-500/40 bg-amber-500/10 text-amber-300 shadow-sm"
                : "border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:text-slate-200"
            }`}
          >
            Verification History
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {isLoading ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Loading faculty requirements...
            </div>
          ) : activeTab === "current" ? (
            /* Tab 1: Current Submissions */
            <div className="space-y-4">
              {/* Current Term Actions Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Bulk Actions
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {/* "Validate All Pending" Bulk Action */}
                  <button
                    type="button"
                    disabled={isValidatingAll}
                    onClick={triggerValidateAllPendingModal}
                    className="text-amber-300 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 hover:text-amber-200 text-xs font-medium rounded-lg px-3 py-1.5 transition cursor-pointer disabled:opacity-50"
                  >
                    {isValidatingAll
                      ? "Validating..."
                      : `Validate All Pending (${pendingSubmissionsCount})`}
                  </button>

                  {/* "Download All (ZIP)" Action */}
                  <button
                    type="button"
                    disabled={isDownloadingZip}
                    onClick={handleDownloadZip}
                    className="text-amber-300 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 hover:text-amber-200 text-xs font-medium rounded-lg px-3 py-1.5 transition cursor-pointer disabled:opacity-50"
                  >
                    {isDownloadingZip ? "Zipping..." : "Download All (ZIP)"}
                  </button>
                </div>
              </div>

              {/* Action Feedback Banner */}
              {actionFeedback ? (
                <div
                  className={`flex items-center gap-2.5 rounded-xl border p-3 text-xs font-semibold shadow-md transition-all ${
                    actionFeedback.type === "info"
                      ? "border-amber-500/40 bg-amber-950/60 text-amber-300"
                      : actionFeedback.type === "success"
                      ? "border-emerald-500/40 bg-emerald-950/60 text-emerald-300"
                      : "border-rose-500/40 bg-rose-950/60 text-rose-300"
                  }`}
                >
                  <span className="text-sm">
                    {actionFeedback.type === "info"
                      ? "ℹ️"
                      : actionFeedback.type === "success"
                      ? "✅"
                      : "⚠️"}
                  </span>
                  <span>{actionFeedback.message}</span>
                </div>
              ) : null}
              {DEFAULT_REQUIREMENTS.map((code) => {
                const reqLabel = REQUIREMENT_LABEL[code];
                const matchingSubmission = submissions.find((s) => {
                  if (s.requirement_code !== code) return false;
                  const term = toAcademicYearAndSemester(
                    s.submitted_at || s.created_at
                  );
                  if (academicYear && term.academicYear !== academicYear)
                    return false;
                  if (semester && term.semester !== semester) return false;
                  return true;
                });

                const documents = matchingSubmission?.document_versions ?? [];
                const firstDoc = documents[0] ?? null;

                const rawStatus = matchingSubmission
                  ? (matchingSubmission.status || "").toLowerCase()
                  : "not_submitted";
                const isValidated = rawStatus === "validated" || rawStatus === "approved";
                const pureStatus = getPureStatusText(rawStatus as any);
                const statusColor = getStatusTextColor(rawStatus as any);

                const hasFile = documents.length > 0 && firstDoc?.storage_path;
                const fileDownloadUrl = hasFile
                  ? `/api/storage/download?path=${encodeURIComponent(
                      firstDoc.storage_path
                    )}`
                  : null;

                return (
                  <div
                    key={code}
                    className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-4 transition hover:border-slate-800"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/60 pb-3">
                      <div>
                        <h4 className="text-xs font-semibold text-slate-200">
                          {reqLabel}
                        </h4>
                        <p className="mt-0.5 text-[10px] text-slate-500">
                          Code: {code}
                        </p>
                      </div>
                      <span className={`text-xs font-medium ${statusColor}`}>
                        {pureStatus}
                      </span>
                    </div>

                    {matchingSubmission ? (
                      <div className="mt-3 space-y-3">
                        {matchingSubmission.remarks ? (
                          <div className="text-xs">
                            <span className="text-[10px] uppercase tracking-wider text-slate-500">
                              Faculty Remarks:
                            </span>
                            <p className="mt-0.5 text-slate-300 italic">
                              "{matchingSubmission.remarks}"
                            </p>
                          </div>
                        ) : null}

                        {/* File Preview Links */}
                        {fileDownloadUrl ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setPreviewingDoc({
                                  url: fileDownloadUrl,
                                  name: firstDoc?.storage_path.split("/").pop() || "File",
                                  mimeType: firstDoc?.mime_type,
                                  label: reqLabel,
                                  storagePath: firstDoc?.storage_path,
                                });
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-300 hover:bg-amber-500/20 hover:text-amber-200 transition cursor-pointer"
                            >
                              Preview File
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleSingleFileDownload(
                                  firstDoc?.storage_path,
                                  firstDoc?.storage_path?.split("/").pop() || `${reqLabel}.pdf`
                                )
                              }
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-slate-850 hover:text-slate-100 transition cursor-pointer"
                            >
                              Download
                            </button>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500 italic">
                            No file attached
                          </p>
                        )}

                        {/* 3. Lock Validated Requirements (Prevent Re-Validation) */}
                        {isValidated ? null : (
                          /* Direct Validation Controls */
                          <div className="space-y-2 pt-1">
                            <input
                              type="text"
                              placeholder="Add remarks for faculty (optional)..."
                              value={remarksInput[code] || ""}
                              onChange={(e) =>
                                setRemarksInput((prev) => ({
                                  ...prev,
                                  [code]: e.target.value,
                                }))
                              }
                              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-amber-400/80"
                            />
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={reviewingCode === code}
                                onClick={() =>
                                  handleReviewSubmission(
                                    matchingSubmission.id,
                                    "validated",
                                    code
                                  )
                                }
                                className="rounded-lg bg-amber-400 hover:bg-amber-300 px-3.5 py-1.5 text-xs font-semibold text-slate-950 transition disabled:opacity-50"
                              >
                                {reviewingCode === code ? "Updating..." : "Validate"}
                              </button>
                              <button
                                type="button"
                                disabled={reviewingCode === code}
                                onClick={() =>
                                  handleReviewSubmission(
                                    matchingSubmission.id,
                                    "rejected",
                                    code
                                  )
                                }
                                className="rounded-lg border border-amber-400/60 hover:bg-amber-400/10 px-3.5 py-1.5 text-xs font-semibold text-amber-300 transition disabled:opacity-50"
                              >
                                {reviewingCode === code ? "Updating..." : "Request Revision"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mt-3 text-xs text-slate-500 italic">
                        Not Submitted
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* Tab 2: Verification History */
            <div className="space-y-4">
              {/* Term Dropdown Selector & Download Action */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Past Academic Term:
                  </span>
                  <select
                    value={selectedHistoryAy}
                    onChange={(e) => setSelectedHistoryAy(e.target.value)}
                    className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 outline-none transition focus:border-amber-400/80"
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
                    className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 outline-none transition focus:border-amber-400/80"
                  >
                    <option value="1st Semester">1st Semester</option>
                    <option value="2nd Semester">2nd Semester</option>
                  </select>
                </div>

                {/* "Download All (ZIP)" Action for Verification History */}
                <button
                  type="button"
                  disabled={isDownloadingHistoryZip}
                  onClick={handleDownloadHistoryZip}
                  className="text-amber-300 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 hover:text-amber-200 text-xs font-medium rounded-lg px-3 py-1.5 transition cursor-pointer disabled:opacity-50"
                >
                  {isDownloadingHistoryZip ? "Zipping..." : "Download History ZIP"}
                </button>
              </div>

              {/* Action Feedback Banner */}
              {actionFeedback ? (
                <div
                  className={`flex items-center gap-2.5 rounded-xl border p-3 text-xs font-semibold shadow-md transition-all ${
                    actionFeedback.type === "info"
                      ? "border-amber-500/40 bg-amber-950/60 text-amber-300"
                      : actionFeedback.type === "success"
                      ? "border-emerald-500/40 bg-emerald-950/60 text-emerald-300"
                      : "border-rose-500/40 bg-rose-950/60 text-rose-300"
                  }`}
                >
                  <span className="text-sm">
                    {actionFeedback.type === "info"
                      ? "ℹ️"
                      : actionFeedback.type === "success"
                      ? "✅"
                      : "⚠️"}
                  </span>
                  <span>{actionFeedback.message}</span>
                </div>
              ) : null}

              {/* Past Submissions List */}
              <div className="space-y-3">
                {DEFAULT_REQUIREMENTS.map((code) => {
                  const reqLabel = REQUIREMENT_LABEL[code];
                  const matchingSub = historySubmissions.find(
                    (s) => s.requirement_code === code
                  );
                  const docs = matchingSub?.document_versions ?? [];
                  const latestReview = matchingSub?.review_decisions?.[0] ?? null;

                  const rawStatus = matchingSub?.status ?? null;
                  const pureStatus = getPureStatusText(rawStatus as any);
                  const statusColor = getStatusTextColor(rawStatus as any);

                  if (!matchingSub) {
                    return (
                      <div
                        key={code}
                        className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4"
                      >
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-semibold text-slate-200">
                            {reqLabel}
                          </h4>
                          <span className="text-xs text-slate-500 italic">
                            Not Submitted
                          </span>
                        </div>
                      </div>
                    );
                  }

                  const submittedDateText = formatFullDateTime(
                    matchingSub.submitted_at || matchingSub.created_at
                  );

                  return (
                    <div
                      key={code}
                      className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/60 pb-2.5">
                        <div>
                          <h4 className="text-xs font-semibold text-slate-200">
                            {reqLabel}
                          </h4>
                          <p className="mt-0.5 text-[10px] text-slate-500">
                            Submitted: {submittedDateText}
                          </p>
                        </div>
                        <span className={`text-xs font-medium ${statusColor}`}>
                          {pureStatus}
                        </span>
                      </div>

                      {/* File version details */}
                      {docs.length > 0 ? (
                        docs.map((doc, idx) => {
                          const fileName =
                            doc.storage_path?.split("/").pop() || "Document";
                          const fileSize = formatBytes(doc.size_bytes);
                          const versionLabel = doc.version_number
                            ? `Version ${doc.version_number}`
                            : `Version 1`;
                          const downloadUrl = `/api/storage/download?path=${encodeURIComponent(
                            doc.storage_path
                          )}`;

                          return (
                            <div
                              key={doc.id || idx}
                              className="flex flex-wrap items-center justify-between gap-2.5 rounded-lg border border-slate-800/80 bg-slate-950 p-3 text-xs"
                            >
                              <div className="flex items-center gap-2">
                                <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                                  {versionLabel}
                                </span>
                                <span className="font-medium text-slate-200">
                                  {fileName}
                                </span>
                                {fileSize ? (
                                  <span className="text-[10px] text-slate-500">
                                    ({fileSize})
                                  </span>
                                ) : null}
                              </div>

                              <div className="flex items-center gap-2">
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
                                  className="inline-flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-300 hover:bg-amber-500/20 hover:text-amber-200 transition cursor-pointer"
                                >
                                  Preview File
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    handleSingleFileDownload(doc.storage_path, fileName)
                                  }
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-slate-850 hover:text-slate-100 transition cursor-pointer"
                                >
                                  Download
                                </button>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-xs text-slate-500 italic">
                          No document files logged.
                        </p>
                      )}

                      {/* Faculty Remarks */}
                      {matchingSub.remarks ? (
                        <div className="rounded-lg border border-slate-800/80 bg-slate-950 p-2.5 text-xs">
                          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                            Faculty Remarks:
                          </span>
                          <p className="mt-1 text-slate-300 italic">
                            "{matchingSub.remarks}"
                          </p>
                        </div>
                      ) : null}

                      {/* Admin Feedback */}
                      {latestReview?.remarks ? (
                        <div className="rounded-lg border border-amber-500/20 bg-amber-950/20 p-2.5 text-xs">
                          <span className="text-[10px] uppercase tracking-wider text-amber-400/90 font-semibold">
                            Admin Feedback:
                          </span>
                          <p className="mt-1 text-amber-200/90 italic">
                            "{latestReview.remarks}"
                          </p>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* File Preview Sub-Modal */}
      {previewingDoc ? (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/90 p-4"
          onClick={() => setPreviewingDoc(null)}
        >
          <div
            className="flex h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-950"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
              <div className="flex items-center gap-2 truncate max-w-[60%]">
                <span className="text-xs font-semibold text-slate-100">
                  {previewingDoc.label}
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  ({previewingDoc.name})
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Full View Button */}
                <a
                  href={previewingDoc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-300 transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Full View
                </a>

                {/* Direct Download Button inside Preview Modal */}
                <button
                  type="button"
                  onClick={() =>
                    handleSingleFileDownload(
                      previewingDoc.storagePath || null,
                      previewingDoc.name
                    )
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 transition cursor-pointer"
                >
                  Download
                </button>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => setPreviewingDoc(null)}
                  className="rounded-lg border border-slate-800 p-1.5 text-slate-400 hover:bg-slate-900 hover:text-slate-200 transition cursor-pointer"
                  aria-label="Close preview"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="relative flex-1 overflow-hidden bg-slate-900 flex items-center justify-center">
              {previewingDoc.mimeType?.startsWith("image/") ||
              /\.(jpe?g|png|gif|bmp|webp)$/i.test(previewingDoc.name) ? (
                <Image
                  src={previewingDoc.url}
                  alt={previewingDoc.name}
                  width={1000}
                  height={800}
                  unoptimized
                  className="h-full w-full object-contain"
                />
              ) : previewingDoc.mimeType === "application/pdf" ||
                /\.pdf$/i.test(previewingDoc.name) ? (
                <iframe
                  title="PDF Preview"
                  src={previewingDoc.url}
                  className="h-full w-full border-0"
                />
              ) : (
                <div className="p-4 text-xs text-slate-400">
                  Preview not available for this file type. Please download the file.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* Notice Pop-up Modal (No Downloadable / No Pending Requirements) */}
      {noticeModalData ? (
        <div
          className="fixed inset-0 z-70 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setNoticeModalData(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-amber-500/30 bg-[#2a060a]/95 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-amber-500/20 pb-3 mb-4">
              <h3 className="text-base font-bold text-[#fff8e7]">
                {noticeModalData.title}
              </h3>
              <button
                type="button"
                onClick={() => setNoticeModalData(null)}
                className="text-amber-400 hover:text-amber-300 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex items-start gap-3 mb-5">
              <span className="text-2xl shrink-0">ℹ️</span>
              <p className="text-xs text-slate-300 leading-relaxed">
                {noticeModalData.message}
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setNoticeModalData(null)}
                className="rounded-lg bg-amber-500 hover:bg-amber-400 px-4 py-2 text-xs font-bold text-slate-950 transition cursor-pointer shadow-md"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Validate All Pending Confirmation Pop-up Modal with 5s Safety Timer */}
      {isValidateModalOpen ? (
        <div
          className="fixed inset-0 z-70 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setIsValidateModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-amber-500/30 bg-[#2a060a]/95 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-amber-500/20 pb-3 mb-4">
              <h3 className="text-base font-bold text-[#fff8e7]">
                Confirm Bulk Validation
              </h3>
              <button
                type="button"
                onClick={() => setIsValidateModalOpen(false)}
                className="text-amber-400 hover:text-amber-300 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 mb-5">
              <p className="text-xs text-slate-300 leading-relaxed">
                You are about to validate <span className="font-bold text-amber-300">{pendingSubmissionsCount} pending requirement(s)</span> for <span className="font-semibold text-slate-100">{faculty.fullName}</span> for <span className="font-semibold text-slate-100">A.Y. {academicYear} &bull; {semester}</span>.
              </p>
              {validateTimerSeconds > 0 ? (
                <p className="rounded-lg border border-amber-500/30 bg-amber-950/40 p-2.5 text-[11px] font-medium text-amber-300 flex items-center gap-2">
                  <span className="animate-pulse">⏳</span> Please review for {validateTimerSeconds} second(s) before confirming.
                </p>
              ) : (
                <p className="rounded-lg border border-emerald-500/30 bg-emerald-950/40 p-2.5 text-[11px] font-medium text-emerald-300 flex items-center gap-2">
                  <span>✅</span> Ready to confirm bulk validation.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isValidatingAll}
                onClick={() => setIsValidateModalOpen(false)}
                className="rounded-lg bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isValidatingAll || validateTimerSeconds > 0}
                onClick={executeValidateAllPending}
                className="rounded-lg bg-amber-500 hover:bg-amber-400 px-4 py-2 text-xs font-bold text-slate-950 transition shadow-md disabled:opacity-50 cursor-pointer"
              >
                {isValidatingAll
                  ? "Validating..."
                  : validateTimerSeconds > 0
                  ? `Confirm (${validateTimerSeconds}s)`
                  : `Confirm & Validate All (${pendingSubmissionsCount})`}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Zipping / Downloading Progress Modal */}
      {zipProgressData ? (
        <div
          className="fixed inset-0 z-70 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => {
            if (zipProgressData.status !== "zipping") {
              setZipProgressData(null);
            }
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-amber-500/30 bg-[#2a060a]/95 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-amber-500/20 pb-3 mb-4">
              <h3 className="text-base font-bold text-[#fff8e7]">
                {zipProgressData.title}
              </h3>
              {zipProgressData.status !== "zipping" ? (
                <button
                  type="button"
                  onClick={() => setZipProgressData(null)}
                  className="text-amber-400 hover:text-amber-300 text-sm cursor-pointer"
                >
                  ✕
                </button>
              ) : null}
            </div>

            <div className="flex flex-col items-center justify-center py-4 text-center space-y-4">
              {zipProgressData.status === "zipping" ? (
                <>
                  <div className="relative flex h-14 w-14 items-center justify-center">
                    <div className="absolute h-full w-full animate-spin rounded-full border-4 border-amber-500/20 border-t-amber-400"></div>
                    <span className="text-xl">📦</span>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-200">
                      {zipProgressData.message}
                    </p>
                    {zipProgressData.progressText ? (
                      <p className="mt-1 text-[11px] font-mono text-amber-300">
                        {zipProgressData.progressText}
                      </p>
                    ) : null}
                  </div>
                </>
              ) : zipProgressData.status === "success" ? (
                <>
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-2xl border border-emerald-500/30">
                    ✅
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-emerald-300">
                      {zipProgressData.message}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Check your browser's downloads folder.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/20 text-rose-400 text-2xl border border-rose-500/30">
                    ⚠️
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-rose-300">
                      {zipProgressData.message}
                    </p>
                  </div>
                </>
              )}
            </div>

            {zipProgressData.status !== "zipping" ? (
              <div className="flex justify-end pt-2 border-t border-amber-500/20 mt-2">
                <button
                  type="button"
                  onClick={() => setZipProgressData(null)}
                  className="rounded-lg bg-amber-500 hover:bg-amber-400 px-4 py-2 text-xs font-bold text-slate-950 transition cursor-pointer shadow-md"
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
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border border-slate-800 bg-slate-950 text-slate-200 mb-6">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          {/* Search Input */}
          <input
            type="text"
            placeholder="Search faculty by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-64 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 outline-none transition focus:border-amber-400/80 focus:ring-1 focus:ring-amber-400/30"
          />

          {/* Program Dropdown Filter */}
          <select
            value={selectedProgram}
            onChange={(e) => setSelectedProgram(e.target.value)}
            className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 outline-none transition focus:border-amber-400/80 focus:ring-1 focus:ring-amber-400/30"
          >
            <option value="All Programs">All Programs</option>
            {availablePrograms.map((prog) => (
              <option key={prog} value={prog}>
                {prog}
              </option>
            ))}
          </select>
        </div>

        {/* Active Term Indicator */}
        <div className="text-slate-400 text-xs font-medium tracking-wide shrink-0">
          A.Y. {academicYear || "2026-2027"} &bull; {semester}
        </div>
      </div>

      {/* 2. Faculty List / Table View */}
      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="border-b border-slate-800 bg-slate-900/60 uppercase tracking-wider text-[10px] text-slate-400">
              <tr>
                <th className="px-4 py-3.5 font-semibold">Faculty Name</th>
                <th className="px-4 py-3.5 font-semibold">Program</th>
                <th className="px-4 py-3.5 font-semibold">Submission Progress</th>
                <th className="px-4 py-3.5 font-semibold">Status</th>
                <th className="px-4 py-3.5 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredFaculty.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-xs text-slate-500"
                  >
                    No faculty members found.
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
                  let textColor = "text-slate-400";

                  if (validatedCount === DEFAULT_REQUIREMENTS.length) {
                    overallStatus = "Validated";
                    textColor = "text-emerald-400";
                  } else if (uploadedCount > 0 || (validatedCount > 0 && validatedCount < DEFAULT_REQUIREMENTS.length)) {
                    overallStatus = "Pending Review";
                    textColor = "text-amber-400";
                  } else {
                    overallStatus = "Not Submitted";
                    textColor = "text-slate-400";
                  }

                  const programCode =
                    faculty.program?.code || faculty.program?.name || "N/A";

                  return (
                    <tr
                      key={faculty.id}
                      className="transition hover:bg-slate-900/40"
                    >
                      <td className="px-4 py-3 font-medium text-slate-200">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-amber-500/30 bg-amber-500/10 text-xs font-bold text-amber-300 shadow-sm">
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
                            <div className="font-semibold text-slate-100">{faculty.fullName}</div>
                            {faculty.email ? (
                              <div className="text-[10px] text-slate-500 font-normal">
                                {faculty.email}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-400 font-medium">
                        {programCode}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {isLoadingStatuses && !statusRecord ? (
                          <span className="text-slate-500 italic text-[11px]">
                            Loading...
                          </span>
                        ) : (
                          `${validatedCount}/${DEFAULT_REQUIREMENTS.length} Validated`
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {isLoadingStatuses && !statusRecord ? (
                          <span className="text-slate-500 italic text-[11px]">
                            ...
                          </span>
                        ) : (
                          <span className={`text-xs ${textColor}`}>
                            {overallStatus}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setReviewingFaculty(faculty)}
                          className="inline-flex items-center gap-1 rounded-lg border border-amber-400/60 bg-amber-400/10 hover:bg-amber-400/20 px-3 py-1.5 text-xs font-semibold text-amber-300 transition"
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
