"use client";

import { useEffect, useState } from "react";
import { Calendar, CheckCircle, WarningTriangle } from "iconoir-react";
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
  isGracePeriod?: boolean;
  isPersonalDeadline?: boolean;
  effectiveDeadline?: string | null;
  formattedDueAt?: string | null;
  badgeLabel?: string | null;
};

type SubmissionWindowCountdownProps = {
  window: SubmissionWindowState | null;
  isLoading: boolean;
  onExpired?: () => void;
  isAllValidated?: boolean;
};

function getManilaTimestamp(date: string, time: string): number {
  const iso = `${date}T${time}+08:00`;
  return new Date(iso).getTime();
}

function formatDateReadable(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(`${dateStr}T00:00:00+08:00`);
    if (Number.isNaN(d.getTime())) return dateStr;
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

function formatTimeReadable(timeStr?: string | null, label?: string | null): string | null {
  if (label && label.trim()) return label.trim();
  if (!timeStr) return null;
  const trimmed = timeStr.trim();
  if (/AM|PM/i.test(trimmed)) return trimmed;
  try {
    const [h, m] = trimmed.split(":");
    const hour = parseInt(h, 10);
    const minute = m || "00";
    if (isNaN(hour)) return trimmed;
    const period = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${hour12}:${minute} ${period}`;
  } catch {
    return trimmed;
  }
}

export function SubmissionWindowCountdown({
  window: windowState,
  isLoading,
  onExpired,
  isAllValidated,
}: SubmissionWindowCountdownProps) {
  const [hasExpired, setHasExpired] = useState(false);

  useEffect(() => {
    if (!windowState || !windowState.isConfigured || windowState.status !== "Open") {
      setHasExpired(false);
      return;
    }
    const { endDate, endTime } = windowState;
    if (!endDate || !endTime) return;

    const checkExpiration = () => {
      const targetMs = getManilaTimestamp(endDate, endTime);
      if (Date.now() >= targetMs && !hasExpired) {
        setHasExpired(true);
        setTimeout(() => {
          onExpired?.();
        }, 1500);
      }
    };

    checkExpiration();
    const intervalId = setInterval(checkExpiration, 30000);
    window.addEventListener("focus", checkExpiration);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("focus", checkExpiration);
    };
  }, [
    windowState?.status,
    windowState?.endDate,
    windowState?.endTime,
    windowState?.isConfigured,
    hasExpired,
    onExpired,
  ]);

  useEffect(() => {
    if (windowState?.status !== "Open") {
      setHasExpired(false);
    }
  }, [windowState?.status]);

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="rounded-xl border border-amber-400/30 bg-[#6b0000]/80 p-3.5 shadow-xs animate-pulse">
        <div className="flex items-center justify-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-amber-400/30" />
          <div className="h-3.5 w-28 rounded bg-amber-400/20" />
        </div>
        <div className="mt-2.5 mx-auto h-3.5 w-40 rounded bg-amber-400/20" />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="h-14 rounded-lg bg-black/25 border border-amber-400/10" />
          <div className="h-14 rounded-lg bg-black/25 border border-amber-400/10" />
        </div>
      </div>
    );
  }

  // Completed all mandatory requirements for the semester
  if (isAllValidated) {
    return (
      <div className="rounded-xl border border-emerald-500/40 bg-[#08412a]/90 p-3.5 shadow-xs text-white text-center">
        <div className="flex items-center justify-center gap-2">
          <AppIcon icon={CheckCircle} size="sm" color="inherit" className="text-emerald-300 shrink-0" />
          <span className="text-xs font-bold uppercase tracking-[0.15em] text-emerald-200">
            All Requirements Done
          </span>
        </div>
        {windowState?.academicYear && windowState?.semester ? (
          <p className="mt-1 text-[11px] text-emerald-200/80 font-medium">
            A.Y. {windowState.academicYear} | {windowState.semester}
          </p>
        ) : null}
        <p className="mt-2 text-xs leading-relaxed text-emerald-100/90 font-medium">
          All required compliance documents completed for this semester.
        </p>
      </div>
    );
  }

  // Personal deadline active override
  const isPersonalActive = Boolean(windowState?.isPersonalDeadline || windowState?.isGracePeriod);
  if (isPersonalActive && !isAllValidated) {
    return (
      <div className="rounded-xl border border-emerald-500/40 bg-[#08412a]/90 p-3.5 shadow-xs text-white text-center">
        <div className="flex items-center justify-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400 pulse-dot" aria-hidden="true" />
          <span className="text-xs font-bold uppercase tracking-[0.15em] text-emerald-300">
            PERSONAL DEADLINE ACTIVE
          </span>
        </div>
        {windowState?.formattedDueAt ? (
          <p className="mt-1.5 text-[11px] text-emerald-200/90 font-medium">
            Due: {windowState.formattedDueAt}
          </p>
        ) : windowState?.academicYear && windowState?.semester ? (
          <p className="mt-1.5 text-[11px] text-emerald-200/80 font-medium">
            A.Y. {windowState.academicYear} | {windowState.semester}
          </p>
        ) : null}
        <p className="mt-1.5 text-xs leading-relaxed text-emerald-100/90 font-medium">
          Uploads currently unlocked
        </p>
      </div>
    );
  }

  // Not configured
  if (!windowState || !windowState.isConfigured) {
    return (
      <div className="rounded-xl border border-amber-400/30 bg-[#6b0000]/80 p-3.5 shadow-xs text-amber-100 text-center">
        <div className="flex items-center justify-center gap-2">
          <AppIcon icon={WarningTriangle} size="sm" color="inherit" className="text-amber-300" />
          <span className="text-[10px] uppercase tracking-[0.15em] text-amber-300 font-semibold">
            Submission Not Configured
          </span>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-amber-200/70">
          Admin has not set submission dates yet.
        </p>
      </div>
    );
  }

  const { status, academicYear, semester, startDate, endDate, startTime, endTime } =
    windowState;
  const isAlwaysOpen = Boolean(
    windowState?.endDate && (
      windowState.endDate.startsWith("2099") ||
      new Date(windowState.endDate).getFullYear() >= 2099
    )
  );

  const formattedStartTime = formatTimeReadable(startTime, windowState.startTimeLabel);
  const formattedEndTime = formatTimeReadable(endTime, windowState.endTimeLabel);
  const formattedStartDate = formatDateReadable(startDate);
  const formattedEndDate = isAlwaysOpen ? "Indefinite" : formatDateReadable(endDate);

  // Status badge config
  const badges: Record<
    typeof status,
    {
      label: string;
      dotClass: string;
      borderClass: string;
      bgClass: string;
      textClass: string;
    }
  > = {
    Open: {
      label:
        isAllValidated
          ? "All Requirements Done"
          : windowState?.badgeLabel ||
            (isAlwaysOpen ? "Submissions Always Open" : "Submission Open"),
      dotClass: isAllValidated ? "bg-emerald-400" : "bg-emerald-400 pulse-dot",
      borderClass: "border-amber-400/40",
      bgClass: "bg-[#6b0000]/80 text-emerald-200",
      textClass: "text-emerald-300",
    },
    Closed: {
      label: "Submission Closed",
      dotClass: "bg-rose-400",
      borderClass: "border-amber-400/40",
      bgClass: "bg-[#6b0000]/80 text-rose-200",
      textClass: "text-rose-300",
    },
    Upcoming: {
      label: "Opening Soon",
      dotClass: "bg-amber-400",
      borderClass: "border-amber-400/40",
      bgClass: "bg-[#6b0000]/80 text-amber-200",
      textClass: "text-amber-300",
    },
  };

  const badge = badges[status];

  return (
    <div
      className={`rounded-xl border ${badge.borderClass} ${badge.bgClass} p-3.5 transition-colors duration-500 shadow-xs`}
    >
      {/* Centered Status badge without lock icon */}
      <div className="flex items-center justify-center gap-2">
        <span
          className={`inline-block h-2.5 w-2.5 rounded-full ${badge.dotClass}`}
          aria-hidden="true"
        />
        <span
          className={`text-xs font-bold uppercase tracking-[0.15em] ${badge.textClass}`}
        >
          {badge.label}
        </span>
      </div>

      {/* Centered Academic term & semester */}
      {academicYear && semester ? (
        <div className="mt-2 flex items-center justify-center gap-2">
          <AppIcon icon={Calendar} size="sm" color="inherit" className="text-amber-300/80 shrink-0" />
          <span className="text-xs tracking-wide text-amber-100/90 font-medium truncate">
            A.Y. {academicYear} | {semester}
          </span>
        </div>
      ) : null}

      {/* Static Start & End Dates */}
      <div className="mt-3 pt-2.5 border-t border-amber-400/20">
        <div className="grid grid-cols-2 gap-2 text-left">
          {/* Start Date */}
          <div className="rounded-lg bg-black/25 border border-amber-400/20 p-2 flex flex-col justify-between">
            <div>
              <span className="text-[9px] uppercase tracking-wider text-amber-200/70 font-semibold block">
                Start Date
              </span>
              <span className="text-xs font-bold text-amber-100 mt-1 block leading-tight">
                {formattedStartDate}
              </span>
            </div>
            {formattedStartTime ? (
              <span className="text-[10px] text-amber-200/80 font-medium block mt-1">
                {formattedStartTime}
              </span>
            ) : null}
          </div>

          {/* End Date */}
          <div className="rounded-lg bg-black/25 border border-amber-400/20 p-2 flex flex-col justify-between">
            <div>
              <span className="text-[9px] uppercase tracking-wider text-amber-200/70 font-semibold block">
                {isAlwaysOpen ? "End Date" : status === "Closed" ? "Closed Date" : "End Date"}
              </span>
              <span className="text-xs font-bold text-amber-100 mt-1 block leading-tight">
                {formattedEndDate}
              </span>
            </div>
            {!isAlwaysOpen && formattedEndTime ? (
              <span className="text-[10px] text-amber-200/80 font-medium block mt-1">
                {formattedEndTime}
              </span>
            ) : isAlwaysOpen ? (
              <span className="text-[10px] text-emerald-300 font-medium block mt-1">
                Always open
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Expired flash */}
      {hasExpired ? (
        <div className="mt-2.5 rounded-lg border border-red-400/40 bg-red-950/60 px-2.5 py-1.5 text-center">
          <p className="text-[10px] font-medium text-red-200">
            Submission window has closed — refreshing…
          </p>
        </div>
      ) : null}
    </div>
  );
}
