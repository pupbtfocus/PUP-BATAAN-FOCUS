"use client";

import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { Calendar, CheckCircle, ClockRotateRight, EditPencil, FloppyDisk, Hourglass, Page, Search, ShieldAlert, SystemRestart, WarningTriangle, Xmark } from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";
import { ModalHeader } from "@/components/ui/modal-header";
import type {
  ApiBody,
  SubmissionWindowResponse,
} from "@/features/faculty-management/types/faculty-dashboard.types";
import { SubmissionScheduleLogsModal } from "./submission-schedule-logs-modal";
import { AlertPopup } from "@/components/ui/alert-popup";
import { emitRealtimeSync, useRealtimeSync } from "@/lib/realtime";

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
  onNavigateToRequirements?: () => void;
}

export function SubmissionWindowPanel({
  onWindowChange,
  isSuperAdmin = false,
  onNavigateToRequirements,
}: SubmissionWindowPanelProps) {
  const [openDateTime, setOpenDateTime] = useState("");
  const [closeDateTime, setCloseDateTime] = useState("");
  const [isAlwaysOpen, setIsAlwaysOpen] = useState(false);

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

  // Logs state
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [extensionLogs, setExtensionLogs] = useState<ExtensionLogEntry[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Extension Requests state
  const [extensionRequests, setExtensionRequests] = useState<any[]>([]);
  const [pendingRequestsCount, setPendingRequestsCount] = useState<number>(0);

  // Edit vs. Save schedule toggle (defaults to editing if no schedule exists yet)
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);

  // Tab view switcher: "global" schedule vs "requests" (Extension Requests)
  const [activeTab, setActiveTab] = useState<"global" | "requests">("global");

  // 3-second safety countdown for Close Submissions
  const [closeCountdown, setCloseCountdown] = useState(3);

  // Snapshot refs for cancel-edit restore
  const savedOpenDateTimeRef = useRef("");
  const savedCloseDateTimeRef = useRef("");
  const openingInputRef = useRef<HTMLInputElement>(null);
  const isEditingScheduleRef = useRef(isEditingSchedule);
  isEditingScheduleRef.current = isEditingSchedule;
  const hasInitializedEditScheduleRef = useRef(false);

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

  const isGlobalSubmissionOpen = useMemo(() => {
    if (windowStatus?.status === "Closed") return false;
    if (isAlwaysOpen) return true;
    if (!startDateObj || !endDateObj) return false;
    if (now > endDateObj) return false;
    return isWindowOpen || isUpcoming;
  }, [windowStatus?.status, isAlwaysOpen, startDateObj, endDateObj, now, isWindowOpen, isUpcoming]);

  const formattedCountdownTime = useMemo(() => {
    if (isAlwaysOpen || (endDateObj && endDateObj.getFullYear() >= 2099)) {
      return "Always Open (No Deadline)";
    }
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
  }, [isAlwaysOpen, isWindowOpen, isUpcoming, startDateObj, endDateObj, now]);

  const isGlobalConfigured = Boolean(
    isAlwaysOpen || (startDateObj && endDateObj)
  );

  const nowIso = getNowIsoLocal();

  const activePreset = useMemo(() => {
    if (isAlwaysOpen || closeDateTime === "2099-12-31T23:59") {
      return "always";
    }
    if (!closeDateTime) {
      return null;
    }

    const getPresetString = (days: number) => {
      const d = new Date();
      d.setDate(d.getDate() + days);
      d.setHours(23, 59, 0, 0);
      return toDateTimeLocal(d);
    };

    if (closeDateTime === getPresetString(0)) return "today";
    if (closeDateTime === getPresetString(3)) return "+3d";
    if (closeDateTime === getPresetString(7)) return "+1w";
    if (closeDateTime === getPresetString(14)) return "+2w";

    return null;
  }, [closeDateTime, isAlwaysOpen]);

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
    if (!openDateTime) {
      setError("Opening schedule date and time are required.");
      return false;
    }

    if (!isAlwaysOpen && !closeDateTime) {
      setError("Closing schedule date and time are required.");
      return false;
    }

    if (!isAlwaysOpen && openDateTime >= closeDateTime) {
      setError("The closing schedule must be later than the opening schedule.");
      return false;
    }

    return true;
  }

  const fetchLogs = useCallback(async () => {
    try {
      setIsLoadingLogs(true);
      const res = await fetch("/api/staff/submission-window/logs", { credentials: "include" });
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

  const fetchExtensionRequests = useCallback(async () => {
    try {
      const res = await fetch("/api/staff/submission-window/extension-requests?status=all", {
        credentials: "include",
      });
      if (res.ok) {
        const body = await res.json();
        setExtensionRequests(body.requests || []);
        setPendingRequestsCount(body.pendingCount || 0);
      }
    } catch {
      // Ignore background error
    }
  }, []);

  const handleMarkAsRead = useCallback(async (requestId: string) => {
    setExtensionRequests((prev) =>
      prev.map((r) => (r.id === requestId ? { ...r, status: "approved" } : r))
    );
    setPendingRequestsCount((prev) => Math.max(0, prev - 1));

    try {
      await fetch("/api/staff/submission-window/extension-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ requestId, action: "read" }),
      });
      emitRealtimeSync();
    } catch {
      void fetchExtensionRequests();
    }
  }, [fetchExtensionRequests]);

  const handleMarkAllAsRead = useCallback(async () => {
    setExtensionRequests((prev) =>
      prev.map((r) => ({ ...r, status: "approved" }))
    );
    setPendingRequestsCount(0);

    try {
      await fetch("/api/staff/submission-window/extension-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "mark_all_read" }),
      });
      emitRealtimeSync();
    } catch {
      void fetchExtensionRequests();
    }
  }, [fetchExtensionRequests]);



  async function loadWindow(options?: { silent?: boolean }) {
    if (!options?.silent) {
      setIsLoading(true);
      setError(null);
    }

    try {
      const response = await fetch("/api/staff/submission-window", {
        credentials: "include",
        cache: "no-store",
      });
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

      let data = body as SubmissionWindowResponse;

      // Ensure active academic term is populated even if window status config was previously uninitialized
      if (!data.academicYear || !data.semester) {
        try {
          const termsRes = await fetch("/api/staff/academic-terms", { credentials: "include" });
          if (termsRes.ok) {
            const termsJson = await termsRes.json();
            const termsList = Array.isArray(termsJson?.terms) ? termsJson.terms : [];
            const currentTerm = termsList.find(
              (t: any) => (t.status || "").trim().toLowerCase() === "current"
            ) || termsList[0];
            if (currentTerm?.academicYear && currentTerm?.semester) {
              data = {
                ...data,
                academicYear: currentTerm.academicYear,
                semester: currentTerm.semester,
              };
            }
          }
        } catch {
          // ignore fallback error
        }
      }

      setWindowStatus(data);

      // Do not overwrite user-entered dates while actively editing or typing
      if (!isEditingScheduleRef.current) {
        if (data.status === "Closed") {
          setOpenDateTime("");
          setCloseDateTime("");
          setIsAlwaysOpen(false);
        } else {
          const isAlwaysOpenWindow = Boolean(
            data.endDate && (data.endDate.startsWith("2099") || new Date(data.endDate).getFullYear() >= 2099)
          );
          setIsAlwaysOpen(isAlwaysOpenWindow);

          if (data.startDate && data.startTimeLabel) {
            const time24 = toTimeInputValue(data.startTimeLabel);
            setOpenDateTime(time24 ? `${data.startDate}T${time24}` : `${data.startDate}T09:00`);
          } else if (data.startDate) {
            setOpenDateTime(`${data.startDate}T09:00`);
          } else {
            setOpenDateTime("");
          }

          if (isAlwaysOpenWindow) {
            setCloseDateTime("2099-12-31T23:59");
          } else if (data.endDate && data.endTimeLabel) {
            const time24 = toTimeInputValue(data.endTimeLabel);
            setCloseDateTime(time24 ? `${data.endDate}T${time24}` : `${data.endDate}T17:00`);
          } else if (data.endDate) {
            setCloseDateTime(`${data.endDate}T17:00`);
          } else {
            setCloseDateTime("");
          }
        }
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load submission window");
    } finally {
      if (!options?.silent) {
        setIsLoading(false);
      }
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadWindow();
      void fetchExtensionRequests();
      if (isSuperAdmin) {
        void fetchLogs();
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [isSuperAdmin, fetchLogs, fetchExtensionRequests]);

  useRealtimeSync(() => {
    void loadWindow({ silent: true });
    void fetchExtensionRequests();
    if (isSuperAdmin) {
      void fetchLogs();
    }
  });

  // Sync isEditingSchedule: lock inputs once a valid schedule loads on initial fetch
  useEffect(() => {
    if (!isLoading && windowStatus && !hasInitializedEditScheduleRef.current) {
      hasInitializedEditScheduleRef.current = true;
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

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    let currentAY = windowStatus?.academicYear;
    let currentSem = windowStatus?.semester;

    if (!currentAY || !currentSem) {
      try {
        const termsRes = await fetch("/api/staff/academic-terms", { credentials: "include" });
        if (termsRes.ok) {
          const termsJson = await termsRes.json();
          const termsList = Array.isArray(termsJson?.terms) ? termsJson.terms : [];
          const currentTerm = termsList.find(
            (t: any) => (t.status || "").trim().toLowerCase() === "current"
          ) || termsList[0];
          if (currentTerm?.academicYear && currentTerm?.semester) {
            currentAY = currentTerm.academicYear;
            currentSem = currentTerm.semester;
            setWindowStatus((prev) => (prev ? { ...prev, academicYear: currentAY, semester: currentSem } : null));
          }
        }
      } catch {
        // ignore
      }
    }

    if (!currentAY || !currentSem) {
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
    const [endDate, endTime24] = isAlwaysOpen
      ? ["2099-12-31", "23:59"]
      : closeDateTime.split("T");

    const startTimeLabel = toTimeLabel(startTime24);
    const endTimeLabel = isAlwaysOpen ? "11:59 PM" : toTimeLabel(endTime24);

    try {
      const response = await fetch("/api/staff/submission-window", {
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
      isEditingScheduleRef.current = false;
      savedOpenDateTimeRef.current = openDateTime;
      savedCloseDateTimeRef.current = closeDateTime;
      setSuccess("Submission window updated successfully.");
      emitRealtimeSync();
      onWindowChange?.();
      void fetchLogs();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save submission window");
    } finally {
      setIsSaving(false);
    }
  }

  function handleCloseSubmission() {
    if (!isGlobalSubmissionOpen) return;
    setCloseCountdown(3);
    setShowCloseConfirmation(true);
  }

  async function confirmCloseSubmission() {
    setShowCloseConfirmation(false);
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/staff/submission-window", {
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
      setIsAlwaysOpen(false);
      setIsEditingSchedule(true);
      isEditingScheduleRef.current = true;
      savedOpenDateTimeRef.current = "";
      savedCloseDateTimeRef.current = "";
      setSuccess("Submissions closed and schedule cleared.");
      emitRealtimeSync();
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
    void fetchExtensionRequests();
    onWindowChange?.();
  };

  function handleSwitchToGlobalSchedule() {
    setActiveTab("global");
    setIsEditingSchedule(true);
    setTimeout(() => {
      openingInputRef.current?.focus();
      openingInputRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 50);
  }



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
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 shadow-xs dark:shadow-none space-y-5 sm:space-y-6 transition-colors">
      {/* Real-time Status Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-xl bg-slate-50 border border-slate-200/80 dark:bg-slate-950/50 dark:border-slate-800 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
          {/* Status Badge */}
          <div className="inline-flex items-center justify-center sm:justify-start gap-2 bg-white text-slate-800 border border-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-800 px-3 py-1.5 text-xs font-semibold rounded-md shadow-2xs">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                isAlwaysOpen || isWindowOpen
                  ? "bg-emerald-500 animate-pulse"
                  : isUpcoming
                  ? "bg-amber-500 animate-ping"
                  : "bg-slate-400 dark:bg-slate-500"
              }`}
            />
            <span>
              {isAlwaysOpen
                ? "Always Open Window"
                : isWindowOpen
                ? "Live Submission Window"
                : isUpcoming
                ? "Scheduled Window"
                : !isGlobalConfigured
                ? "Not Configured"
                : "Window Closed"}
            </span>
          </div>

          {/* Current Academic Term Badge */}
          <div className="inline-flex items-center justify-center sm:justify-start gap-1.5 text-xs text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-md shadow-2xs">
            <span>Current Term:</span>
            <span className="font-semibold text-slate-900 dark:text-slate-200">{currentTermLabel}</span>
          </div>
        </div>

        {/* Real-Time Countdown Timer Display */}
        <div className="flex items-center justify-between sm:justify-end gap-3 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 px-3.5 py-2 rounded-lg shadow-xs w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <AppIcon icon={Hourglass} size="md" color="default" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {isWindowOpen
                ? "Time Remaining"
                : isUpcoming
                ? "Opens In"
                : "Status"}
            </span>
          </div>
          <span className="font-mono text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
            {formattedCountdownTime}
          </span>
        </div>
      </div>

      <AlertPopup
        type="error"
        message={error}
        onClose={() => setError(null)}
      />

      <AlertPopup
        type="success"
        message={success}
        onClose={() => setSuccess(null)}
      />

      {/* 2-Option Schedule Switcher: Global Schedule & Extension Requests */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 w-full sm:w-auto shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveTab("global")}
            className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "global"
                ? "bg-amber-500 text-slate-950 shadow-xs border border-amber-600 font-extrabold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-900"
            }`}
          >
            <AppIcon icon={Calendar} size="sm" color="inherit" />
            <span>Global Schedule</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("requests")}
            className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "requests"
                ? "bg-amber-500 text-slate-950 shadow-xs border border-amber-600 font-extrabold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-900"
            }`}
          >
            <AppIcon icon={Hourglass} size="sm" color="inherit" />
            <span>Extension Requests</span>
            {pendingRequestsCount > 0 ? (
              <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full transition-colors ${
                activeTab === "requests"
                  ? "bg-white text-amber-950 shadow-2xs border border-amber-600/30"
                  : "bg-amber-500 text-slate-950"
              }`}>
                {pendingRequestsCount}
              </span>
            ) : null}
          </button>
        </div>

        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
          {activeTab === "global" ? (
            <span>Campus-wide submission window for all faculty members</span>
          ) : null}
        </div>
      </div>

      {activeTab === "global" ? (
        <>
          {/* 2. 2-Column Schedule Configuration Grid */}
          <form onSubmit={handleSave} className="space-y-6">
        {/* Pending Extension Requests Alert Banner in Global Schedule View */}
        {pendingRequestsCount > 0 ? (
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-amber-50/70 border border-amber-200/80 dark:bg-amber-950/20 dark:border-amber-800/40 text-xs">
            <div className="flex items-center gap-2.5 text-amber-900 dark:text-amber-200">
              <AppIcon icon={Hourglass} size="md" color="inherit" />
              <span>
                <strong>{pendingRequestsCount} Pending Extension Request{pendingRequestsCount !== 1 ? "s" : ""}:</strong> Faculty have requested submission extensions due to closed or past due deadlines.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab("requests")}
              className="shrink-0 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-50 border border-amber-300 dark:border-amber-700/60 font-semibold text-xs px-3 py-1.5 rounded-lg transition shadow-2xs cursor-pointer"
            >
              Review Requests ({pendingRequestsCount})
            </button>
          </div>
        ) : null}

        {isEditingSchedule ? (
          <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-slate-100 border border-slate-200/90 dark:bg-slate-800/50 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs transition-all">
            <AppIcon icon={EditPencil} size="md" color="default" />
            <span>
              <strong>Schedule Edit Mode Active:</strong> You can adjust the opening and closing schedules below. Remember to click <strong>Save Schedule</strong> to apply changes.
            </span>
          </div>
        ) : null}

        <div className="grid gap-4 sm:gap-5 md:grid-cols-2">
          {/* Left Column: Opening Schedule Input */}
          <div className={`p-3.5 sm:p-4 rounded-xl flex flex-col justify-between transition-all duration-200 ${
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
                    <AppIcon icon={Hourglass} size="sm" color="default" />
                    <span>Set to Now / Today</span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          {/* Right Column: Closing Schedule & Deadline */}
          <div className={`p-3.5 sm:p-4 rounded-xl flex flex-col justify-between transition-all duration-200 ${
            isEditingSchedule
              ? "bg-white border-2 border-slate-300 dark:bg-slate-900 dark:border-slate-700 shadow-xs"
              : "bg-slate-50 border border-slate-200/80 dark:bg-slate-950/50 dark:border-slate-800"
          }`}>
            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <label htmlFor="closing-schedule" className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Closing Date & Deadline
                </label>
                {isEditingSchedule ? (
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none bg-amber-500/10 dark:bg-amber-500/20 border border-amber-400/50 px-2.5 py-0.5 rounded-md hover:bg-amber-500/20 transition">
                    <input
                      type="checkbox"
                      checked={isAlwaysOpen}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setIsAlwaysOpen(checked);
                        if (checked) {
                          setCloseDateTime("2099-12-31T23:59");
                        } else {
                          const d = new Date();
                          d.setDate(d.getDate() + 7);
                          d.setHours(23, 59, 0, 0);
                          setCloseDateTime(toDateTimeLocal(d));
                        }
                      }}
                      disabled={!isEditingSchedule || isLoading || isSaving}
                      className="h-3.5 w-3.5 rounded border-amber-400 text-amber-500 focus:ring-amber-400 cursor-pointer"
                    />
                    <span className="text-amber-900 dark:text-amber-200">Always Open</span>
                  </label>
                ) : null}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                {isAlwaysOpen
                  ? "Submissions will remain open indefinitely for this semester with no closing deadline."
                  : "Current active deadline for faculty compliance document uploads."}
              </p>
            </div>

            <div>
              {!isEditingSchedule && (isAlwaysOpen || (windowStatus?.endDate && windowStatus.endDate.startsWith("2099"))) ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white border border-emerald-300 text-slate-900 dark:bg-slate-900 dark:border-emerald-800/80 dark:text-slate-100 p-3 sm:px-3.5 sm:py-2 text-sm rounded-lg shadow-2xs">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold text-xs sm:text-sm">
                    <AppIcon icon={CheckCircle} size="md" color="inherit" />
                    <span>Always Open (No Closing Deadline)</span>
                  </div>
                  <span className="self-start sm:self-auto bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 px-2 py-0.5 text-xs font-bold rounded-md whitespace-nowrap">
                    Indefinite
                  </span>
                </div>
              ) : !isEditingSchedule && windowStatus?.endDate && windowStatus?.endTimeLabel ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white border border-slate-200 text-slate-900 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100 p-3 sm:px-3.5 sm:py-2 text-sm rounded-lg shadow-2xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <AppIcon icon={Calendar} size="md" color="default" />
                    <span className="font-semibold text-slate-900 dark:text-slate-100 text-xs sm:text-sm">
                      {windowStatus.endDate} at {windowStatus.endTimeLabel}
                    </span>
                  </div>
                  <span className="self-start sm:self-auto bg-slate-200/80 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 px-2 py-0.5 text-[11px] sm:text-xs font-medium rounded-md whitespace-nowrap">
                    Configured Deadline
                  </span>
                </div>
              ) : (
                <>
                  {isAlwaysOpen ? (
                    <div className="rounded-xl border border-emerald-300 dark:border-emerald-700/60 bg-emerald-50 dark:bg-emerald-950/30 p-3.5 flex items-center justify-between gap-3 shadow-2xs">
                      <div className="flex items-center gap-2.5">
                        <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                        <div>
                          <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                            Always Open Option Active
                          </p>
                          <p className="text-[11px] text-emerald-700 dark:text-emerald-300/80">
                            Faculty can upload compliance documents indefinitely without an expiration deadline.
                          </p>
                        </div>
                      </div>
                      <span className="shrink-0 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-600 text-white shadow-2xs">
                        No Deadline
                      </span>
                    </div>
                  ) : (
                    <input
                      id="closing-schedule"
                      type="datetime-local"
                      value={closeDateTime}
                      onChange={(e) => {
                        setCloseDateTime(e.target.value);
                        setIsAlwaysOpen(false);
                      }}
                      disabled={!isEditingSchedule || isLoading || isSaving}
                      className={`w-full px-3.5 py-2 text-sm rounded-lg outline-none transition-colors ${
                        isEditingSchedule
                          ? "bg-white border-2 border-amber-500/60 text-slate-900 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:bg-slate-900 dark:border-amber-500/60 dark:text-slate-100 dark:focus:border-amber-400 shadow-xs"
                          : "bg-white border border-slate-200 text-slate-900 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100 cursor-not-allowed opacity-90"
                      }`}
                    />
                  )}

                  {isEditingSchedule ? (
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setIsAlwaysOpen(false);
                          const d = new Date();
                          d.setHours(23, 59, 0, 0);
                          setCloseDateTime(toDateTimeLocal(d));
                        }}
                        className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md transition cursor-pointer ${
                          activePreset === "today"
                            ? "bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold border border-amber-500 shadow-2xs"
                            : "font-medium bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                        }`}
                      >
                        <span>Today (End of Day)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAlwaysOpen(false);
                          const d = new Date();
                          d.setDate(d.getDate() + 3);
                          d.setHours(23, 59, 0, 0);
                          setCloseDateTime(toDateTimeLocal(d));
                        }}
                        className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md transition cursor-pointer ${
                          activePreset === "+3d"
                            ? "bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold border border-amber-500 shadow-2xs"
                            : "font-medium bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                        }`}
                      >
                        <span>+3 Days</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAlwaysOpen(false);
                          const d = new Date();
                          d.setDate(d.getDate() + 7);
                          d.setHours(23, 59, 0, 0);
                          setCloseDateTime(toDateTimeLocal(d));
                        }}
                        className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md transition cursor-pointer ${
                          activePreset === "+1w"
                            ? "bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold border border-amber-500 shadow-2xs"
                            : "font-medium bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                        }`}
                      >
                        <span>+1 Week</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAlwaysOpen(false);
                          const d = new Date();
                          d.setDate(d.getDate() + 14);
                          d.setHours(23, 59, 0, 0);
                          setCloseDateTime(toDateTimeLocal(d));
                        }}
                        className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md transition cursor-pointer ${
                          activePreset === "+2w"
                            ? "bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold border border-amber-500 shadow-2xs"
                            : "font-medium bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                        }`}
                      >
                        <span>+2 Weeks</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAlwaysOpen(true);
                          setCloseDateTime("2099-12-31T23:59");
                        }}
                        className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md transition cursor-pointer ${
                          activePreset === "always"
                            ? "bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold border border-amber-500 shadow-2xs"
                            : "font-medium bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                        }`}
                      >
                        <span>Always Open</span>
                      </button>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>

        {/* 3. Structured Footer Action Toolbar */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 border-t border-slate-200 dark:border-slate-800 pt-5 mt-6">
          {/* Operational & Destructive Triggers */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => {
                setShowLogsModal(true);
                refetchLogs();
              }}
              className="flex items-center justify-center sm:justify-start gap-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-slate-300 dark:border-slate-800 px-3.5 py-2.5 sm:py-2 text-sm font-medium rounded-xl transition-colors cursor-pointer w-full sm:w-auto"
            >
              <AppIcon icon={ClockRotateRight} size="sm" color="default" />
              <span>Submission Schedule Logs {extensionLogs.length > 0 ? `(${extensionLogs.length})` : ""}</span>
            </button>

            <button
              type="button"
              onClick={handleCloseSubmission}
              disabled={isLoading || isSaving || !isGlobalSubmissionOpen}
              className="flex items-center justify-center sm:justify-start gap-1.5 bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] px-3.5 py-2.5 sm:py-2 text-sm font-semibold rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-xs w-full sm:w-auto"
              title={!isGlobalSubmissionOpen ? "Global submission window is currently closed" : "Close active submissions"}
            >
              <AppIcon icon={ShieldAlert} size="sm" color="white" />
              <span>Close Submissions</span>
            </button>
          </div>

          {/* Active Mode Controls (Edit / Save / Cancel / Extend) */}
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
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
                  className="flex items-center justify-center gap-1.5 bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] px-3.5 py-2.5 sm:py-2 text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  <AppIcon icon={Xmark} size="sm" color="inherit" />
                  <span>Cancel</span>
                </button>

                <button
                  type="submit"
                  disabled={isLoading || isSaving}
                  className="flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2.5 sm:py-2 text-sm rounded-xl transition-colors shadow-xs disabled:opacity-50 cursor-pointer border border-amber-600"
                >
                  {isSaving ? (
                    <AppIcon icon={SystemRestart} size="sm" color="inherit" className="animate-spin text-slate-950" />
                  ) : (
                    <AppIcon icon={FloppyDisk} size="sm" color="inherit" className="text-slate-950" />
                  )}
                  <span>{isSaving ? "Saving..." : "Save Schedule"}</span>
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
                  className="flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-3.5 py-2.5 sm:py-2 text-sm rounded-xl transition-colors disabled:opacity-50 cursor-pointer shadow-xs active:scale-[0.98]"
                >
                  <AppIcon icon={EditPencil} size="sm" color="inherit" className="text-slate-950" />
                  <span>Edit Schedule</span>
                </button>

              </>
            )}
          </div>
        </div>
      </form>
    </>
      ) : (
        /* SECTION: Extension Requests Tab */
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Header Informational Banner with Quick Global Schedule Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-100 border border-slate-200/90 dark:bg-slate-800/50 dark:border-slate-700 text-xs">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 shadow-xs">
                <AppIcon icon={Hourglass} size="xs" color="inherit" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  Faculty Extension Requests
                </h3>
                <p className="mt-0.5 text-slate-600 dark:text-slate-400 leading-relaxed">
                  Faculty who missed the deadline have submitted extension requests. Adjust the Global Schedule to open document submissions for all faculty at once.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {pendingRequestsCount > 0 && (
                <button
                  type="button"
                  onClick={() => void handleMarkAllAsRead()}
                  className="shrink-0 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 transition cursor-pointer shadow-xs border border-slate-300 dark:border-slate-700 active:scale-95"
                >
                  <AppIcon icon={CheckCircle} size="xs" color="inherit" />
                  <span>Read All</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleSwitchToGlobalSchedule}
                className="shrink-0 inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 transition cursor-pointer shadow-xs border border-amber-600 active:scale-95"
              >
                <AppIcon icon={Calendar} size="sm" color="inherit" />
                <span>Set Global Schedule for All</span>
              </button>
            </div>
          </div>

          {/* Requests Content: Notification List / Empty */}
          {extensionRequests.length === 0 ? (
            <div className="py-12 px-4 text-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 space-y-3">
              <div className="w-10 h-10 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center mx-auto shadow-xs">
                <AppIcon icon={Hourglass} size="sm" color="inherit" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  No extension requests found
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  When faculty members request deadline extensions for overdue requirements, their requests will appear here.
                </p>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleSwitchToGlobalSchedule}
                  className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition cursor-pointer"
                >
                  Go to Global Schedule
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Requests ({extensionRequests.length})
                </span>
                {pendingRequestsCount > 0 && (
                  <button
                    type="button"
                    onClick={() => void handleMarkAllAsRead()}
                    className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 dark:text-amber-400 hover:underline cursor-pointer"
                  >
                    <AppIcon icon={CheckCircle} size="xs" color="inherit" />
                    <span>Read All</span>
                  </button>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 shadow-xs divide-y divide-slate-100 dark:divide-slate-850 overflow-hidden">
                {extensionRequests.map((req, index) => (
                <div
                  key={req.id}
                  className="p-3.5 sm:px-4 hover:bg-slate-50/70 dark:hover:bg-slate-900/40 transition-colors flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full font-bold text-xs flex items-center justify-center shrink-0 shadow-xs transition-colors ${
                        req.status === "pending"
                          ? "bg-amber-500 text-slate-950"
                          : "bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      {index + 1}
                    </div>

                    <div className="min-w-0 text-xs sm:text-sm">
                      <p className="text-slate-800 dark:text-slate-200 truncate">
                        <span className="font-bold text-slate-950 dark:text-white">
                          {req.faculty_name}
                        </span>{" "}
                        requested an extension
                        {req.reason ? (
                          <span className="text-slate-500 dark:text-slate-400 italic font-normal">
                            {" "}— &ldquo;{req.reason}&rdquo;
                          </span>
                        ) : null}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    {(req.supporting_document_url || req.supporting_document_name) && (
                      <a
                        href={`/api/faculty/submissions/extension-request/document?requestId=${req.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 px-2.5 py-0.5 rounded-md shadow-2xs transition-colors"
                      >
                        <AppIcon icon={Page} size="xs" color="inherit" />
                        <span>Attachment</span>
                      </a>
                    )}
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 whitespace-nowrap">
                      {req.created_at
                        ? new Date(req.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })
                        : ""}
                    </span>

                    {/* Read / Unread Status Button */}
                    {req.status === "pending" ? (
                      <button
                        type="button"
                        onClick={() => void handleMarkAsRead(req.id)}
                        className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 transition cursor-pointer shadow-xs border border-amber-600 active:scale-95"
                        title="Mark this request as read"
                      >
                        Read
                      </button>
                    ) : (
                      <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 px-1">
                        Read
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

          {/* Footer Toolbar: Logs only */}
          <div className="flex items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-800 pt-5">
            <button
              type="button"
              onClick={() => {
                setShowLogsModal(true);
                refetchLogs();
              }}
              className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-slate-300 dark:border-slate-800 px-3.5 py-2 text-xs font-medium rounded-xl transition cursor-pointer"
            >
              <AppIcon icon={ClockRotateRight} size="sm" color="default" />
              <span>Submission Schedule Logs {extensionLogs.length > 0 ? `(${extensionLogs.length})` : ""}</span>
            </button>
          </div>
        </div>
      )}

      {/* Submission Schedule Logs History Modal */}
      <SubmissionScheduleLogsModal
        isOpen={showLogsModal}
        onClose={() => setShowLogsModal(false)}
      />

      {/* Save Confirmation Modal */}
      {showSaveConfirmation ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 text-slate-900 dark:text-slate-100">
            <ModalHeader
              icon={Calendar}
              title="Save Submission Schedule?"
              subtitle="Confirm Window Schedule"
              className="-mx-6 -mt-6 mb-4 rounded-t-2xl"
            />
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
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg px-4 py-2 transition-colors cursor-pointer shadow-xs border border-amber-600"
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
            <ModalHeader
              icon={WarningTriangle}
              title="Close Submissions Now?"
              subtitle="Immediate Closure & Schedule Reset"
              className="-mx-6 -mt-6 mb-4 rounded-t-2xl"
            />
            <p className="text-xs leading-5 text-slate-600 dark:text-slate-300">
              This will <span className="font-bold text-rose-700 dark:text-rose-400">immediately close</span> the active submission window and clear the schedule. Faculty will no longer be able to upload compliance documents.
            </p>

            <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 dark:border-emerald-950/60 bg-emerald-50/70 dark:bg-emerald-950/20 p-3 text-xs text-emerald-900 dark:text-emerald-300">
              <AppIcon icon={CheckCircle} size="md" color="success" className="mt-0.5" />
              <p className="leading-relaxed">
                <span className="font-semibold">Completed Accounts Preserved:</span> Faculty accounts that completed and validated all requirements will be placed under &ldquo;Completed / Validated&rdquo; and remain protected in completed status.
              </p>
            </div>

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
                      strokeDashoffset={97.39 * (1 - closeCountdown / 3)}
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
                <AppIcon icon={CheckCircle} size="lg" color="success" />
                <p className="text-[11px] text-emerald-800 dark:text-emerald-300 font-semibold">
                  Safety timer completed. You may now confirm the closure.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setShowCloseConfirmation(false); setCloseCountdown(3); }}
                className="bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] text-xs font-semibold px-4 py-2 rounded-lg transition-all cursor-pointer shadow-xs"
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
              <AppIcon icon={WarningTriangle} size="md" color="inherit" />
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
                className="flex-1 py-2.5 rounded-lg border border-[#5e0000] bg-[#780000] hover:bg-[#5e0000] text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setWarningModalData({ ...warningModalData, isOpen: false });
                  if (onNavigateToRequirements) {
                    onNavigateToRequirements();
                    return;
                  }
                  const isSuper =
                    isSuperAdmin ||
                    (typeof window !== "undefined" &&
                      (window.location.pathname.startsWith("/admin") ||
                        window.location.pathname.startsWith("/super-admin")));
                  if (isSuper) {
                    window.location.href = "/admin/dashboard?tab=verification";
                  } else {
                    window.location.href = "/staff/dashboard?tab=requirements";
                  }
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
