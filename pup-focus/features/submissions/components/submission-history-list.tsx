"use client";

import React from "react";
import { ChatBubble, Check, CheckCircle, Download, Eye, Folder, NavArrowLeft, NavArrowRight, Notes, WarningCircle } from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";
import { REQUIREMENT_LABEL, type RequirementCode } from "@/config/compliance";
import { SubmissionStatusBadge } from "./submission-status-badge";
import { cn } from "@/utils/cn";

export type PastSubmissionItem = {
  id: string;
  academicYear: string;
  semester: string;
  requirementCode: RequirementCode | string;
  status: string;
  submittedAt: string;
  updatedAt?: string;
  dateValidated?: string;
  note?: string;
  remarks?: string;
  admin_remarks?: string;
  adminRemarks?: string | null;
  feedback?: string;
  fileName?: string;
  storagePath?: string;
  reviewedAt?: string;
  is_read?: boolean;
  isViewed?: boolean;
  viewed_at?: string;
  classId?: string | null;
  class_id?: string | null;
  faculty_class?: {
    id?: string;
    section_code?: string;
    subject_code?: string;
    description?: string;
    units?: number;
    is_archived?: boolean;
  } | null;
};

export interface SubmissionHistoryClass {
  id: string;
  subject_code: string;
  description: string;
  units: number;
  section_code: string;
  is_archived?: boolean;
}

export interface SubmissionHistoryListProps<T extends PastSubmissionItem = PastSubmissionItem> {
  submissions: T[];
  classes?: SubmissionHistoryClass[];
  onViewFile: (submission: T) => void;
  onDownloadFile?: (submission: T) => void;
  viewedSubmissionIds?: Set<string>;
  getRequirementTitle?: (code: string) => string;
  templateMandatoryMap?: Map<string, boolean>;
  totalRequiredCount?: number;
  emptyMessage?: string;
  className?: string;
}

export const REQUIREMENT_NAME_MAP: Record<string, string> = {
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

export function getFriendlyRequirementName(code?: string): string {
  if (!code) return "Requirement Document";
  if (REQUIREMENT_LABEL[code as RequirementCode]) {
    return REQUIREMENT_LABEL[code as RequirementCode];
  }
  const clean = code.toLowerCase().trim().replace(/[-_\s]+/g, "");
  for (const [key, label] of Object.entries(REQUIREMENT_NAME_MAP)) {
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

function formatDateTime(value?: string): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDateOnly(value?: string): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTimeOnly(value?: string): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";

  return parsed.toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

interface HistoryClassCardGroup<T> {
  key: string;
  classId: string | null;
  sectionCode: string;
  subjectCode: string;
  description: string;
  units: number | null;
  submissions: T[];
  isGeneral?: boolean;
}

function cleanDisplayFileName(rawName: string): string {
  return rawName.replace(/^\d+_/, "");
}

export function SubmissionHistoryList<T extends PastSubmissionItem = PastSubmissionItem>({
  submissions,
  classes = [],
  onViewFile,
  onDownloadFile,
  viewedSubmissionIds = new Set(),
  getRequirementTitle,
  templateMandatoryMap,
  totalRequiredCount,
  emptyMessage = "No validated documents found for the selected academic term.",
  className = "",
}: SubmissionHistoryListProps<T>) {
  const [selectedClassKey, setSelectedClassKey] = React.useState<string | null>(null);

  // Group validated submissions into subject cards
  const classGroups = React.useMemo<HistoryClassCardGroup<T>[]>(() => {
    const groups: HistoryClassCardGroup<T>[] = [];
    const classMap = new Map<string, HistoryClassCardGroup<T>>();

    // 1. Registered faculty classes
    classes
      .filter((c) => !c.is_archived)
      .forEach((c) => {
        const key = c.id || `${c.section_code}_${c.subject_code}`;
        const group: HistoryClassCardGroup<T> = {
          key,
          classId: c.id || null,
          sectionCode: c.section_code,
          subjectCode: c.subject_code,
          description: c.description,
          units: c.units,
          submissions: [],
        };
        groups.push(group);
        classMap.set(key, group);
        if (c.id) classMap.set(c.id, group);
      });

    // 2. Discover classes from submissions
    submissions.forEach((sub) => {
      if (sub.faculty_class) {
        const fc = sub.faculty_class;
        const key = fc.id || `${fc.section_code}_${fc.subject_code}`;
        if (!classMap.has(key) && !(fc.id && classMap.has(fc.id))) {
          const group: HistoryClassCardGroup<T> = {
            key,
            classId: fc.id || null,
            sectionCode: fc.section_code || "Section",
            subjectCode: fc.subject_code || "Subject",
            description: fc.description || "Course Load",
            units: fc.units ?? 3.0,
            submissions: [],
          };
          groups.push(group);
          classMap.set(key, group);
          if (fc.id) classMap.set(fc.id, group);
        }
      }
    });

    // 3. Map submissions into groups
    const unassigned: T[] = [];
    submissions.forEach((sub) => {
      const cId = (sub as any).classId || (sub as any).class_id;
      let target: HistoryClassCardGroup<T> | undefined;
      if (cId && classMap.has(cId)) {
        target = classMap.get(cId);
      } else if (sub.faculty_class) {
        const key = sub.faculty_class.id || `${sub.faculty_class.section_code}_${sub.faculty_class.subject_code}`;
        target = classMap.get(key);
      }

      if (target) {
        target.submissions.push(sub);
      } else {
        unassigned.push(sub);
      }
    });

    if (unassigned.length > 0) {
      groups.unshift({
        key: "general",
        classId: null,
        sectionCode: "General Requirements",
        subjectCode: "GENERAL",
        description: "General / Institutional Requirements",
        units: null,
        submissions: unassigned,
        isGeneral: true,
      });
    }

    return groups.filter((g) => g.submissions.length > 0);
  }, [classes, submissions]);

  const selectedGroup = React.useMemo(() => {
    if (!selectedClassKey) return null;
    return classGroups.find((g) => g.key === selectedClassKey || (g.classId && g.classId === selectedClassKey)) || null;
  }, [selectedClassKey, classGroups]);

  function handleDownload(sub: T) {
    if (onDownloadFile) {
      onDownloadFile(sub);
      return;
    }
    const resolvedTitle = getRequirementTitle
      ? getRequirementTitle(sub.requirementCode)
      : getFriendlyRequirementName(sub.requirementCode);
    const downloadUrl = `/api/faculty/submissions/view?submissionId=${encodeURIComponent(sub.id)}&download=true`;
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = sub.fileName || `${resolvedTitle}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  if (submissions.length === 0) {
    return (
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-6 sm:p-14 text-center shadow-sm max-w-xl mx-auto my-4 space-y-4 animate-in zoom-in-95 duration-200">
        <div className="mx-auto flex h-16 w-16 sm:h-24 sm:w-24 items-center justify-center rounded-3xl bg-[#0b5336] text-white shadow-xl shadow-[#0b5336]/25 border-2 border-[#08412a] animate-in zoom-in duration-300">
          <CheckCircle className="w-8 h-8 sm:w-12 sm:h-12 stroke-[2.5]" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            No Validated Documents Found
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
            {emptyMessage}
          </p>
        </div>
      </div>
    );
  }

  // STEP 1: If no class is selected, show per-subject folder cards grid
  if (selectedClassKey === null || !selectedGroup) {
    return (
      <div className={cn("w-full space-y-4", className)}>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 pt-1">
          {classGroups.map((group) => {
            const validatedCount = group.submissions.filter((s) => {
              const st = (s.status || "").toLowerCase();
              return st === "validated" || st === "approved";
            }).length;
            const totalReqs =
              typeof totalRequiredCount === "number" && totalRequiredCount > 0
                ? totalRequiredCount
                : Math.max(validatedCount, 1);
            const progressPct = Math.min(
              100,
              Math.round((validatedCount / totalReqs) * 100),
            );

            return (
              <div
                key={group.key}
                onClick={() => setSelectedClassKey(group.key)}
                className="group relative flex flex-col cursor-pointer text-left transition-all duration-200 hover:-translate-y-1"
              >
                {/* Folder Top Tab with Smooth Slanted Shoulder */}
                <div className="flex items-end -mb-[2px] relative z-10 self-start">
                  <div className="h-7.5 px-3.5 rounded-tl-xl flex items-center gap-2 text-xs font-black tracking-wide border-t-2 border-l-2 border-amber-500 dark:border-amber-600 bg-amber-400 dark:bg-amber-500 text-slate-950 shadow-2xs group-hover:bg-amber-300 transition-colors duration-200">
                    <AppIcon icon={Folder} size="xs" color="inherit" />
                    <span className="truncate max-w-[140px]">
                      {group.isGeneral ? "General Requirements" : group.sectionCode}
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
                              {Number(group.units).toFixed(1)} Units
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                              Institutional
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#0b5336] border border-[#08412a] text-white px-2.5 py-0.5 text-[10.5px] font-bold shadow-2xs">
                            <AppIcon icon={Check} size="xs" color="white" />
                            {validatedCount} Validated
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
                            {progressPct}% ({validatedCount}/{totalReqs} Validated)
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

                    {/* Bottom Action Footer: Solid Amber CTA */}
                    <div className="pt-2">
                      <div className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl bg-amber-400 group-hover:bg-amber-500 border border-amber-500 transition-all duration-200 shadow-2xs">
                        <span className="text-xs font-extrabold text-amber-950 flex items-center gap-2">
                          <AppIcon icon={Folder} size="xs" color="inherit" />
                          <span>View Verified Documents</span>
                        </span>
                        <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-[#780000] text-white group-hover:bg-[#5e0000] transition-colors shadow-2xs">
                          <AppIcon icon={NavArrowRight} size="xs" color="white" />
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // STEP 2: Detail view for the selected subject card
  const displayedSubmissions = selectedGroup.submissions;

  return (
    <div className={cn("w-full space-y-4", className)}>
      {/* Subject Context Header with Back Button matching Admin Validation History */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-1">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5 min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setSelectedClassKey(null)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
            title="Return to Class List"
          >
            <AppIcon icon={NavArrowLeft} size="sm" color="white" />
            <span>Back to Class List</span>
          </button>

          <div className="h-6 w-px bg-amber-400/60 dark:bg-amber-600/40 hidden sm:block shrink-0" />

          <div className="min-w-0 flex-1 sm:pl-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-black px-2.5 py-0.5 rounded-md bg-amber-400 text-amber-950 shrink-0">
                {selectedGroup.isGeneral ? "GENERAL" : selectedGroup.sectionCode}
              </span>
              <span className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100 break-words">
                {selectedGroup.subjectCode} &bull; {selectedGroup.description}
              </span>
              {selectedGroup.units !== null && (
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 shrink-0">
                  ({selectedGroup.units} Units)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Quick Subject Switcher */}
        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
          <select
            value={selectedClassKey}
            onChange={(e) => setSelectedClassKey(e.target.value)}
            className="w-full sm:w-auto rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 sm:py-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-amber-500 cursor-pointer shadow-2xs"
          >
            {classGroups.map((g) => (
              <option key={g.key} value={g.key}>
                {g.sectionCode} - {g.subjectCode}
              </option>
            ))}
          </select>
        </div>
      </div>

      {displayedSubmissions.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-slate-500 dark:text-slate-400 shadow-2xs">
          <p className="text-xs font-semibold">No validated requirements found for this subject load.</p>
        </div>
      ) : null}

      {/* ─── Desktop Table View matching Admin Validation History ─── */}
      <div className="hidden md:block overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs transition-colors">
        <div className="w-full overflow-x-auto custom-scrollbar">
          <table className="w-full table-fixed text-left text-xs text-slate-600 dark:text-slate-300 min-w-[960px]" aria-label="Validation history table">
            <thead className="bg-slate-50 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <tr>
                <th scope="col" className="px-4 py-3 w-[23%] text-center">
                  Requirement
                </th>
                <th scope="col" className="px-3 py-3 w-[10%] text-center">
                  Type
                </th>
                <th scope="col" className="px-4 py-3 w-[23%] text-center">
                  File Versions
                </th>
                <th scope="col" className="px-4 py-3 w-[22%]">
                  Notes &amp; Remarks
                </th>
                <th scope="col" className="px-3 py-3 w-[12%] text-center">
                  Status
                </th>
                <th scope="col" className="px-3 py-3 w-[10%] text-center">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {displayedSubmissions.map((sub) => {
                const title = getRequirementTitle
                  ? getRequirementTitle(sub.requirementCode)
                  : getFriendlyRequirementName(sub.requirementCode);
                const isMandatory = templateMandatoryMap
                  ? templateMandatoryMap.get(sub.requirementCode) !== false
                  : true;
                const adminFeedback =
                  sub.adminRemarks || sub.admin_remarks || sub.feedback;
                const facultyNote =
                  (sub.remarks || sub.note) &&
                  (sub.remarks || sub.note) !== adminFeedback
                    ? sub.remarks || sub.note
                    : null;
                const isCleanedDoc = Boolean(
                  sub.storagePath?.startsWith("__cleaned__"),
                );
                const rawName =
                  sub.fileName ||
                  (isCleanedDoc
                    ? sub.storagePath?.replace(/^__cleaned__\/?/, "").trim() || ""
                    : sub.storagePath?.split("/").pop() || "") ||
                  "Document";
                const displayFileName = cleanDisplayFileName(rawName);
                const submittedDateText = sub.submittedAt
                  ? formatDateTime(sub.submittedAt)
                  : null;

                return (
                  <tr
                    key={sub.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    {/* Requirement */}
                    <td className="px-4 py-3.5 align-middle text-center">
                      <div className="space-y-1 min-w-0 text-center">
                        <span className="font-semibold text-slate-900 dark:text-slate-100 text-xs block leading-snug">
                          {title}
                        </span>
                        {submittedDateText && submittedDateText !== "—" ? (
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
                      <div className="flex items-center justify-center">
                        {isMandatory ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-[#780000] text-white border border-[#5e0000] shadow-2xs">
                            Required
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 shadow-2xs">
                            Optional
                          </span>
                        )}
                      </div>
                    </td>

                    {/* File Versions */}
                    <td className="px-4 py-3.5 align-middle text-center">
                      <div className="space-y-1.5 min-w-0 flex flex-col items-center justify-center">
                        {isCleanedDoc ? (
                          <div className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 px-3 py-2 text-center text-xs w-full">
                            <span
                              className="font-medium text-slate-800 dark:text-slate-200 text-xs break-words leading-snug max-w-full"
                              title={rawName}
                            >
                              {displayFileName}
                            </span>
                            <span className="shrink-0 rounded-md border border-amber-600 bg-amber-500 px-2.5 py-0.5 text-[10px] font-bold text-slate-950 shadow-2xs">
                              Cleaned (Archived)
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-2 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 px-3 py-2 text-xs w-full">
                            <span
                              className="truncate font-medium text-slate-800 dark:text-slate-200 text-xs"
                              title={rawName}
                            >
                              {displayFileName}
                            </span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Notes & Remarks */}
                    <td className="px-4 py-3.5 align-middle">
                      {facultyNote || adminFeedback ? (
                        <div className="flex flex-col gap-1.5 min-w-0">
                          {facultyNote ? (
                            <div
                              className="rounded-lg border border-slate-200/90 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 px-2.5 py-1.5 text-xs shadow-2xs min-w-0"
                              title={facultyNote}
                            >
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shrink-0 [&>svg]:h-2.5 [&>svg]:w-2.5">
                                  <AppIcon icon={ChatBubble} size="xs" color="inherit" />
                                </span>
                                <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 tracking-tight">
                                  Faculty Remarks
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-800 dark:text-slate-200 font-medium leading-relaxed line-clamp-2 pl-5 break-words">
                                &ldquo;{facultyNote}&rdquo;
                              </p>
                            </div>
                          ) : null}

                          {adminFeedback ? (
                            <div
                              className="rounded-lg border border-slate-200/90 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 px-2.5 py-1.5 text-xs shadow-2xs min-w-0"
                              title={adminFeedback}
                            >
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shrink-0 [&>svg]:h-2.5 [&>svg]:w-2.5">
                                  <AppIcon icon={Check} size="xs" color="inherit" strokeWidth={2.5} />
                                </span>
                                <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 tracking-tight">
                                  Validated Remarks
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-800 dark:text-slate-200 font-medium leading-relaxed line-clamp-2 pl-5 break-words">
                                &ldquo;{adminFeedback}&rdquo;
                              </p>
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <div className="pt-0.5 text-center">
                          <span className="text-slate-400 dark:text-slate-600 text-xs italic block">
                            &mdash;
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-3 py-3.5 align-middle text-center whitespace-nowrap">
                      <div className="flex items-center justify-center">
                        <SubmissionStatusBadge status={sub.status || "Validated"} size="md" />
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-3.5 align-middle text-center whitespace-nowrap">
                      {isCleanedDoc ? (
                        <span className="text-slate-400 dark:text-slate-600 text-xs">
                          &mdash;
                        </span>
                      ) : (
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            aria-label={`View submitted file for ${title}`}
                            onClick={() => onViewFile(sub)}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer shadow-2xs"
                            title="Preview Document"
                          >
                            <AppIcon icon={Eye} size="sm" color="inherit" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Download file for ${title}`}
                            onClick={() => handleDownload(sub)}
                            className="p-1.5 rounded-lg border border-[#08412a] bg-[#0b5336] hover:bg-[#08412a] text-white transition cursor-pointer shadow-2xs"
                            title="Download File"
                          >
                            <AppIcon icon={Download} size="sm" color="white" />
                          </button>
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

      {/* ─── Mobile Stacked Card View (Visible on mobile, hidden on md+) ─── */}
      <div className="space-y-3.5 block md:hidden" role="feed" aria-label="Validation history list">
        {displayedSubmissions.map((sub) => {
          const title = getRequirementTitle
            ? getRequirementTitle(sub.requirementCode)
            : getFriendlyRequirementName(sub.requirementCode);
          const isMandatory = templateMandatoryMap
            ? templateMandatoryMap.get(sub.requirementCode) !== false
            : true;
          const adminFeedback =
            sub.adminRemarks || sub.admin_remarks || sub.feedback;
          const facultyNote =
            (sub.remarks || sub.note) &&
            (sub.remarks || sub.note) !== adminFeedback
              ? sub.remarks || sub.note
              : null;
          const isCleanedDoc = Boolean(
            sub.storagePath?.startsWith("__cleaned__"),
          );
          const rawName =
            sub.fileName ||
            (isCleanedDoc
              ? sub.storagePath?.replace(/^__cleaned__\/?/, "").trim() || ""
              : sub.storagePath?.split("/").pop() || "") ||
            "Document";
          const displayFileName = cleanDisplayFileName(rawName);
          const dateValidated =
            sub.dateValidated || sub.updatedAt || sub.reviewedAt || sub.submittedAt;

          return (
            <article
              key={sub.id}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-3.5 shadow-sm transition hover:border-slate-300 dark:border-slate-700"
            >
              {/* Header: Title & Status Badge */}
              <div className="flex items-start justify-between gap-2.5 sm:gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 break-words">
                      {title}
                    </h4>
                    {isMandatory ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-[#780000] text-white border border-[#5e0000] shadow-2xs shrink-0">
                        Required
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 shadow-2xs shrink-0">
                        Optional
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 font-medium break-words mt-1" title={rawName}>
                    {displayFileName}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    <span className="bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 px-2.5 py-0.5 text-[10px] font-semibold rounded-md inline-flex items-center shadow-2xs">
                      {sub.semester} • S.Y. {sub.academicYear}
                    </span>
                    {isCleanedDoc && (
                      <span className="rounded-md border border-amber-600 bg-amber-500 px-2.5 py-0.5 text-[10px] font-bold text-slate-950 shadow-2xs">
                        Cleaned (Archived)
                      </span>
                    )}
                  </div>
                </div>

                <SubmissionStatusBadge status={sub.status || "Validated"} size="md" />
              </div>

              {/* Date Validated */}
              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 font-medium pt-1">
                <AppIcon icon={CheckCircle} size="sm" color="success" />
                <span>Validated: {formatDateTime(dateValidated)}</span>
              </div>

              {/* Remarks Callouts */}
              {facultyNote && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-800 dark:text-slate-200 p-3 text-xs shadow-2xs">
                  <span className="font-bold uppercase tracking-wider text-[10px] text-slate-600 dark:text-slate-300 mb-1 flex items-center gap-1">
                    <AppIcon icon={ChatBubble} size="xs" color="inherit" />
                    Faculty Remarks:
                  </span>
                  <p className="italic leading-relaxed">&ldquo;{facultyNote}&rdquo;</p>
                </div>
              )}

              {adminFeedback && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-800 dark:text-slate-200 p-3 text-xs shadow-2xs">
                  <span className="font-bold uppercase tracking-wider text-[10px] text-[#0b5336] dark:text-emerald-400 mb-1 flex items-center gap-1">
                    <AppIcon icon={Notes} size="xs" color="success" />
                    Validated Remarks:
                  </span>
                  <p className="italic leading-relaxed">&ldquo;{adminFeedback}&rdquo;</p>
                </div>
              )}

              {/* Footer Actions */}
              {!isCleanedDoc && (
                <div className="flex items-center justify-end gap-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    aria-label={`View submitted file for ${title}`}
                    onClick={() => onViewFile(sub)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 transition cursor-pointer shadow-2xs active:scale-95"
                  >
                    <AppIcon icon={Eye} size="sm" color="default" />
                    <span>View</span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Download file for ${title}`}
                    onClick={() => handleDownload(sub)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#08412a] bg-[#0b5336] hover:bg-[#08412a] text-white px-3 py-2 text-xs font-bold transition cursor-pointer shadow-xs active:scale-95"
                  >
                    <AppIcon icon={Download} size="sm" color="white" />
                    <span>Download</span>
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
