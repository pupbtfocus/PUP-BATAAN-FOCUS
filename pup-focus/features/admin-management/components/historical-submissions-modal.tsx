"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Archive,
  OpenNewWindow,
  Page,
  Refresh,
  Search,
  SystemRestart,
} from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";
import { ModalHeader } from "@/components/ui/modal-header";
import { AlertPopup } from "@/components/ui/alert-popup";
import { SubmissionStatusBadge } from "@/features/submissions/components/submission-status-badge";
import type { HistoricalSubmissionItem } from "@/app/api/staff/academic-terms/submissions/route";

const historicalSubmissionsCache: Record<string, HistoricalSubmissionItem[]> = {};

export async function prefetchHistoricalSubmissions(termKey = "all", status = "all") {
  const cacheKey = `${termKey}::${status}`;
  if (historicalSubmissionsCache[cacheKey]) return;
  try {
    const params = new URLSearchParams();
    if (termKey !== "all") {
      const [ay, sem] = termKey.split("|");
      if (ay) params.set("academicYear", ay);
      if (sem) params.set("semester", sem);
    }
    if (status !== "all") {
      params.set("status", status);
    }
    const res = await fetch(`/api/staff/academic-terms/submissions?${params.toString()}`, {
      credentials: "include",
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.submissions)) {
        historicalSubmissionsCache[cacheKey] = data.submissions;
      }
    }
  } catch {}
}

interface HistoricalSubmissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialAcademicYear?: string;
  initialSemester?: string;
  allTerms: Array<{ academicYear: string; semester: string; status: string }>;
}

export function HistoricalSubmissionsModal({
  isOpen,
  onClose,
  initialAcademicYear,
  initialSemester,
  allTerms,
}: HistoricalSubmissionsModalProps) {
  const initialKey =
    initialAcademicYear && initialSemester
      ? `${initialAcademicYear}|${initialSemester}`
      : "all";
  const [selectedTermKey, setSelectedTermKey] = useState<string>(initialKey);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const currentCacheKey = `${selectedTermKey}::${statusFilter}`;
  const [submissions, setSubmissions] = useState<HistoricalSubmissionItem[]>(() => {
    return historicalSubmissionsCache[currentCacheKey] || [];
  });
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    return !historicalSubmissionsCache[currentCacheKey];
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialAcademicYear && initialSemester) {
      const nextKey = `${initialAcademicYear}|${initialSemester}`;
      setSelectedTermKey(nextKey);
      const nextCacheKey = `${nextKey}::${statusFilter}`;
      if (historicalSubmissionsCache[nextCacheKey]) {
        setSubmissions(historicalSubmissionsCache[nextCacheKey]);
        setIsLoading(false);
      }
    }
  }, [initialAcademicYear, initialSemester, statusFilter]);

  useEffect(() => {
    if (isOpen) {
      void fetchSubmissions();
    }
  }, [isOpen, selectedTermKey, statusFilter]);

  async function fetchSubmissions(options?: { silent?: boolean }) {
    const key = `${selectedTermKey}::${statusFilter}`;
    const cached = historicalSubmissionsCache[key];
    if (cached) {
      setSubmissions(cached);
    }
    const isSilent = options?.silent ?? Boolean(cached);
    if (!isSilent) {
      setIsLoading(true);
    }
    setError(null);

    try {
      const params = new URLSearchParams();
      if (selectedTermKey !== "all") {
        const [ay, sem] = selectedTermKey.split("|");
        if (ay) params.set("academicYear", ay);
        if (sem) params.set("semester", sem);
      }
      if (statusFilter !== "all") {
        params.set("status", statusFilter);
      }

      params.set("_t", String(Date.now()));
      const res = await fetch(
        `/api/staff/academic-terms/submissions?${params.toString()}`,
        { credentials: "include", cache: "no-store" },
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load historical submissions.");
      }

      const nextSubs = Array.isArray(data.submissions) ? data.submissions : [];
      historicalSubmissionsCache[key] = nextSubs;
      setSubmissions(nextSubs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load submissions.");
    } finally {
      if (!isSilent) {
        setIsLoading(false);
      }
    }
  }

  const selectedTermObj = useMemo(() => {
    if (selectedTermKey === "all") return null;
    const [ay, sem] = selectedTermKey.split("|");
    return allTerms.find(
      (t) => t.academicYear === ay && t.semester === sem,
    );
  }, [selectedTermKey, allTerms]);

  const isCurrentTerm = selectedTermObj?.status === "Current";

  const filteredSubmissions = useMemo(() => {
    if (!searchQuery.trim()) return submissions;
    const q = searchQuery.toLowerCase().trim();
    return submissions.filter(
      (s) =>
        s.facultyName.toLowerCase().includes(q) ||
        s.facultyEmail.toLowerCase().includes(q) ||
        s.programCode.toLowerCase().includes(q) ||
        s.requirementTitle.toLowerCase().includes(q) ||
        s.requirementCode.toLowerCase().includes(q) ||
        (s.facultyRemarks && s.facultyRemarks.toLowerCase().includes(q)) ||
        (s.adminRemarks && s.adminRemarks.toLowerCase().includes(q)),
    );
  }, [submissions, searchQuery]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[70] flex h-dvh w-screen flex-col bg-white overflow-hidden overscroll-none dark:bg-slate-900 animate-in fade-in duration-200"
    >
      <div className="flex h-full w-full flex-col overflow-hidden bg-white dark:bg-slate-900">
        <ModalHeader
          title={
            isCurrentTerm
              ? "Current Academic Term Submissions"
              : "Past Academic Term Submissions"
          }
          subtitle={
            isCurrentTerm
              ? `Submissions under the active academic term (${selectedTermObj?.academicYear} • ${selectedTermObj?.semester}). Submissions can also be reviewed and verified in Requirements Verification.`
              : "Read-only historical archive of submissions from past inactive academic terms."
          }
          icon={isCurrentTerm ? Page : Archive}
        />

        {/* Filter Toolbar */}
        <div className="border-b border-slate-200 bg-slate-50/70 p-3.5 sm:p-4 dark:border-slate-800 dark:bg-slate-950/40">
          <div className="grid grid-cols-1 sm:flex sm:flex-wrap sm:items-center gap-2.5 sm:gap-3">
            {/* Term Selector */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 min-w-0">
              <label
                htmlFor="historicalTermSelect"
                className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 shrink-0"
              >
                Term:
              </label>
              <select
                id="historicalTermSelect"
                value={selectedTermKey}
                onChange={(e) => {
                  const newTerm = e.target.value;
                  setSelectedTermKey(newTerm);
                  const cacheKey = `${newTerm}::${statusFilter}`;
                  if (historicalSubmissionsCache[cacheKey]) {
                    setSubmissions(historicalSubmissionsCache[cacheKey]);
                    setIsLoading(false);
                  }
                }}
                className="h-9 sm:h-8 w-full sm:w-auto min-w-0 max-w-full rounded-lg border border-slate-300 bg-white px-2.5 sm:px-3 text-xs font-semibold text-slate-800 outline-none focus:border-amber-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 truncate"
              >
                <option value="all">All Terms (Archive & Current)</option>
                {allTerms.map((t) => (
                  <option
                    key={`${t.academicYear}|${t.semester}`}
                    value={`${t.academicYear}|${t.semester}`}
                  >
                    {t.academicYear} • {t.semester} {t.status === "Current" ? "(Current Active Term)" : `(${t.status})`}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Selector */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 min-w-0">
              <label
                htmlFor="historicalStatusSelect"
                className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 shrink-0"
              >
                Status:
              </label>
              <select
                id="historicalStatusSelect"
                value={statusFilter}
                onChange={(e) => {
                  const newStatus = e.target.value;
                  setStatusFilter(newStatus);
                  const cacheKey = `${selectedTermKey}::${newStatus}`;
                  if (historicalSubmissionsCache[cacheKey]) {
                    setSubmissions(historicalSubmissionsCache[cacheKey]);
                    setIsLoading(false);
                  }
                }}
                className="h-9 sm:h-8 w-full sm:w-auto min-w-0 rounded-lg border border-slate-300 bg-white px-2.5 sm:px-3 text-xs font-semibold text-slate-800 outline-none focus:border-amber-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <option value="all">All Statuses</option>
                <option value="validated">Validated</option>
                <option value="pending">Pending</option>
                <option value="rejected">Needs Revision</option>
              </select>
            </div>

            {/* Search Input & Refresh */}
            <div className="flex items-center gap-2 w-full sm:w-auto sm:flex-1 sm:max-w-sm">
              <div className="relative flex-1 min-w-0">
                <input
                  type="text"
                  placeholder="Search faculty or requirement..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 sm:h-8 w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-amber-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                />
                <Search className="absolute left-2.5 top-2.5 sm:top-2 h-4 w-4 text-slate-400" />
              </div>

              <button
                type="button"
                onClick={() => void fetchSubmissions()}
                disabled={isLoading}
                className="inline-flex h-9 sm:h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-750 cursor-pointer"
              >
                <AppIcon icon={Refresh} size="xs" color="inherit" className={isLoading ? "animate-spin" : ""} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Read-Only or Active Status Notice Badge */}
          <div
            className={`mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg px-3.5 sm:px-4 py-2.5 text-xs font-semibold shadow-xs ${
              isCurrentTerm
                ? "bg-[#0b5336] text-white border border-[#08412a]"
                : "bg-[#b45309] text-white border border-[#92400e]"
            }`}
          >
            <span className="flex items-start sm:items-center gap-2 min-w-0">
              {isCurrentTerm ? (
                <>
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-300 animate-pulse shrink-0 mt-1 sm:mt-0" />
                  <span className="leading-relaxed">
                    Current Active Term: Submissions can be actively reviewed and evaluated in Requirements Verification.
                  </span>
                </>
              ) : (
                <span className="leading-relaxed">
                  Read-Only Mode: Historical submissions are preserved for auditing and browsing.
                </span>
              )}
            </span>
            <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 sm:gap-3 shrink-0">
              {isCurrentTerm && (
                <a
                  href={
                    typeof window !== "undefined" &&
                    (window.location.pathname.startsWith("/admin") ||
                      window.location.pathname.startsWith("/super-admin"))
                      ? "/admin/dashboard?tab=verification"
                      : "/staff/dashboard?tab=requirements"
                  }
                  style={{ color: "#fef08a" }}
                  className="font-bold underline !text-amber-200 hover:!text-white text-amber-200 inline-flex items-center gap-1 transition-colors"
                >
                  <span style={{ color: "#fef08a" }} className="!text-amber-200 hover:!text-white">Go to Requirements Verification →</span>
                </a>
              )}
              <span className="font-bold bg-white/20 border border-white/25 px-2.5 py-0.5 rounded-full text-white shrink-0">
                Total: {filteredSubmissions.length} records
              </span>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 bg-white dark:bg-slate-900">
          {isLoading && filteredSubmissions.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-slate-500 dark:text-slate-400">
              <AppIcon icon={SystemRestart} size="lg" color="inherit" className="animate-spin mr-2" />
              <span className="text-sm font-semibold">Loading submissions...</span>
            </div>
          ) : error ? (
            <div className="flex h-64 items-center justify-center">
              <AlertPopup
                type="error"
                message={error}
                onClose={() => setError(null)}
                position="inline"
                autoCloseMs={5000}
              />
            </div>
          ) : filteredSubmissions.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center text-slate-500 dark:text-slate-400 px-4 text-center">
              <div
                className={`flex h-14 w-14 items-center justify-center rounded-2xl mb-3 ${
                  isCurrentTerm
                    ? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400"
                    : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
                }`}
              >
                {isCurrentTerm ? <Page className="h-7 w-7" /> : <Archive className="h-7 w-7" />}
              </div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                {isCurrentTerm
                  ? `No submissions found for the current active term (${selectedTermObj?.academicYear} • ${selectedTermObj?.semester}).`
                  : "No submissions found for the selected term criteria."}
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm text-center">
                {isCurrentTerm
                  ? "Faculty members have not submitted requirements for this active term yet. Once submitted, they will appear here and in Requirements Verification."
                  : "Try selecting a different academic term or adjusting your search filters."}
              </p>
              {isCurrentTerm && (
                <a
                  href={
                    typeof window !== "undefined" &&
                    (window.location.pathname.startsWith("/admin") ||
                      window.location.pathname.startsWith("/super-admin"))
                      ? "/admin/dashboard?tab=verification"
                      : "/staff/dashboard?tab=requirements"
                  }
                  style={{ color: "#ffffff" }}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#0b5336] hover:bg-[#073d2a] active:bg-[#052e1f] !text-white text-white border border-emerald-500/40 px-5 py-2.5 text-xs font-bold shadow-md transition-all cursor-pointer hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
                >
                  <AppIcon icon={OpenNewWindow} size="sm" color="white" className="shrink-0 text-white !text-white" />
                  <span style={{ color: "#ffffff" }} className="!text-white text-white font-bold tracking-wide">
                    Open Requirements Verification
                  </span>
                </a>
              )}
            </div>
          ) : (
            <>
              {/* Mobile Card View (< md) */}
              <div className="md:hidden space-y-2.5">
                {filteredSubmissions.map((sub) => (
                  <div
                    key={`mobile-${sub.id}`}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-3.5 space-y-2.5 shadow-xs"
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                          {sub.facultyName}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 break-all">
                          {sub.facultyEmail}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        {sub.programCode || "—"}
                      </span>
                    </div>

                    <div className="rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800/80 p-2.5 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          {sub.requirementTitle}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono">
                          {sub.requirementCode}
                        </p>
                      </div>
                      <div className="shrink-0">
                        <SubmissionStatusBadge status={sub.status} />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <span>Submitted At:</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {sub.submittedAt
                          ? new Date(sub.submittedAt).toLocaleDateString("en-PH", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                              hour12: true,
                            })
                          : "—"}
                      </span>
                    </div>

                    {(sub.adminRemarks || sub.facultyRemarks) && (
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-1 text-[11px]">
                        {sub.adminRemarks && (
                          <p className="text-slate-600 dark:text-slate-400">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">Admin:</span>{" "}
                            {sub.adminRemarks}
                          </p>
                        )}
                        {sub.facultyRemarks && (
                          <p className="text-slate-600 dark:text-slate-300 italic">
                            <span className="font-semibold not-italic text-slate-700 dark:text-slate-300">Faculty:</span>{" "}
                            {sub.facultyRemarks}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop Table View (>= md) */}
              <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-950">
                <table className="w-full text-left text-xs table-auto">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-400">
                      <th className="px-4 py-3.5 whitespace-nowrap min-w-[220px]">Faculty Member</th>
                      <th className="px-3 py-3.5 whitespace-nowrap min-w-[80px]">Program</th>
                      <th className="px-4 py-3.5 min-w-[240px]">Requirement</th>
                      <th className="px-3 py-3.5 whitespace-nowrap min-w-[130px]">Status</th>
                      <th className="px-4 py-3.5 whitespace-nowrap min-w-[150px]">Submitted At</th>
                      <th className="px-4 py-3.5 min-w-[160px]">Admin Remarks</th>
                      <th className="px-4 py-3.5 min-w-[160px]">Faculty Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {filteredSubmissions.map((sub) => (
                      <tr
                        key={sub.id}
                        className="hover:bg-slate-50/70 transition-colors dark:hover:bg-slate-900/50"
                      >
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900 dark:text-slate-100">
                            {sub.facultyName}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {sub.facultyEmail}
                          </p>
                        </td>
                        <td className="px-3 py-3 text-slate-700 dark:text-slate-300 font-medium">
                          {sub.programCode || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-800 dark:text-slate-200">
                            {sub.requirementTitle}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            {sub.requirementCode}
                          </p>
                        </td>
                        <td className="px-3 py-3">
                          <SubmissionStatusBadge status={sub.status} />
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {sub.submittedAt
                            ? new Date(sub.submittedAt).toLocaleDateString("en-PH", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                                hour12: true,
                              })
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400" title={sub.adminRemarks || ""}>
                          {sub.adminRemarks || "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300" title={sub.facultyRemarks || ""}>
                          {sub.facultyRemarks ? (
                            <span className="italic">{sub.facultyRemarks}</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 sm:px-6 py-3 dark:border-slate-800 dark:bg-slate-950">
          <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
            {isCurrentTerm ? "Active Academic Term Records" : "Read-only Historical Term Archive"}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg bg-[#800000] hover:bg-[#6c0000] text-white px-5 py-1.5 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
