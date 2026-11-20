"use client";

import { CheckCircle, Group, XmarkCircle } from "iconoir-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { FacultyAccount } from "@/features/faculty-management/types/faculty-dashboard.types";

interface FacultyStatsCardsProps {
  facultyAccounts: FacultyAccount[];
  isLoading?: boolean;
}

export function FacultyStatsCards({
  facultyAccounts,
  isLoading = false,
}: FacultyStatsCardsProps) {
  const totalCount = facultyAccounts.length;
  const activeCount = facultyAccounts.filter((f) => f.is_active).length;
  const inactiveCount = facultyAccounts.filter((f) => !f.is_active).length;

  return (
    <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
      <div className="rounded-xl bg-white text-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs dark:bg-slate-900 dark:text-slate-100 p-3 sm:p-5 transition-colors flex flex-col justify-between">
        <div className="flex items-center justify-between gap-1.5">
          <p className="text-slate-500 dark:text-slate-400 text-[10px] sm:text-xs font-medium uppercase tracking-wider leading-tight">
            Total Faculty
          </p>
          <Group className="hidden sm:block h-5 w-5 text-slate-400 shrink-0" strokeWidth={2} />
        </div>
        <div className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
          {isLoading ? <Skeleton className="h-7 w-14" /> : totalCount}
        </div>
      </div>

      <div className="rounded-xl bg-white text-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs dark:bg-slate-900 dark:text-slate-100 p-3 sm:p-5 transition-colors flex flex-col justify-between">
        <div className="flex items-center justify-between gap-1.5">
          <p className="text-slate-500 dark:text-slate-400 text-[10px] sm:text-xs font-medium uppercase tracking-wider leading-tight">
            Active Faculty
          </p>
          <CheckCircle className="hidden sm:block h-5 w-5 text-slate-400 shrink-0" strokeWidth={2} />
        </div>
        <div className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
          {isLoading ? <Skeleton className="h-7 w-14" /> : activeCount}
        </div>
      </div>

      <div className="rounded-xl bg-white text-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs dark:bg-slate-900 dark:text-slate-100 p-3 sm:p-5 transition-colors flex flex-col justify-between">
        <div className="flex items-center justify-between gap-1.5">
          <p className="text-slate-500 dark:text-slate-400 text-[10px] sm:text-xs font-medium uppercase tracking-wider leading-tight">
            Inactive Faculty
          </p>
          <XmarkCircle className="hidden sm:block h-5 w-5 text-slate-400 shrink-0" strokeWidth={2} />
        </div>
        <div className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
          {isLoading ? <Skeleton className="h-7 w-14" /> : inactiveCount}
        </div>
      </div>
    </div>
  );
}
