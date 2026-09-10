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
      <div className="rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm shadow-slate-300/50 dark:shadow-none transition-colors">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Total Faculty
        </p>
        <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
          {isLoading ? "..." : totalCount}
        </p>
      </div>

      <div className="rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm shadow-slate-300/50 dark:shadow-none transition-colors">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Active Faculty
        </p>
        <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
          {isLoading ? "..." : activeCount}
        </p>
      </div>

      <div className="rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm shadow-slate-300/50 dark:shadow-none transition-colors">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Inactive Faculty
        </p>
        <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
          {isLoading ? "..." : inactiveCount}
        </p>
      </div>
    </div>
  );
}
