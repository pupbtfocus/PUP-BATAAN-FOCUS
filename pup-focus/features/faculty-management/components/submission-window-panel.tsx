"use client";

import React, { useEffect, useState } from "react";
import { BellRing, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  ApiBody,
  SubmissionWindowResponse,
} from "@/features/faculty-management/types/faculty-dashboard.types";

function getNowIsoLocal(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
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

function toIsoLocalString(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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

export interface SubmissionWindowPanelProps {
  onWindowChange?: () => void;
}

export function SubmissionWindowPanel({ onWindowChange }: SubmissionWindowPanelProps) {
  const [openDateTime, setOpenDateTime] = useState("");
  const [closeDateTime, setCloseDateTime] = useState("");

  const [windowStatus, setWindowStatus] = useState<SubmissionWindowResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
  const [showCloseConfirmation, setShowCloseConfirmation] = useState(false);
  const [showBroadcastConfirmation, setShowBroadcastConfirmation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

  function handlePreset(days?: number, isEndOfMonth?: boolean) {
    const base = openDateTime ? new Date(openDateTime) : new Date();
    const validBase = Number.isNaN(base.getTime()) ? new Date() : base;
    const target = new Date(validBase);

    if (isEndOfMonth) {
      target.setMonth(target.getMonth() + 1, 0);
      target.setHours(23, 59, 0, 0);
    } else if (days) {
      target.setDate(target.getDate() + days);
    }

    setCloseDateTime(toIsoLocalString(target));
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

  async function loadWindow() {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

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
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

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

    const [startDate, startTime24] = openDateTime.split("T");
    const [endDate, endTime24] = closeDateTime.split("T");

    const startTimeLabel = toTimeLabel(startTime24);
    const endTimeLabel = toTimeLabel(endTime24);

    if (!startTimeLabel || !endTimeLabel) {
      setError("Please select valid start and end times.");
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
      setSuccess("Submission window updated successfully.");
      onWindowChange?.();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save submission window");
    } finally {
      setIsSaving(false);
    }
  }

  function handleCloseSubmission() {
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
    } catch (closeError) {
      setError(closeError instanceof Error ? closeError.message : "Failed to close submissions");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleBroadcastReminder() {
    setShowBroadcastConfirmation(false);
    setIsBroadcasting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/admin/submission-window/broadcast-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const body = await readApiBody(response);

      if (!response.ok) {
        const details =
          typeof body === "object" && body !== null
            ? (((body as ApiBody).error || (body as ApiBody).details) ?? `HTTP ${response.status}`)
            : `HTTP ${response.status}`;
        setError(`Failed to broadcast reminder: ${details}`);
        return;
      }

      const message =
        typeof body === "object" &&
        body !== null &&
        typeof (body as { message?: string }).message === "string"
          ? (body as { message: string }).message
          : "Successfully sent deadline reminders to faculty members.";

      setSuccess(message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to broadcast deadline reminder.");
    } finally {
      setIsBroadcasting(false);
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
    <div className="rounded-xl border border-slate-800 bg-slate-950 p-5 shadow-xl space-y-6">
      {/* Header & Status Section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-4">
        <div>
          <h4 className="text-base font-semibold text-slate-100">
            Submission Window Manager
          </h4>
          <p className="mt-1 text-xs text-slate-400">
            Current term: <span className="font-medium text-slate-200">{currentTermLabel}</span>
          </p>
        </div>

        <div className="flex flex-col sm:items-end">
          {windowStatus?.status === "Open" ? (
            <span className="text-emerald-400 font-semibold text-xs">Status: Open</span>
          ) : windowStatus?.status === "Closed" ? (
            <span className="text-amber-400 font-semibold text-xs">Status: Closed</span>
          ) : windowStatus?.status === "Upcoming" ? (
            <span className="text-sky-400 font-semibold text-xs">Status: Upcoming</span>
          ) : (
            <span className="text-slate-400 font-semibold text-xs">Status: Checking...</span>
          )}
          <p className="mt-0.5 text-[11px] text-slate-400">{currentScheduleLabel}</p>
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

      {/* Main Schedule Configuration Form */}
      <form onSubmit={handleSave} className="space-y-5">
        <div className="grid gap-5 md:grid-cols-2">
          {/* Opening Schedule Input */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 flex flex-col justify-between">
            <div>
              <label htmlFor="opening-schedule" className="block text-xs font-semibold text-amber-400">
                Opening Schedule
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
                disabled={isLoading || isSaving}
                className="w-full bg-slate-900 border border-slate-800 text-slate-100 rounded-lg p-2.5 text-xs focus:border-amber-500/50 outline-none transition"
              />
            </div>
          </div>

          {/* Closing Schedule Input & Presets */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 flex flex-col justify-between">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <label htmlFor="closing-schedule" className="block text-xs font-semibold text-rose-400">
                  Closing Schedule
                </label>
                <p className="mt-1 text-[11px] text-slate-400">
                  Select or use quick presets for deadline.
                </p>
              </div>

              {/* Quick Presets */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handlePreset(7)}
                  disabled={isLoading || isSaving}
                  className="bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 text-[11px] font-semibold rounded-md px-2 py-1 transition disabled:opacity-50"
                >
                  +7 Days
                </button>
                <button
                  type="button"
                  onClick={() => handlePreset(14)}
                  disabled={isLoading || isSaving}
                  className="bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 text-[11px] font-semibold rounded-md px-2 py-1 transition disabled:opacity-50"
                >
                  +14 Days
                </button>
                <button
                  type="button"
                  onClick={() => handlePreset(undefined, true)}
                  disabled={isLoading || isSaving}
                  className="bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 text-[11px] font-semibold rounded-md px-2 py-1 transition disabled:opacity-50"
                >
                  End of Month
                </button>
              </div>
            </div>

            <div className="mt-3">
              <input
                id="closing-schedule"
                type="datetime-local"
                min={openDateTime || nowIso}
                value={closeDateTime}
                onChange={(e) => setCloseDateTime(e.target.value)}
                disabled={isLoading || isSaving}
                className="w-full bg-slate-900 border border-slate-800 text-slate-100 rounded-lg p-2.5 text-xs focus:border-amber-500/50 outline-none transition"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => setShowBroadcastConfirmation(true)}
            disabled={isLoading || isSaving || isBroadcasting || !windowStatus?.isOpen}
            className="bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 text-xs font-semibold rounded-lg px-4 py-2 flex items-center transition disabled:opacity-50"
          >
            {isBroadcasting ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <BellRing className="mr-2 h-3.5 w-3.5 text-amber-400" />
            )}
            Broadcast Deadline Reminder
          </button>
          <button
            type="button"
            onClick={handleCloseSubmission}
            disabled={isLoading || isSaving || isBroadcasting || !windowStatus?.isOpen}
            className="bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 text-xs font-semibold rounded-lg px-4 py-2 transition disabled:opacity-50"
          >
            Close Submissions
          </button>
          <button
            type="submit"
            disabled={isLoading || isSaving || isBroadcasting}
            className="bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 text-xs font-semibold rounded-lg px-4 py-2 transition disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save Window Schedule"}
          </button>
        </div>
      </form>

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

      {/* Close Confirmation Modal */}
      {showCloseConfirmation ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-950 border border-slate-800 rounded-xl p-6 shadow-2xl space-y-4">
            <p className="text-xs uppercase tracking-wider text-rose-400 font-medium">
              Confirm Close
            </p>
            <h3 className="text-xl font-semibold text-slate-100">
              Close Submissions Now?
            </h3>
            <p className="text-xs leading-5 text-slate-300">
              This will immediately close the active submission window and clear the schedule.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowCloseConfirmation(false)}
                className="bg-slate-900 border border-slate-800 text-slate-300 hover:text-slate-100 text-xs"
              >
                Cancel
              </Button>
              <button
                type="button"
                onClick={() => void confirmCloseSubmission()}
                className="bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 text-xs font-semibold rounded-lg px-4 py-2 transition"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Broadcast Confirmation Modal */}
      {showBroadcastConfirmation ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-950 border border-slate-800 rounded-xl p-6 shadow-2xl space-y-4">
            <p className="text-xs uppercase tracking-wider text-amber-400 font-medium">
              Confirm Deadline Broadcast
            </p>
            <h3 className="text-xl font-semibold text-slate-100 flex items-center gap-2">
              <BellRing className="h-5 w-5 text-amber-400" />
              Broadcast Deadline Reminder?
            </h3>
            <p className="text-xs leading-5 text-slate-300">
              This will send an immediate <span className="font-semibold text-amber-400">Deadline Alert notification</span> to all active faculty members reminding them of the upcoming submission window closing date.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowBroadcastConfirmation(false)}
                disabled={isBroadcasting}
                className="bg-slate-900 border border-slate-800 text-slate-300 hover:text-slate-100 text-xs"
              >
                Cancel
              </Button>
              <button
                type="button"
                onClick={() => void handleBroadcastReminder()}
                disabled={isBroadcasting}
                className="bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 text-xs font-semibold rounded-lg px-4 py-2 transition disabled:opacity-50"
              >
                {isBroadcasting ? "Sending..." : "Confirm & Send"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export { SubmissionWindowPanel as SubmissionWindowManager };
