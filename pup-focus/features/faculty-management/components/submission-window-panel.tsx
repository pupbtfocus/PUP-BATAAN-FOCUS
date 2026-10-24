"use client";

import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { Calendar, CheckCircle, ClockRotateRight, EditPencil, FloppyDisk, Hourglass, NavArrowRight, Page, Search, ShieldAlert, SystemRestart, User, WarningCircle, WarningTriangle, Xmark } from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";
import { ModalHeader } from "@/components/ui/modal-header";
import { Button } from "@/components/ui/button";
import type {
  ApiBody,
  SubmissionWindowResponse,
} from "@/features/faculty-management/types/faculty-dashboard.types";
import { ExtendSubmissionWindowModal } from "./extend-submission-window-modal";
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

export interface ActiveFacultySchedule {
  facultyProfileId: string;
  facultyName: string;
  email: string;
  department: string;
  academicYear: string;
  semester: string;
  type: "onboarding" | "extension" | "custom" | "standard";
  typeLabel: string;
  deadline: string;
  deadlineFormatted: string;
  daysRemaining: number;
  timeRemainingLabel: string;
  openDateFormatted?: string;
  closeDateFormatted?: string;
  unlockedRequirements: string[];
  unlockedCount: number;
  remarks: string;
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

  // Extension Modal & History states
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [extensionLogs, setExtensionLogs] = useState<ExtensionLogEntry[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Extension Requests state
  const [extensionRequests, setExtensionRequests] = useState<any[]>([]);
  const [pendingRequestsCount, setPendingRequestsCount] = useState<number>(0);
  const [showRequestsModal, setShowRequestsModal] = useState(false);
  const [requestsFilter, setRequestsFilter] = useState<"pending" | "all">("pending");
  const [selectedRequestForReject, setSelectedRequestForReject] = useState<any | null>(null);
  const [rejectRemarks, setRejectRemarks] = useState("");
  const [isReviewingRequest, setIsReviewingRequest] = useState(false);
  const [selectedRequestForApprove, setSelectedRequestForApprove] = useState<any | null>(null);
  const [approveDate, setApproveDate] = useState("");
  const [approveTime, setApproveTime] = useState("23:59");
  const [approveRemarks, setApproveRemarks] = useState("");
  const [isApprovingRequest, setIsApprovingRequest] = useState(false);
  const [activeLinkedRequestId, setActiveLinkedRequestId] = useState<string | null>(null);
  const [extendModalPrefills, setExtendModalPrefills] = useState<{
    scope?: "global" | "program" | "faculty";
    facultyName?: string;
    preset?: any;
    reason?: string;
  } | null>(null);

  // Active Faculty On-Schedule states (Option A Onboarding Grace Period / Extensions)
  const [activeFacultySchedules, setActiveFacultySchedules] = useState<ActiveFacultySchedule[]>([]);
  const [closingFacultyId, setClosingFacultyId] = useState<string | null>(null);
  const [showActiveFacultyModal, setShowActiveFacultyModal] = useState(false);
  const [facultyToClose, setFacultyToClose] = useState<ActiveFacultySchedule | null>(null);
  const [facultyCloseCountdown, setFacultyCloseCountdown] = useState(3);

  // Edit vs. Save schedule toggle (defaults to editing if no schedule exists yet)
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);

  // 2-Option view switcher: "global" schedule vs "personal" deadline
  const [scheduleViewMode, setScheduleViewMode] = useState<"global" | "personal">("global");
  const [personalSearchQuery, setPersonalSearchQuery] = useState("");
  const [personalTypeFilter, setPersonalTypeFilter] = useState<"all" | "onboarding" | "extension" | "standard">("all");

  // Memoized unique personal deadline faculty list with search & type filtering
  const { filteredPersonalFaculty, personalCounts } = useMemo(() => {
    const query = personalSearchQuery.trim().toLowerCase();
    const seen = new Set<string>();
    const uniqueList: ActiveFacultySchedule[] = [];

    for (const fac of activeFacultySchedules) {
      const key = fac.facultyProfileId || fac.email;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      uniqueList.push(fac);
    }

    const counts = {
      all: uniqueList.length,
      onboarding: uniqueList.filter((f) => f.type === "onboarding").length,
      extension: uniqueList.filter((f) => f.type === "extension").length,
      standard: uniqueList.filter((f) => f.type === "standard").length,
    };

    const filtered = uniqueList.filter((fac) => {
      if (personalTypeFilter !== "all" && fac.type !== personalTypeFilter) {
        return false;
      }
      if (!query) return true;
      return (
        fac.facultyName.toLowerCase().includes(query) ||
        fac.email.toLowerCase().includes(query) ||
        fac.department.toLowerCase().includes(query) ||
        (fac.typeLabel || "").toLowerCase().includes(query) ||
        (fac.academicYear || "").toLowerCase().includes(query)
      );
    });

    return { filteredPersonalFaculty: filtered, personalCounts: counts };
  }, [activeFacultySchedules, personalSearchQuery, personalTypeFilter]);

  // 3-second safety countdown for Close Submissions
  const [closeCountdown, setCloseCountdown] = useState(3);

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

  const nearestPersonalDeadline = useMemo(() => {
    if (!activeFacultySchedules || activeFacultySchedules.length === 0) return null;
    const valid = activeFacultySchedules
      .map((fac) => {
        try {
          const d = new Date(fac.deadline);
          return isNaN(d.getTime()) ? null : { fac, date: d };
        } catch {
          return null;
        }
      })
      .filter((item): item is { fac: ActiveFacultySchedule; date: Date } => item !== null)
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    return valid.length > 0 ? valid[0] : null;
  }, [activeFacultySchedules]);

  const personalCountdownTime = useMemo(() => {
    if (!activeFacultySchedules || activeFacultySchedules.length === 0) {
      return "Not Configured";
    }
    if (!nearestPersonalDeadline) {
      return `${activeFacultySchedules.length} Active`;
    }
    const diff = nearestPersonalDeadline.date.getTime() - now.getTime();
    if (diff > 0) {
      return formatTimeDifference(diff);
    }
    return `Expired ${formatTimeAgo(Math.abs(diff))}`;
  }, [activeFacultySchedules, nearestPersonalDeadline, now]);

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

  const fetchActiveFacultySchedules = useCallback(async () => {
    try {
      const res = await fetch("/api/staff/submission-window/active-faculty-schedules", {
        credentials: "include",
      });
      if (res.ok) {
        const body = await res.json();
        setActiveFacultySchedules(body.schedules || []);
      }
    } catch {
      // Ignore background error
    }
  }, []);

  const handleCloseFacultySchedule = (fac: ActiveFacultySchedule) => {
    setFacultyToClose(fac);
    setFacultyCloseCountdown(3);
  };

  const confirmCloseFacultySchedule = async () => {
    if (!facultyToClose) return;
    const fac = facultyToClose;
    setClosingFacultyId(fac.facultyProfileId);
    try {
      const res = await fetch("/api/staff/submission-window/active-faculty-schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          facultyProfileId: fac.facultyProfileId,
          email: fac.email,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to close faculty submission schedule");
      } else {
        setSuccess(`Submission schedule closed for ${fac.facultyName}.`);
        setFacultyToClose(null);
        await fetchActiveFacultySchedules();
        onWindowChange?.();
      }
    } catch {
      setError("Failed to close faculty submission schedule");
    } finally {
      setClosingFacultyId(null);
    }
  };

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
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load submission window");
    } finally {
      if (!options?.silent) {
        setIsLoading(false);
      }
      void fetchActiveFacultySchedules();
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadWindow();
      void fetchExtensionRequests();
      void fetchActiveFacultySchedules();
      if (isSuperAdmin) {
        void fetchLogs();
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [isSuperAdmin, fetchLogs, fetchExtensionRequests, fetchActiveFacultySchedules]);

  useRealtimeSync(() => {
    void loadWindow({ silent: true });
    void fetchExtensionRequests();
    void fetchActiveFacultySchedules();
    if (isSuperAdmin) {
      void fetchLogs();
    }
  });

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

  // Faculty Close countdown timer tick
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (facultyToClose && facultyCloseCountdown > 0) {
      interval = setInterval(() => {
        setFacultyCloseCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [facultyToClose, facultyCloseCountdown]);

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
    void fetchExtensionRequests();
    onWindowChange?.();
  };

  function handleOpenExtendForRequest(req: any) {
    setActiveLinkedRequestId(req.id);
    setExtendModalPrefills({
      scope: "faculty",
      facultyName: req.faculty_name,
      preset: req.requested_preset || "+3 Days",
      reason: req.reason,
    });
    setShowRequestsModal(false);
    setShowExtendModal(true);
  }

  async function handleRejectRequest(requestId: string) {
    setIsReviewingRequest(true);
    setError(null);
    try {
      const res = await fetch("/api/staff/submission-window/extension-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          requestId,
          action: "reject",
          adminRemarks: rejectRemarks.trim() || "Deadline extension request was not approved.",
        }),
      });
      if (res.ok) {
        setSuccess("Extension request has been declined. Portal remains locked for overdue requirements.");
        setSelectedRequestForReject(null);
        setRejectRemarks("");
        void fetchExtensionRequests();
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body.error || "Failed to decline extension request.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error declining extension request.");
    } finally {
      setIsReviewingRequest(false);
    }
  }

  function handleOpenApproveModal(req: any) {
    setSelectedRequestForApprove(req);
    let defaultDate = req.requested_date || "";
    let defaultTime = req.requested_time || "23:59";
    if (!defaultDate) {
      const preset = req.requested_preset || "+3 Days";
      const d = new Date();
      if (preset === "+24 Hours") d.setHours(d.getHours() + 24);
      else if (preset === "+48 Hours") d.setHours(d.getHours() + 48);
      else if (preset === "+3 Days") d.setDate(d.getDate() + 3);
      else if (preset === "+1 Week") d.setDate(d.getDate() + 7);
      else d.setDate(d.getDate() + 3);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      defaultDate = `${yyyy}-${mm}-${dd}`;
    }
    setApproveDate(defaultDate);
    setApproveTime(defaultTime);
    setApproveRemarks("");
  }

  async function handleConfirmApproveRequest() {
    if (!selectedRequestForApprove) return;
    setIsApprovingRequest(true);
    setError(null);
    try {
      const res = await fetch("/api/staff/submission-window/extension-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          requestId: selectedRequestForApprove.id,
          action: "approve",
          approvedDate: approveDate,
          approvedTime: approveTime,
          adminRemarks: approveRemarks.trim() || undefined,
        }),
      });
      if (res.ok) {
        setSuccess(`Extension request approved until ${approveDate} at ${approveTime}. Submission portal unlocked for faculty.`);
        setSelectedRequestForApprove(null);
        void fetchExtensionRequests();
        onWindowChange?.();
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body.error || "Failed to approve extension request.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error approving extension request.");
    } finally {
      setIsApprovingRequest(false);
    }
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
          {/* Context-aware Status Badge */}
          {scheduleViewMode === "personal" ? (
            <div className="inline-flex items-center justify-center sm:justify-start gap-2 bg-white text-slate-800 border border-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-800 px-3 py-1.5 text-xs font-semibold rounded-md shadow-2xs">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  activeFacultySchedules.length > 0
                    ? "bg-emerald-500 animate-pulse"
                    : "bg-slate-400 dark:bg-slate-500"
                }`}
              />
              <span>
                {activeFacultySchedules.length > 0
                  ? `Schedule Extensions Active (${activeFacultySchedules.length})`
                  : "Not Configured"}
              </span>
            </div>
          ) : (
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
          )}

          {/* Current Academic Term Badge */}
          <div className="inline-flex items-center justify-center sm:justify-start gap-1.5 text-xs text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-md shadow-2xs">
            <span>Current Term:</span>
            <span className="font-semibold text-slate-900 dark:text-slate-200">{currentTermLabel}</span>
          </div>

          {/* On Schedule Faculty Badge - Shortcut visible on Global view, clicking directs to Extension of Schedule view */}
          {scheduleViewMode === "global" && activeFacultySchedules.length > 0 && (
            <button
              type="button"
              onClick={() => setScheduleViewMode("personal")}
              className="inline-flex items-center justify-center sm:justify-start gap-2 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white border border-emerald-700 dark:border-emerald-500 px-3 py-1.5 text-xs font-bold rounded-lg shadow-xs transition cursor-pointer active:scale-95"
              title="Click to switch to Extension of Schedule view"
            >
              <span className="w-2 h-2 rounded-full bg-white animate-pulse shrink-0" />
              <span>
                Extensions Active: <strong className="font-extrabold text-white">{activeFacultySchedules.length} Faculty</strong>
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-800 text-white font-black uppercase tracking-wider border border-emerald-500/40">
                View
              </span>
            </button>
          )}
        </div>

        {/* Real-Time Countdown Timer Display */}
        <div className="flex items-center justify-between sm:justify-end gap-3 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 px-3.5 py-2 rounded-lg shadow-xs w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <AppIcon icon={Hourglass} size="md" color="default" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {scheduleViewMode === "personal"
                ? activeFacultySchedules.length > 1
                  ? "Next Deadline"
                  : activeFacultySchedules.length === 1
                  ? "Time Remaining"
                  : "Status"
                : isWindowOpen
                ? "Time Remaining"
                : isUpcoming
                ? "Opens In"
                : "Status"}
            </span>
          </div>
          <span className="font-mono text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
            {scheduleViewMode === "personal" ? personalCountdownTime : formattedCountdownTime}
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

      {/* 2-Option Schedule Switcher: Global Schedule & Extension of Schedule */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 w-full sm:w-auto shadow-2xs">
          <button
            type="button"
            onClick={() => setScheduleViewMode("global")}
            className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              scheduleViewMode === "global"
                ? "bg-amber-500 text-slate-950 shadow-xs border border-amber-600 font-extrabold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-900"
            }`}
          >
            <AppIcon icon={Calendar} size="sm" color="inherit" />
            <span>Global Schedule</span>
          </button>

          <button
            type="button"
            onClick={() => setScheduleViewMode("personal")}
            className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              scheduleViewMode === "personal"
                ? "bg-amber-500 text-slate-950 shadow-xs border border-amber-600 font-extrabold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-900"
            }`}
          >
            <AppIcon icon={User} size="sm" color="inherit" />
            <span>Extension of Schedule</span>
            {activeFacultySchedules.length > 0 ? (
              <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full transition-colors ${
                scheduleViewMode === "personal"
                  ? "bg-white text-amber-950 shadow-2xs border border-amber-600/30"
                  : "bg-emerald-600 text-white"
              }`}>
                {activeFacultySchedules.length}
              </span>
            ) : null}
          </button>
        </div>

        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
          {scheduleViewMode === "global" ? (
            <span>Campus-wide submission window for all faculty members</span>
          ) : (
            <span>
              <strong>{activeFacultySchedules.length} Faculty</strong> with active schedule extensions
            </span>
          )}
        </div>
      </div>

      {scheduleViewMode === "global" ? (
        <>
          {/* 2. 2-Column Schedule Configuration Grid */}
          <form onSubmit={handleSave} className="space-y-6">
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
                      min={openDateTime || undefined}
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

                <button
                  type="button"
                  onClick={() => setShowExtendModal(true)}
                  disabled={isLoading || isSaving || !isGlobalSubmissionOpen}
                  className="flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-4 py-2.5 sm:py-2 text-sm rounded-xl transition-colors shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-[0.98]"
                  title={!isGlobalSubmissionOpen ? "Cannot extend a closed submission window" : "Extend active submission window"}
                >
                  <AppIcon icon={Hourglass} size="sm" color="inherit" className="text-slate-950" />
                  <span>Extend Window</span>
                </button>
              </>
            )}
          </div>
        </div>
      </form>
    </>
      ) : (
        /* SECTION: Extension of Schedule Management */
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Subtle Informational Banner matching Global Schedule (No duplicate action button) */}
          <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-slate-100 border border-slate-200/90 dark:bg-slate-800/50 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs">
            <AppIcon icon={User} size="md" color="default" />
            <div>
              <span className="font-bold text-slate-900 dark:text-slate-100">Faculty Schedule Extensions:</span>{" "}
              <span>
                {personalCounts.all} faculty member{personalCounts.all !== 1 ? "s" : ""} with approved deadline extensions.
              </span>
            </div>
          </div>

          {/* Pending Extension Requests Alert Banner in Extension of Schedule View */}
          {pendingRequestsCount > 0 && (
            <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-amber-50/70 border border-amber-200/80 dark:bg-amber-950/20 dark:border-amber-800/40 text-xs">
              <div className="flex items-center gap-2.5 text-amber-900 dark:text-amber-200">
                <AppIcon icon={Hourglass} size="md" color="inherit" />
                <span>
                  <strong>{pendingRequestsCount} Pending Request{pendingRequestsCount !== 1 ? "s" : ""}:</strong> Faculty have requested submission deadline extensions.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowRequestsModal(true);
                  void fetchExtensionRequests();
                }}
                className="shrink-0 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-50 border border-amber-300 dark:border-amber-700/60 font-semibold text-xs px-3 py-1.5 rounded-lg transition shadow-2xs cursor-pointer"
              >
                Review Requests ({pendingRequestsCount})
              </button>
            </div>
          )}

          {/* Search Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <AppIcon
                icon={Search}
                size="sm"
                color="default"
                className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 dark:text-slate-500"
              />
              <input
                type="text"
                placeholder="Search faculty name, email, department..."
                value={personalSearchQuery}
                onChange={(e) => setPersonalSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-amber-500 dark:focus:border-amber-400 transition-colors shadow-2xs"
              />
              {personalSearchQuery ? (
                <button
                  type="button"
                  onClick={() => setPersonalSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <AppIcon icon={Xmark} size="sm" color="inherit" />
                </button>
              ) : null}
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Showing <strong>{filteredPersonalFaculty.length}</strong> active extension{filteredPersonalFaculty.length !== 1 ? "s" : ""}
            </div>
          </div>

          {/* Table / List View */}
          {filteredPersonalFaculty.length === 0 ? (
            <div className="py-12 px-4 text-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                <AppIcon icon={Calendar} size="lg" color="inherit" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {personalSearchQuery ? "No matching faculty found" : "No active schedule extensions"}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  {personalSearchQuery
                    ? `No faculty with extended schedule matches "${personalSearchQuery}". Try adjusting your search term.`
                    : "All faculty are currently following the global schedule. Faculty granted deadline extension requests will appear here."}
                </p>
              </div>
              <div className="flex items-center justify-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setScheduleViewMode("global")}
                  className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition cursor-pointer"
                >
                  Switch to Global Schedule
                </button>
                {pendingRequestsCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowRequestsModal(true);
                      void fetchExtensionRequests();
                    }}
                    className="px-3.5 py-2 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 transition cursor-pointer"
                  >
                    Review Requests ({pendingRequestsCount})
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="w-full overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-3 text-center w-12">#</th>
                    <th className="py-3 px-5">Faculty Name</th>
                    <th className="py-3 px-4 text-center">Type</th>
                    <th className="py-3 px-4">Personal Schedule</th>
                    <th className="py-3 px-4 text-center">Portal Status</th>
                    <th className="py-3 px-5 text-center w-44">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-950">
                  {filteredPersonalFaculty.map((fac, index) => {
                    const formattedOpen = (() => {
                      if (fac.openDateFormatted && fac.openDateFormatted !== "—" && !fac.openDateFormatted.includes("Invalid")) {
                        return fac.openDateFormatted;
                      }
                      return "Active";
                    })();

                    const formattedClose = (() => {
                      if (fac.closeDateFormatted && fac.closeDateFormatted !== "—" && !fac.closeDateFormatted.includes("Invalid")) {
                        return fac.closeDateFormatted;
                      }
                      if (fac.deadlineFormatted && !fac.deadlineFormatted.includes("Invalid")) {
                        return fac.deadlineFormatted;
                      }
                      try {
                        const d = new Date(fac.deadline);
                        if (!isNaN(d.getTime())) {
                          return d.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                            hour12: true,
                          });
                        }
                      } catch {
                        // ignore
                      }
                      return "Active Window";
                    })();

                    return (
                      <tr
                        key={fac.facultyProfileId || fac.email}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-900/40 transition-colors"
                      >
                        <td className="py-3 px-3 text-center align-middle font-medium text-slate-400 dark:text-slate-500">
                          {index + 1}
                        </td>
                        <td className="py-3 px-5 align-middle">
                          <div className="space-y-0.5">
                            <span className="font-semibold text-sm text-slate-900 dark:text-slate-100 block">
                              {fac.facultyName}
                            </span>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              {fac.email} • {fac.department} • {fac.academicYear} {fac.semester}
                            </p>
                          </div>
                        </td>
                        <td className="py-3 px-4 align-middle text-center whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white border border-sky-700 shadow-2xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />
                            Approved Extension
                          </span>
                        </td>
                        <td className="py-3 px-4 align-middle whitespace-nowrap">
                          <div className="flex flex-col gap-0.5 text-xs">
                            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                              <span className="text-[11px] font-semibold text-slate-400">Opens:</span>
                              <span className="font-medium text-slate-700 dark:text-slate-300">{formattedOpen}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                              <span className="text-[11px] font-semibold text-slate-400">Deadline:</span>
                              <span className="font-bold text-slate-900 dark:text-slate-100">{formattedClose}</span>
                            </div>
                            {fac.timeRemainingLabel && !fac.timeRemainingLabel.includes("NaN") ? (
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                                {fac.timeRemainingLabel}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="py-3 px-4 align-middle text-center whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-[#0b5336] px-2.5 py-1 rounded-md border border-[#08412a] shadow-2xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse shrink-0" />
                            Portal Unlocked
                          </span>
                        </td>
                        <td className="py-3 px-5 align-middle text-center whitespace-nowrap">
                          <button
                            type="button"
                            disabled={closingFacultyId === fac.facultyProfileId}
                            onClick={() => handleCloseFacultySchedule(fac)}
                            className="inline-flex items-center justify-center gap-1.5 bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 cursor-pointer shadow-2xs active:scale-95"
                            title="Close submission window for this faculty member"
                          >
                            <AppIcon icon={ShieldAlert} size="sm" color="white" />
                            <span>Close Deadline</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Extension of Schedule Footer Action Toolbar (Sole location for Extension Requests & Logs) */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-slate-200 dark:border-slate-800 pt-5">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setShowRequestsModal(true);
                  void fetchExtensionRequests();
                }}
                className="relative inline-flex items-center gap-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-slate-300 dark:border-slate-800 px-3.5 py-2 text-xs font-medium rounded-xl transition cursor-pointer shadow-2xs"
              >
                <AppIcon icon={Hourglass} size="sm" color="active" />
                <span>Extension Requests</span>
                {pendingRequestsCount > 0 ? (
                  <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950 animate-pulse">
                    {pendingRequestsCount} Pending
                  </span>
                ) : null}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowLogsModal(true);
                  refetchLogs();
                }}
                className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-slate-300 dark:border-slate-800 px-3.5 py-2 text-xs font-medium rounded-xl transition cursor-pointer"
              >
                <AppIcon icon={ClockRotateRight} size="sm" color="default" />
                <span>Logs {extensionLogs.length > 0 ? `(${extensionLogs.length})` : ""}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Workflow Modal: Extend Submission Window */}
      <ExtendSubmissionWindowModal
        isOpen={showExtendModal}
        onClose={() => {
          setShowExtendModal(false);
          setActiveLinkedRequestId(null);
          setExtendModalPrefills(null);
        }}
        onSuccess={(msg) => {
          handleExtensionSuccess(msg);
          setActiveLinkedRequestId(null);
          setExtendModalPrefills(null);
        }}
        currentEndDate={windowStatus?.endDate}
        currentEndTimeLabel={windowStatus?.endTimeLabel}
        academicYear={windowStatus?.academicYear}
        semester={windowStatus?.semester}
        initialScope={extendModalPrefills?.scope || "global"}
        initialFacultyName={extendModalPrefills?.facultyName || ""}
        initialPreset={extendModalPrefills?.preset || "+3 Days"}
        linkedRequestId={activeLinkedRequestId}
      />

      {/* Extension Requests Management Modal */}
      {showRequestsModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col text-slate-900 dark:text-slate-100">
            <ModalHeader
              icon={Hourglass}
              title="Faculty Extension Requests"
              subtitle="Review and approve faculty deadline extension requests"
              onClose={() => setShowRequestsModal(false)}
              className="-mx-6 -mt-6 mb-4 rounded-t-2xl"
            />

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setRequestsFilter("pending")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  requestsFilter === "pending"
                    ? "bg-amber-500 text-slate-950 font-bold"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                }`}
              >
                Pending Requests ({pendingRequestsCount})
              </button>
              <button
                type="button"
                onClick={() => setRequestsFilter("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  requestsFilter === "all"
                    ? "bg-amber-500 text-slate-950 font-bold"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                }`}
              >
                All Requests ({extensionRequests.length})
              </button>
            </div>

            {/* Requests List */}
            <div className="overflow-y-auto space-y-3 pr-1 flex-1">
              {(() => {
                const displayed = extensionRequests.filter((r) =>
                  requestsFilter === "pending" ? r.status === "pending" : true
                );

                if (displayed.length === 0) {
                  return (
                    <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400 space-y-1">
                      <p className="font-semibold text-slate-700 dark:text-slate-300">No extension requests found.</p>
                      <p>When faculty members request deadline extensions for incomplete requirements, they will appear here.</p>
                    </div>
                  );
                }

                return displayed.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                            {req.faculty_name}
                          </h4>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              req.status === "approved"
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                                : req.status === "rejected"
                                ? "bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30"
                                : "bg-amber-500/20 text-amber-900 dark:text-amber-200 border border-amber-500/40"
                            }`}
                          >
                            {req.status}
                          </span>
                          {req.status === "approved" && !req.approved_date && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                              Deadline Closed
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {req.department || "Faculty"} • {req.academic_year} {req.semester}
                        </p>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 text-xs text-slate-500 shrink-0">
                        <span className="font-semibold text-amber-800 dark:text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-md border border-amber-500/30">
                          {req.requested_preset || "+3 Days"}
                        </span>
                        {req.requested_date && (
                          <span className="text-[11px] text-slate-600 dark:text-slate-400">
                            (Target: {req.requested_date} {req.requested_time || "23:59"})
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Requirements tags */}
                    {Array.isArray(req.requirement_codes) && req.requirement_codes.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-semibold text-slate-500">For:</span>
                        {req.requirement_codes.map((code: string) => (
                          <span
                            key={code}
                            className="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-medium"
                          >
                            {code}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    {/* Reason */}
                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 text-xs text-slate-700 dark:text-slate-300 italic">
                      &ldquo;{req.reason}&rdquo;
                    </div>

                    {/* Supporting Document Attachment */}
                    {req.supporting_document_url || req.supporting_document_name ? (
                      <div className="flex items-center gap-2 pt-0.5">
                        <a
                          href={`/api/faculty/submissions/extension-request/document?requestId=${req.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 dark:text-amber-200 border border-amber-500/30 text-[11px] font-semibold transition"
                        >
                          <AppIcon icon={Page} size="xs" color="inherit" />
                          <span>Supporting Document: {req.supporting_document_name || "View Document"}</span>
                        </a>
                      </div>
                    ) : null}

                    {/* Approved details if already approved */}
                    {req.status === "approved" && req.approved_date && (
                      <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 text-[11px] text-emerald-800 dark:text-emerald-300">
                        <span className="font-semibold">Approved Custom Deadline:</span> {req.approved_date} at {req.approved_time || "11:59 PM"}
                      </div>
                    )}

                    {/* Admin remarks if reviewed */}
                    {req.admin_remarks && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="font-semibold">Approver remarks:</span> {req.admin_remarks}
                      </p>
                    )}

                    {/* Pending Action Buttons */}
                    {req.status === "pending" && (
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
                        <button
                          type="button"
                          onClick={() => setSelectedRequestForReject(req)}
                          className="px-3 py-1.5 rounded-lg border border-[#5e0000] bg-[#780000] hover:bg-[#5e0000] text-white text-xs font-semibold transition cursor-pointer shadow-2xs"
                        >
                          Decline
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenApproveModal(req)}
                          className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer shadow-xs"
                        >
                          Approve Extension
                        </button>
                      </div>
                    )}
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      ) : null}

      {/* Decline Extension Request Confirmation Modal */}
      {selectedRequestForReject ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 text-slate-900 dark:text-slate-100">
            <ModalHeader
              icon={WarningCircle}
              title="Decline Extension Request"
              subtitle={`Faculty: ${selectedRequestForReject.faculty_name} • ${selectedRequestForReject.requested_preset || "+3 Days"}`}
              className="-mx-6 -mt-6 mb-4 rounded-t-2xl"
            />

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Reason / Feedback Remarks for Faculty (Optional)
              </label>
              <textarea
                value={rejectRemarks}
                onChange={(e) => setRejectRemarks(e.target.value)}
                placeholder="e.g. Please submit during the next scheduled submission cycle."
                rows={3}
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Declining this request keeps the requirement <span className="font-semibold text-rose-600 dark:text-rose-400">Overdue</span> and leaves the submission portal locked.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedRequestForReject(null);
                  setRejectRemarks("");
                }}
                disabled={isReviewingRequest}
                className="px-4 py-2 rounded-lg border border-[#5e0000] bg-[#780000] hover:bg-[#5e0000] text-white text-xs font-semibold transition cursor-pointer shadow-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleRejectRequest(selectedRequestForReject.id)}
                disabled={isReviewingRequest}
                className="px-4 py-2 rounded-lg border border-[#5e0000] bg-[#780000] hover:bg-[#5e0000] text-white text-xs font-semibold transition cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isReviewingRequest ? "Declining..." : "Confirm Decline"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Approve Extension Request Modal */}
      {selectedRequestForApprove ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 text-slate-900 dark:text-slate-100">
            <ModalHeader
              icon={CheckCircle}
              title="Approve Extension Request"
              subtitle={`Faculty: ${selectedRequestForApprove.faculty_name} • ${selectedRequestForApprove.requested_preset || "+3 Days"}`}
              className="-mx-6 -mt-6 mb-4 rounded-t-2xl"
            />

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs space-y-1.5">
              <p className="text-slate-600 dark:text-slate-300">
                <span className="font-semibold text-slate-800 dark:text-slate-200">Reason:</span> &ldquo;{selectedRequestForApprove.reason}&rdquo;
              </p>
              {selectedRequestForApprove.supporting_document_url && (
                <div className="pt-1">
                  <a
                    href={`/api/faculty/submissions/extension-request/document?requestId=${selectedRequestForApprove.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-300 hover:underline font-semibold"
                  >
                    <AppIcon icon={Page} size="xs" color="inherit" />
                    <span>View Supporting Document ({selectedRequestForApprove.supporting_document_name || "Attachment"})</span>
                  </a>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Approved Custom Due Date
                </label>
                <input
                  type="date"
                  value={approveDate}
                  onChange={(e) => setApproveDate(e.target.value)}
                  className="w-full p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Approved Time
                </label>
                <input
                  type="time"
                  value={approveTime}
                  onChange={(e) => setApproveTime(e.target.value)}
                  className="w-full p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Approver Remarks / Instructions (Optional)
              </label>
              <textarea
                value={approveRemarks}
                onChange={(e) => setApproveRemarks(e.target.value)}
                placeholder="e.g. Extension approved. Please complete submissions before the deadline."
                rows={2}
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Assigns this date as the individual custom due date, sets status to <span className="font-semibold text-indigo-600 dark:text-indigo-400">Extended</span>, and unlocks the portal until that new date.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedRequestForApprove(null);
                  setApproveRemarks("");
                }}
                disabled={isApprovingRequest}
                className="px-4 py-2 rounded-lg border border-[#5e0000] bg-[#780000] hover:bg-[#5e0000] text-white text-xs font-semibold transition cursor-pointer shadow-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmApproveRequest()}
                disabled={isApprovingRequest || !approveDate}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isApprovingRequest ? "Approving..." : "Confirm Approval"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

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

      {/* Individual Faculty Close Confirmation Modal — 3-second Safety Countdown */}
      {facultyToClose ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 text-slate-900 dark:text-slate-100">
            <ModalHeader
              icon={WarningTriangle}
              title={`Close Submission for ${facultyToClose.facultyName}?`}
              subtitle="Immediate Closure & Portal Lock"
              onClose={() => {
                setFacultyToClose(null);
                setFacultyCloseCountdown(3);
              }}
              className="-mx-6 -mt-6 mb-4 rounded-t-2xl"
            />
            <p className="text-xs leading-5 text-slate-600 dark:text-slate-300">
              This will <span className="font-bold text-rose-700 dark:text-rose-400">immediately close</span> the active submission schedule for <strong className="text-slate-900 dark:text-slate-100">{facultyToClose.facultyName}</strong> ({facultyToClose.email}). Their individual upload portal will be locked immediately.
            </p>

            <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 dark:border-amber-950/60 bg-amber-50/70 dark:bg-amber-950/20 p-3 text-xs text-amber-900 dark:text-amber-300">
              <AppIcon icon={ShieldAlert} size="md" color="warning" className="mt-0.5 shrink-0" />
              <p className="leading-relaxed">
                <span className="font-semibold">Documents Protected:</span> Any compliance documents already uploaded by this faculty member will remain intact and validated/under review.
              </p>
            </div>

            {/* Countdown indicator */}
            {facultyCloseCountdown > 0 ? (
              <div className="flex items-center gap-3 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 px-4 py-3">
                <div className="relative flex items-center justify-center h-10 w-10 shrink-0">
                  <svg className="h-10 w-10 -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-300 dark:text-slate-800" />
                    <circle
                      cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="2.5"
                      className="text-rose-600 dark:text-rose-500 transition-all duration-1000 ease-linear"
                      strokeDasharray="97.39"
                      strokeDashoffset={97.39 * (1 - facultyCloseCountdown / 3)}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute text-sm font-black text-rose-700 dark:text-rose-400">{facultyCloseCountdown}</span>
                </div>
                <p className="text-[11px] text-rose-800 dark:text-rose-300">
                  Please wait <span className="font-bold">{facultyCloseCountdown} second{facultyCloseCountdown !== 1 ? "s" : ""}</span> before confirming. This safety timer protects against accidental closures.
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
                onClick={() => {
                  setFacultyToClose(null);
                  setFacultyCloseCountdown(3);
                }}
                className="bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] text-xs font-semibold px-4 py-2 rounded-lg transition-all cursor-pointer shadow-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmCloseFacultySchedule()}
                disabled={facultyCloseCountdown > 0 || closingFacultyId === facultyToClose.facultyProfileId}
                className={`text-xs font-semibold rounded-lg px-4 py-2 transition-all cursor-pointer shadow-xs ${
                  facultyCloseCountdown > 0 || closingFacultyId === facultyToClose.facultyProfileId
                    ? "bg-slate-200 dark:bg-slate-800 text-slate-400 border border-slate-300 dark:border-slate-700 cursor-not-allowed opacity-60"
                    : "bg-[#780000] hover:bg-[#5e0000] text-white"
                }`}
              >
                {facultyCloseCountdown > 0
                  ? `Confirm Close (${facultyCloseCountdown}s)`
                  : closingFacultyId === facultyToClose.facultyProfileId
                  ? "Closing..."
                  : "Confirm Close Submission"}
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
