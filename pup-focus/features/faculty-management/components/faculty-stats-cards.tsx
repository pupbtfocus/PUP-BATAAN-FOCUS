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
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div className="rounded-xl border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950/70 p-4 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Total Faculty
        </p>
        <p className="mt-2 text-2xl font-bold text-slate-800 dark:text-slate-100">
          {isLoading ? "..." : totalCount}
        </p>
      </div>

      <div className="rounded-xl border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950/70 p-4 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
          Active Faculty
        </p>
        <p className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
          {isLoading ? "..." : activeCount}
        </p>
      </div>

      <div className="rounded-xl border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950/70 p-4 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wider text-rose-600 dark:text-rose-400">
          Inactive Faculty
        </p>
        <p className="mt-2 text-2xl font-bold text-rose-600 dark:text-rose-400">
          {isLoading ? "..." : inactiveCount}
        </p>
      </div>
    </div>
  );
}
