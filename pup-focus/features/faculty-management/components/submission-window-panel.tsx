"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type {
  ApiBody,
  DatePartState,
  SubmissionWindowResponse,
  TimePartState,
} from "@/features/faculty-management/types/faculty-dashboard.types";

function getCurrentYearInManila(): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
  }).formatToParts(new Date());

  const yearPart = parts.find((part) => part.type === "year");
  return yearPart ? Number.parseInt(yearPart.value, 10) : new Date().getFullYear();
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

function padScheduleNumber(value: number): string {
  return value.toString().padStart(2, "0");
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function parseScheduleDate(value: string | null | undefined): {
  year: string;
  month: string;
  day: string;
} {
  if (!value) {
    return { year: "", month: "", day: "" };
  }

  const parts = value.split("-");
  if (parts.length !== 3) {
    return { year: "", month: "", day: "" };
  }

  return { year: parts[0], month: parts[1], day: parts[2] };
}

function formatScheduleDate(year: string, month: string, day: string): string {
  if (!year || !month || !day) {
    return "";
  }

  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function buildScheduleYearOptions(selectedYear?: number): number[] {
  const currentYear = getCurrentYearInManila();
  const startYear = currentYear;
  const endYear = currentYear + 10;

  const years = Array.from(
    { length: endYear - startYear + 1 },
    (_, index) => startYear + index,
  );

  if (selectedYear !== undefined && !years.includes(selectedYear)) {
    years.push(selectedYear);
  }

  return years.sort((a, b) => a - b);
}

function parseScheduleTime(value: string | null | undefined): {
  hour: string;
  minute: string;
  period: "AM" | "PM" | "";
} {
  if (!value) {
    return { hour: "", minute: "", period: "" };
  }

  const parts = value.split(":");
  if (parts.length !== 2) {
    return { hour: "", minute: "", period: "" };
  }

  const hour24 = Number.parseInt(parts[0], 10);
  const minute = parts[1];

  if (Number.isNaN(hour24) || hour24 < 0 || hour24 > 23) {
    return { hour: "", minute: "", period: "" };
  }

  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;

  return {
    hour: hour12.toString(),
    minute: minute.padStart(2, "0"),
    period,
  };
}

function ScheduleDateInput({
  id,
  value,
  onChange,
  onPartialChange,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onPartialChange?: (parts: DatePartState) => void;
  disabled: boolean;
}) {
  const parsedValue = parseScheduleDate(value);
  const [selectedYear, setSelectedYear] = useState(parsedValue.year);
  const [selectedMonth, setSelectedMonth] = useState(parsedValue.month);
  const [selectedDay, setSelectedDay] = useState(parsedValue.day);

  useEffect(() => {
    setSelectedYear(parsedValue.year);
    setSelectedMonth(parsedValue.month);
    setSelectedDay(parsedValue.day);
  }, [parsedValue.year, parsedValue.month, parsedValue.day]);

  const yearOptions = buildScheduleYearOptions(
    selectedYear ? Number.parseInt(selectedYear, 10) : undefined,
  );
  const dayLimit =
    selectedYear && selectedMonth
      ? getDaysInMonth(
          Number.parseInt(selectedYear, 10),
          Number.parseInt(selectedMonth, 10),
        )
      : 31;

  function handlePartChange(part: "year" | "month" | "day", nextValue: string) {
    const nextYear = part === "year" ? nextValue : selectedYear;
    const nextMonth = part === "month" ? nextValue : selectedMonth;
    const nextDay = part === "day" ? nextValue : selectedDay;

    setSelectedYear(nextYear);
    setSelectedMonth(nextMonth);
    setSelectedDay(nextDay);

    onPartialChange?.({
      year: nextYear,
      month: nextMonth,
      day: nextDay,
    });

    if (nextYear && nextMonth && nextDay) {
      onChange(formatScheduleDate(nextYear, nextMonth, nextDay));
    }
  }

  return (
    <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-[minmax(4.5rem,1fr)_minmax(3rem,1fr)_minmax(4.5rem,1fr)] min-w-0">
      <div className="min-w-0">
        <label className="sr-only" htmlFor={`${id}-month`}>
          Month
        </label>
        <select
          id={`${id}-month`}
          className="w-full min-w-[4.5rem] rounded-md border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950 px-2 py-1 text-sm outline-none focus:ring focus:ring-amber-300/30"
          value={selectedMonth}
          onChange={(event) => handlePartChange("month", event.target.value)}
          disabled={disabled}
        >
          <option value="">Month</option>
          {Array.from({ length: 12 }, (_, index) => {
            const monthNumber = index + 1;
            return (
              <option key={monthNumber} value={padScheduleNumber(monthNumber)}>
                {new Date(0, index).toLocaleString("en-US", { month: "short" })}
              </option>
            );
          })}
        </select>
      </div>
      <div className="min-w-0">
        <label className="sr-only" htmlFor={`${id}-day`}>
          Day
        </label>
        <select
          id={`${id}-day`}
          className="w-full min-w-[3.5rem] rounded-md border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950 px-2 py-1 text-sm outline-none focus:ring focus:ring-amber-300/30"
          value={selectedDay}
          onChange={(event) => handlePartChange("day", event.target.value)}
          disabled={disabled}
        >
          <option value="">Day</option>
          {Array.from({ length: dayLimit }, (_, index) => {
            const dayValue = index + 1;
            return (
              <option key={dayValue} value={padScheduleNumber(dayValue)}>
                {dayValue}
              </option>
            );
          })}
        </select>
      </div>
      <div className="min-w-0">
        <label className="sr-only" htmlFor={`${id}-year`}>
          Year
        </label>
        <select
          id={`${id}-year`}
          className="w-full min-w-[4.25rem] rounded-md border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950 px-2 py-1 text-sm outline-none focus:ring focus:ring-amber-300/30"
          value={selectedYear}
          onChange={(event) => handlePartChange("year", event.target.value)}
          disabled={disabled}
        >
          <option value="">Year</option>
          {yearOptions.map((yearOption) => (
            <option key={yearOption} value={yearOption}>
              {yearOption}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function ScheduleTimeInput({
  id,
  value,
  onChange,
  onPartialChange,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onPartialChange?: (parts: TimePartState) => void;
  disabled: boolean;
}) {
  const parsedValue = parseScheduleTime(value);
  const [selectedHour, setSelectedHour] = useState(parsedValue.hour);
  const [selectedMinute, setSelectedMinute] = useState(parsedValue.minute);
  const [selectedPeriod, setSelectedPeriod] = useState(parsedValue.period);

  useEffect(() => {
    setSelectedHour(parsedValue.hour);
    setSelectedMinute(parsedValue.minute);
    setSelectedPeriod(parsedValue.period);
  }, [parsedValue.hour, parsedValue.minute, parsedValue.period]);

  function handlePartChange(
    part: "hour" | "minute" | "period",
    nextValue: string,
  ) {
    const nextHour = part === "hour" ? nextValue : selectedHour;
    const nextMinute = part === "minute" ? nextValue : selectedMinute;
    const nextPeriod =
      part === "period" ? (nextValue as "AM" | "PM" | "") : selectedPeriod;

    setSelectedHour(nextHour);
    setSelectedMinute(nextMinute);
    setSelectedPeriod(nextPeriod);

    onPartialChange?.({
      hour: nextHour,
      minute: nextMinute,
      period: nextPeriod,
    });

    if (nextHour && nextMinute && nextPeriod) {
      const hour12 = Number.parseInt(nextHour, 10);
      const hour24 =
        nextPeriod === "AM"
          ? hour12 === 12
            ? 0
            : hour12
          : hour12 === 12
            ? 12
            : hour12 + 12;

      onChange(`${hour24.toString().padStart(2, "0")}:${nextMinute.padStart(2, "0")}`);
    }
  }

  return (
    <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-3 min-w-0">
      <div className="min-w-0">
        <label className="sr-only" htmlFor={`${id}-hour`}>
          Hour
        </label>
        <select
          id={`${id}-hour`}
          className="w-full rounded-md border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950 px-2 py-1 text-sm outline-none focus:ring focus:ring-amber-300/30"
          value={selectedHour}
          onChange={(event) => handlePartChange("hour", event.target.value)}
          disabled={disabled}
        >
          <option value="">Hour</option>
          {Array.from({ length: 12 }, (_, index) => {
            const hourValue = index + 1;
            return (
              <option key={hourValue} value={hourValue.toString()}>
                {hourValue}
              </option>
            );
          })}
        </select>
      </div>
      <div className="min-w-0">
        <label className="sr-only" htmlFor={`${id}-minute`}>
          Minute
        </label>
        <select
          id={`${id}-minute`}
          className="w-full rounded-md border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950 px-2 py-1 text-sm outline-none focus:ring focus:ring-amber-300/30"
          value={selectedMinute}
          onChange={(event) => handlePartChange("minute", event.target.value)}
          disabled={disabled}
        >
          <option value="">Min</option>
          {Array.from({ length: 60 }, (_, index) => {
            const minuteValue = index;
            return (
              <option key={minuteValue} value={padScheduleNumber(minuteValue)}>
                {padScheduleNumber(minuteValue)}
              </option>
            );
          })}
        </select>
      </div>
      <div className="min-w-0">
        <label className="sr-only" htmlFor={`${id}-period`}>
          AM / PM
        </label>
        <select
          id={`${id}-period`}
          className="w-full rounded-md border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950 px-2 py-1 text-sm outline-none focus:ring focus:ring-amber-300/30"
          value={selectedPeriod}
          onChange={(event) => handlePartChange("period", event.target.value)}
          disabled={disabled}
        >
          <option value="">Period</option>
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
    </div>
  );
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
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [, setStartDateParts] = useState<DatePartState>({
    year: "",
    month: "",
    day: "",
  });
  const [, setEndDateParts] = useState<DatePartState>({
    year: "",
    month: "",
    day: "",
  });
  const [, setStartTimeParts] = useState<TimePartState>({
    hour: "",
    minute: "",
    period: "",
  });
  const [, setEndTimeParts] = useState<TimePartState>({
    hour: "",
    minute: "",
    period: "",
  });
  const [windowStatus, setWindowStatus] = useState<SubmissionWindowResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
  const [showCloseConfirmation, setShowCloseConfirmation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function formatScheduleDateTime(
    date: string | null,
    timeLabel: string | null,
  ): string | null {
    if (!date || !timeLabel) {
      return null;
    }

    const timeValue = toTimeInputValue(timeLabel);
    if (!timeValue) {
      return null;
    }

    const parsed = new Date(`${date}T${timeValue}`);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return parsed.toLocaleString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function getStatusIcon(status: SubmissionWindowResponse["status"] | null) {
    if (status === "Upcoming") {
      return "🟡";
    }

    if (status === "Open") {
      return "🟢";
    }

    return "🔴";
  }

  function validateSchedule(): boolean {
    if (!startDate || !endDate || !startTime || !endTime) {
      setError("Start/end date and time are required.");
      return false;
    }

    if (
      startDate > endDate ||
      (startDate === endDate && startTime >= endTime)
    ) {
      setError(
        "The closing date and time must be later than the opening date and time.",
      );
      return false;
    }

    return true;
  }

  async function loadWindow() {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/admin/submission-window", {
        credentials: "include",
      });
      const body = await readApiBody(response);

      if (!response.ok) {
        const details =
          typeof body === "object" && body !== null
            ? (((body as ApiBody).error || (body as ApiBody).details) ??
              `HTTP ${response.status}`)
            : `HTTP ${response.status}`;

        setError(`Failed to load submission window: ${details}`);
        return;
      }

      if (typeof body !== "object" || body === null) {
        setError(
          `Failed to load submission window: Invalid response (HTTP ${response.status})`,
        );
        return;
      }

      const data = body as SubmissionWindowResponse;
      setWindowStatus(data);
      setStartDate(data.startDate ?? "");
      setEndDate(data.endDate ?? "");
      setStartDateParts(parseScheduleDate(data.startDate ?? ""));
      setEndDateParts(parseScheduleDate(data.endDate ?? ""));
      setStartTime(
        data.startTimeLabel
          ? (toTimeInputValue(data.startTimeLabel) ?? "")
          : "",
      );
      setEndTime(
        data.endTimeLabel
          ? (toTimeInputValue(data.endTimeLabel) ?? "")
          : "",
      );
      setStartTimeParts(
        data.startTimeLabel
          ? parseScheduleTime(toTimeInputValue(data.startTimeLabel) ?? "")
          : { hour: "", minute: "", period: "" },
      );
      setEndTimeParts(
        data.endTimeLabel
          ? parseScheduleTime(toTimeInputValue(data.endTimeLabel) ?? "")
          : { hour: "", minute: "", period: "" },
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load submission window",
      );
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

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!windowStatus?.academicYear || !windowStatus?.semester) {
      setError(
        "No active academic term is configured. Please set a current academic term first.",
      );
      return;
    }

    if (!validateSchedule()) {
      return;
    }

    const startTimeLabel = toTimeLabel(startTime);
    const endTimeLabel = toTimeLabel(endTime);

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

    const startTimeLabel = toTimeLabel(startTime);
    const endTimeLabel = toTimeLabel(endTime);

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
          setError(
            `Failed to save submission window (HTTP ${response.status}).`,
          );
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
        setError(
          `Failed to save submission window: Invalid response (HTTP ${response.status}).`,
        );
        return;
      }

      setWindowStatus(body as SubmissionWindowResponse);
      setSuccess("Submission window updated successfully.");
      onWindowChange?.();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save submission window",
      );
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
        if (typeof body === "object" && body !== null) {
          setError((body as ApiBody).error || "Failed to close submissions");
        } else {
          setError(`Failed to close submissions (HTTP ${response.status}).`);
        }
        return;
      }

      if (typeof body !== "object" || body === null) {
        setError(
          `Failed to close submissions: Invalid response (HTTP ${response.status}).`,
        );
        return;
      }

      setWindowStatus(body as SubmissionWindowResponse);
      setStartDate("");
      setEndDate("");
      setStartTime("");
      setEndTime("");
      setSuccess("Submissions closed and schedule cleared.");
      onWindowChange?.();
    } catch (closeError) {
      setError(
        closeError instanceof Error
          ? closeError.message
          : "Failed to close submissions",
      );
    } finally {
      setIsSaving(false);
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
      ? `${formatScheduleDateTime(windowStatus.startDate, windowStatus.startTimeLabel)} to ${formatScheduleDateTime(windowStatus.endDate, windowStatus.endTimeLabel)}`
      : "Not configured";

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950/80 p-5 shadow-lg shadow-black/20">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h4 className="text-base font-semibold text-[#fff8e7]">
              Submission Window Status
            </h4>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Current term: <span className="font-medium text-slate-200">{currentTermLabel}</span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-2xl">{getStatusIcon(windowStatus?.status ?? null)}</span>
            <div>
              <span className="text-sm font-semibold text-slate-200">
                {windowStatus?.status ?? "Checking..."}
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-400">{currentScheduleLabel}</p>
            </div>
          </div>
        </div>

        {error ? (
          <p className="mt-4 rounded-md border border-red-700 bg-red-950/20 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        ) : null}

        {success ? (
          <p className="mt-4 rounded-md border border-emerald-700 bg-emerald-950/20 px-3 py-2 text-sm text-emerald-300">
            {success}
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950/80 p-5 shadow-lg shadow-black/20">
        <h4 className="text-base font-semibold text-[#fff8e7]">
          Configure Schedule
        </h4>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Set the opening and closing date and time for document submissions.
        </p>

        <form onSubmit={handleSave} className="mt-6 space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 p-4">
              <h5 className="font-semibold text-amber-300">Opening Schedule</h5>
              <div className="mt-4 space-y-3">
                <div>
                  <label className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Opening Date
                  </label>
                  <ScheduleDateInput
                    id="start-date"
                    value={startDate}
                    onChange={setStartDate}
                    onPartialChange={setStartDateParts}
                    disabled={isLoading || isSaving}
                  />
                </div>

                <div>
                  <label className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Opening Time
                  </label>
                  <ScheduleTimeInput
                    id="start-time"
                    value={startTime}
                    onChange={setStartTime}
                    onPartialChange={setStartTimeParts}
                    disabled={isLoading || isSaving}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 p-4">
              <h5 className="font-semibold text-rose-300">Closing Schedule</h5>
              <div className="mt-4 space-y-3">
                <div>
                  <label className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Closing Date
                  </label>
                  <ScheduleDateInput
                    id="end-date"
                    value={endDate}
                    onChange={setEndDate}
                    onPartialChange={setEndDateParts}
                    disabled={isLoading || isSaving}
                  />
                </div>

                <div>
                  <label className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Closing Time
                  </label>
                  <ScheduleTimeInput
                    id="end-time"
                    value={endTime}
                    onChange={setEndTime}
                    onPartialChange={setEndTimeParts}
                    disabled={isLoading || isSaving}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={handleCloseSubmission}
              disabled={isLoading || isSaving || !windowStatus?.isOpen}
              className="text-rose-400 hover:text-rose-300"
            >
              Close Submissions
            </Button>
            <Button
              type="submit"
              disabled={isLoading || isSaving}
            >
              {isSaving ? "Saving..." : "Save Window Schedule"}
            </Button>
          </div>
        </form>
      </section>

      {showSaveConfirmation ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950/95 p-6 shadow-2xl shadow-black/40">
            <p className="text-xs uppercase tracking-[0.28em] text-amber-400">
              Confirm Window Schedule
            </p>
            <h3 className="mt-3 text-2xl font-semibold text-white">
              Save Submission Schedule?
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-300">
              Faculty will be permitted to upload compliance documents starting from{" "}
              <span className="font-semibold text-white">
                {formatScheduleDateTime(startDate, toTimeLabel(startTime))}
              </span>{" "}
              until{" "}
              <span className="font-semibold text-white">
                {formatScheduleDateTime(endDate, toTimeLabel(endTime))}
              </span>.
            </p>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowSaveConfirmation(false)}
              >
                Cancel
              </Button>
              <Button type="button" onClick={() => void submitSave()}>
                Confirm Save
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {showCloseConfirmation ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950/95 p-6 shadow-2xl shadow-black/40">
            <p className="text-xs uppercase tracking-[0.28em] text-rose-400">
              Confirm Close
            </p>
            <h3 className="mt-3 text-2xl font-semibold text-white">
              Close Submissions Now?
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-300">
              This will immediately close the active submission window and clear the schedule.
            </p>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowCloseConfirmation(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-rose-600 text-white hover:bg-rose-500"
                onClick={() => void confirmCloseSubmission()}
              >
                Close Window
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
