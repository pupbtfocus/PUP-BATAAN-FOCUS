"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Search,
  Filter,
  ShieldAlert,
  FileText,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Eye,
  X,
  Upload,
  UserPlus,
  UserMinus,
  UserCheck,
  Trash2,
  Clock,
  CheckCircle2,
  XCircle,
  Settings,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";

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

type ActionCategory = "" | "uploads" | "reviews" | "user_management" | "submission_windows";

const ACTION_CATEGORY_OPTIONS: { value: ActionCategory; label: string }[] = [
  { value: "", label: "All Actions" },
  { value: "uploads", label: "Uploads" },
  { value: "reviews", label: "Reviews" },
  { value: "user_management", label: "User Management" },
  { value: "submission_windows", label: "Submission Windows" },
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
  if (action.includes("approve") || action.includes("validated") || action.includes("create") || action.includes("activate")) {
    return {
      bg: "bg-emerald-500/15 border-emerald-500/30",
      text: "text-emerald-400",
      icon: <CheckCircle2 className="h-3 w-3" />,
    };
  }
  if (action.includes("reject") || action.includes("delete") || action.includes("deactivate")) {
    return {
      bg: "bg-rose-500/15 border-rose-500/30",
      text: "text-rose-400",
      icon: <XCircle className="h-3 w-3" />,
    };
  }
  if (action.includes("upload")) {
    return {
      bg: "bg-blue-500/15 border-blue-500/30",
      text: "text-blue-400",
      icon: <Upload className="h-3 w-3" />,
    };
  }
  if (action.includes("update") || action.includes("window")) {
    return {
      bg: "bg-amber-500/15 border-amber-500/30",
      text: "text-amber-400",
      icon: <Pencil className="h-3 w-3" />,
    };
  }
  return {
    bg: "bg-slate-500/15 border-slate-500/30",
    text: "text-slate-400",
    icon: <ShieldAlert className="h-3 w-3" />,
  };
}

function getActionIcon(action: string): React.ReactNode {
  if (action.includes("upload")) return <Upload className="h-4 w-4 text-blue-400" />;
  if (action.includes("approve") || action.includes("validated")) return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
  if (action.includes("reject")) return <XCircle className="h-4 w-4 text-rose-400" />;
  if (action.includes("create") || action.includes("invite")) return <UserPlus className="h-4 w-4 text-emerald-400" />;
  if (action.includes("delete")) return <Trash2 className="h-4 w-4 text-rose-400" />;
  if (action.includes("activate")) return <UserCheck className="h-4 w-4 text-emerald-400" />;
  if (action.includes("deactivate")) return <UserMinus className="h-4 w-4 text-amber-400" />;
  if (action.includes("update")) return <Pencil className="h-4 w-4 text-amber-400" />;
  if (action.includes("window")) return <Settings className="h-4 w-4 text-amber-400" />;
  return <FileText className="h-4 w-4 text-slate-400" />;
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
        className="flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-700 px-6 py-4">
          <div className="flex items-center gap-3">
            {getActionIcon(entry.action)}
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[#7a0000] dark:text-amber-300">
                Audit Log Detail
              </p>
              <h3 className="mt-1 text-lg font-semibold text-slate-800 dark:text-slate-100">
                {formatActionLabel(entry.action)}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-300 dark:border-slate-700 p-2 text-slate-500 dark:text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5 space-y-4">
          {/* Summary Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Timestamp
              </p>
              <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">
                {formatTimestamp(entry.createdAt)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Actor
              </p>
              <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">
                {entry.actorName ?? truncateId(entry.actorId)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Entity Type
              </p>
              <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">
                {entry.entityType}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Entity ID
              </p>
              <p className="mt-1 text-sm font-mono text-slate-800 dark:text-slate-100 break-all">
                {entry.entityId ?? "—"}
              </p>
            </div>
          </div>

          {/* Full Actor ID */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Actor ID
            </p>
            <p className="mt-1 text-sm font-mono text-slate-800 dark:text-slate-100 break-all">
              {entry.actorId ?? "—"}
            </p>
          </div>

          {/* Metadata JSON */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 mb-2">
              Metadata
            </p>
            {Object.keys(entry.metadata).length > 0 ? (
              <div className="space-y-1.5">
                {Object.entries(entry.metadata).map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-start gap-2 text-sm"
                  >
                    <span className="font-mono text-amber-400 dark:text-amber-300 shrink-0">
                      {key}:
                    </span>
                    <span className="font-mono text-slate-700 dark:text-slate-300 break-all">
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
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Log ID
            </p>
            <p className="mt-1 text-sm font-mono text-slate-800 dark:text-slate-100 break-all">
              {entry.id}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 dark:border-slate-700 px-6 py-3 flex justify-end">
          <Button onClick={onClose} variant="secondary" size="sm">
            Close
          </Button>
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

  return (
    <div className="mt-4 space-y-4">
      {/* ── Filter Bar ── */}
      <div className="rounded-2xl border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950/80 p-4 shadow-lg shadow-black/20">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search actions, entity types…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900 py-2.5 pl-10 pr-4 text-sm text-slate-800 dark:text-slate-100 outline-none placeholder-slate-400 focus:ring-2 focus:ring-amber-300/40 transition"
            />
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <select
                value={actionCategory}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="appearance-none rounded-xl border border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900 py-2.5 pl-10 pr-8 text-sm text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-amber-300/40 transition"
              >
                {ACTION_CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
              className="flex items-center gap-1.5"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`}
              />
              {isLoading ? "Loading…" : "Refresh"}
            </Button>
          </div>
        </div>

        {/* Result Count */}
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          {isLoading
            ? "Loading audit logs…"
            : `${total} ${total === 1 ? "record" : "records"} found`}
        </p>
      </div>

      {/* ── Error State ── */}
      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {/* ── Data Table ── */}
      <div className="w-full overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-950/80 shadow-lg shadow-black/20">
        {/* Table Header */}
        <div className="hidden lg:grid lg:grid-cols-[160px_1fr_1.2fr_1fr_80px] gap-2 border-b border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/50 px-4 py-2.5">
          <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-500 dark:text-slate-400">
            Timestamp
          </p>
          <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-500 dark:text-slate-400">
            Actor
          </p>
          <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-500 dark:text-slate-400">
            Action
          </p>
          <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-500 dark:text-slate-400">
            Entity
          </p>
          <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-500 dark:text-slate-400 text-center">
            Details
          </p>
        </div>

        {/* Table Body */}
        {isLoading && logs.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <RefreshCw className="mx-auto h-6 w-6 animate-spin text-slate-400" />
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
              Loading audit logs…
            </p>
          </div>
        ) : logs.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <ShieldAlert className="mx-auto h-8 w-8 text-slate-500 dark:text-slate-400" />
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
              No audit log entries found.
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Try adjusting your search or filter criteria.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-700/50">
            {logs.map((entry) => {
              const badge = getActionBadgeStyle(entry.action);

              return (
                <div
                  key={entry.id}
                  className="group grid gap-2 px-4 py-3 transition hover:bg-slate-100/50 dark:hover:bg-slate-800/30 lg:grid-cols-[160px_1fr_1.2fr_1fr_80px] items-center"
                >
                  {/* Timestamp */}
                  <div className="flex items-center gap-2 lg:gap-0">
                    <Clock className="h-3.5 w-3.5 text-slate-400 lg:hidden" />
                    <p className="text-xs text-slate-600 dark:text-slate-300 font-mono">
                      {formatTimestamp(entry.createdAt)}
                    </p>
                  </div>

                  {/* Actor */}
                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                      {entry.actorName ?? "System"}
                    </p>
                    <p className="text-[10px] font-mono text-slate-400 truncate">
                      {truncateId(entry.actorId)}
                    </p>
                  </div>

                  {/* Action Badge */}
                  <div className="flex items-center gap-2">
                    {getActionIcon(entry.action)}
                    <span
                      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold tracking-wide ${badge.bg} ${badge.text}`}
                    >
                      {badge.icon}
                      {formatActionLabel(entry.action)}
                    </span>
                  </div>

                  {/* Entity */}
                  <div>
                    <p className="text-sm text-slate-700 dark:text-slate-200 capitalize">
                      {entry.entityType.replace(/_/g, " ")}
                    </p>
                    <p className="text-[10px] font-mono text-slate-400 truncate">
                      {truncateId(entry.entityId)}
                    </p>
                  </div>

                  {/* Details Button */}
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={() => setSelectedEntry(entry)}
                      className="inline-flex items-center gap-1 rounded-lg border border-blue-500/30 bg-blue-500/10 px-2.5 py-1.5 text-xs font-medium text-blue-400 transition hover:bg-blue-500/20"
                    >
                      <Eye className="h-3 w-3" />
                      View
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 ? (
        <div className="flex items-center justify-between rounded-2xl border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950/80 px-4 py-3 shadow-lg shadow-black/20">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={page <= 1 || isLoading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="flex items-center gap-1"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Previous
          </Button>

          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Page {page} of {totalPages}
          </p>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={page >= totalPages || isLoading}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="flex items-center gap-1"
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
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
