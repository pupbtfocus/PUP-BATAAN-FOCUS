"use client";

import React from "react";
import { Check, CheckCircle, Download, Eye, Folder, NavArrowLeft, NavArrowRight, Notes, WarningCircle } from "iconoir-react";
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

export function SubmissionHistoryList<T extends PastSubmissionItem = PastSubmissionItem>({
  submissions,
  classes = [],
  onViewFile,
  onDownloadFile,
  viewedSubmissionIds = new Set(),
  getRequirementTitle,
  templateMandatoryMap,
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
      if (sub.faculty_class && !sub.faculty_class.is_archived) {
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

    return groups;
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
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-10 sm:p-14 text-center shadow-sm max-w-xl mx-auto my-4 space-y-4 animate-in zoom-in-95 duration-200">
        <div className="mx-auto flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-3xl bg-[#0b5336] text-white shadow-xl shadow-[#0b5336]/25 border-2 border-[#08412a] animate-in zoom-in duration-300">
          <CheckCircle className="w-10 h-10 sm:w-12 sm:h-12 stroke-[2.5]" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            No Validated Documents Found
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
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
            const validatedCount = group.submissions.length;

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
                              {group.units} Units
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
                    </div>

                    {/* Bottom Action Footer: Solid Amber CTA */}
                    <div className="pt-2">
                      <div className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl bg-amber-400 group-hover:bg-amber-500 border border-amber-500 transition-all duration-200 shadow-2xs">
                        <span className="text-xs font-extrabold text-amber-950 flex items-center gap-2">
                          <AppIcon icon={Folder} size="xs" color="inherit" />
                          <span>View Validated Documents</span>
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
      {/* Subject Context Header with Back Button */}
      <div className="rounded-2xl border-2 border-amber-400/80 dark:border-amber-500/60 bg-amber-50/80 dark:bg-amber-950/20 p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setSelectedClassKey(null)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
            title="Return to Subject Cards"
          >
            <AppIcon icon={NavArrowLeft} size="sm" color="white" />
            <span>Back to Subject Cards</span>
          </button>

          <div className="h-6 w-px bg-amber-400/60 dark:bg-amber-600/40 hidden sm:block shrink-0" />

          <div className="min-w-0 flex-1 pl-1">
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
        <div className="flex items-center gap-2 shrink-0">
          <select
            value={selectedClassKey}
            onChange={(e) => setSelectedClassKey(e.target.value)}
            className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-amber-500 cursor-pointer shadow-2xs"
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

      {/* ─── Desktop Table View with Horizontal Scroll Container ─── */}
      <div className="hidden md:block overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition-colors">
        <div className="w-full overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs min-w-[920px]" aria-label="Validation history table">
            <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/80 text-slate-600 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider">
              <tr>
                <th scope="col" className="w-[30%] px-6 py-4">
                  Requirement
                </th>
                <th scope="col" className="w-[10%] px-4 py-4 text-center whitespace-nowrap">
                  Type
                </th>
                <th scope="col" className="w-[16%] px-5 py-4 whitespace-nowrap">
                  Academic Term
                </th>
                <th scope="col" className="w-[14%] px-5 py-4 whitespace-nowrap">
                  Date Validated
                </th>
                <th scope="col" className="w-[8%] px-4 py-4 text-center whitespace-nowrap">
                  Status
                </th>
                <th scope="col" className="w-[12%] px-4 py-4">
                  Reviewer Remarks
                </th>
                <th scope="col" className="w-[10%] px-6 py-4 text-right whitespace-nowrap">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {displayedSubmissions.map((sub) => {
                const title = getRequirementTitle
                  ? getRequirementTitle(sub.requirementCode)
                  : getFriendlyRequirementName(sub.requirementCode);
                const isMandatory = templateMandatoryMap
                  ? templateMandatoryMap.get(sub.requirementCode) !== false
                  : true;
                const adminFeedback =
                  sub.adminRemarks || sub.admin_remarks || sub.feedback;
                const dateValidated =
                  sub.dateValidated || sub.updatedAt || sub.reviewedAt || sub.submittedAt;

                return (
                  <tr
                    key={sub.id}
                    className="bg-white dark:bg-slate-900 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    {/* Requirement Name */}
                    <td className="px-6 py-4.5 font-medium text-slate-900 dark:text-slate-100">
                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-sm text-slate-900 dark:text-slate-100 leading-snug">
                          {title}
                        </span>
                        {sub.fileName && (
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate block max-w-[260px] mt-0.5" title={sub.fileName}>
                            {sub.fileName}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Type (Required / Optional) column */}
                    <td className="px-4 py-4.5 align-middle text-center whitespace-nowrap">
                      {isMandatory ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-[#780000] text-white border border-[#5e0000] shadow-2xs">
                          Required
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-700 dark:bg-slate-700 text-white border border-slate-600 shadow-2xs">
                          Optional
                        </span>
                      )}
                    </td>

                    {/* Academic Term */}
                    <td className="px-5 py-4.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-2xs">
                        {sub.semester} • S.Y. {sub.academicYear}
                      </span>
                    </td>

                    {/* Date Validated */}
                    <td className="px-5 py-4.5 whitespace-nowrap">
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {formatDateOnly(dateValidated)}
                      </div>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                        {formatTimeOnly(dateValidated)}
                      </div>
                    </td>

                    {/* Status Column: Check Icon Only */}
                    <td className="px-4 py-4.5 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center">
                        <SubmissionStatusBadge status="validated" size="md" iconOnly />
                      </div>
                    </td>

                    {/* Reviewer Remarks */}
                    <td className="px-4 py-4.5 text-slate-600 dark:text-slate-400">
                      {adminFeedback ? (
                        <div className="max-w-[240px] rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-2.5 text-xs text-slate-700 dark:text-slate-300 leading-relaxed shadow-2xs" title={adminFeedback}>
                          <span className="font-bold text-[10px] uppercase tracking-wider text-[#0b5336] dark:text-emerald-400 block mb-0.5">Remarks:</span>
                          <p className="italic">&ldquo;{adminFeedback}&rdquo;</p>
                        </div>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-600 text-xs">—</span>
                      )}
                    </td>

                    {/* Action Column */}
                    <td className="px-6 py-4.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          aria-label={`View submitted file for ${title}`}
                          onClick={() => onViewFile(sub)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 transition cursor-pointer shadow-2xs active:scale-95"
                          title="Preview Document"
                        >
                          <AppIcon icon={Eye} size="sm" color="default" />
                          <span>View</span>
                        </button>
                        <button
                          type="button"
                          aria-label={`Download file for ${title}`}
                          onClick={() => handleDownload(sub)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-[#08412a] bg-[#0b5336] hover:bg-[#08412a] text-white px-3 py-1.5 text-xs font-bold transition cursor-pointer shadow-xs active:scale-95"
                          title="Download File"
                        >
                          <AppIcon icon={Download} size="sm" color="white" />
                          <span>Download</span>
                        </button>
                      </div>
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
          const dateValidated =
            sub.dateValidated || sub.updatedAt || sub.reviewedAt || sub.submittedAt;

          return (
            <article
              key={sub.id}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-3.5 shadow-sm transition hover:border-slate-300 dark:border-slate-700"
            >
              {/* Header: Title & Status Badge */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                      {title}
                    </h4>
                    {isMandatory ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-[#780000] text-white border border-[#5e0000] shadow-2xs">
                        Required
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-700 dark:bg-slate-700 text-white border border-slate-600 shadow-2xs">
                        Optional
                      </span>
                    )}
                  </div>
                  {sub.fileName && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5" title={sub.fileName}>
                      {sub.fileName}
                    </p>
                  )}
                  <span className="bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 px-2.5 py-0.5 text-[10px] font-semibold rounded-md inline-flex items-center mt-1.5 shadow-2xs">
                    {sub.semester} • S.Y. {sub.academicYear}
                  </span>
                </div>

                <SubmissionStatusBadge status="validated" size="md" iconOnly />
              </div>

              {/* Date Validated */}
              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 font-medium pt-1">
                <AppIcon icon={CheckCircle} size="sm" color="success" />
                <span>Validated: {formatDateTime(dateValidated)}</span>
              </div>

              {/* Reviewer Feedback Callout */}
              {adminFeedback && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-800 dark:text-slate-200 p-3 text-xs shadow-2xs">
                  <span className="font-bold uppercase tracking-wider text-[10px] text-[#0b5336] dark:text-emerald-400 mb-1 flex items-center gap-1">
                    <AppIcon icon={Notes} size="xs" color="success" />
                    Reviewer Remarks:
                  </span>
                  <p className="italic leading-relaxed">&ldquo;{adminFeedback}&rdquo;</p>
                </div>
              )}

              {/* Footer Actions */}
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
            </article>
          );
        })}
      </div>
    </div>
  );
}
