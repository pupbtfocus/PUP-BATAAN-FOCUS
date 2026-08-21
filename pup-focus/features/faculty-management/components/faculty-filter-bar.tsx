"use client";

export interface FacultyFilterBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter?: "all" | "active" | "inactive";
  onStatusFilterChange?: (status: "all" | "active" | "inactive") => void;
  programFilter?: string;
  onProgramFilterChange?: (program: string) => void;
  programs?: Array<{ id: string; code: string; name: string }>;
  placeholder?: string;
}

export function FacultyFilterBar({
  searchTerm,
  onSearchChange,
  statusFilter = "all",
  onStatusFilterChange,
  programFilter = "all",
  onProgramFilterChange,
  programs = [],
  placeholder = "Search faculty by name or email...",
}: FacultyFilterBarProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-400 dark:border-slate-800 mb-6 shadow-sm shadow-slate-200/60 dark:shadow-none text-slate-900 dark:text-slate-200">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5 w-full sm:w-auto flex-wrap">
        <input
          type="text"
          value={searchTerm}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={placeholder}
          className="w-full sm:w-64 h-9 rounded-xl border border-slate-400 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
        />

        {onProgramFilterChange ? (
          <select
            value={programFilter || "all"}
            onChange={(e) => onProgramFilterChange(e.target.value)}
            className="w-full sm:w-48 h-9 rounded-xl border border-slate-400 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 text-xs text-slate-900 dark:text-slate-100 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
          >
            <option value="all">All Programs</option>
            {programs.map((p) => (
              <option key={p.id || p.code} value={p.code}>
                {p.code} — {p.name}
              </option>
            ))}
          </select>
        ) : null}

        {onStatusFilterChange ? (
          <div className="flex items-center justify-start gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <div className="flex items-center gap-1 rounded-xl border border-slate-400 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 p-1 h-9 shrink-0">
              <button
                type="button"
                onClick={() => onStatusFilterChange("all")}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                  statusFilter === "all"
                    ? "bg-amber-500 text-slate-950 font-semibold shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => onStatusFilterChange("active")}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                  statusFilter === "active"
                    ? "bg-emerald-500 text-white font-semibold shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                Active
              </button>
              <button
                type="button"
                onClick={() => onStatusFilterChange("inactive")}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                  statusFilter === "inactive"
                    ? "bg-slate-300 dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-semibold shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                Inactive
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
