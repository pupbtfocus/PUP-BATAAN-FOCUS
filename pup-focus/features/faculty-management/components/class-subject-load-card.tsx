"use client";

import { useEffect, useRef, useState } from "react";
import {
  Archive,
  CheckCircle,
  EditPencil,
  Eye,
  MoreHoriz,
  NavArrowRight,
  Refresh,
  SystemRestart,
  Trash,
} from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";
import { Skeleton } from "@/components/ui/skeleton";
import type { FacultyClass } from "./faculty-submission-panel";

export interface ClassSubjectLoadCardProps {
  classLoad: FacultyClass;
  totalRequirements: number;
  validatedCount: number;
  pendingCount: number;
  revisionCount: number;
  isLoadingStatus?: boolean;
  isActionLoading?: boolean;
  onSelect: (cls: FacultyClass) => void;
  onDetails: (cls: FacultyClass, e?: React.MouseEvent) => void;
  onEdit: (cls: FacultyClass, e?: React.MouseEvent) => void;
  onArchive: (cls: FacultyClass, e?: React.MouseEvent) => void;
  onDelete: (cls: FacultyClass, e?: React.MouseEvent) => void;
}

export function ClassSubjectLoadCard({
  classLoad,
  totalRequirements,
  validatedCount,
  pendingCount,
  revisionCount,
  isLoadingStatus = false,
  isActionLoading = false,
  onSelect,
  onDetails,
  onEdit,
  onArchive,
  onDelete,
}: ClassSubjectLoadCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const isArchived = Boolean(classLoad.is_archived);
  const submittedCount =
    totalRequirements > 0
      ? Math.min(totalRequirements, validatedCount + pendingCount)
      : 0;
  const isComplete =
    totalRequirements > 0 &&
    validatedCount >= totalRequirements &&
    revisionCount === 0;
  const progressPct =
    totalRequirements > 0
      ? Math.min(100, Math.round((submittedCount / totalRequirements) * 100))
      : 0;

  const leftBorderAccent = isLoadingStatus
    ? "border-l-slate-300 dark:border-l-slate-700"
    : isComplete
      ? "border-l-[#0b5336]"
      : isArchived
        ? "border-l-slate-400 dark:border-l-slate-600"
        : "border-l-[#580000]";

  return (
    <div
      onClick={() => onSelect(classLoad)}
      className={`group relative flex flex-col justify-between gap-4 rounded-xl border border-slate-200 dark:border-slate-800 border-l-4 ${leftBorderAccent} bg-white dark:bg-slate-900 p-5 shadow-xs transition-all hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-sm cursor-pointer text-left`}
    >
      {/* 1. Top Metadata Row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          <span className="inline-flex items-center rounded-md border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-xs font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[160px]">
            {classLoad.section_code}
          </span>
          <span className="inline-flex items-center rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-400">
            {Number(classLoad.units || 0).toFixed(1)} Units
          </span>
          {isArchived && (
            <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
              <AppIcon icon={Archive} size="xs" color="inherit" />
              <span>Archived</span>
            </span>
          )}
        </div>

        {/* Semantic Compliance Status Pill */}
        {isLoadingStatus ? (
          <Skeleton className="h-5 w-24 rounded-full shrink-0" />
        ) : isComplete ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-[#08412a] bg-[#0b5336] px-2.5 py-0.5 text-[11px] font-semibold text-white shadow-2xs shrink-0">
            <AppIcon icon={CheckCircle} size="xs" color="white" />
            <span>Complete</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-600 bg-amber-500 px-2.5 py-0.5 text-[11px] font-bold text-amber-950 shadow-2xs shrink-0">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-950" />
            <span>
              {submittedCount}/{totalRequirements} Submitted
            </span>
          </span>
        )}
      </div>

      {/* 2. Center Body (Primary Focal Point) */}
      <div className="flex-1 space-y-3.5">
        <div className="space-y-2.5">
          <div>
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              COURSE CODE
            </span>
            <h3 className="mt-0.5 text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 group-hover:text-[#580000] dark:group-hover:text-rose-300 transition-colors">
              {classLoad.subject_code}
            </h3>
          </div>

          <div>
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              SUBJECT NAME
            </span>
            <p className="mt-0.5 text-sm font-medium text-slate-700 dark:text-slate-300 line-clamp-2 leading-snug">
              {classLoad.description}
            </p>
          </div>
        </div>

        {/* Slim Submission Progress Bar */}
        {isLoadingStatus ? (
          <div className="space-y-1.5 pt-0.5">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-3.5 w-9" />
            </div>
            <Skeleton className="h-1.5 w-full rounded-full" />
          </div>
        ) : (
          totalRequirements > 0 && (
            <div className="space-y-1.5 pt-0.5">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-medium text-slate-500 dark:text-slate-400">
                  Submission Progress
                  {revisionCount > 0 ? (
                    <span className="ml-1.5 font-semibold text-[#780000] dark:text-rose-400">
                      ({revisionCount} for revision)
                    </span>
                  ) : null}
                </span>
                <span
                  className={`font-semibold tabular-nums ${
                    isComplete
                      ? "text-[#0b5336] dark:text-emerald-400"
                      : "text-slate-700 dark:text-slate-300"
                  }`}
                >
                  {progressPct}%
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    isComplete ? "bg-[#0b5336]" : "bg-[#580000]"
                  }`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )
        )}
      </div>

      {/* 3. Bottom Action Footer */}
      <div
        className="flex items-center gap-2 border-t border-slate-100 dark:border-slate-800 pt-3.5"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => onSelect(classLoad)}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#580000] hover:bg-[#780000] px-3.5 py-2 text-xs font-semibold text-white shadow-2xs transition-colors cursor-pointer active:scale-[0.99]"
        >
          <span>View Requirements</span>
          <AppIcon icon={NavArrowRight} size="xs" color="white" />
        </button>

        {/* Overflow Actions Menu */}
        <div ref={menuRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            disabled={isActionLoading}
            aria-label={`More actions for ${classLoad.subject_code}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer disabled:opacity-50"
            title="More actions"
          >
            {isActionLoading ? (
              <AppIcon
                icon={SystemRestart}
                size="sm"
                color="inherit"
                className="animate-spin"
              />
            ) : (
              <AppIcon icon={MoreHoriz} size="sm" color="inherit" />
            )}
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 bottom-full mb-1.5 z-30 w-44 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1 shadow-lg animate-in fade-in zoom-in-95 duration-100"
            >
              <button
                type="button"
                role="menuitem"
                onClick={(e) => {
                  setMenuOpen(false);
                  onDetails(classLoad, e);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <AppIcon icon={Eye} size="xs" color="inherit" />
                <span>Class Details</span>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={(e) => {
                  setMenuOpen(false);
                  onEdit(classLoad, e);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <AppIcon icon={EditPencil} size="xs" color="inherit" />
                <span>Edit Load</span>
              </button>

              <button
                type="button"
                role="menuitem"
                disabled={isActionLoading}
                onClick={(e) => {
                  setMenuOpen(false);
                  onArchive(classLoad, e);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
              >
                <AppIcon
                  icon={isArchived ? Refresh : Archive}
                  size="xs"
                  color="inherit"
                />
                <span>{isArchived ? "Restore to Active" : "Archive Load"}</span>
              </button>

              <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

              <button
                type="button"
                role="menuitem"
                onClick={(e) => {
                  setMenuOpen(false);
                  onDelete(classLoad, e);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-[#780000] dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
              >
                <AppIcon icon={Trash} size="xs" color="inherit" />
                <span>Delete Load</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
