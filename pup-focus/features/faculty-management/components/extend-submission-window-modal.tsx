"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Calendar, Check, CheckCircle, Hourglass, NavArrowDown, Refresh, Search, SystemRestart, User, WarningCircle, Xmark } from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";
import { ModalHeader } from "@/components/ui/modal-header";
import { Button } from "@/components/ui/button";

export interface FacultyOption {
  id: string;
  userId?: string | null;
  fullName: string;
  email: string;
  programCode?: string;
  programName?: string;
}

export interface ExtendSubmissionWindowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  currentEndDate?: string | null;
  currentEndTimeLabel?: string | null;
  academicYear?: string | null;
  semester?: string | null;
  initialScope?: ExtensionScope;
  initialScopeTarget?: string;
  initialFacultyName?: string;
  initialPreset?: ExtensionPreset;
  linkedRequestId?: string | null;
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

function getInitials(name?: string | null): string {
  if (!name) return "FM";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

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
  initialScope,
  initialScopeTarget,
  initialFacultyName,
  initialPreset,
  linkedRequestId,
}: ExtendSubmissionWindowModalProps) {
  const [scope, setScope] = useState<ExtensionScope>(initialScope || "global");
  const [scopeTarget, setScopeTarget] = useState(initialScopeTarget || "BSIT");
  const [facultyNameInput, setFacultyNameInput] = useState(initialFacultyName || "");
  const [preset, setPreset] = useState<ExtensionPreset>(initialPreset || "+3 Days");

  const [customDate, setCustomDate] = useState("");
  const [customTime, setCustomTime] = useState("17:00");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Faculty searchable dropdown state
  const [facultyList, setFacultyList] = useState<FacultyOption[]>([]);
  const [isLoadingFaculty, setIsLoadingFaculty] = useState(false);
  const [selectedFaculty, setSelectedFaculty] = useState<FacultyOption | null>(null);
  const [facultySearchQuery, setFacultySearchQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch faculty list when modal opens
  useEffect(() => {
    if (isOpen) {
      setIsLoadingFaculty(true);
      fetch(`/api/admin/faculty/list?_t=${Date.now()}`)
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data.faculty)) {
            const mapped: FacultyOption[] = data.faculty.map((f: any) => ({
              id: f.id,
              userId: f.user_id,
              fullName: f.fullName || "Unknown Faculty",
              email: f.email || "",
              programCode: f.program?.code || f.department || "FACULTY",
              programName: f.program?.name || "",
            }));
            setFacultyList(mapped);

            // Auto-select if initialFacultyName matches
            const targetName = initialFacultyName || facultyNameInput;
            if (targetName) {
              const cleanTarget = targetName.trim().toLowerCase();
              const found = mapped.find(
                (item) =>
                  item.fullName.toLowerCase() === cleanTarget ||
                  item.fullName.toLowerCase().includes(cleanTarget)
              );
              if (found) {
                setSelectedFaculty(found);
                setFacultyNameInput(found.fullName);
              }
            }
          }
        })
        .catch(() => {})
        .finally(() => setIsLoadingFaculty(false));
    }
  }, [isOpen, initialFacultyName]);

  // Filtered faculty list based on search query
  const filteredFaculty = useMemo(() => {
    if (!facultySearchQuery.trim()) return facultyList;
    const q = facultySearchQuery.toLowerCase().trim();
    return facultyList.filter(
      (f) =>
        f.fullName.toLowerCase().includes(q) ||
        f.email.toLowerCase().includes(q) ||
        (f.programCode || "").toLowerCase().includes(q)
    );
  }, [facultyList, facultySearchQuery]);

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
      if (initialScope) setScope(initialScope);
      if (initialScopeTarget) setScopeTarget(initialScopeTarget);
      if (initialFacultyName) setFacultyNameInput(initialFacultyName);
      if (initialPreset) setPreset(initialPreset);
      const base = getBaseDate(currentEndDate, currentEndTimeLabel);
      base.setDate(base.getDate() + 3);
      setCustomDate(formatDateToIsoString(base));
      setCustomTime(`${String(base.getHours()).padStart(2, "0")}:${String(base.getMinutes()).padStart(2, "0")}`);
      setError(null);
    }
  }, [isOpen, currentEndDate, currentEndTimeLabel, initialScope, initialScopeTarget, initialFacultyName, initialPreset]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const targetFaculty = selectedFaculty ? selectedFaculty.fullName : facultyNameInput.trim();
    if (scope === "faculty" && !targetFaculty) {
      setError("Please select or specify a faculty member.");
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
            : targetFaculty,
        preset,
        newEndDate: computedTarget.dateIso,
        newEndTime: computedTarget.time12h,
        linkedRequestId: linkedRequestId || null,
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

      if (linkedRequestId) {
        try {
          await fetch("/api/admin/submission-window/extension-requests", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              requestId: linkedRequestId,
              action: "approve",
              adminRemarks: `Window extended (${preset}) until ${computedTarget.display}`,
            }),
          });
        } catch {
          // Non-blocking
        }
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto text-slate-900 dark:text-slate-100">
        {/* Header */}
        <ModalHeader
          icon={Hourglass}
          title="Extend & Re-open Submission Window"
          subtitle={`Grant a deadline extension for ${academicYear && semester ? `${academicYear} • ${semester}` : "Active Term"}.`}
        />

        {error ? (
          <div className="flex items-center gap-2 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 p-3 text-xs text-rose-700 dark:text-rose-400">
            <AppIcon icon={WarningCircle} size="md" color="danger" />
            <span>{error}</span>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Section 1: Extension Scope */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              1. Extension Scope
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setScope("global")}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium transition cursor-pointer ${
                  scope === "global"
                    ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900 font-bold shadow-xs"
                    : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-slate-700 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
                }`}
              >
                <span className="font-semibold">Global</span>
                <span className={`text-[10px] mt-0.5 ${scope === "global" ? "text-slate-300 dark:text-slate-600" : "text-slate-500 dark:text-slate-400"}`}>All Faculty</span>
              </button>

              <button
                type="button"
                onClick={() => setScope("program")}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium transition cursor-pointer ${
                  scope === "program"
                    ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900 font-bold shadow-xs"
                    : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-slate-700 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
                }`}
              >
                <span className="font-semibold">By Program</span>
                <span className={`text-[10px] mt-0.5 ${scope === "program" ? "text-slate-300 dark:text-slate-600" : "text-slate-500 dark:text-slate-400"}`}>Specific Dept</span>
              </button>

              <button
                type="button"
                onClick={() => setScope("faculty")}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium transition cursor-pointer ${
                  scope === "faculty"
                    ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900 font-bold shadow-xs"
                    : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-slate-700 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
                }`}
              >
                <span className="font-semibold">Specific Faculty</span>
                <span className={`text-[10px] mt-0.5 ${scope === "faculty" ? "text-slate-300 dark:text-slate-600" : "text-slate-500 dark:text-slate-400"}`}>Individual Waiver</span>
              </button>
            </div>

            {scope === "program" && (
              <div className="mt-2.5">
                <select
                  value={scopeTarget}
                  onChange={(e) => setScopeTarget(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-slate-400 dark:focus:border-slate-600"
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
              <div className="mt-2.5 space-y-2" ref={dropdownRef}>
                {selectedFaculty ? (
                  /* Selected Faculty Card */
                  <div className="flex items-center justify-between rounded-xl border border-amber-500/40 bg-amber-500/10 dark:bg-amber-500/15 p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-amber-500 text-slate-950 font-bold flex items-center justify-center text-xs shrink-0 shadow-xs">
                        {getInitials(selectedFaculty.fullName)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                            {selectedFaculty.fullName}
                          </span>
                          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300 border border-amber-500/30">
                            {selectedFaculty.programCode}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {selectedFaculty.email}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFaculty(null);
                        setFacultyNameInput("");
                        setFacultySearchQuery("");
                        setIsDropdownOpen(true);
                      }}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-[#780000] text-[#780000] hover:bg-[#780000] hover:text-white transition cursor-pointer shrink-0"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  /* Search & Dropdown Combobox */
                  <div className="relative">
                    <div className="relative flex items-center">
                      <AppIcon icon={Search} size="md" color="muted" />
                      <input
                        type="text"
                        placeholder="Search faculty by name, email, or department..."
                        value={facultySearchQuery}
                        onChange={(e) => {
                          setFacultySearchQuery(e.target.value);
                          setIsDropdownOpen(true);
                        }}
                        onFocus={() => setIsDropdownOpen(true)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-9 pr-8 py-2.5 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-amber-500 dark:focus:border-amber-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                      />
                      {facultySearchQuery ? (
                        <button
                          type="button"
                          onClick={() => setFacultySearchQuery("")}
                          className="absolute right-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-0.5 cursor-pointer"
                        >
                          <AppIcon icon={Xmark} size="sm" color="inherit" />
                        </button>
                      ) : (
                        <AppIcon icon={NavArrowDown} size="sm" color="muted" />
                      )}
                    </div>

                    {isDropdownOpen && (
                      <div className="absolute z-20 mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-1.5 shadow-xl space-y-1">
                        <div className="flex items-center justify-between px-2.5 py-1 text-[10px] font-semibold text-slate-400 border-b border-slate-100 dark:border-slate-800/80">
                          <span>
                            {isLoadingFaculty
                              ? "Loading faculty..."
                              : `${filteredFaculty.length} faculty members available`}
                          </span>
                          <span>Click to select</span>
                        </div>

                        <div className="max-h-52 overflow-y-auto space-y-0.5 pr-1">
                          {isLoadingFaculty ? (
                            <div className="flex items-center justify-center gap-2 py-6 text-xs text-slate-400">
                              <AppIcon icon={SystemRestart} size="sm" color="inherit" className="animate-spin" />
                              <span>Loading faculty members...</span>
                            </div>
                          ) : filteredFaculty.length === 0 ? (
                            <div className="py-4 text-center text-xs text-slate-500 dark:text-slate-400 space-y-2">
                              <p>No faculty found matching &ldquo;{facultySearchQuery}&rdquo;</p>
                              {facultySearchQuery.trim() && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFacultyNameInput(facultySearchQuery.trim());
                                    setIsDropdownOpen(false);
                                  }}
                                  className="text-xs text-amber-600 dark:text-amber-400 font-semibold underline cursor-pointer"
                                >
                                  Use custom name &ldquo;{facultySearchQuery.trim()}&rdquo;
                                </button>
                              )}
                            </div>
                          ) : (
                            filteredFaculty.map((f) => (
                              <button
                                key={f.id}
                                type="button"
                                onClick={() => {
                                  setSelectedFaculty(f);
                                  setFacultyNameInput(f.fullName);
                                  setFacultySearchQuery("");
                                  setIsDropdownOpen(false);
                                }}
                                className="w-full flex items-center justify-between p-2 rounded-lg text-left hover:bg-slate-100 dark:hover:bg-slate-900 transition cursor-pointer group"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold flex items-center justify-center text-[10px] shrink-0 group-hover:bg-amber-500 group-hover:text-slate-950 transition-colors">
                                    {getInitials(f.fullName)}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                                        {f.fullName}
                                      </span>
                                      <span className="rounded bg-slate-100 dark:bg-slate-800 px-1 py-0.2 text-[9px] font-semibold text-slate-600 dark:text-slate-400">
                                        {f.programCode}
                                      </span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                                      {f.email}
                                    </p>
                                  </div>
                                </div>
                                <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                  Select
                                </span>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 2: Quick Presets */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              2. Extension Duration (Presets)
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {(["+24 Hours", "+48 Hours", "+3 Days", "+1 Week", "Custom"] as ExtensionPreset[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPreset(p)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                    preset === p
                      ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900 font-semibold shadow-xs"
                      : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-slate-700 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            {preset === "Custom" && (
              <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    New Target End Date
                  </label>
                  <input
                    type="date"
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-2 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-slate-400 dark:focus:border-slate-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    New Target End Time
                  </label>
                  <input
                    type="time"
                    value={customTime}
                    onChange={(e) => setCustomTime(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-2 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-slate-400 dark:focus:border-slate-600"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Live Preview Card with Re-opening Status Badge */}
          <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-3.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <AppIcon icon={Calendar} size="md" color="default" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                    New Extended Deadline Preview
                  </span>
                  {isPreviouslyClosed && (
                    <span className="inline-flex items-center gap-1 rounded bg-slate-200/80 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                      <AppIcon icon={Refresh} size="md" color="inherit" />
                      Status: Re-opening Closed Window
                    </span>
                  )}
                </div>
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100 font-mono">{computedTarget.display}</span>
              </div>
            </div>
            <span className="text-xs font-medium px-2.5 py-0.5 rounded-md bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
              {preset}
            </span>
          </div>

          {/* Completed Accounts Protection Notice */}
          <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 dark:border-emerald-950/60 bg-emerald-50/70 dark:bg-emerald-950/20 p-3 text-xs text-emerald-900 dark:text-emerald-300">
            <AppIcon icon={CheckCircle} size="md" color="success" className="mt-0.5" />
            <p className="leading-relaxed">
              <span className="font-semibold">Completed Accounts Protected:</span> Accounts that have already completed and validated all requirements will remain completed. Extending the submission window applies only to faculty with pending or lacking requirements.
            </p>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] px-3.5 py-2 text-sm font-semibold rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2 text-sm font-semibold rounded-lg transition-colors shadow-xs flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <AppIcon icon={SystemRestart} size="sm" color="inherit" className="text-slate-950 animate-spin" />
                  Extending Window...
                </>
              ) : (
                <>
                  <AppIcon icon={CheckCircle} size="sm" color="inherit" className="text-slate-950" />
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

