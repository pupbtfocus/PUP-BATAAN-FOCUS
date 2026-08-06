"use client";

import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { Loader2, Clock, History, Calendar, ShieldAlert, CheckCircle2, Pencil, Save, X } from "lucide-react";
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
}

export function SubmissionWindowPanel({ onWindowChange }: SubmissionWindowPanelProps) {
  const [openDateTime, setOpenDateTime] = useState("");
  const [closeDateTime, setCloseDateTime] = useState("");

  const [windowStatus, setWindowStatus] = useState<SubmissionWindowResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
  const [showCloseConfirmation, setShowCloseConfirmation] = useState(false);
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
  }, []);

  const refetchLogs = useCallback(() => {
    void fetchLogs();
  }, [fetchLogs]);

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
      void fetchLogs();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchLogs]);

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
        if (typeof body !== "object" && body === null) {
          setError((body as ApiBody).error || "Failed to close submissions");
        } else {
          setError(`Failed to close submissions (HTTP ${response.status}).`);
        }
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
    <div className="rounded-xl border border-slate-800 bg-slate-950 p-5 shadow-xl space-y-6">
      {/* 1. Header & Status Section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h4 className="text-base font-semibold text-slate-100">
              Submission Window Manager
            </h4>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Current term: <span className="font-medium text-slate-200">{currentTermLabel}</span>
          </p>
        </div>
      </div>

      {/* Real-time Status Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-[#1a0407]/90 border border-amber-500/20 shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-3">
          {/* Live Pulsing Badge */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider ${
            isWindowOpen
              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
              : isUpcoming
              ? "bg-amber-500/10 text-amber-300 border border-amber-500/30"
              : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
          }`}>
            <span className={`w-2.5 h-2.5 rounded-full ${
              isWindowOpen ? "bg-emerald-400 animate-pulse" : isUpcoming ? "bg-amber-400 animate-ping" : "bg-rose-500"
            }`} />
            <span>{isWindowOpen ? "Live Submission Window" : isUpcoming ? "Scheduled Window" : "Window Closed"}</span>
          </div>

          {/* Term Context */}
          <span className="text-xs text-slate-300 font-semibold">
            {currentTermLabel}
          </span>
        </div>

        {/* Real-Time Countdown Timer Display */}
        <div className="flex items-center gap-2 bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-2">
          <Clock className="w-4 h-4 text-amber-400 animate-[spin_6s_linear_infinite]" />
          <div className="text-right">
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
              {isWindowOpen ? "Time Remaining" : isUpcoming ? "Opens In" : "Status"}
            </p>
            <p className="text-sm font-black text-amber-300 font-mono">
              {formattedCountdownTime}
            </p>
          </div>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-950/30 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      ) : null}

      {success ? (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-300">
          {success}
        </p>
      ) : null}

      {/* 2. 2-Column Schedule Configuration Grid */}
      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid gap-5 md:grid-cols-2">
          {/* Left Column: Opening Schedule Input */}
          <div className={`rounded-xl p-4 flex flex-col justify-between transition-all duration-300 ${
            isEditingSchedule
              ? "border-2 border-amber-500 ring-4 ring-amber-500/20 bg-amber-500/5"
              : "border border-slate-800 bg-slate-900/50"
          }`}>
            <div>
              <label htmlFor="opening-schedule" className="block text-xs font-semibold text-amber-400">
                Opening Date & Time
              </label>
              <p className="mt-1 text-[11px] text-slate-400">
                Select the opening date and time for document uploads.
              </p>
            </div>
            <div className="mt-3">
              <input
                id="opening-schedule"
                type="datetime-local"
                min={nowIso}
                value={openDateTime}
                onChange={(e) => setOpenDateTime(e.target.value)}
                disabled={!isEditingSchedule || isLoading || isSaving}
                className={`w-full rounded-lg p-2.5 text-xs outline-none transition-all duration-300 ${
                  isEditingSchedule
                    ? "bg-slate-900 border-2 border-amber-500/60 text-amber-100 ring-2 ring-amber-500/10"
                    : "bg-slate-900 border border-slate-800 text-slate-400 cursor-not-allowed"
                }`}
              />
              {isEditingSchedule ? (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setOpenDateTime(toDateTimeLocal(new Date()))}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition"
                  >
                    <Clock className="w-3 h-3" />
                    <span>Set to Now / Today</span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          {/* Right Column: Closing Schedule & Deadline */}
          <div className={`rounded-xl p-4 flex flex-col justify-between transition-all duration-300 ${
            isEditingSchedule
              ? "border-2 border-amber-500 ring-4 ring-amber-500/20 bg-amber-500/5"
              : "border border-slate-800 bg-slate-900/50"
          }`}>
            <div>
              <label htmlFor="closing-schedule" className="block text-xs font-semibold text-rose-400">
                Closing Date & Deadline
              </label>
              <p className="mt-1 text-[11px] text-slate-400">
                Current active deadline for faculty compliance document uploads.
              </p>
            </div>

            <div className="mt-3">
              {!isEditingSchedule && windowStatus?.endDate && windowStatus?.endTimeLabel ? (
                <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 p-2.5">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-rose-400" />
                    <span className="text-xs font-bold text-slate-100">
                      {windowStatus.endDate} at {windowStatus.endTimeLabel}
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded">
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
                    className={`w-full rounded-lg p-2.5 text-xs outline-none transition-all duration-300 ${
                      isEditingSchedule
                        ? "bg-slate-900 border-2 border-amber-500/60 text-amber-100 ring-2 ring-amber-500/10"
                        : "bg-slate-900 border border-slate-800 text-slate-400 cursor-not-allowed"
                    }`}
                  />
                  {isEditingSchedule ? (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const d = new Date();
                          d.setHours(23, 59, 0, 0);
                          setCloseDateTime(toDateTimeLocal(d));
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition"
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
                        className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 transition"
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
                        className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 transition"
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
                        className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 transition"
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

        {/* 3. Structured Footer Action Toolbar — Zone-Separated Split Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-800/80 pt-5 mt-6">
          {/* LEFT: Operational & Destructive Triggers */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                setShowLogsModal(true);
                refetchLogs();
              }}
              className="flex items-center gap-1.5 bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all"
            >
              <History className="w-3.5 h-3.5 text-slate-400" />
              <span>Extension Logs ({extensionLogs.length})</span>
            </button>

            <button
              type="button"
              onClick={handleCloseSubmission}
              disabled={isLoading || isSaving || !windowStatus?.isOpen}
              className="flex items-center gap-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all disabled:opacity-50"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
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
                  className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold transition-all disabled:opacity-50"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Cancel</span>
                </button>

                <button
                  type="submit"
                  disabled={isLoading || isSaving}
                  className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl px-5 py-2.5 text-xs shadow-lg hover:shadow-amber-500/20 transition-all disabled:opacity-50"
                >
                  {isSaving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
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
                  }}
                  disabled={isLoading || isSaving}
                  className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 rounded-xl px-4 py-2.5 text-xs font-bold transition-all disabled:opacity-50"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Edit Schedule</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowExtendModal(true)}
                  disabled={isLoading || isSaving}
                  className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl px-5 py-2.5 text-xs shadow-lg hover:shadow-amber-500/20 transition-all disabled:opacity-50"
                >
                  <Clock className="w-3.5 h-3.5" />
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

      {/* Extension Logs History Modal */}
      {showLogsModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 shrink-0">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-amber-400" />
                <h3 className="text-lg font-bold text-slate-100">Extension Audit Logs</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowLogsModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-900 hover:text-slate-200 transition"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto space-y-3 pr-1 flex-1">
              {isLoadingLogs ? (
                <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
                  Loading extension history...
                </div>
              ) : extensionLogs.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No extension history recorded yet.
                </div>
              ) : (
                extensionLogs.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2.5 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-100">
                          {log.extended_by_name || "Admin"}
                        </span>
                        <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/30 uppercase">
                          {log.extension_preset || "Extended"}
                        </span>
                        <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-300 capitalize">
                          Scope: {log.scope} ({log.scope_target || "Global"})
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-medium">
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

                    <div className="flex flex-wrap items-center gap-2 text-slate-300 bg-slate-950/80 p-2.5 rounded-lg border border-slate-800/80">
                      <span className="text-slate-400 font-medium text-[11px]">Deadline Change:</span>
                      {log.old_end_date ? (
                        <>
                          <span className="text-slate-400 line-through">
                            {log.old_end_date} {log.old_end_time || ""}
                          </span>
                          <span className="text-amber-400 font-bold">➔</span>
                        </>
                      ) : null}
                      <span className="font-bold text-amber-300">
                        {log.new_end_date} {log.new_end_time ? `at ${log.new_end_time}` : ""}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end shrink-0">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowLogsModal(false)}
                className="bg-slate-900 border border-slate-800 text-slate-300 hover:text-slate-100 text-xs"
              >
                Close Logs
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Save Confirmation Modal */}
      {showSaveConfirmation ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-950 border border-slate-800 rounded-xl p-6 shadow-2xl space-y-4">
            <p className="text-xs uppercase tracking-wider text-amber-400 font-medium">
              Confirm Window Schedule
            </p>
            <h3 className="text-xl font-semibold text-slate-100">
              Save Submission Schedule?
            </h3>
            <p className="text-xs leading-5 text-slate-300">
              Faculty will be permitted to upload compliance documents starting from{" "}
              <span className="font-semibold text-amber-400">
                {formatDisplayDateTime(openDateTime)}
              </span>{" "}
              until{" "}
              <span className="font-semibold text-amber-400">
                {formatDisplayDateTime(closeDateTime)}
              </span>.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowSaveConfirmation(false)}
                className="bg-slate-900 border border-slate-800 text-slate-300 hover:text-slate-100 text-xs"
              >
                Cancel
              </Button>
              <button
                type="button"
                onClick={() => void submitSave()}
                className="bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 text-xs font-semibold rounded-lg px-4 py-2 transition"
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
          <div className="w-full max-w-lg bg-slate-950 border border-rose-500/30 rounded-xl p-6 shadow-2xl space-y-4">
            <p className="text-xs uppercase tracking-wider text-rose-400 font-medium">
              ⚠ Destructive Action
            </p>
            <h3 className="text-xl font-semibold text-slate-100">
              Close Submissions Now?
            </h3>
            <p className="text-xs leading-5 text-slate-300">
              This will <span className="font-bold text-rose-400">immediately close</span> the active submission window and clear the schedule. Faculty will no longer be able to upload compliance documents.
            </p>

            {/* Countdown indicator */}
            {closeCountdown > 0 ? (
              <div className="flex items-center gap-3 rounded-lg border border-rose-500/20 bg-rose-950/30 px-4 py-3">
                <div className="relative flex items-center justify-center h-10 w-10 shrink-0">
                  <svg className="h-10 w-10 -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-800" />
                    <circle
                      cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="2.5"
                      className="text-rose-500 transition-all duration-1000 ease-linear"
                      strokeDasharray="97.39"
                      strokeDashoffset={97.39 * (1 - closeCountdown / 10)}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute text-sm font-black text-rose-400">{closeCountdown}</span>
                </div>
                <p className="text-[11px] text-rose-300">
                  Please wait <span className="font-bold">{closeCountdown} second{closeCountdown !== 1 ? "s" : ""}</span> before confirming. This safety timer protects against accidental closures.
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-950/30 px-4 py-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                <p className="text-[11px] text-emerald-300 font-semibold">
                  Safety timer completed. You may now confirm the closure.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => { setShowCloseConfirmation(false); setCloseCountdown(10); }}
                className="bg-slate-900 border border-slate-800 text-slate-300 hover:text-slate-100 text-xs"
              >
                Cancel
              </Button>
              <button
                type="button"
                onClick={() => void confirmCloseSubmission()}
                disabled={closeCountdown > 0}
                className={`text-xs font-semibold rounded-lg px-4 py-2 transition-all ${
                  closeCountdown > 0
                    ? "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60"
                    : "bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20"
                }`}
              >
                {closeCountdown > 0 ? `Confirm Close (${closeCountdown}s)` : "Confirm Close Submissions"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export { SubmissionWindowPanel as SubmissionWindowManager };
