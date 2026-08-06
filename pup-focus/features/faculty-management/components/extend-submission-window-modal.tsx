"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Clock, Calendar, AlertCircle, Loader2, CheckCircle2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ExtendSubmissionWindowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  currentEndDate?: string | null;
  currentEndTimeLabel?: string | null;
  academicYear?: string | null;
  semester?: string | null;
}

type ExtensionPreset = "+24 Hours" | "+48 Hours" | "+3 Days" | "+1 Week" | "Custom";
type ExtensionScope = "global" | "program" | "faculty";


const PROGRAM_OPTIONS = [
  { code: "BEED", name: "Bachelor of Elementary Education" },
  { code: "BSA", name: "Bachelor of Science in Accountancy" },
  { code: "BSMA", name: "Bachelor of Science in Management Accounting" },
  { code: "BSIE", name: "Bachelor of Science in Industrial Engineering" },
  { code: "BSIT", name: "Bachelor of Science in Information Technology" },
  { code: "BSBAHRM", name: "Bachelor of Science in Business Administration major in Human Resource Management" },
  { code: "BSEnt", name: "Bachelor of Science in Entrepreneurship" },
  { code: "DIT", name: "Diploma in Information Technology" },
  { code: "DOMT-LOM", name: "Diploma in Office Management Technology major in Legal Office Management" },
];

function parse12HourTime(timeLabel?: string | null): { hour24: number; minute: number } {
  if (!timeLabel) return { hour24: 17, minute: 0 };
  const match = timeLabel.trim().match(/^(0?[1-9]|1[0-2]):([0-5][0-9])\s?(AM|PM)$/i);
  if (!match) return { hour24: 17, minute: 0 };
  const hour12 = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2], 10);
  const period = match[3].toUpperCase();
  let hour24 = hour12;
  if (period === "AM") {
    if (hour12 === 12) hour24 = 0;
  } else if (hour12 !== 12) {
    hour24 = hour12 + 12;
  }
  return { hour24, minute };
}

function format24HourTo12HourString(hour24: number, minute: number): string {
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const minuteStr = minute.toString().padStart(2, "0");
  return `${hour12}:${minuteStr} ${period}`;
}

function getBaseDate(currentEndDate?: string | null, currentEndTimeLabel?: string | null): Date {
  if (currentEndDate && /^\d{4}-\d{2}-\d{2}$/.test(currentEndDate)) {
    const [y, m, d] = currentEndDate.split("-").map(Number);
    const { hour24, minute } = parse12HourTime(currentEndTimeLabel);
    const date = new Date(y, m - 1, d, hour24, minute);
    if (!Number.isNaN(date.getTime()) && date > new Date()) {
      return date;
    }
  }
  return new Date();
}

function formatDateToIsoString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateDisplay(dateIso: string, time12h: string): string {
  if (!dateIso) return "";
  const [y, m, d] = dateIso.split("-").map(Number);
  const dateObj = new Date(y, m - 1, d);
  if (Number.isNaN(dateObj.getTime())) return `${dateIso} ${time12h}`;

  const monthName = dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${monthName} at ${time12h}`;
}

export function ExtendSubmissionWindowModal({
  isOpen,
  onClose,
  onSuccess,
  currentEndDate,
  currentEndTimeLabel,
  academicYear,
  semester,
}: ExtendSubmissionWindowModalProps) {
  const [scope, setScope] = useState<ExtensionScope>("global");
  const [scopeTarget, setScopeTarget] = useState("BSIT");
  const [facultyNameInput, setFacultyNameInput] = useState("");
  const [preset, setPreset] = useState<ExtensionPreset>("+3 Days");
  
  const [customDate, setCustomDate] = useState("");
  const [customTime, setCustomTime] = useState("17:00");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if current window was closed/expired or unconfigured
  const isPreviouslyClosed = useMemo(() => {
    if (!currentEndDate) return true;
    const base = getBaseDate(currentEndDate, currentEndTimeLabel);
    return base <= new Date();
  }, [currentEndDate, currentEndTimeLabel]);

  // Compute new target date and time based on preset or custom input
  const computedTarget = useMemo(() => {
    const base = getBaseDate(currentEndDate, currentEndTimeLabel);
    const target = new Date(base);

    if (preset === "+24 Hours") {
      target.setHours(target.getHours() + 24);
    } else if (preset === "+48 Hours") {
      target.setHours(target.getHours() + 48);
    } else if (preset === "+3 Days") {
      target.setDate(target.getDate() + 3);
    } else if (preset === "+1 Week") {
      target.setDate(target.getDate() + 7);
    } else if (preset === "Custom" && customDate) {
      const [y, m, d] = customDate.split("-").map(Number);
      const [h, min] = customTime.split(":").map(Number);
      if (!Number.isNaN(y) && !Number.isNaN(m) && !Number.isNaN(d)) {
        target.setFullYear(y, m - 1, d);
        target.setHours(h || 17, min || 0);
      }
    }

    const dateIso = formatDateToIsoString(target);
    const time12h = format24HourTo12HourString(target.getHours(), target.getMinutes());

    return {
      dateIso,
      time12h,
      time24h: `${String(target.getHours()).padStart(2, "0")}:${String(target.getMinutes()).padStart(2, "0")}:00`,
      display: formatDateDisplay(dateIso, time12h),
    };
  }, [currentEndDate, currentEndTimeLabel, preset, customDate, customTime]);

  // Set initial custom date picker values on open
  useEffect(() => {
    if (isOpen) {
      const base = getBaseDate(currentEndDate, currentEndTimeLabel);
      base.setDate(base.getDate() + 3);
      setCustomDate(formatDateToIsoString(base));
      setCustomTime(`${String(base.getHours()).padStart(2, "0")}:${String(base.getMinutes()).padStart(2, "0")}`);
      setError(null);
    }
  }, [isOpen, currentEndDate, currentEndTimeLabel]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (scope === "faculty" && !facultyNameInput.trim()) {
      setError("Please specify the faculty member's name or ID.");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        scope,
        scopeTarget:
          scope === "global"
            ? "All Faculty"
            : scope === "program"
            ? scopeTarget
            : facultyNameInput.trim(),
        preset,
        newEndDate: computedTarget.dateIso,
        newEndTime: computedTarget.time12h,
      };

      const response = await fetch("/api/admin/submission-window/extend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(body.error || `Failed to extend submission window (HTTP ${response.status}).`);
        return;
      }

      onSuccess(body.message || `Submission window extended to ${computedTarget.display}.`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error submitting window extension request.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-400" />
              <h3 className="text-lg font-bold text-slate-100">Extend & Re-open Submission Window</h3>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Grant a deadline extension for{" "}
              <span className="font-semibold text-slate-300">
                {academicYear && semester ? `${academicYear} • ${semester}` : "Active Term"}
              </span>.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-900 hover:text-slate-200 transition"
          >
            ✕
          </button>
        </div>

        {error ? (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-950/30 p-3 text-xs text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Section 1: Extension Scope */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
              1. Extension Scope
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setScope("global")}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium transition ${
                  scope === "global"
                    ? "border-amber-500/50 bg-amber-500/10 text-amber-300"
                    : "border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700"
                }`}
              >
                <span className="font-semibold">Global</span>
                <span className="text-[10px] text-slate-400 mt-0.5">All Faculty</span>
              </button>

              <button
                type="button"
                onClick={() => setScope("program")}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium transition ${
                  scope === "program"
                    ? "border-amber-500/50 bg-amber-500/10 text-amber-300"
                    : "border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700"
                }`}
              >
                <span className="font-semibold">By Program</span>
                <span className="text-[10px] text-slate-400 mt-0.5">Specific Dept</span>
              </button>

              <button
                type="button"
                onClick={() => setScope("faculty")}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium transition ${
                  scope === "faculty"
                    ? "border-amber-500/50 bg-amber-500/10 text-amber-300"
                    : "border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700"
                }`}
              >
                <span className="font-semibold">Specific Faculty</span>
                <span className="text-[10px] text-slate-400 mt-0.5">Individual Waiver</span>
              </button>
            </div>

            {scope === "program" && (
              <div className="mt-2.5">
                <select
                  value={scopeTarget}
                  onChange={(e) => setScopeTarget(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 p-2.5 text-xs text-slate-200 outline-none focus:border-amber-500/50"
                >
                  {PROGRAM_OPTIONS.map((prog) => (
                    <option key={prog.code} value={prog.code}>
                      {prog.code} ({prog.name})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {scope === "faculty" && (
              <div className="mt-2.5">
                <input
                  type="text"
                  placeholder="Enter faculty name or ID..."
                  value={facultyNameInput}
                  onChange={(e) => setFacultyNameInput(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 p-2.5 text-xs text-slate-200 outline-none focus:border-amber-500/50 placeholder:text-slate-500"
                />
              </div>
            )}
          </div>

          {/* Section 2: Quick Presets */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
              2. Extension Duration (Presets)
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {(["+24 Hours", "+48 Hours", "+3 Days", "+1 Week", "Custom"] as ExtensionPreset[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPreset(p)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                    preset === p
                      ? "border-amber-500 bg-amber-500/20 text-amber-300 shadow-sm"
                      : "border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-slate-300"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            {preset === "Custom" && (
              <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    New Target End Date
                  </label>
                  <input
                    type="date"
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2 text-xs text-slate-200 outline-none focus:border-amber-500/50"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    New Target End Time
                  </label>
                  <input
                    type="time"
                    value={customTime}
                    onChange={(e) => setCustomTime(e.target.value)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2 text-xs text-slate-200 outline-none focus:border-amber-500/50"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Live Preview Card with Re-opening Status Badge */}
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <Calendar className="h-4 w-4 text-amber-400 shrink-0" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium text-amber-300/80 uppercase tracking-wider block">
                    New Extended Deadline Preview
                  </span>
                  {isPreviouslyClosed && (
                    <span className="inline-flex items-center gap-1 rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/40">
                      <RefreshCw className="h-2.5 w-2.5" />
                      Status: Re-opening Closed Window
                    </span>
                  )}
                </div>
                <span className="text-sm font-bold text-amber-300">{computedTarget.display}</span>
              </div>
            </div>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {preset}
            </span>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-slate-800 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isSubmitting}
              className="bg-slate-900 border border-slate-800 text-slate-300 hover:text-slate-100 text-xs"
            >
              Cancel
            </Button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl px-5 py-2.5 transition flex items-center gap-2 shadow-lg disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Extending Window...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Confirm & Extend Window
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

