"use client";

interface FacultyFilterBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter?: "all" | "active" | "inactive";
  onStatusFilterChange?: (status: "all" | "active" | "inactive") => void;
  placeholder?: string;
}

export function FacultyFilterBar({
  searchTerm,
  onSearchChange,
  statusFilter = "all",
  onStatusFilterChange,
  placeholder = "Search faculty by name or email",
}: FacultyFilterBarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="flex-1 rounded-xl border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950/70 p-3">
        <input
          type="text"
          value={searchTerm}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 outline-none transition focus:border-amber-400"
        />
      </div>

      {onStatusFilterChange ? (
        <div className="flex shrink-0 items-center gap-1 rounded-xl border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950/70 p-1.5">
          <button
            type="button"
            onClick={() => onStatusFilterChange("all")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              statusFilter === "all"
                ? "bg-amber-400 text-slate-950 font-semibold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => onStatusFilterChange("active")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              statusFilter === "active"
                ? "bg-emerald-500 text-slate-950 font-semibold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            Active
          </button>
          <button
            type="button"
            onClick={() => onStatusFilterChange("inactive")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              statusFilter === "inactive"
                ? "bg-rose-500 text-white font-semibold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            Inactive
          </button>
        </div>
      ) : null}
    </div>
  );
}
