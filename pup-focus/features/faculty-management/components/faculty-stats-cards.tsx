"use client";

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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
      <div className="rounded-2xl border border-slate-400 dark:border-slate-800 border-l-4 border-l-amber-500 bg-white dark:bg-slate-900 p-5 shadow-sm shadow-slate-200/60 dark:shadow-none">
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
          Total Faculty
        </p>
        <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
          {isLoading ? "..." : totalCount}
        </p>
      </div>

      <div className="rounded-2xl border border-slate-400 dark:border-slate-800 border-l-4 border-l-emerald-500 bg-white dark:bg-slate-900 p-5 shadow-sm shadow-slate-200/60 dark:shadow-none">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
          Active Faculty
        </p>
        <p className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
          {isLoading ? "..." : activeCount}
        </p>
      </div>

      <div className="rounded-2xl border border-slate-400 dark:border-slate-800 border-l-4 border-l-slate-400 dark:border-l-slate-600 bg-white dark:bg-slate-900 p-5 shadow-sm shadow-slate-200/60 dark:shadow-none">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
          Inactive Faculty
        </p>
        <p className="mt-2 text-2xl font-bold text-slate-700 dark:text-slate-300">
          {isLoading ? "..." : inactiveCount}
        </p>
      </div>
    </div>
  );
}
