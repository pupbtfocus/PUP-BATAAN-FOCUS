"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Archive,
  Page,
  Refresh,
  Search,
  SystemRestart,
  WarningCircle,
} from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";
import { ModalHeader } from "@/components/ui/modal-header";
import { SubmissionStatusBadge } from "@/features/submissions/components/submission-status-badge";
import type { HistoricalSubmissionItem } from "@/app/api/admin/academic-terms/submissions/route";

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
  const [selectedTermKey, setSelectedTermKey] = useState<string>(
    initialAcademicYear && initialSemester
      ? `${initialAcademicYear}|${initialSemester}`
      : "all",
  );
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [submissions, setSubmissions] = useState<HistoricalSubmissionItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialAcademicYear && initialSemester) {
      setSelectedTermKey(`${initialAcademicYear}|${initialSemester}`);
    }
  }, [initialAcademicYear, initialSemester]);

  useEffect(() => {
    if (isOpen) {
      void fetchSubmissions();
    }
  }, [isOpen, selectedTermKey, statusFilter]);

  async function fetchSubmissions() {
    setIsLoading(true);
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

      const res = await fetch(
        `/api/admin/academic-terms/submissions?${params.toString()}`,
        { credentials: "include" },
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load historical submissions.");
      }

      setSubmissions(Array.isArray(data.submissions) ? data.submissions : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load submissions.");
    } finally {
      setIsLoading(false);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 sm:p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="flex h-[92vh] w-[96vw] max-w-[1550px] flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden dark:border-slate-800 dark:bg-slate-900">
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
          onClose={onClose}
        />

        {/* Filter Toolbar */}
        <div className="border-b border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Term Selector */}
            <div className="flex items-center gap-2">
              <label
                htmlFor="historicalTermSelect"
                className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
              >
                Term:
              </label>
              <select
                id="historicalTermSelect"
                value={selectedTermKey}
                onChange={(e) => setSelectedTermKey(e.target.value)}
                className="h-8 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 outline-none focus:border-amber-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
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
            <div className="flex items-center gap-2">
              <label
                htmlFor="historicalStatusSelect"
                className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
              >
                Status:
              </label>
              <select
                id="historicalStatusSelect"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-8 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 outline-none focus:border-amber-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <option value="all">All Statuses</option>
                <option value="validated">Validated</option>
                <option value="pending">Pending</option>
                <option value="rejected">Needs Revision</option>
              </select>
            </div>

            {/* Search Input */}
            <div className="relative min-w-[200px] flex-1 max-w-xs">
              <input
                type="text"
                placeholder="Search faculty or requirement..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-amber-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
              <Search className="absolute left-2.5 top-2 h-4 w-4 text-slate-400" />
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => void fetchSubmissions()}
              disabled={isLoading}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-750 cursor-pointer"
            >
              <AppIcon icon={Refresh} size="xs" color="inherit" className={isLoading ? "animate-spin" : ""} />
              <span>Refresh</span>
            </button>
          </div>

          {/* Read-Only or Active Status Notice Badge */}
          <div
            className={`mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg px-4 py-2 text-xs font-semibold shadow-xs ${
              isCurrentTerm
                ? "bg-[#0b5336] text-white border border-[#08412a]"
                : "bg-[#b45309] text-white border border-[#92400e]"
            }`}
          >
            <span className="flex items-center gap-2">
              {isCurrentTerm ? (
                <>
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-300 animate-pulse" />
                  <span>
                    Current Active Term: Submissions can be actively reviewed and evaluated in Requirements Verification.
                  </span>
                </>
              ) : (
                <span>
                  Read-Only Mode: Historical submissions are preserved for auditing and browsing.
                </span>
              )}
            </span>
            <div className="flex items-center gap-3">
              {isCurrentTerm && (
                <a
                  href={
                    typeof window !== "undefined" && window.location.pathname.startsWith("/super-admin")
                      ? "/super-admin/dashboard?tab=verification"
                      : "/admin/dashboard?tab=requirements"
                  }
                  className="font-bold underline text-amber-200 hover:text-white inline-flex items-center gap-1 transition-colors"
                >
                  <span>Go to Requirements Verification →</span>
                </a>
              )}
              <span className="font-bold bg-black/20 px-2.5 py-0.5 rounded-full text-white">
                Total: {filteredSubmissions.length} records
              </span>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-white dark:bg-slate-900">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center text-slate-500 dark:text-slate-400">
              <AppIcon icon={SystemRestart} size="lg" color="inherit" className="animate-spin mr-2" />
              <span className="text-sm font-semibold">Loading submissions...</span>
            </div>
          ) : error ? (
            <div className="flex h-64 items-center justify-center">
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-center text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300 max-w-md">
                <AppIcon icon={WarningCircle} size="md" color="default" className="mx-auto mb-2 text-rose-500" />
                <p className="font-semibold">{error}</p>
              </div>
            </div>
          ) : filteredSubmissions.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center text-slate-500 dark:text-slate-400">
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
                    typeof window !== "undefined" && window.location.pathname.startsWith("/super-admin")
                      ? "/super-admin/dashboard?tab=verification"
                      : "/admin/dashboard?tab=requirements"
                  }
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#0b5336] hover:bg-[#073d2a] text-white border border-[#08412a] px-4 py-2 text-xs font-semibold shadow-xs transition-all cursor-pointer"
                >
                  <span>Open Requirements Verification</span>
                </a>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-950">
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
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3 dark:border-slate-800 dark:bg-slate-950">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {isCurrentTerm ? "Active Academic Term Records" : "Read-only Historical Term Archive"}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[#800000] hover:bg-[#6c0000] text-white px-5 py-1.5 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
