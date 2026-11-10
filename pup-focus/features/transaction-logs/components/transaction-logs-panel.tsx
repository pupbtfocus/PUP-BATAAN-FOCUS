"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  CheckCircle,
  EditPencil,
  Eye,
  Filter,
  Hourglass,
  NavArrowDown,
  NavArrowLeft,
  NavArrowRight,
  Page,
  Refresh,
  Search,
  Settings,
  ShieldAlert,
  Trash,
  Upload,
  UserBadgeCheck,
  UserPlus,
  UserXmark,
  Xmark,
  XmarkCircle,
  LogIn,
  LogOut,
  Calendar,
  ViewGrid,
  Book,
} from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";
import { AlertPopup } from "@/components/ui/alert-popup";
import { useRealtimeSync } from "@/lib/realtime";

// ─── Types ───────────────────────────────────────────────────────────

export type TransactionLogEntry = {
  id: string;
  actorId: string | null;
  actorName: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type AuditLogEntry = TransactionLogEntry;

type TransactionLogsResponse = {
  logs: TransactionLogEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  categoryCounts?: Record<string, number>;
};

type ActionCategory =
  | ""
  | "auth"
  | "uploads"
  | "reviews"
  | "user_management"
  | "submission_windows"
  | "academic_terms"
  | "templates"
  | "classes"
  | "backup";

const ACTION_CATEGORY_OPTIONS: { value: ActionCategory; label: string }[] = [
  { value: "", label: "All Activities" },
  { value: "auth", label: "Authentication & Logins" },
  { value: "uploads", label: "Uploads" },
  { value: "reviews", label: "Reviews & Validations" },
  { value: "user_management", label: "User Management" },
  { value: "submission_windows", label: "Submission Windows" },
  { value: "academic_terms", label: "Academic Terms" },
  { value: "templates", label: "Requirement Templates" },
  { value: "classes", label: "Classes & Programs" },
  { value: "backup", label: "Backup & Archive" },
];

// ─── Helpers ─────────────────────────────────────────────────────────

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function truncateId(id: string | null): string {
  if (!id) return "—";
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

type ActionBadgeStyle = {
  bg: string;
  text: string;
  icon: React.ReactNode;
};

function getActionBadgeStyle(action: string): ActionBadgeStyle {
  return {
    bg: "bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700",
    text: "text-slate-700 dark:text-slate-200",
    icon: <AppIcon icon={getActionIcon(action)} size="xs" color="inherit" />,
  };
}

function getActionIcon(action: string) {
  if (action.includes("login")) return LogIn;
  if (action.includes("logout")) return LogOut;
  if (action.includes("academic_term")) return Calendar;
  if (action.includes("template")) return ViewGrid;
  if (action.includes("class") || action.includes("program")) return Book;
  if (action.includes("upload")) return Upload;
  if (action.includes("approve") || action.includes("validated")) return CheckCircle;
  if (action.includes("reject")) return XmarkCircle;
  if (action.includes("create") || action.includes("invite")) return UserPlus;
  if (action.includes("delete")) return Trash;
  if (action.includes("activate")) return UserBadgeCheck;
  if (action.includes("deactivate")) return UserXmark;
  if (action.includes("update")) return EditPencil;
  if (action.includes("window")) return Settings;
  return Page;
}

function formatActionLabel(action: string): string {
  return action
    .replace(/[._]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Log Detail Modal (no metadata) ──────────────────────────────────

function LogDetailModal({
  entry,
  onClose,
}: {
  entry: TransactionLogEntry;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-3 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-400 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-300 dark:border-slate-800">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            {formatActionLabel(entry.action)}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Transaction Log Detail
          </p>
        </div>
        <div className="px-6 py-5 space-y-3">
          <div className="rounded-xl border border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3 flex items-center gap-3">
            <AppIcon icon={Hourglass} size="sm" color="muted" />
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400 font-semibold">Timestamp</p>
              <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">{formatTimestamp(entry.createdAt)}</p>
            </div>
          </div>
          <div className="rounded-xl border border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3 flex items-center gap-3">
            <AppIcon icon={UserBadgeCheck} size="sm" color="muted" />
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400 font-semibold">Actor</p>
              <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">{entry.actorName ?? "System"}</p>
            </div>
          </div>
          <div className="rounded-xl border border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3 flex items-center gap-3">
            <AppIcon icon={Page} size="sm" color="muted" />
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400 font-semibold">Entity Type</p>
              <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100 capitalize">{entry.entityType.replace(/_/g, " ")}</p>
            </div>
          </div>
        </div>
        <div className="border-t border-slate-300 dark:border-slate-800 px-6 py-3 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Panel ──────────────────────────────────────────────────────

let cachedTransactionLogsData: {
  logs: TransactionLogEntry[];
  total: number;
  totalPages: number;
  categoryCounts: Record<string, number>;
} | null = null;

export function TransactionLogsPanel() {
  const [logs, setLogs] = useState<TransactionLogEntry[]>(() => {
    if (cachedTransactionLogsData) return cachedTransactionLogsData.logs;
    if (typeof window !== "undefined") {
      try {
        const stored = sessionStorage.getItem("pup_focus_tx_logs");
        if (stored) {
          const parsed = JSON.parse(stored);
          cachedTransactionLogsData = parsed;
          return parsed.logs || [];
        }
      } catch {}
    }
    return [];
  });
  const [total, setTotal] = useState(() => cachedTransactionLogsData?.total || 0);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>(() => cachedTransactionLogsData?.categoryCounts || {
    all: 0,
    auth: 0,
    uploads: 0,
    reviews: 0,
    user_management: 0,
    submission_windows: 0,
    academic_terms: 0,
    templates: 0,
    classes: 0,
    backup: 0,
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(() => cachedTransactionLogsData?.totalPages || 1);
  const [isLoading, setIsLoading] = useState(() => !cachedTransactionLogsData);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const hasLoadedRef = useRef(Boolean(cachedTransactionLogsData));
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [actionCategory, setActionCategory] = useState<ActionCategory>("");
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);

  const currentCategoryOption =
    ACTION_CATEGORY_OPTIONS.find((opt) => opt.value === actionCategory) ||
    ACTION_CATEGORY_OPTIONS[0];
  const currentCategoryCount =
    actionCategory === ""
      ? categoryCounts.all || total
      : categoryCounts[actionCategory] || 0;

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<TransactionLogEntry | null>(null);
  const [deleteConfirmEntry, setDeleteConfirmEntry] = useState<TransactionLogEntry | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchLogs = useCallback(async (options?: { silent?: boolean }) => {
    const showLoading = !options?.silent && !hasLoadedRef.current;
    if (showLoading) {
      setIsLoading(true);
    }
    setError(null);
    if (!options?.silent) {
      setSelectedIds(new Set());
      setSelectionMode(false);
      setDeleteConfirmEntry(null);
    }

    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (actionCategory) params.set("action", actionCategory);

      const response = await fetch(`/api/admin/transaction-logs?${params.toString()}`, {
        credentials: "include",
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error ?? `HTTP ${response.status}`);
      }

      const data: TransactionLogsResponse = await response.json();
      setLogs(data.logs);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      if (data.categoryCounts) {
        setCategoryCounts(data.categoryCounts);
      }
      cachedTransactionLogsData = {
        logs: data.logs,
        total: data.total,
        totalPages: data.totalPages,
        categoryCounts: data.categoryCounts || categoryCounts,
      };
      if (typeof window !== "undefined") {
        try {
          sessionStorage.setItem("pup_focus_tx_logs", JSON.stringify(cachedTransactionLogsData));
        } catch {}
      }
      hasLoadedRef.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch transaction logs");
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  }, [page, debouncedSearch, actionCategory]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  useRealtimeSync(() => {
    void fetchLogs({ silent: true });
  });

  async function handleRefresh() {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await fetchLogs({ silent: true });
    } finally {
      setIsRefreshing(false);
    }
  }

  function handleCategoryChange(value: string) {
    setActionCategory(value as ActionCategory);
    setPage(1);
  }

  // ── Selection helpers ──
  const allCurrentIds = logs.map((l) => l.id);
  const isAllSelected = allCurrentIds.length > 0 && allCurrentIds.every((id) => selectedIds.has(id));
  const isIndeterminate = allCurrentIds.some((id) => selectedIds.has(id)) && !isAllSelected;

  function toggleSelectAll() {
    if (!selectionMode) {
      setSelectionMode(true);
      setSelectedIds(new Set(allCurrentIds));
    } else if (isAllSelected) {
      setSelectedIds(new Set());
      setSelectionMode(false);
    } else {
      setSelectedIds(new Set(allCurrentIds));
    }
  }

  function toggleSelectOne(id: string) {
    setSelectionMode(true);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ── Delete ──
  async function handleDeleteOne(id: string) {
    setIsDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/transaction-logs?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Failed to delete log entry");
      }
      setDeleteConfirmEntry(null);
      await fetchLogs({ silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleDeleteSelected() {
    if (selectedIds.size === 0) return;
    setIsDeleting(true);
    setError(null);
    try {
      const ids = Array.from(selectedIds).join(",");
      const res = await fetch(`/api/admin/transaction-logs?ids=${encodeURIComponent(ids)}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Failed to delete selected logs");
      }
      setSelectedIds(new Set());
      setSelectionMode(false);
      await fetchLogs({ silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk delete failed");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="mt-4 space-y-4">
      {/* ── System Activity Overview Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Total Activity
            </span>
            <AppIcon icon={Activity} size="md" color="muted" />
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">
            {categoryCounts.all || total}
          </p>
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            All system events logged
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Logins &amp; Auth
            </span>
            <AppIcon icon={LogIn} size="md" color="muted" />
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">
            {categoryCounts.auth || 0}
          </p>
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Session &amp; access events
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Uploads &amp; Reviews
            </span>
            <AppIcon icon={Page} size="md" color="muted" />
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">
            {(categoryCounts.uploads || 0) + (categoryCounts.reviews || 0)}
          </p>
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {categoryCounts.uploads || 0} uploads &bull; {categoryCounts.reviews || 0} reviews
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Admin &amp; Settings
            </span>
            <AppIcon icon={Settings} size="md" color="muted" />
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">
            {(categoryCounts.user_management || 0) +
              (categoryCounts.submission_windows || 0) +
              (categoryCounts.academic_terms || 0) +
              (categoryCounts.templates || 0) +
              (categoryCounts.classes || 0) +
              (categoryCounts.backup || 0)}
          </p>
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Administrative operations
          </span>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div className="rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-2.5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Search */}
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <AppIcon icon={Search} size="sm" color="muted" />
            </span>
            <input
              type="text"
              placeholder="Search actions, entity types…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 py-2 pl-9 pr-3 text-xs text-slate-900 dark:text-slate-100 outline-none placeholder-slate-400 dark:placeholder-slate-500 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Custom Category Dropdown Filter */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsCategoryDropdownOpen((prev) => !prev)}
                className="flex items-center justify-between gap-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-900 dark:text-slate-200 outline-none transition hover:border-slate-400 dark:hover:border-slate-600 focus:border-amber-500 cursor-pointer shadow-2xs"
              >
                <div className="flex items-center gap-1.5 text-left">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Category:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {currentCategoryOption.label}
                  </span>
                  <span className="ml-1 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500 text-slate-950 shadow-2xs">
                    {currentCategoryCount}
                  </span>
                </div>
                <NavArrowDown
                  className={`h-4 w-4 text-slate-500 dark:text-slate-400 transition-transform ${
                    isCategoryDropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {isCategoryDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setIsCategoryDropdownOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-1.5 z-30 w-72 rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 py-1.5 shadow-xl text-xs text-slate-900 dark:text-slate-200 overflow-hidden max-h-80 overflow-y-auto">
                    {ACTION_CATEGORY_OPTIONS.map((opt) => {
                      const isSelected = actionCategory === opt.value;
                      const count =
                        opt.value === ""
                          ? categoryCounts.all || total
                          : categoryCounts[opt.value] || 0;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            handleCategoryChange(opt.value);
                            setIsCategoryDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between gap-2.5 px-3.5 py-2 transition hover:bg-slate-100 dark:hover:bg-slate-800 text-left cursor-pointer ${
                            isSelected
                              ? "bg-amber-50 dark:bg-amber-950/30 text-slate-900 dark:text-slate-100 font-bold"
                              : "text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          <span className="truncate">{opt.label}</span>
                          <span
                            className={`ml-2 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[11px] font-bold shrink-0 shadow-2xs ${
                              isSelected
                                ? "bg-amber-500 text-slate-950"
                                : count > 0
                                ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500"
                            }`}
                          >
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => void handleRefresh()}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-200 text-xs font-semibold px-3.5 py-2 transition disabled:opacity-50 cursor-pointer shadow-2xs"
            >
              <Refresh className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              <span>{isRefreshing ? "Refreshing…" : "Refresh"}</span>
            </button>
          </div>
        </div>

        {/* Result Count */}
        <p className="text-xs text-slate-600 dark:text-slate-400">
          {isLoading && logs.length === 0
            ? "Loading transaction logs…"
            : `${total} ${total === 1 ? "record" : "records"} found`}
        </p>
      </div>

      {/* ── Bulk Action Bar (visible when selection > 0) ── */}
      {selectedIds.size > 0 && (
        <div className="rounded-2xl border border-red-300 dark:border-red-900/60 bg-red-50 dark:bg-red-950/20 px-4 py-2.5 flex items-center justify-between gap-3 shadow-sm">
          <p className="text-xs font-semibold text-red-700 dark:text-red-400">
            {selectedIds.size} {selectedIds.size === 1 ? "entry" : "entries"} selected
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="flex items-center gap-1 text-xs text-white px-2.5 py-1 rounded-lg border border-[#5e0000] bg-[#780000] hover:bg-[#5e0000] transition cursor-pointer shadow-xs"
            >
              <AppIcon icon={Xmark} size="xs" color="white" />
              Clear
            </button>
            <button
              type="button"
              onClick={() => void handleDeleteSelected()}
              disabled={isDeleting}
              className="flex items-center gap-1.5 text-xs font-semibold text-white bg-[#780000] hover:bg-[#5e0000] border border-[#5e0000] px-3 py-1 rounded-lg transition cursor-pointer disabled:opacity-50 shadow-xs"
            >
              <AppIcon icon={Trash} size="xs" color="inherit" />
              Delete {selectedIds.size} selected
            </button>
          </div>
        </div>
      )}

      {/* ── Error State ── */}
      <AlertPopup
        type="error"
        message={error}
        onClose={() => setError(null)}
      />

      {/* ── Data Table ── */}
      <div className="w-full overflow-x-auto rounded-2xl border border-slate-400 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        {/* Table Header */}
        <div className="hidden lg:grid lg:grid-cols-[80px_160px_1fr_1.2fr_1fr_120px] gap-2 border-b border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 px-4 py-2.5 items-center">
          <div className="flex items-center justify-center gap-1.5 col-span-1">
            <input
              type="checkbox"
              checked={isAllSelected}
              ref={(el) => { if (el) el.indeterminate = isIndeterminate; }}
              onChange={toggleSelectAll}
              disabled={logs.length === 0}
              className="w-3.5 h-3.5 rounded border-slate-400 dark:border-slate-600 accent-[#780000] cursor-pointer"
              title="Select all"
            />
            <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-600 dark:text-slate-400">Select</span>
          </div>
          <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-600 dark:text-slate-400">Timestamp</p>
          <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-600 dark:text-slate-400">Actor</p>
          <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-600 dark:text-slate-400">Action</p>
          <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-600 dark:text-slate-400">Entity</p>
          <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-600 dark:text-slate-400 text-center">Actions</p>
        </div>

        {/* Table Body */}
        {isLoading && logs.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <AppIcon icon={Refresh} size="lg" color="muted" className="animate-spin mx-auto" />
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              Loading transaction logs…
            </p>
          </div>
        ) : logs.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <AppIcon icon={ShieldAlert} size="xl" color="muted" className="mx-auto" />
            <p className="mt-3 text-xs font-semibold text-slate-700 dark:text-slate-300">
              No transaction log entries found.
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Try adjusting your search or filter criteria.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {logs.map((entry) => {
              const badge = getActionBadgeStyle(entry.action);
              const isSelected = selectedIds.has(entry.id);
              const isPendingDelete = deleteConfirmEntry?.id === entry.id;

              return (
                <Fragment key={entry.id}>
                  <div
                    className={`group grid gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-800 transition items-center lg:grid-cols-[80px_160px_1fr_1.2fr_1fr_120px] ${
                      isPendingDelete
                        ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40"
                        : isSelected
                        ? "bg-red-50/60 dark:bg-red-950/20"
                        : "bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    }`}
                  >
                    {/* Row Checkbox */}
                    <div className="flex items-center justify-center">
                      {selectionMode || isSelected ? (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(entry.id)}
                          className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-600 accent-[#780000] cursor-pointer"
                        />
                      ) : (
                        <span className="w-3.5 h-3.5" />
                      )}
                    </div>

                    {/* Timestamp */}
                    <div className="flex items-center gap-1.5">
                      <AppIcon icon={Hourglass} size="xs" color="muted" />
                      <p className="text-xs text-slate-700 dark:text-slate-300 font-mono leading-tight">
                        {formatTimestamp(entry.createdAt)}
                      </p>
                    </div>

                    {/* Actor */}
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                        {entry.actorName ?? "System"}
                      </p>
                      <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate">
                        {truncateId(entry.actorId)}
                      </p>
                    </div>

                    {/* Action Badge */}
                    <div className="flex items-center">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold tracking-wide shadow-xs ${badge.bg} ${badge.text}`}
                      >
                        {badge.icon}
                        {formatActionLabel(entry.action)}
                      </span>
                    </div>

                    {/* Entity */}
                    <div>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200 capitalize">
                        {entry.entityType.replace(/_/g, " ")}
                      </p>
                    </div>

                    {/* Actions — View + Delete */}
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedEntry(entry)}
                        className="bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer flex items-center gap-1 shadow-xs"
                        title="View details"
                      >
                        <AppIcon icon={Eye} size="xs" color="inherit" />
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmEntry(isPendingDelete ? null : entry)}
                        disabled={isDeleting}
                        className={`p-1 border rounded-lg transition cursor-pointer disabled:opacity-50 ${
                          isPendingDelete
                            ? "text-amber-600 bg-amber-100 border-amber-300 dark:bg-amber-950/40 dark:border-amber-700"
                            : "text-red-500 hover:bg-red-500/10 border-transparent hover:border-red-200 dark:hover:border-red-900/60"
                        }`}
                        title={isPendingDelete ? "Cancel delete" : "Delete this log entry"}
                      >
                        <AppIcon icon={isPendingDelete ? Xmark : Trash} size="sm" color="inherit" />
                      </button>
                    </div>
                  </div>

                  {/* Inline Confirmation Bar */}
                  {isPendingDelete && (
                    <div className="px-4 py-2.5 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900/40 flex items-center justify-between gap-3">
                      <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                        ⚠ Delete this transaction log entry? This cannot be undone.
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmEntry(null)}
                          className="px-3 py-1 text-xs font-semibold rounded-lg border border-[#5e0000] bg-[#780000] hover:bg-[#5e0000] text-white transition cursor-pointer shadow-xs"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={isDeleting}
                          onClick={() => void handleDeleteOne(entry.id)}
                          className="px-3 py-1 text-xs font-bold rounded-lg bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] transition cursor-pointer disabled:opacity-50 flex items-center gap-1"
                        >
                          <AppIcon icon={Trash} size="xs" color="inherit" />
                          {isDeleting ? "Deleting…" : "Confirm Delete"}
                        </button>
                      </div>
                    </div>
                  )}
                </Fragment>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 ? (
        <div className="flex items-center justify-between rounded-2xl border border-slate-400 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 shadow-sm">
          <button
            type="button"
            disabled={page <= 1 || isLoading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="flex items-center gap-1 rounded-xl border border-slate-400 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-200 text-xs font-semibold px-3 py-1.5 transition disabled:opacity-50 cursor-pointer"
          >
            <AppIcon icon={NavArrowLeft} size="sm" color="inherit" />
            Previous
          </button>

          <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
            Page {page} of {totalPages}
          </p>

          <button
            type="button"
            disabled={page >= totalPages || isLoading}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="flex items-center gap-1 rounded-xl border border-slate-400 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-200 text-xs font-semibold px-3 py-1.5 transition disabled:opacity-50 cursor-pointer"
          >
            Next
            <AppIcon icon={NavArrowRight} size="sm" color="inherit" />
          </button>
        </div>
      ) : null}

      {/* ── Log Detail Modal ── */}
      {selectedEntry ? (
        <LogDetailModal
          entry={selectedEntry}
          onClose={() => setSelectedEntry(null)}
        />
      ) : null}
    </div>
  );
}

export const AuditLogsPanel = TransactionLogsPanel;
