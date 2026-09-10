"use client";

import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { Calendar, CheckCircle, Clock, ClockRotateRight, EditPencil, FloppyDisk, NavArrowRight, ShieldAlert, SystemRestart, WarningTriangle, Xmark } from "iconoir-react";
import { Button } from "@/components/ui/button";
import type {
  ApiBody,
  SubmissionWindowResponse,
} from "@/features/faculty-management/types/faculty-dashboard.types";
import { ExtendSubmissionWindowModal } from "./extend-submission-window-modal";

function toDateTimeLocal(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function getNowIsoLocal(): string {
  return toDateTimeLocal(new Date());
}

function formatTimeDifference(ms: number): string {
  if (ms <= 0) return "0s";
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  if (minutes > 0 || hours > 0 || days > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);

  return parts.join(" ");
}

function formatTimeAgo(ms: number): string {
  if (ms <= 0) return "just now";
  const minutes = Math.floor(ms / (1000 * 60));
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));

  if (days > 0) return `${days}d ${hours % 24}h ago`;
  if (hours > 0) return `${hours}h ${minutes % 60}m ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "just now";
}

function toTimeInputValue(timeLabel: string): string | null {
  const match = timeLabel
    .trim()
    .match(/^(0?[1-9]|1[0-2]):([0-5][0-9])\s?(AM|PM)$/i);

  if (!match) {
    return null;
  }

  const hour12 = Number.parseInt(match[1], 10);
  const minute = match[2];
  const period = match[3].toUpperCase();

  const hour24 =
    period === "AM"
      ? hour12 === 12
        ? 0
        : hour12
      : hour12 === 12
        ? 12
        : hour12 + 12;

  return `${hour24.toString().padStart(2, "0")}:${minute}`;
}

function toTimeLabel(timeInput: string): string | null {
  const match = timeInput.trim().match(/^([01][0-9]|2[0-3]):([0-5][0-9])$/);

  if (!match) {
    return null;
  }

  const hour24 = Number.parseInt(match[1], 10);
  const minute = match[2];
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;

  return `${hour12}:${minute} ${period}`;
}

async function readApiBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export interface ExtensionLogEntry {
  id: string;
  created_at: string;
  extended_by?: string;
  extended_by_name?: string;
  old_end_date?: string;
  old_end_time?: string;
  new_end_date: string;
  new_end_time: string;
  scope: string;
  scope_target?: string;
  reason: string;
  reason_details?: string;
  extension_preset?: string;
  notified_faculty?: boolean;
}

export interface SubmissionWindowPanelProps {
  onWindowChange?: () => void;
  isSuperAdmin?: boolean;
}

export function SubmissionWindowPanel({
  onWindowChange,
  isSuperAdmin = false,
}: SubmissionWindowPanelProps) {
  const [openDateTime, setOpenDateTime] = useState("");
  const [closeDateTime, setCloseDateTime] = useState("");

  const [windowStatus, setWindowStatus] = useState<SubmissionWindowResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
  const [showCloseConfirmation, setShowCloseConfirmation] = useState(false);
  const [warningModalData, setWarningModalData] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
  }>({ isOpen: false, title: "", description: "" });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Extension Modal & History states
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [extensionLogs, setExtensionLogs] = useState<ExtensionLogEntry[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Edit vs. Save schedule toggle (defaults to editing if no schedule exists yet)
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);

  // 10-second safety countdown for Close Submissions
  const [closeCountdown, setCloseCountdown] = useState(10);

  // Snapshot refs for cancel-edit restore
  const savedOpenDateTimeRef = useRef("");
  const savedCloseDateTimeRef = useRef("");
  const openingInputRef = useRef<HTMLInputElement>(null);

  // Live clock state updating every second
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const startDateObj = useMemo(() => {
    if (!openDateTime) return null;
    const d = new Date(openDateTime);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [openDateTime]);

  const endDateObj = useMemo(() => {
    if (!closeDateTime) return null;
    const d = new Date(closeDateTime);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [closeDateTime]);

  const isWindowOpen = Boolean(
    startDateObj && endDateObj && now >= startDateObj && now <= endDateObj
  );

  const isUpcoming = Boolean(startDateObj && now < startDateObj);

  const formattedCountdownTime = useMemo(() => {
    if (isWindowOpen && endDateObj) {
      const diff = endDateObj.getTime() - now.getTime();
      return formatTimeDifference(diff);
    }
    if (isUpcoming && startDateObj) {
      const diff = startDateObj.getTime() - now.getTime();
      return formatTimeDifference(diff);
    }
    if (endDateObj && now > endDateObj) {
      const diff = now.getTime() - endDateObj.getTime();
      return `Expired ${formatTimeAgo(diff)}`;
    }
    return "Not Configured";
  }, [isWindowOpen, isUpcoming, startDateObj, endDateObj, now]);

  const nowIso = getNowIsoLocal();

  function formatDisplayDateTime(isoDateTime: string): string | null {
    if (!isoDateTime) return null;
    const parsed = new Date(isoDateTime);
    if (Number.isNaN(parsed.getTime())) return null;

    const dateStr = parsed.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    const timeStr = parsed.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    return `${dateStr} at ${timeStr}`;
  }

  function validateSchedule(): boolean {
    if (!openDateTime || !closeDateTime) {
      setError("Opening and closing schedule date and time are required.");
      return false;
    }

    if (openDateTime >= closeDateTime) {
      setError("The closing schedule must be later than the opening schedule.");
      return false;
    }

    return true;
  }

  const fetchLogs = useCallback(async () => {
    if (!isSuperAdmin) return;
    try {
      setIsLoadingLogs(true);
      const res = await fetch("/api/admin/submission-window/logs", { credentials: "include" });
      if (res.ok) {
        const body = await res.json();
        setExtensionLogs(body.logs || []);
      }
    } catch {
      // Ignore background log fetch error
    } finally {
      setIsLoadingLogs(false);
    }
  }, [isSuperAdmin]);

  const refetchLogs = useCallback(() => {
    if (isSuperAdmin) {
      void fetchLogs();
    }
  }, [isSuperAdmin, fetchLogs]);

  async function loadWindow() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/submission-window", { credentials: "include" });
      const body = await readApiBody(response);

      if (!response.ok) {
        const details =
          typeof body === "object" && body !== null
            ? (((body as ApiBody).error || (body as ApiBody).details) ?? `HTTP ${response.status}`)
            : `HTTP ${response.status}`;

        setError(`Failed to load submission window: ${details}`);
        return;
      }

      if (typeof body !== "object" || body === null) {
        setError(`Failed to load submission window: Invalid response (HTTP ${response.status})`);
        return;
      }

      const data = body as SubmissionWindowResponse;
      setWindowStatus(data);

      if (data.status === "Closed") {
        setOpenDateTime("");
        setCloseDateTime("");
      } else {
        if (data.startDate && data.startTimeLabel) {
          const time24 = toTimeInputValue(data.startTimeLabel);
          setOpenDateTime(time24 ? `${data.startDate}T${time24}` : `${data.startDate}T09:00`);
        } else if (data.startDate) {
          setOpenDateTime(`${data.startDate}T09:00`);
        } else {
          setOpenDateTime("");
        }

        if (data.endDate && data.endTimeLabel) {
          const time24 = toTimeInputValue(data.endTimeLabel);
          setCloseDateTime(time24 ? `${data.endDate}T${time24}` : `${data.endDate}T17:00`);
        } else if (data.endDate) {
          setCloseDateTime(`${data.endDate}T17:00`);
        } else {
          setCloseDateTime("");
        }
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load submission window");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadWindow();
      if (isSuperAdmin) {
        void fetchLogs();
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [isSuperAdmin, fetchLogs]);

  // Sync isEditingSchedule: lock inputs once a valid schedule loads
  useEffect(() => {
    if (!isLoading && windowStatus) {
      const hasSchedule = !!(windowStatus.startDate && windowStatus.endDate && windowStatus.status !== "Closed");
      setIsEditingSchedule(!hasSchedule);
    }
  }, [isLoading, windowStatus]);

  // Close countdown timer tick
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (showCloseConfirmation && closeCountdown > 0) {
      interval = setInterval(() => {
        setCloseCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [showCloseConfirmation, closeCountdown]);

  useEffect(() => {
    if (!closeDateTime) return;

    const checkExpiration = () => {
      const nowLocal = getNowIsoLocal();
      if (closeDateTime <= nowLocal) {
        setOpenDateTime("");
        setCloseDateTime("");
        fetch("/api/admin/submission-window", {
          method: "DELETE",
          credentials: "include",
        })
          .then(() => {
            void loadWindow();
            onWindowChange?.();
          })
          .catch(() => {});
      }
    };

    checkExpiration();
    const interval = setInterval(checkExpiration, 5000);
    return () => clearInterval(interval);
  }, [closeDateTime, onWindowChange]);

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!windowStatus?.academicYear || !windowStatus?.semester) {
      setError("No active academic term is configured. Please set a current academic term first.");
      return;
    }

    if (!validateSchedule()) {
      return;
    }

    setShowSaveConfirmation(true);
  }

  async function submitSave() {
    setShowSaveConfirmation(false);
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    const [startDate, startTime24] = openDateTime.split("T");
    const [endDate, endTime24] = closeDateTime.split("T");

    const startTimeLabel = toTimeLabel(startTime24);
    const endTimeLabel = toTimeLabel(endTime24);

    try {
      const response = await fetch("/api/admin/submission-window", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          startDate,
          endDate,
          startTime: startTimeLabel,
          endTime: endTimeLabel,
        }),
      });
      const body = await readApiBody(response);

      if (!response.ok) {
        if (typeof body !== "object" || body === null) {
          setError(`Failed to save submission window (HTTP ${response.status}).`);
          return;
        }

        const apiBody = body as ApiBody;
        setError(
          apiBody.details
            ? `${apiBody.error || "Failed to save submission window"}: ${apiBody.details}`
            : (apiBody.error ?? "Failed to save submission window"),
        );
        return;
      }

      if (typeof body !== "object" || body === null) {
        setError(`Failed to save submission window: Invalid response (HTTP ${response.status}).`);
        return;
      }

      setWindowStatus(body as SubmissionWindowResponse);
      setIsEditingSchedule(false);
      setSuccess("Submission window updated successfully.");
      onWindowChange?.();
      void fetchLogs();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save submission window");
    } finally {
      setIsSaving(false);
    }
  }

  function handleCloseSubmission() {
    setCloseCountdown(10);
    setShowCloseConfirmation(true);
  }

  async function confirmCloseSubmission() {
    setShowCloseConfirmation(false);
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/admin/submission-window", {
        method: "DELETE",
        credentials: "include",
      });
      const body = await readApiBody(response);

      if (!response.ok) {
        const apiBody = body as ApiBody;
        if (
          apiBody?.error?.includes("unvalidated or incomplete requirements") ||
          apiBody?.details?.includes("unvalidated") ||
          apiBody?.error?.includes("Cannot close") ||
          apiBody?.error?.includes("Incomplete Term Requirements")
        ) {
          setWarningModalData({
            isOpen: true,
            title: "Incomplete Term Requirements",
            description:
              "The submission window cannot be changed or closed yet. There are still missing requirements or unvalidated submissions for the current term.",
          });
          return;
        }
        setError(apiBody?.error || "Failed to close submissions");
        return;
      }

      if (typeof body !== "object" || body === null) {
        setError(`Failed to close submissions: Invalid response (HTTP ${response.status}).`);
        return;
      }

      setWindowStatus(body as SubmissionWindowResponse);
      setOpenDateTime("");
      setCloseDateTime("");
      setSuccess("Submissions closed and schedule cleared.");
      onWindowChange?.();
      void fetchLogs();
    } catch (closeError) {
      setError(closeError instanceof Error ? closeError.message : "Failed to close submissions");
    } finally {
      setIsSaving(false);
    }
  }

  const handleExtensionSuccess = (msg: string) => {
    setSuccess(msg);
    void loadWindow();
    refetchLogs();
    onWindowChange?.();
  };

  const currentTermLabel =
    windowStatus?.academicYear && windowStatus?.semester
      ? `${windowStatus.academicYear} • ${windowStatus.semester}`
      : "No active academic term";

  const currentScheduleLabel =
    windowStatus?.startDate &&
    windowStatus?.startTimeLabel &&
    windowStatus?.endDate &&
    windowStatus?.endTimeLabel
      ? `${formatDisplayDateTime(`${windowStatus.startDate}T${toTimeInputValue(windowStatus.startTimeLabel)}`)} to ${formatDisplayDateTime(`${windowStatus.endDate}T${toTimeInputValue(windowStatus.endTimeLabel)}`)}`
      : "Not configured";

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs dark:shadow-none space-y-6 transition-colors">
      {/* 1. Header & Status Section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Submission Window Manager
            </h4>
          </div>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            Current term: <span className="font-semibold text-slate-900 dark:text-slate-200">{currentTermLabel}</span>
          </p>
        </div>
      </div>

      {/* Real-time Status Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80 dark:bg-slate-950/50 dark:border-slate-800 transition-colors">
        <div className="flex items-center gap-3">
          {/* Status Badge */}
          <div className="flex items-center gap-2 bg-white text-slate-800 border border-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-800 px-2.5 py-1 text-xs font-semibold rounded-md shadow-2xs">
            <span className={`w-2 h-2 rounded-full ${
              isWindowOpen ? "bg-emerald-500 animate-pulse" : isUpcoming ? "bg-amber-500 animate-ping" : "bg-slate-400 dark:bg-slate-500"
            }`} />
            <span>{isWindowOpen ? "Live Submission Window" : isUpcoming ? "Scheduled Window" : "Window Closed"}</span>
          </div>
        </div>

        {/* Real-Time Countdown Timer Display */}
        <div className="flex items-center gap-2.5 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 px-3 py-1.5 rounded-lg shadow-xs">
          <Clock className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {isWindowOpen ? "Time Remaining" : isUpcoming ? "Opens In" : "Status"}
            </p>
            <p className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100">
              {formattedCountdownTime}
            </p>
          </div>
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300 px-4 py-2.5 text-xs">
          {error}
        </p>
      ) : null}

      {success ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300 px-4 py-2.5 text-xs">
          {success}
        </p>
      ) : null}

      {/* 2. 2-Column Schedule Configuration Grid */}
      <form onSubmit={handleSave} className="space-y-6">
        {isEditingSchedule ? (
          <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-slate-100 border border-slate-200/90 dark:bg-slate-800/50 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs transition-all">
            <EditPencil className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
            <span>
              <strong>Schedule Edit Mode Active:</strong> You can adjust the opening and closing schedules below. Remember to click <strong>Save Window Schedule</strong> to apply changes.
            </span>
          </div>
        ) : null}

        <div className="grid gap-5 md:grid-cols-2">
          {/* Left Column: Opening Schedule Input */}
          <div className={`p-4 rounded-xl flex flex-col justify-between transition-all duration-200 ${
            isEditingSchedule
              ? "bg-white border-2 border-slate-300 dark:bg-slate-900 dark:border-slate-700 shadow-xs"
              : "bg-slate-50 border border-slate-200/80 dark:bg-slate-950/50 dark:border-slate-800"
          }`}>
            <div>
              <label htmlFor="opening-schedule" className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                Opening Date & Time
              </label>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                Select the opening date and time for document uploads.
              </p>
            </div>
            <div>
              <input
                ref={openingInputRef}
                id="opening-schedule"
                type="datetime-local"
                min={nowIso}
                value={openDateTime}
                onChange={(e) => setOpenDateTime(e.target.value)}
                disabled={!isEditingSchedule || isLoading || isSaving}
                className={`w-full px-3.5 py-2 text-sm rounded-lg outline-none transition-colors ${
                  isEditingSchedule
                    ? "bg-white border border-slate-300 focus:border-slate-500 focus:ring-1 focus:ring-slate-500 text-slate-900 dark:bg-slate-900 dark:border-slate-700 dark:focus:border-slate-500 dark:text-slate-100 shadow-2xs"
                    : "bg-white border border-slate-200 text-slate-900 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100 cursor-not-allowed opacity-90"
                }`}
              />
              {isEditingSchedule ? (
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setOpenDateTime(toDateTimeLocal(new Date()))}
                    className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-md bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                  >
                    <Clock className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                    <span>Set to Now / Today</span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          {/* Right Column: Closing Schedule & Deadline */}
          <div className={`p-4 rounded-xl flex flex-col justify-between transition-all duration-200 ${
            isEditingSchedule
              ? "bg-white border-2 border-slate-300 dark:bg-slate-900 dark:border-slate-700 shadow-xs"
              : "bg-slate-50 border border-slate-200/80 dark:bg-slate-950/50 dark:border-slate-800"
          }`}>
            <div>
              <label htmlFor="closing-schedule" className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                Closing Date & Deadline
              </label>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                Current active deadline for faculty compliance document uploads.
              </p>
            </div>

            <div>
              {!isEditingSchedule && windowStatus?.endDate && windowStatus?.endTimeLabel ? (
                <div className="flex items-center justify-between bg-white border border-slate-200 text-slate-900 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100 px-3.5 py-2 text-sm rounded-lg">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-slate-500 dark:text-slate-400 shrink-0" />
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {windowStatus.endDate} at {windowStatus.endTimeLabel}
                    </span>
                  </div>
                  <span className="bg-slate-200/80 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 px-2 py-0.5 text-xs font-medium rounded-md">
                    Configured Deadline
                  </span>
                </div>
              ) : (
                <>
                  <input
                    id="closing-schedule"
                    type="datetime-local"
                    min={openDateTime || nowIso}
                    value={closeDateTime}
                    onChange={(e) => setCloseDateTime(e.target.value)}
                    disabled={!isEditingSchedule || isLoading || isSaving}
                    className={`w-full px-3.5 py-2 text-sm rounded-lg outline-none transition-colors ${
                      isEditingSchedule
                        ? "bg-white border-2 border-amber-500/60 text-slate-900 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:bg-slate-900 dark:border-amber-500/60 dark:text-slate-100 dark:focus:border-amber-400 shadow-xs"
                        : "bg-white border border-slate-200 text-slate-900 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100 cursor-not-allowed opacity-90"
                    }`}
                  />
                  {isEditingSchedule ? (
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const d = new Date();
                          d.setHours(23, 59, 0, 0);
                          setCloseDateTime(toDateTimeLocal(d));
                        }}
                        className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-md bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                      >
                        <span>Today (End of Day)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const d = new Date();
                          d.setDate(d.getDate() + 3);
                          setCloseDateTime(toDateTimeLocal(d));
                        }}
                        className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-md bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                      >
                        <span>+3 Days</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const d = new Date();
                          d.setDate(d.getDate() + 7);
                          setCloseDateTime(toDateTimeLocal(d));
                        }}
                        className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-md bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                      >
                        <span>+1 Week</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const d = new Date();
                          d.setDate(d.getDate() + 14);
                          setCloseDateTime(toDateTimeLocal(d));
                        }}
                        className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-md bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                      >
                        <span>+2 Weeks</span>
                      </button>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>

        {/* 3. Structured Footer Action Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 dark:border-slate-800 pt-5 mt-6">
          {/* LEFT: Operational & Destructive Triggers */}
          <div className="flex items-center gap-2.5">
            {isSuperAdmin ? (
              <button
                type="button"
                onClick={() => {
                  setShowLogsModal(true);
                  refetchLogs();
                }}
                className="flex items-center gap-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-slate-300 dark:border-slate-800 px-3.5 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer"
              >
                <ClockRotateRight className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                <span>Extension Logs {extensionLogs.length > 0 ? `(${extensionLogs.length})` : ""}</span>
              </button>
            ) : null}

            <button
              type="button"
              onClick={handleCloseSubmission}
              disabled={isLoading || isSaving || !windowStatus?.isOpen}
              className="flex items-center gap-1.5 bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] px-3.5 py-2 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-white/90" />
              <span>Close Submissions</span>
            </button>
          </div>

          {/* RIGHT: Active Mode Controls (Edit / Save / Cancel / Extend) */}
          <div className="flex items-center gap-2.5">
            {isEditingSchedule ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setOpenDateTime(savedOpenDateTimeRef.current);
                    setCloseDateTime(savedCloseDateTimeRef.current);
                    setIsEditingSchedule(false);
                  }}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] px-3.5 py-2 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  <Xmark className="w-3.5 h-3.5" />
                  <span>Cancel</span>
                </button>

                <button
                  type="submit"
                  disabled={isLoading || isSaving}
                  className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900 px-4 py-2 text-sm font-semibold rounded-lg transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {isSaving ? (
                    <SystemRestart className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FloppyDisk className="w-3.5 h-3.5" />
                  )}
                  <span>{isSaving ? "Saving..." : "Save Window Schedule"}</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    savedOpenDateTimeRef.current = openDateTime;
                    savedCloseDateTimeRef.current = closeDateTime;
                    setIsEditingSchedule(true);
                    setTimeout(() => {
                      openingInputRef.current?.focus();
                      openingInputRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                    }, 50);
                  }}
                  disabled={isLoading || isSaving}
                  className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-3.5 py-2 text-sm rounded-lg transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  <EditPencil className="w-3.5 h-3.5 text-slate-950" />
                  <span>Edit Schedule</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowExtendModal(true)}
                  disabled={isLoading || isSaving}
                  className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-4 py-2 text-sm rounded-lg transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5 text-slate-950" />
                  <span>Extend Window</span>
                </button>
              </>
            )}
          </div>
        </div>
      </form>

      {/* Workflow Modal: Extend Submission Window */}
      <ExtendSubmissionWindowModal
        isOpen={showExtendModal}
        onClose={() => setShowExtendModal(false)}
        onSuccess={handleExtensionSuccess}
        currentEndDate={windowStatus?.endDate}
        currentEndTimeLabel={windowStatus?.endTimeLabel}
        academicYear={windowStatus?.academicYear}
        semester={windowStatus?.semester}
      />

      {/* Extension Logs History Modal - Super Admin Only */}
      {isSuperAdmin && showLogsModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4 shrink-0">
              <div className="flex items-center gap-2">
                <ClockRotateRight className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Extension Audit Logs</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowLogsModal(false)}
                className="rounded-lg border border-[#5e0000] bg-[#780000] hover:bg-[#5e0000] text-white p-1.5 transition cursor-pointer shadow-2xs"
                aria-label="Close logs"
              >
                <Xmark className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-3 pr-1 flex-1">
              {isLoadingLogs ? (
                <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2">
                  <SystemRestart className="h-4 w-4 animate-spin text-slate-500" />
                  Loading extension history...
                </div>
              ) : extensionLogs.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                  No extension history recorded yet.
                </div>
              ) : (
                extensionLogs.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-4 space-y-2.5 text-xs text-slate-900 dark:text-slate-100"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {log.extended_by_name || "Admin"}
                        </span>
                        <span className="rounded bg-slate-200/80 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 uppercase">
                          {log.extension_preset || "Extended"}
                        </span>
                        <span className="rounded bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 text-[10px] font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 capitalize">
                          Scope: {log.scope} ({log.scope_target || "Global"})
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        {new Date(log.created_at).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                          hour12: true,
                        })}
                      </span>
                    </div>

                    {log.new_end_date || log.old_end_date ? (
                      <div className="flex flex-wrap items-center gap-2 text-slate-800 dark:text-slate-300 bg-white dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                        <span className="text-slate-500 dark:text-slate-400 font-medium text-[11px]">Deadline Change:</span>
                        {log.old_end_date ? (
                          <>
                            <span className="text-slate-500 line-through">
                              {log.old_end_date} {log.old_end_time || ""}
                            </span>
                            <NavArrowRight className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                          </>
                        ) : null}
                        <span className="font-bold text-slate-900 dark:text-slate-100 font-mono">
                          {log.new_end_date} {log.new_end_time ? `at ${log.new_end_time}` : ""}
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2 text-slate-800 dark:text-slate-300 bg-white dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                        <span className="text-slate-500 dark:text-slate-400 font-medium text-[11px]">Action:</span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {log.reason || "Administrative Window Update"}
                        </span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setShowLogsModal(false)}
                className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-slate-300 dark:border-slate-800 text-xs font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer"
              >
                Close Logs
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Save Confirmation Modal */}
      {showSaveConfirmation ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 text-slate-900 dark:text-slate-100">
            <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
              Confirm Window Schedule
            </p>
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Save Submission Schedule?
            </h3>
            <p className="text-xs leading-5 text-slate-600 dark:text-slate-300">
              Faculty will be permitted to upload compliance documents starting from{" "}
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {formatDisplayDateTime(openDateTime)}
              </span>{" "}
              until{" "}
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {formatDisplayDateTime(closeDateTime)}
              </span>.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowSaveConfirmation(false)}
                className="bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] text-xs font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer shadow-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitSave()}
                className="bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900 font-semibold text-xs rounded-lg px-4 py-2 transition-colors cursor-pointer shadow-xs"
              >
                Confirm Save
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Close Confirmation Modal — 10-second Safety Countdown */}
      {showCloseConfirmation ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 text-slate-900 dark:text-slate-100">
            <p className="text-xs uppercase tracking-wider text-rose-700 dark:text-rose-400 font-semibold flex items-center gap-1.5">
              <WarningTriangle className="h-3.5 w-3.5 shrink-0" />
              Destructive Action
            </p>
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Close Submissions Now?
            </h3>
            <p className="text-xs leading-5 text-slate-600 dark:text-slate-300">
              This will <span className="font-bold text-rose-700 dark:text-rose-400">immediately close</span> the active submission window and clear the schedule. Faculty will no longer be able to upload compliance documents.
            </p>

            {/* Countdown indicator */}
            {closeCountdown > 0 ? (
              <div className="flex items-center gap-3 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 px-4 py-3">
                <div className="relative flex items-center justify-center h-10 w-10 shrink-0">
                  <svg className="h-10 w-10 -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-300 dark:text-slate-800" />
                    <circle
                      cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="2.5"
                      className="text-rose-600 dark:text-rose-500 transition-all duration-1000 ease-linear"
                      strokeDasharray="97.39"
                      strokeDashoffset={97.39 * (1 - closeCountdown / 10)}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute text-sm font-black text-rose-700 dark:text-rose-400">{closeCountdown}</span>
                </div>
                <p className="text-[11px] text-rose-800 dark:text-rose-300">
                  Please wait <span className="font-bold">{closeCountdown} second{closeCountdown !== 1 ? "s" : ""}</span> before confirming. This safety timer protects against accidental closures.
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3">
                <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <p className="text-[11px] text-emerald-800 dark:text-emerald-300 font-semibold">
                  Safety timer completed. You may now confirm the closure.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setShowCloseConfirmation(false); setCloseCountdown(10); }}
                className="border border-[#780000] text-[#780000] dark:text-rose-300 dark:border-rose-800 hover:bg-[#780000]/10 dark:hover:bg-rose-950/40 text-xs font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmCloseSubmission()}
                disabled={closeCountdown > 0}
                className={`text-xs font-semibold rounded-lg px-4 py-2 transition-all cursor-pointer shadow-xs ${
                  closeCountdown > 0
                    ? "bg-slate-200 dark:bg-slate-800 text-slate-400 border border-slate-300 dark:border-slate-700 cursor-not-allowed opacity-60"
                    : "bg-[#780000] hover:bg-[#5e0000] text-white"
                }`}
              >
                {closeCountdown > 0 ? `Confirm Close (${closeCountdown}s)` : "Confirm Close Submissions"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {warningModalData.isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full text-center shadow-2xl space-y-4 text-slate-900 dark:text-slate-100">
            <div className="w-14 h-14 bg-amber-500/10 border border-amber-500/30 rounded-full flex items-center justify-center mx-auto text-amber-600 dark:text-amber-400">
              <WarningTriangle className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {warningModalData.title}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {warningModalData.description}
            </p>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() =>
                  setWarningModalData({ ...warningModalData, isOpen: false })
                }
                className="flex-1 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setWarningModalData({ ...warningModalData, isOpen: false });
                  window.location.href = "/admin/dashboard?tab=requirements";
                }}
                className="flex-1 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs shadow-xs active:scale-[0.98] transition-colors cursor-pointer"
              >
                Review Requirements
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export { SubmissionWindowPanel as SubmissionWindowManager };
