import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/utils/cn";

export function StatusMetricsSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-3", className)} aria-busy="true" aria-label="Loading metrics">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <Skeleton className="h-4 w-48" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
      </div>
      <Skeleton className="h-2 w-full rounded-full" />
    </div>
  );
}

export function ComplianceListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      className="bg-white border border-slate-200/80 dark:bg-slate-900 dark:border-slate-800 rounded-xl divide-y divide-slate-200/70 dark:divide-slate-800/60 overflow-hidden shadow-xs"
      aria-busy="true"
      aria-label="Loading requirements"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-48 sm:w-64" />
            <Skeleton className="h-3 w-36" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-8 w-20 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SubmissionHistorySkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading submission history">
      {/* Desktop table skeleton */}
      <div className="hidden md:block overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
        <div className="border-b border-slate-200/80 dark:border-slate-800 px-5 py-3.5 bg-slate-50/80 dark:bg-slate-900 flex justify-between">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="divide-y divide-slate-200/70 dark:divide-slate-800/60">
          {Array.from({ length: count }).map((_, idx) => (
            <div key={idx} className="px-5 py-4 flex items-center justify-between gap-4">
              <div className="space-y-1.5 w-1/4">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-8 w-20 rounded-xl" />
            </div>
          ))}
        </div>
      </div>

      {/* Mobile card skeleton */}
      <div className="space-y-3 md:hidden">
        {Array.from({ length: count }).map((_, idx) => (
          <div
            key={idx}
            className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3 shadow-xs"
          >
            <div className="flex justify-between items-start">
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <Skeleton className="h-3 w-48" />
            <div className="flex justify-end pt-2 border-t border-slate-200/80 dark:border-slate-800/60">
              <Skeleton className="h-8 w-24 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SubmissionWindowSkeleton() {
  return (
    <div
      className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs space-y-3"
      aria-busy="true"
      aria-label="Loading submission window"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-48" />
        </div>
        <Skeleton className="h-6 w-28 rounded-full" />
      </div>
      <div className="grid grid-cols-4 gap-2 pt-2">
        <Skeleton className="h-14 rounded-xl" />
        <Skeleton className="h-14 rounded-xl" />
        <Skeleton className="h-14 rounded-xl" />
        <Skeleton className="h-14 rounded-xl" />
      </div>
    </div>
  );
}

export function DashboardMetricsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2 shadow-xs"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-4 rounded-full" />
          </div>
          <Skeleton className="h-7 w-12" />
        </div>
      ))}
    </div>
  );
}
