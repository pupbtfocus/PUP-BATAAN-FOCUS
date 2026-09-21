"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle, EditPencil, Eye, Filter, Hourglass, NavArrowLeft, NavArrowRight, Page, Refresh, Search, Settings, ShieldAlert, Trash, Upload, UserBadgeCheck, UserPlus, UserXmark, Xmark, XmarkCircle } from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";
import { ModalHeader } from "@/components/ui/modal-header";
import { AlertPopup } from "@/components/ui/alert-popup";

// ─── Types ───────────────────────────────────────────────────────────

type AuditLogEntry = {
  id: string;
  actorId: string | null;
  actorName: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

type AuditLogsResponse = {
  logs: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type ActionCategory = "" | "uploads" | "reviews" | "user_management" | "submission_windows" | "backup";

const ACTION_CATEGORY_OPTIONS: { value: ActionCategory; label: string }[] = [
  { value: "", label: "All Actions" },
  { value: "uploads", label: "Uploads" },
  { value: "reviews", label: "Reviews" },
  { value: "user_management", label: "User Management" },
  { value: "submission_windows", label: "Submission Windows" },
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
  if (action === "backup.create") {
    return { bg: "bg-[#0b5336] border-[#08412a]", text: "text-white", icon: <AppIcon icon={CheckCircle} size="xs" color="inherit" /> };
  }
  if (action === "backup.delete") {
    return { bg: "bg-[#780000] border-[#5e0000]", text: "text-white", icon: <AppIcon icon={Trash} size="xs" color="inherit" /> };
  }
  if (action === "backup.download") {
    return { bg: "bg-amber-600 border-amber-700", text: "text-white", icon: <AppIcon icon={Page} size="xs" color="inherit" /> };
  }
  if (action === "backup.export_zip") {
    return { bg: "bg-slate-600 border-slate-700", text: "text-white", icon: <AppIcon icon={Page} size="xs" color="inherit" /> };
  }
  if (action.includes("approve") || action.includes("validated") || action.includes("activate")) {
    return { bg: "bg-[#0b5336] border-[#08412a]", text: "text-white", icon: <AppIcon icon={CheckCircle} size="xs" color="inherit" /> };
  }
  if (action.includes("create") || action.includes("invite")) {
    return { bg: "bg-emerald-700 border-emerald-800", text: "text-white", icon: <AppIcon icon={UserPlus} size="xs" color="inherit" /> };
  }
  if (action.includes("reject") || action.includes("delete") || action.includes("deactivate")) {
    return { bg: "bg-[#780000] border-[#5e0000]", text: "text-white", icon: <AppIcon icon={XmarkCircle} size="xs" color="inherit" /> };
  }
  if (action.includes("upload")) {
    return { bg: "bg-blue-700 border-blue-800", text: "text-white", icon: <AppIcon icon={Upload} size="xs" color="inherit" /> };
  }
  if (action.includes("update") || action.includes("window")) {
    return { bg: "bg-amber-600 border-amber-700", text: "text-white", icon: <AppIcon icon={EditPencil} size="xs" color="inherit" /> };
  }
  return { bg: "bg-slate-600 border-slate-700", text: "text-white", icon: <AppIcon icon={ShieldAlert} size="xs" color="inherit" /> };
}

function getActionIcon(action: string) {
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

// ─── Metadata Modal ──────────────────────────────────────────────────

function MetadataModal({
  entry,
  onClose,
}: {
  entry: AuditLogEntry;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-3 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-400 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <ModalHeader
          title={formatActionLabel(entry.action)}
          subtitle="Audit Log Detail"
          icon={getActionIcon(entry.action)}
        />

        {/* Body */}
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5 space-y-4">
          {/* Summary Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-400 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400 font-semibold">
                Timestamp
              </p>
              <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                {formatTimestamp(entry.createdAt)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-400 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400 font-semibold">
                Actor
              </p>
              <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                {entry.actorName ?? truncateId(entry.actorId)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-400 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400 font-semibold">
                Entity Type
              </p>
              <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                {entry.entityType}
              </p>
            </div>
            <div className="rounded-xl border border-slate-400 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400 font-semibold">
                Entity ID
              </p>
              <p className="mt-1 text-sm font-mono text-slate-900 dark:text-slate-100 break-all">
                {entry.entityId ?? "—"}
              </p>
            </div>
          </div>

          {/* Full Actor ID */}
          <div className="rounded-xl border border-slate-400 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400 font-semibold">
              Actor ID
            </p>
            <p className="mt-1 text-sm font-mono text-slate-900 dark:text-slate-100 break-all">
              {entry.actorId ?? "—"}
            </p>
          </div>

          {/* Metadata JSON */}
          <div className="rounded-xl border border-slate-400 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400 font-semibold mb-2">
              Metadata
            </p>
            {Object.keys(entry.metadata).length > 0 ? (
              <div className="space-y-1.5">
                {Object.entries(entry.metadata).map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-start gap-2 text-sm"
                  >
                    <span className="font-mono text-amber-700 dark:text-amber-300 font-semibold shrink-0">
                      {key}:
                    </span>
                    <span className="font-mono text-slate-900 dark:text-slate-200 break-all">
                      {typeof value === "object"
                        ? JSON.stringify(value)
                        : String(value ?? "null")}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm italic text-slate-500 dark:text-slate-400">
                No metadata recorded.
              </p>
            )}
          </div>

          {/* Log ID */}
          <div className="rounded-xl border border-slate-400 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400 font-semibold">
              Log ID
            </p>
            <p className="mt-1 text-sm font-mono text-slate-900 dark:text-slate-100 break-all">
              {entry.id}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-400 dark:border-slate-800 px-6 py-3 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] transition cursor-pointer shadow-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Panel ──────────────────────────────────────────────────────

export function AuditLogsPanel() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [actionCategory, setActionCategory] = useState<ActionCategory>("");
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false); // row checkboxes visible
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmEntry, setDeleteConfirmEntry] = useState<AuditLogEntry | null>(null); // per-row confirmation

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setSelectedIds(new Set());
    setSelectionMode(false);
    setDeleteConfirmEntry(null);

    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (actionCategory) params.set("action", actionCategory);

      const response = await fetch(`/api/admin/audit-logs?${params.toString()}`, {
        credentials: "include",
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error ?? `HTTP ${response.status}`);
      }

      const data: AuditLogsResponse = await response.json();
      setLogs(data.logs);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch audit logs");
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch, actionCategory]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  function handleRefresh() {
    void fetchLogs();
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
      // First click: enter selection mode and check all
      setSelectionMode(true);
      setSelectedIds(new Set(allCurrentIds));
    } else if (isAllSelected) {
      // All selected → deselect all + exit selection mode
      setSelectedIds(new Set());
      setSelectionMode(false);
    } else {
      // Some/none selected → select all
      setSelectedIds(new Set(allCurrentIds));
    }
  }

  function toggleSelectOne(id: string) {
    setSelectionMode(true); // entering selection mode on any row click
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
      const res = await fetch(`/api/admin/audit-logs?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Failed to delete log entry");
      }
      setDeleteConfirmEntry(null);
      await fetchLogs();
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
      const res = await fetch(`/api/admin/audit-logs?ids=${encodeURIComponent(ids)}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Failed to delete selected logs");
      }
      setSelectedIds(new Set());
      await fetchLogs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk delete failed");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="mt-4 space-y-4">
      {/* ── Filter Bar ── */}
      <div className="rounded-2xl border border-slate-400 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
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
              className="w-full rounded-xl border border-slate-400 dark:border-slate-800 bg-white dark:bg-slate-950 py-2 pl-9 pr-3 text-xs text-slate-900 dark:text-slate-100 outline-none placeholder-slate-400 dark:placeholder-slate-500 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition"
            />
          </div>

          {/* Category Filter + Refresh */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <AppIcon icon={Filter} size="sm" color="muted" />
              </span>
              <select
                value={actionCategory}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="appearance-none rounded-xl border border-slate-400 dark:border-slate-800 bg-white dark:bg-slate-950 py-2 pl-9 pr-8 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-amber-500 transition cursor-pointer"
              >
                {ACTION_CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={isLoading}
              className="flex items-center gap-1.5 rounded-xl border border-slate-400 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-200 text-xs font-semibold px-3.5 py-2 transition disabled:opacity-50 cursor-pointer"
            >
              <Refresh className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
              {isLoading ? "Loading…" : "Refresh"}
            </button>
          </div>
        </div>

        {/* Result Count */}
        <p className="mt-2.5 text-xs text-slate-600 dark:text-slate-400">
          {isLoading
            ? "Loading audit logs…"
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
              className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 transition cursor-pointer"
            >
              <AppIcon icon={Xmark} size="xs" color="inherit" />
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
        {/* Table Header — neutral */}
        <div className="hidden lg:grid lg:grid-cols-[80px_160px_1fr_1.2fr_1fr_120px] gap-2 border-b border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 px-4 py-2.5 items-center">
          {/* Select All Checkbox */}
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
              Loading audit logs…
            </p>
          </div>
        ) : logs.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <AppIcon icon={ShieldAlert} size="xl" color="muted" className="mx-auto" />
            <p className="mt-3 text-xs font-semibold text-slate-700 dark:text-slate-300">
              No audit log entries found.
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
                <>
                  <div
                    key={entry.id}
                    className={`group grid gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-800 transition items-center lg:grid-cols-[80px_160px_1fr_1.2fr_1fr_120px] ${
                      isPendingDelete
                        ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40"
                        : isSelected
                        ? "bg-red-50/60 dark:bg-red-950/20"
                        : "bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    }`}
                  >
                    {/* Row Checkbox — only visible in selection mode */}
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
                      <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate">
                        {truncateId(entry.entityId)}
                      </p>
                    </div>

                    {/* Actions — View + Delete */}
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedEntry(entry)}
                        className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer flex items-center gap-1"
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
                        ⚠ Delete this audit log entry? This cannot be undone.
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmEntry(null)}
                          className="px-3 py-1 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
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
                </>
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

      {/* ── Metadata Detail Modal ── */}
      {selectedEntry ? (
        <MetadataModal
          entry={selectedEntry}
          onClose={() => setSelectedEntry(null)}
        />
      ) : null}
    </div>
  );
}
