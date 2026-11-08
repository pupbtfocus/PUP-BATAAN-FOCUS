"use client";

import { CheckCircle, Group, XmarkCircle } from "iconoir-react";
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
      <div className="rounded-xl bg-white text-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs dark:bg-slate-900 dark:text-slate-100 p-5 transition-colors">
        <div className="flex items-center justify-between">
          <p className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider">
            Total Faculty
          </p>
          <Group className="h-5 w-5 text-slate-400" strokeWidth={2} />
        </div>
        <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
          {isLoading ? "..." : totalCount}
        </p>
      </div>

      <div className="rounded-xl bg-white text-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs dark:bg-slate-900 dark:text-slate-100 p-5 transition-colors">
        <div className="flex items-center justify-between">
          <p className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider">
            Active Faculty
          </p>
          <CheckCircle className="h-5 w-5 text-slate-400" strokeWidth={2} />
        </div>
        <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
          {isLoading ? "..." : activeCount}
        </p>
      </div>

      <div className="rounded-xl bg-white text-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs dark:bg-slate-900 dark:text-slate-100 p-5 transition-colors">
        <div className="flex items-center justify-between">
          <p className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider">
            Inactive Faculty
          </p>
          <XmarkCircle className="h-5 w-5 text-slate-400" strokeWidth={2} />
        </div>
        <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
          {isLoading ? "..." : inactiveCount}
        </p>
      </div>
    </div>
  );
}
