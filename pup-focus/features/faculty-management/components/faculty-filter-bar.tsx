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
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-white text-slate-900 border border-slate-200 shadow-xs dark:bg-slate-900 dark:text-slate-100 dark:border-slate-800 rounded-xl mb-6 transition-colors">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5 w-full sm:w-auto flex-wrap">
        <input
          type="text"
          value={searchTerm}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={placeholder}
          className="w-full sm:w-64 h-9 rounded-xl bg-white text-slate-900 border border-slate-200 focus:border-slate-400 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-800 dark:focus:border-slate-600 px-3 text-xs placeholder-slate-400 dark:placeholder-slate-500 outline-none transition"
        />

        {onProgramFilterChange ? (
          <select
            value={programFilter || "all"}
            onChange={(e) => onProgramFilterChange(e.target.value)}
            className="w-full sm:w-48 h-9 rounded-xl bg-white text-slate-900 border border-slate-200 focus:border-slate-400 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-800 dark:focus:border-slate-600 px-3 text-xs outline-none transition cursor-pointer"
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
            <div className="flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-1 h-9 shrink-0">
              <button
                type="button"
                onClick={() => onStatusFilterChange("all")}
                className={`rounded-lg px-2.5 py-1 text-xs transition cursor-pointer ${
                  statusFilter === "all"
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-medium shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800/60 font-normal"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => onStatusFilterChange("active")}
                className={`rounded-lg px-2.5 py-1 text-xs transition cursor-pointer ${
                  statusFilter === "active"
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-medium shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800/60 font-normal"
                }`}
              >
                Active
              </button>
              <button
                type="button"
                onClick={() => onStatusFilterChange("inactive")}
                className={`rounded-lg px-2.5 py-1 text-xs transition cursor-pointer ${
                  statusFilter === "inactive"
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-medium shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800/60 font-normal"
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
