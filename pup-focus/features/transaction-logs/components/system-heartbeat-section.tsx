"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  CheckCircle,
  ClockRotateRight,
  Hourglass,
  NavArrowDown,
  Refresh,
  ShieldAlert,
} from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";
import { useRealtimeSync } from "@/lib/realtime";

type KeepaliveLogEntry = {
  id: number;
  jobName: string;
  status: string;
  executedAt: string;
};

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

function getKeepaliveHealth(latestIso?: string): {
  label: string;
  badgeClass: string;
  isHealthy: boolean;
} {
  if (!latestIso) {
    return {
      label: "No Checks Yet",
      badgeClass:
        "bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
      isHealthy: false,
    };
  }
  const ageDays = (Date.now() - new Date(latestIso).getTime()) / (1000 * 60 * 60 * 24);
  if (ageDays <= 7) {
    return {
      label: "Active",
      badgeClass:
        "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
      isHealthy: true,
    };
  }
  return {
    label: "Overdue (>7d)",
    badgeClass:
      "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
    isHealthy: false,
  };
}

export function SystemHeartbeatSection() {
  const [logs, setLogs] = useState<KeepaliveLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchKeepaliveLogs = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setError(null);
    try {
      const limit = showAll ? 25 : 5;
      const res = await fetch(`/api/admin/keepalive-logs?limit=${limit}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setLogs(data.logs ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load database keep-alive logs");
    } finally {
      setIsLoading(false);
    }
  }, [showAll]);

  useEffect(() => {
    void fetchKeepaliveLogs();
  }, [fetchKeepaliveLogs]);

  useRealtimeSync(() => {
    void fetchKeepaliveLogs(true);
  });

  async function handleRefresh() {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await fetchKeepaliveLogs(true);
    } finally {
      setIsRefreshing(false);
    }
  }

  const latest = logs[0];
  const health = getKeepaliveHealth(latest?.executedAt);

  return (
    <section className="rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2">
            <AppIcon icon={Activity} size="sm" color="muted" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Database Keep-Alive
            </h2>
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${health.badgeClass}`}
            >
              <AppIcon
                icon={health.isHealthy ? CheckCircle : ShieldAlert}
                size="xs"
                color="inherit"
              />
              {health.label}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden sm:flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300">
            <AppIcon icon={ClockRotateRight} size="xs" color="muted" />
            <span>
              Last check:{" "}
              <strong className="font-semibold text-slate-900 dark:text-slate-100">
                {latest ? formatTimestamp(latest.executedAt) : "—"}
              </strong>
            </span>
          </div>

          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-200 text-xs font-semibold px-3 py-1.5 transition disabled:opacity-50 cursor-pointer"
          >
            <Refresh className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>{isRefreshing ? "Refreshing…" : "Refresh"}</span>
          </button>
        </div>
      </div>

      {error ? (
        <div className="px-5 py-4 text-xs text-red-600 dark:text-red-400">{error}</div>
      ) : isLoading && logs.length === 0 ? (
        <div className="px-5 py-8 text-center text-xs text-slate-500 dark:text-slate-400">
          Loading database keep-alive logs…
        </div>
      ) : logs.length === 0 ? (
        <div className="px-5 py-8 text-center text-xs text-slate-500 dark:text-slate-400">
          No scheduled check logs found yet.
        </div>
      ) : (
        <>
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {logs.map((entry) => (
              <div
                key={entry.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-5 py-2.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40 transition"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <AppIcon icon={Hourglass} size="xs" color="muted" />
                  <span className="font-mono text-slate-700 dark:text-slate-300 shrink-0">
                    {formatTimestamp(entry.executedAt)}
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {entry.jobName}
                  </span>
                </div>

                <span className="inline-flex w-fit items-center gap-1 rounded-md border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 text-[11px] font-semibold uppercase text-emerald-700 dark:text-emerald-300">
                  <AppIcon icon={CheckCircle} size="xs" color="inherit" />
                  {entry.status}
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between px-5 py-2.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 text-xs text-slate-500 dark:text-slate-400">
            <span>
              Showing {logs.length} of {total} total {total === 1 ? "check" : "checks"}
            </span>
            {total > 5 ? (
              <button
                type="button"
                onClick={() => setShowAll((prev) => !prev)}
                className="inline-flex items-center gap-1 font-semibold text-[#780000] dark:text-amber-400 hover:underline cursor-pointer"
              >
                <span>{showAll ? "Show less" : "View recent 25"}</span>
                <NavArrowDown
                  className={`h-3.5 w-3.5 transition-transform ${showAll ? "rotate-180" : ""}`}
                />
              </button>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}
