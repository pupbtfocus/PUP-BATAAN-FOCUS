import { cn } from "@/utils/cn";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-pulse rounded-md bg-slate-200/80 dark:bg-slate-800/80",
        className,
      )}
      {...props}
    />
  );
}

export function KpiCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-busy="true"
      aria-label="Loading card"
      className={cn(
        "rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs h-full flex flex-col justify-between space-y-3",
        className,
      )}
    >
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-5 w-5 rounded-md" />
        </div>
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-1.5 w-full rounded-full" />
        </div>
      </div>
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 mt-auto">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

export function StatTileSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-busy="true"
      className={cn(
        "rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-4.5 shadow-xs space-y-2.5",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-3.5 w-20" />
        <Skeleton className="h-5 w-8 rounded-full" />
      </div>
      <Skeleton className="h-7 w-16" />
      <Skeleton className="h-3 w-28" />
    </div>
  );
}

export function SubjectLoadCardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div
      aria-busy="true"
      aria-label="Loading subject loads"
      className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 dark:border-slate-800 border-l-4 border-l-slate-300 dark:border-l-slate-700 bg-white dark:bg-slate-900 p-5 shadow-xs"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-5 w-16 rounded-md" />
              <Skeleton className="h-5 w-16 rounded-md" />
            </div>
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Skeleton className="h-2.5 w-20" />
              <Skeleton className="h-6 w-32" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-2.5 w-24" />
              <Skeleton className="h-4 w-44" />
            </div>
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-3 w-8" />
              </div>
              <Skeleton className="h-1.5 w-full rounded-full" />
            </div>
          </div>
          <div className="flex items-center gap-2 border-t border-slate-100 dark:border-slate-800 pt-3.5">
            <Skeleton className="h-9 flex-1 rounded-lg" />
            <Skeleton className="h-9 w-9 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TableRowsSkeleton({
  rows = 5,
  columns = 6,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <tr
          key={rowIdx}
          aria-hidden="true"
          className="border-b border-slate-200/80 dark:border-slate-800/60"
        >
          {Array.from({ length: columns }).map((__, colIdx) => (
            <td key={colIdx} className="px-4 py-3.5">
              {colIdx === 0 ? (
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <Skeleton className="h-3.5 w-28 sm:w-36" />
                    <Skeleton className="h-2.5 w-20 sm:w-28" />
                  </div>
                </div>
              ) : colIdx === columns - 1 ? (
                <div className="flex justify-end gap-1.5">
                  <Skeleton className="h-7 w-20 rounded-lg" />
                </div>
              ) : (
                <Skeleton className="h-3.5 w-20 sm:w-24" />
              )}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function MobileCardListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading list" className="space-y-3">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3 shadow-xs"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Skeleton className="h-9 w-9 rounded-full shrink-0" />
              <div className="space-y-1.5">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-2.5 w-24" />
              </div>
            </div>
            <Skeleton className="h-5 w-16 rounded-full shrink-0" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-1.5 w-full rounded-full" />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function AnalyticsPanelSkeleton() {
  return (
    <section
      aria-busy="true"
      aria-label="Loading compliance analytics"
      className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 shadow-xs space-y-5"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-5 w-52" />
          <Skeleton className="h-3.5 w-72 max-w-full" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-24 rounded-xl" />
          <Skeleton className="h-8 w-24 rounded-xl" />
        </div>
      </div>
      <div className="grid grid-cols-1 min-[360px]:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatTileSkeleton key={i} />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center pt-1">
        <div className="lg:col-span-5 flex items-center justify-center py-4">
          <Skeleton className="h-44 w-44 rounded-full" />
        </div>
        <div className="lg:col-span-7 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3.5 w-36" />
                <Skeleton className="h-3.5 w-16" />
              </div>
              <Skeleton className="h-2.5 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
