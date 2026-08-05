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
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 mb-4">
      <div className="rounded-xl border border-slate-800 border-l-2 border-l-amber-500 bg-slate-950 p-4 shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">
          Total Faculty
        </p>
        <p className="mt-2 text-2xl font-bold text-slate-100">
          {isLoading ? "..." : totalCount}
        </p>
      </div>

      <div className="rounded-xl border border-slate-800 border-l-2 border-l-emerald-500 bg-slate-950 p-4 shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
          Active Faculty
        </p>
        <p className="mt-2 text-2xl font-bold text-emerald-400">
          {isLoading ? "..." : activeCount}
        </p>
      </div>

      <div className="rounded-xl border border-slate-800 border-l-2 border-l-slate-600 bg-slate-950 p-4 shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Inactive Faculty
        </p>
        <p className="mt-2 text-2xl font-bold text-slate-300">
          {isLoading ? "..." : inactiveCount}
        </p>
      </div>
    </div>
  );
}
