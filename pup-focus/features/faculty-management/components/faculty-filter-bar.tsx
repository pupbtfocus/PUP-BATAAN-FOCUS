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
  placeholder = "Search faculty by name or email...",
}: FacultyFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border border-slate-800 bg-slate-950 text-slate-200 mb-4 shadow-xl">
      <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
        <input
          type="text"
          value={searchTerm}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={placeholder}
          className="w-full sm:w-64 h-9 rounded-lg border border-slate-800 bg-slate-900 px-3 text-xs text-slate-200 placeholder-slate-500 outline-none transition focus:border-amber-400/80 focus:ring-1 focus:ring-amber-400/30"
        />

        {onStatusFilterChange ? (
          <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 p-1 h-9">
            <button
              type="button"
              onClick={() => onStatusFilterChange("all")}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                statusFilter === "all"
                  ? "bg-amber-400 text-slate-950 font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => onStatusFilterChange("active")}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                statusFilter === "active"
                  ? "bg-emerald-500 text-slate-950 font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => onStatusFilterChange("inactive")}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                statusFilter === "inactive"
                  ? "bg-slate-700 text-slate-100 font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Inactive
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
