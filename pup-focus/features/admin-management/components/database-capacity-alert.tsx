"use client";

import { useCallback, useEffect, useState } from "react";
import { Archive, Database, HardDrive, NavArrowRight, WarningTriangle, Xmark } from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";
import { useRealtimeSync } from "@/lib/realtime";

export interface DbStatusData {
  detectedTier?: "free" | "pro";
  usedBytes: number;
  maxBytes: number;
  usedMb: number;
  maxMb: number;
  dbBytes?: number;
  maxDbBytes?: number;
  dbMb?: number;
  maxDbMb?: number;
  dbUsagePercent?: number;
  bucketBytes?: number;
  maxBucketBytes?: number;
  bucketMb?: number;
  maxBucketMb?: number;
  bucketUsagePercent?: number;
  maxUploadFileMb?: number;
  tableCount?: number;
  bucketCount?: number;
  objectCount?: number;
  usagePercent: number;
  status: "healthy" | "warning" | "critical";
  warningThresholdPercent: number;
  criticalThresholdPercent: number;
}

interface DatabaseCapacityAlertProps {
  onManageStorage?: () => void;
  showCard?: boolean;
  refreshTrigger?: number;
  overrideStatus?: DbStatusData | null;
}

function formatCapacityMb(mb: number): string {
  if (mb >= 1024) {
    const gb = mb / 1024;
    return `${Number.isInteger(gb) ? gb : gb.toFixed(1)} GB`;
  }
  return `${mb} MB`;
}

export function DatabaseCapacityAlert({
  onManageStorage,
  showCard = false,
  refreshTrigger = 0,
  overrideStatus,
}: DatabaseCapacityAlertProps) {
  const [fetchedStatus, setFetchedStatus] = useState<DbStatusData | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const fetchDbStatus = useCallback(async () => {
    if (overrideStatus) return;
    try {
      const res = await fetch(`/api/admin/db-status?_t=${Date.now()}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as DbStatusData;
      if (data && typeof data.usagePercent === "number") {
        setFetchedStatus(data);
        if (data.status === "critical") {
          setDismissed(false);
        }
      }
    } catch {
      // Silently ignore network errors
    }
  }, [overrideStatus]);

  useEffect(() => {
    if (overrideStatus) {
      setDismissed(false);
      return;
    }
    void fetchDbStatus();
    const interval = setInterval(() => {
      void fetchDbStatus();
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchDbStatus, refreshTrigger, overrideStatus]);

  useRealtimeSync(() => {
    if (!overrideStatus) {
      void fetchDbStatus();
    }
  });

  const dbStatus = overrideStatus ?? fetchedStatus;
  if (!dbStatus) return null;

  const isCritical = dbStatus.status === "critical";
  const isWarning = dbStatus.status === "warning";
  const isNearFull = isCritical || isWarning;

  const isProTier = dbStatus.detectedTier === "pro" || (dbStatus.maxDbMb ?? 500) > 500;
  const maxDbMb = dbStatus.maxDbMb ?? (isProTier ? 8192 : 500);
  const maxBucketMb = dbStatus.maxBucketMb ?? (isProTier ? 102400 : 1024);
  const maxUploadFileMb = dbStatus.maxUploadFileMb ?? (isProTier ? 5120 : 50);
  const dbMb = dbStatus.dbMb ?? Number(((dbStatus.usagePercent / 100) * maxDbMb).toFixed(1));
  const bucketMb = dbStatus.bucketMb ?? Number(((dbStatus.usagePercent / 100) * maxBucketMb * 0.75).toFixed(1));
  const dbUsagePercent =
    dbStatus.dbUsagePercent ?? Math.min(100, Math.round((dbMb / maxDbMb) * 1000) / 10);
  const bucketUsagePercent =
    dbStatus.bucketUsagePercent ?? Math.min(100, Math.round((bucketMb / maxBucketMb) * 1000) / 10);
  const tableCount = dbStatus.tableCount ?? 20;
  const bucketCount = dbStatus.bucketCount ?? 3;

  if (showCard) {
    return (
      <div
        className={`rounded-2xl p-5 shadow-xs space-y-3 transition-colors ${
          isCritical
            ? "border-2 border-red-500 bg-red-50/70 dark:bg-red-950/30"
            : isWarning
            ? "border-2 border-amber-500 bg-amber-50/70 dark:bg-amber-950/30"
            : "border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Database &amp; File Storage
            </span>
            <span className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
              {isProTier ? "Pro Tier" : "Free Tier"}
            </span>
          </div>
          <HardDrive
            className={`h-5 w-5 ${
              isCritical
                ? "text-red-600 dark:text-red-400"
                : isWarning
                ? "text-amber-600 dark:text-amber-400"
                : "text-slate-400"
            }`}
            strokeWidth={2}
          />
        </div>

        <div className="space-y-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              {dbStatus.usagePercent}% Peak Quota
            </h3>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
                isCritical
                  ? "bg-[#780000] text-white border-[#5e0000]"
                  : isWarning
                  ? "bg-amber-500 text-slate-950 border-amber-600"
                  : "bg-[#0b5336] text-white border-[#08412a]"
              }`}
            >
              {isCritical ? "Almost Full" : isWarning ? "High Usage" : "Healthy"}
            </span>
          </div>

          {/* 1. Database Limit */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-medium text-slate-600 dark:text-slate-300">
                Postgres DB ({tableCount} tables)
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {formatCapacityMb(dbMb)} / {formatCapacityMb(maxDbMb)} ({dbUsagePercent}%)
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  dbUsagePercent >= 90
                    ? "bg-red-600"
                    : dbUsagePercent >= 80
                    ? "bg-amber-500"
                    : "bg-[#0b5336]"
                }`}
                style={{ width: `${Math.min(100, Math.max(2, dbUsagePercent))}%` }}
              />
            </div>
          </div>

          {/* 2. File Storage Limit */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-medium text-slate-600 dark:text-slate-300">
                File Buckets ({bucketCount} buckets)
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {formatCapacityMb(bucketMb)} / {formatCapacityMb(maxBucketMb)} ({bucketUsagePercent}%)
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  bucketUsagePercent >= 90
                    ? "bg-red-600"
                    : bucketUsagePercent >= 80
                    ? "bg-amber-500"
                    : "bg-[#0b5336]"
                }`}
                style={{ width: `${Math.min(100, Math.max(2, bucketUsagePercent))}%` }}
              />
            </div>
          </div>

          <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {formatCapacityMb(maxDbMb)} DB + {formatCapacityMb(maxBucketMb)} Files ({formatCapacityMb(maxUploadFileMb)}/upload max)
            </p>
            {onManageStorage && (
              <button
                type="button"
                onClick={onManageStorage}
                className="inline-flex items-center gap-1 text-xs font-bold text-[#800000] dark:text-amber-400 hover:underline cursor-pointer shrink-0"
              >
                <span>Manage</span>
                <NavArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!isNearFull || dismissed) return null;

  return (
    <div
      role="alert"
      className={`mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border-2 px-4 py-3.5 shadow-md transition-all ${
        isCritical
          ? "border-amber-400/90 bg-[#780000] text-white"
          : "border-amber-600 bg-amber-500 text-slate-950"
      }`}
    >
      <div className="flex items-start sm:items-center gap-3 min-w-0">
        <div
          className={`p-2 rounded-xl shrink-0 flex items-center justify-center ${
            isCritical ? "bg-white/15 text-amber-300" : "bg-black/10 text-slate-950"
          }`}
        >
          <AppIcon icon={WarningTriangle} size="md" color="inherit" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs sm:text-sm font-extrabold tracking-tight flex items-center gap-1.5">
              <Database className="h-4 w-4 shrink-0" />
              <span>
                {isCritical
                  ? `Critical Alert: Database & File Storage is About to Be Full (${dbStatus.usagePercent}%)`
                  : `Storage Warning: Database & File Storage Usage is High (${dbStatus.usagePercent}%)`}
              </span>
            </p>
          </div>
          <p
            className={`text-xs mt-0.5 leading-snug ${
              isCritical ? "text-amber-100" : "text-slate-900/90 font-medium"
            }`}
          >
            Postgres DB ({tableCount} tables): <strong>{formatCapacityMb(dbMb)} / {formatCapacityMb(maxDbMb)} ({dbUsagePercent}%)</strong> • File Storage ({bucketCount} buckets): <strong>{formatCapacityMb(bucketMb)} / {formatCapacityMb(maxBucketMb)} ({bucketUsagePercent}%)</strong>. Exceeding {isProTier ? "Pro Tier" : "Free Tier"} limits locks the database into read-only mode — please archive completed terms or clean up files.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
        {onManageStorage && (
          <button
            type="button"
            onClick={onManageStorage}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer shadow-xs ${
              isCritical
                ? "bg-amber-400 hover:bg-amber-300 text-slate-950 border border-amber-300"
                : "bg-[#800000] hover:bg-[#680000] text-white border border-[#5e0000]"
            }`}
          >
            <Archive className="h-3.5 w-3.5" />
            <span>Backups &amp; Archive</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setDismissed(true)}
          className={`p-1.5 rounded-lg transition cursor-pointer ${
            isCritical
              ? "hover:bg-white/15 text-white"
              : "hover:bg-black/10 text-slate-950"
          }`}
          aria-label="Dismiss database capacity alert"
        >
          <AppIcon icon={Xmark} size="sm" color="inherit" />
        </button>
      </div>
    </div>
  );
}
