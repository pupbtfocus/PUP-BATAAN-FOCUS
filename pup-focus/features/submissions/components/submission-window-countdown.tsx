"use client";
import { useEffect, useState } from "react";
import { Calendar, Hourglass, Lock, LockSlash, Timer, WarningTriangle } from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";
type SubmissionWindowState = {
  isConfigured: boolean;
  isOpen: boolean;
  status: "Upcoming" | "Open" | "Closed";
  today: string;
  currentTime: string;
  startDate: string | null;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  academicYear: string | null;
  semester: string | null;
  startTimeLabel?: string | null;
  endTimeLabel?: string | null;
  currentTimeLabel?: string | null;
};
type SubmissionWindowCountdownProps = {
  window: SubmissionWindowState | null;
  isLoading: boolean;
  onExpired?: () => void;
};
type TimeRemaining = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
};
function getManilaTimestamp(date: string, time: string): number {
  // Build an ISO-ish string and parse it as Asia/Manila local time.
  // The service stores dates as YYYY-MM-DD and times as HH:mm:ss.
  // We construct the Date in UTC, then offset to Manila (+08:00).
  const iso = `${date}T${time}+08:00`;
  return new Date(iso).getTime();
}
function computeRemaining(targetMs: number): TimeRemaining {
  const now = Date.now();
  const diff = Math.max(0, targetMs - now);
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds, totalMs: diff };
}
function formatDateReadable(dateStr: string): string {
  try {
    const d = new Date(`${dateStr}T00:00:00+08:00`);
    return d.toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "Asia/Manila",
    });
  } catch {
    return dateStr;
  }
}
function TimeUnit({
  value,
  label,
  numberClass,
}: {
  value: number;
  label: string;
  numberClass?: string;
}) {
  return (
    <div className="flex flex-col items-center">
      <span className={`text-lg font-bold tabular-nums leading-none ${numberClass ?? "text-slate-900 dark:text-emerald-300"}`}>
        {String(value).padStart(2, "0")}
      </span>
      <span className="mt-0.5 text-[9px] uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400 font-medium">
        {label}
      </span>
    </div>
  );
}
export function SubmissionWindowCountdown({
  window: windowState,
  isLoading,
  onExpired,
}: SubmissionWindowCountdownProps) {
  const [remaining, setRemaining] = useState<TimeRemaining | null>(null);
  const [hasExpired, setHasExpired] = useState(false);
  useEffect(() => {
    if (!windowState || !windowState.isConfigured) {
      setRemaining(null);
      return;
    }
    const { status, startDate, startTime, endDate, endTime } = windowState;
    // Determine target timestamp based on status.
    let targetMs: number | null = null;
    if (status === "Open" && endDate && endTime) {
      targetMs = getManilaTimestamp(endDate, endTime);
    } else if (status === "Upcoming" && startDate && startTime) {
      targetMs = getManilaTimestamp(startDate, startTime);
    }
    if (targetMs === null) {
      setRemaining(null);
      return;
    }
    // Compute immediately on mount.
    const initial = computeRemaining(targetMs);
    setRemaining(initial);
    if (initial.totalMs <= 0 && status === "Open") {
      setHasExpired(true);
    }
    const intervalId = setInterval(() => {
      const updated = computeRemaining(targetMs);
      setRemaining(updated);
      if (updated.totalMs <= 0 && status === "Open" && !hasExpired) {
        setHasExpired(true);
        // Auto-refetch after 2 seconds to let parent update the state.
        setTimeout(() => {
          onExpired?.();
        }, 2000);
        clearInterval(intervalId);
      }
    }, 1000);
    return () => clearInterval(intervalId);
  }, [
    windowState?.status,
    windowState?.startDate,
    windowState?.startTime,
    windowState?.endDate,
    windowState?.endTime,
    windowState?.isConfigured,
    hasExpired,
    onExpired,
  ]);
  // Reset expired state when window state changes externally.
  useEffect(() => {
    if (windowState?.status !== "Open") {
      setHasExpired(false);
    }
  }, [windowState?.status]);
  // ── Loading skeleton ──
  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-xs shadow-slate-300/40 dark:shadow-none">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
          <div className="h-3 w-24 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
        </div>
        <div className="mt-3 flex justify-center gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className="h-5 w-7 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
              <div className="h-2 w-5 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
            </div>
          ))}
        </div>
      </div>
    );
  }
  // ── Not configured ──
  if (!windowState || !windowState.isConfigured) {
    return (
      <div className="rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-xs shadow-slate-300/40 dark:shadow-none">
        <div className="flex items-center gap-2">
          <AppIcon icon={WarningTriangle} size="sm" color="default" />
          <span className="text-[10px] uppercase tracking-[0.15em] text-slate-600 dark:text-slate-400 font-semibold">
            Window Not Configured
          </span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
          Admin has not set submission dates yet.
        </p>
      </div>
    );
  }
  const { status, academicYear, semester, startDate, endDate, startTime, endTime } =
    windowState;
  const startTimeLabel = windowState.startTimeLabel ?? startTime;
  const endTimeLabel = windowState.endTimeLabel ?? endTime;
  const isAlwaysOpen = Boolean(
    windowState?.endDate && (
      windowState.endDate.startsWith("2099") ||
      new Date(windowState.endDate).getFullYear() >= 2099
    )
  );

  // ── Status badge config ──
  const badges: Record<
    typeof status,
    {
      label: string;
      icon: React.ReactNode;
      dotClass: string;
      borderClass: string;
      bgClass: string;
      textClass: string;
      numberClass: string;
    }
  > = {
    Open: {
      label: isAlwaysOpen ? "Always Open" : "Window Open",
      icon: <AppIcon icon={LockSlash} size="xs" color="inherit" />,
      dotClass: "bg-emerald-400 pulse-dot",
      borderClass: "border-amber-400/40",
      bgClass: "bg-[#6b0000]/80 text-emerald-200",
      textClass: "text-emerald-300",
      numberClass: "text-amber-100 font-bold",
    },
    Closed: {
      label: "Window Closed",
      icon: <AppIcon icon={Lock} size="xs" color="inherit" />,
      dotClass: "bg-rose-400",
      borderClass: "border-amber-400/40",
      bgClass: "bg-[#6b0000]/80 text-rose-200",
      textClass: "text-rose-300",
      numberClass: "text-amber-100 font-bold",
    },
    Upcoming: {
      label: "Opening Soon",
      icon: <AppIcon icon={Hourglass} size="xs" color="inherit" />,
      dotClass: "bg-amber-400",
      borderClass: "border-amber-400/40",
      bgClass: "bg-[#6b0000]/80 text-amber-200",
      textClass: "text-amber-300",
      numberClass: "text-amber-100 font-bold",
    },
  };
  const badge = badges[status];
  return (
    <div
      className={`rounded-xl border ${badge.borderClass} ${badge.bgClass} p-3 transition-colors duration-500 shadow-xs`}
    >
      {/* Status badge */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${badge.dotClass}`}
            aria-hidden="true"
          />
          <span
            className={`text-[10px] font-bold uppercase tracking-[0.15em] ${badge.textClass}`}
          >
            {badge.label}
          </span>
        </div>
        <span className={badge.textClass}>{badge.icon}</span>
      </div>
      {/* Academic term */}
      {academicYear && semester ? (
        <div className="mt-2 flex items-center gap-1.5">
          <AppIcon icon={Calendar} size="xs" color="muted" />
          <span className="text-[10px] tracking-wide text-amber-100/90 font-medium">
            A.Y. {academicYear} | {semester}
          </span>
        </div>
      ) : null}
      {/* Countdown ticker (Open or Upcoming) */}
      {isAlwaysOpen && status === "Open" ? (
        <div className="mt-2.5 text-center py-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/40 text-[10px] font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Submissions Open Indefinitely</span>
          </div>
          <p className="mt-1 text-[9px] text-amber-200/70">
            No closing deadline configured for this term.
          </p>
        </div>
      ) : remaining && status !== "Closed" ? (
        <div className="mt-3">
          <div className="flex items-center justify-center gap-1 mb-1.5">
            <AppIcon icon={Timer} size="xs" color="muted" />
            <span className="text-[9px] uppercase tracking-[0.18em] text-amber-200/80 font-semibold">
              {status === "Open" ? "Closes in" : "Opens in"}
            </span>
          </div>
          <div className="flex items-center justify-center gap-2.5">
            {remaining.days > 0 ? (
              <>
                <TimeUnit value={remaining.days} label="Days" numberClass={badge.numberClass} />
                <span className="text-sm font-light text-slate-400 dark:text-slate-600">:</span>
              </>
            ) : null}
            <TimeUnit value={remaining.hours} label="Hrs" numberClass={badge.numberClass} />
            <span className="text-sm font-light text-slate-400 dark:text-slate-600">:</span>
            <TimeUnit value={remaining.minutes} label="Min" numberClass={badge.numberClass} />
            <span className="text-sm font-light text-slate-400 dark:text-slate-600">:</span>
            <TimeUnit value={remaining.seconds} label="Sec" numberClass={badge.numberClass} />
          </div>
        </div>
      ) : null}
      {/* Closed state — show window dates */}
      {status === "Closed" && startDate && endDate ? (
        <div className="mt-2.5 rounded-lg bg-white/80 dark:bg-slate-950/50 border border-red-300 dark:border-red-900/40 px-2.5 py-2 text-center">
          <p className="text-[10px] text-red-950 dark:text-slate-400">
            Window was {formatDateReadable(startDate)}{" "}
            {startTimeLabel ?? ""} – {formatDateReadable(endDate)}{" "}
            {endTimeLabel ?? ""}
          </p>
        </div>
      ) : null}
      {/* Upcoming — show scheduled start */}
      {status === "Upcoming" && startDate ? (
        <div className="mt-2 rounded-lg bg-white/80 dark:bg-slate-950/50 border border-amber-300 dark:border-amber-900/40 px-2.5 py-1.5 text-center">
          <p className="text-[10px] text-amber-950 dark:text-slate-400">
            Opens {formatDateReadable(startDate)} {startTimeLabel ?? ""}
          </p>
        </div>
      ) : null}
      {/* Expired flash */}
      {hasExpired ? (
        <div className="mt-2 rounded-lg border border-red-300 dark:border-red-700/40 bg-red-100 dark:bg-red-950/40 px-2.5 py-1.5 text-center">
          <p className="text-[10px] font-medium text-red-800 dark:text-red-400">
            Window has just expired — refreshing…
          </p>
        </div>
      ) : null}
    </div>
  );
}
