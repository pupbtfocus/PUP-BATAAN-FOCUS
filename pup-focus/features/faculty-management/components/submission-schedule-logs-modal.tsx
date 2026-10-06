"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Calendar,
  CheckCircle,
  Clock,
  ClockRotateRight,
  Eye,
  Filter,
  NavArrowLeft,
  NavArrowRight,
  Refresh,
  Search,
  ShieldAlert,
  SystemRestart,
  User,
  UserPlus,
  WarningTriangle,
  Xmark,
} from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";
import { ModalHeader } from "@/components/ui/modal-header";
import type { SubmissionScheduleLogEntry } from "@/features/faculty-management/types/submission-schedule-logs.types";

export interface SubmissionScheduleLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  academicYear?: string;
  semester?: string;
}

function formatDate(isoDate?: string | null): string {
  if (!isoDate) return "N/A";
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

type ActionFilterType = "all" | "SCHEDULE_UPDATE" | "EXTENSION" | "FACULTY_ONBOARDING" | "SCHEDULE_CLOSE";

export function SubmissionScheduleLogsModal({
  isOpen,
  onClose,
  academicYear,
  semester,
}: SubmissionScheduleLogsModalProps) {
  const [logs, setLogs] = useState<SubmissionScheduleLogEntry[]>([]);
  const [activeTerm, setActiveTerm] = useState<{ academicYear: string; semester: string } | null>(null);
  const [currentSchedule, setCurrentSchedule] = useState<{
    status: string;
    isOpen: boolean;
    startDate: string | null;
    endDate: string | null;
    startTime: string | null;
    endTime: string | null;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<ActionFilterType>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedLogForDetails, setSelectedLogForDetails] = useState<SubmissionScheduleLogEntry | null>(null);
  const itemsPerPage = 8;

  const fetchLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch("/api/admin/submission-window/logs", { credentials: "include" });
      if (!res.ok) {
        throw new Error(`Failed to load schedule logs (${res.status})`);
      }
      const data = await res.json();
      setLogs(data.logs || []);
      if (data.activeTerm) setActiveTerm(data.activeTerm);
      if (data.currentSchedule) setCurrentSchedule(data.currentSchedule);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load submission schedule logs");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      void fetchLogs();
      setCurrentPage(1);
    }
  }, [isOpen, fetchLogs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Filter by action category
      if (actionFilter !== "all" && log.action_type !== actionFilter) {
        return false;
      }

      // Filter by search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesTarget = (log.scope_target || "").toLowerCase().includes(query);
        const matchesActor = (log.actor_name || "").toLowerCase().includes(query);
        const matchesReason = (log.reason || "").toLowerCase().includes(query);
        const matchesDetails = (log.reason_details || "").toLowerCase().includes(query);
        const matchesTerm = `${log.academic_year || ""} ${log.semester || ""}`.toLowerCase().includes(query);
        const matchesDates = `${log.new_end_date || ""} ${log.old_end_date || ""} ${log.start_date || ""}`.toLowerCase().includes(query);

        if (!matchesTarget && !matchesActor && !matchesReason && !matchesDetails && !matchesTerm && !matchesDates) {
          return false;
        }
      }

      return true;
    });
  }, [logs, actionFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / itemsPerPage));
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredLogs.slice(start, start + itemsPerPage);
  }, [filteredLogs, currentPage]);

  if (!isOpen) return null;

  const getBadgeStyle = (actionType: SubmissionScheduleLogEntry["action_type"]) => {
    switch (actionType) {
      case "SCHEDULE_UPDATE":
        return {
          bg: "bg-[#0b5336] text-white border border-[#08412a]",
          icon: <Calendar className="h-3 w-3" />,
          label: "Schedule Set / Updated",
        };
      case "EXTENSION":
        return {
          bg: "bg-[#b45309] text-white border border-[#92400e]",
          icon: <ClockRotateRight className="h-3 w-3" />,
          label: "Deadline Extended",
        };
      case "FACULTY_ONBOARDING":
        return {
          bg: "bg-[#1e40af] text-white border border-[#1e3a8a]",
          icon: <UserPlus className="h-3 w-3" />,
          label: "Faculty Onboarding Schedule",
        };
      case "FACULTY_OVERRIDE":
        return {
          bg: "bg-[#581c87] text-white border border-[#4c1d95]",
          icon: <Clock className="h-3 w-3" />,
          label: "Faculty Schedule Override",
        };
      case "SCHEDULE_CLOSE":
        return {
          bg: "bg-[#780000] text-white border border-[#5e0000]",
          icon: <ShieldAlert className="h-3 w-3" />,
          label: "Window Closed",
        };
      default:
        return {
          bg: "bg-slate-700 text-white border border-slate-800",
          icon: <ClockRotateRight className="h-3 w-3" />,
          label: "Schedule Event",
        };
    }
  };

  const getLogStatus = (
    log: SubmissionScheduleLogEntry,
    schedule: typeof currentSchedule
  ): { label: string; badgeClass: string } => {
    if (log.action_type === "SCHEDULE_CLOSE") {
      return {
        label: "Closed",
        badgeClass: "bg-[#780000] text-white border border-[#5e0000]",
      };
    }
    if (log.action_type === "SCHEDULE_UPDATE") {
      if (schedule?.isOpen) {
        return {
          label: "Active",
          badgeClass: "bg-[#0b5336] text-white border border-[#08412a]",
        };
      }
      return {
        label: "Past Schedule",
        badgeClass: "bg-slate-600 text-white border border-slate-700 dark:bg-slate-700",
      };
    }
    if (log.action_type === "EXTENSION") {
      const isPast = log.new_end_date
        ? new Date(log.new_end_date).getTime() < Date.now() - 86400000
        : false;
      if (!isPast && schedule?.isOpen) {
        return {
          label: "Active Extension",
          badgeClass: "bg-[#b45309] text-white border border-[#92400e]",
        };
      }
      return {
        label: "Expired",
        badgeClass: "bg-slate-600 text-white border border-slate-700 dark:bg-slate-700",
      };
    }
    if (log.action_type === "FACULTY_ONBOARDING") {
      return {
        label: "Onboarding Applied",
        badgeClass: "bg-[#1e40af] text-white border border-[#1e3a8a]",
      };
    }
    if (log.action_type === "FACULTY_OVERRIDE") {
      return {
        label: "Override Applied",
        badgeClass: "bg-[#581c87] text-white border border-[#4c1d95]",
      };
    }
    return {
      label: "Recorded",
      badgeClass: "bg-slate-600 text-white border border-slate-700 dark:bg-slate-700",
    };
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-3 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-[96vw] max-w-[1550px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl text-slate-900 dark:text-slate-100 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Modal Header */}
        <ModalHeader
          icon={ClockRotateRight}
          title="Submission Schedule Logs"
          subtitle="Audit record of submission deadlines, extensions, manual closures, and faculty grace period assignments"
          onClose={onClose}
          className="rounded-t-2xl border-b border-slate-200 dark:border-slate-800 px-6 py-4"
        >
          <button
            type="button"
            onClick={() => void fetchLogs()}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-600 text-xs font-bold transition shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
            title="Refresh logs"
          >
            <Refresh className={`h-3.5 w-3.5 text-slate-950 ${isLoading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </ModalHeader>

        {/* Top Solid Banner */}
        <div className="p-4 sm:p-6 pb-2 space-y-4">
          <div
            className={`rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs text-white ${
              currentSchedule?.isOpen
                ? "bg-[#0b5336] border border-[#08412a]"
                : "bg-[#780000] border border-[#5e0000]"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-black/20 text-white">
                <Calendar className="h-4 w-4" />
              </div>
              <div>
                <span className="font-bold text-white block text-sm">
                  Active Term: {activeTerm ? `${activeTerm.academicYear} • ${activeTerm.semester}` : academicYear ? `${academicYear} • ${semester}` : "2026-2027 • 1st Semester"}
                </span>
                <span className="text-xs text-emerald-100 dark:text-emerald-200 font-medium">
                  {currentSchedule?.startDate && currentSchedule?.endDate
                    ? `Window: ${currentSchedule.startDate} (${currentSchedule.startTime || "9:00 AM"}) → ${currentSchedule.endDate} (${currentSchedule.endTime || "5:00 PM"})`
                    : "No submission window currently open."}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-white text-slate-900 border border-white shadow-xs">
                {currentSchedule?.isOpen ? "● Submissions Open" : "○ Submissions Closed"}
              </span>
              <span className="text-xs text-white font-bold bg-black/20 px-3 py-1 rounded-full border border-white/20">
                {logs.length} logged {logs.length === 1 ? "event" : "events"}
              </span>
            </div>
          </div>

          {/* Filters & Search Toolbar */}
          <div className="flex flex-col sm:flex-row items-center gap-2.5">
            <div className="relative w-full sm:flex-1">
              <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by faculty, admin, reason, or date..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md border border-[#5e0000] bg-[#780000] hover:bg-[#5e0000] text-white p-0.5 transition-colors cursor-pointer shadow-2xs"
                  title="Clear search"
                >
                  <Xmark className="h-3 w-3" />
                </button>
              ) : null}
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
              {(
                [
                  { key: "all", label: "All" },
                  { key: "SCHEDULE_UPDATE", label: "Updates" },
                  { key: "EXTENSION", label: "Extensions" },
                  { key: "FACULTY_ONBOARDING", label: "Faculty Onboarding" },
                  { key: "SCHEDULE_CLOSE", label: "Closures" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setActionFilter(tab.key);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                    actionFilter === tab.key
                      ? "bg-amber-500 text-slate-950 font-bold shadow-xs border border-amber-600"
                      : "bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-2">
          <div className="w-full overflow-x-auto rounded-xl border-2 border-amber-400 dark:border-amber-500/60 bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100 shadow-xs overflow-hidden transition-colors">
            <table className="w-full text-left border-collapse text-xs text-slate-800 dark:text-slate-300 min-w-[900px]">
              <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 uppercase tracking-wider text-[10px] text-slate-600 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-2.5 font-semibold w-10 text-center">#</th>
                  <th className="px-4 py-2.5 font-semibold whitespace-nowrap">Event / Action</th>
                  <th className="px-4 py-2.5 font-semibold whitespace-nowrap">Status</th>
                  <th className="px-4 py-2.5 font-semibold whitespace-nowrap">Submission Window</th>
                  <th className="px-4 py-2.5 font-semibold whitespace-nowrap">Scope & Term</th>
                  <th className="px-4 py-2.5 font-semibold">Logged By & Reason</th>
                  <th className="px-4 py-2.5 font-semibold whitespace-nowrap">Date</th>
                  <th className="px-4 py-2.5 text-right font-semibold whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                {isLoading && logs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-xs text-slate-500 dark:text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <AppIcon icon={SystemRestart} size="lg" color="default" className="animate-spin text-amber-600" />
                        <span>Loading submission schedule logs...</span>
                      </div>
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-xs text-rose-800 dark:text-rose-300">
                      <p className="font-semibold">{error}</p>
                      <button
                        type="button"
                        onClick={() => void fetchLogs()}
                        className="mt-2 px-3 py-1.5 rounded-lg bg-white border border-rose-300 font-bold hover:bg-rose-50 cursor-pointer text-slate-900"
                      >
                        Try Again
                      </button>
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-xs text-slate-500 dark:text-slate-400">
                      <AppIcon icon={ClockRotateRight} size="lg" color="muted" className="mx-auto mb-2" />
                      <p className="font-medium text-slate-700 dark:text-slate-300">No schedule logs found</p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        {searchQuery || actionFilter !== "all"
                          ? "Try clearing your filters or search terms."
                          : "Changes to submission windows and faculty onboarding policies will be logged here."}
                      </p>
                    </td>
                  </tr>
                ) : (
                  paginatedLogs.map((log, index) => {
                    const itemIndex = (currentPage - 1) * itemsPerPage + index + 1;
                    const badge = getBadgeStyle(log.action_type);
                    const statusInfo = getLogStatus(log, currentSchedule);
                    const cleanReasonDetails =
                      log.reason_details && !log.reason_details.startsWith("Dates set:")
                        ? log.reason_details
                        : null;

                    return (
                      <tr
                        key={log.id}
                        className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="px-3 py-2.5 text-center text-xs font-mono text-slate-500 dark:text-slate-400 font-semibold">
                          {itemIndex}
                        </td>
                        <td className="px-4 py-2.5 font-medium whitespace-nowrap">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold border uppercase tracking-wider ${badge.bg}`}
                            >
                              {badge.icon}
                              <span>{badge.label}</span>
                            </span>
                            {log.extension_preset ? (
                              <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 border border-amber-600 text-[10px] font-bold shadow-2xs">
                                {log.extension_preset}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 font-medium whitespace-nowrap">
                          <span
                            className={`${statusInfo.badgeClass} px-2.5 py-1 text-xs font-semibold rounded-md inline-flex items-center shadow-2xs`}
                          >
                            {statusInfo.label}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-xs font-mono whitespace-nowrap">
                          {log.start_date || log.new_end_date ? (
                            <div className="space-y-0.5">
                              {log.start_date ? (
                                <div className="text-slate-600 dark:text-slate-400 text-[11px]">
                                  Opens: <strong className="text-slate-900 dark:text-slate-100">{log.start_date} {log.start_time || ""}</strong>
                                </div>
                              ) : null}
                              {log.old_end_date ? (
                                <div className="text-slate-400 line-through text-[10px]">
                                  Was: {log.old_end_date} {log.old_end_time || ""}
                                </div>
                              ) : null}
                              {log.new_end_date ? (
                                <div className="text-amber-700 dark:text-amber-400 font-bold text-[11px]">
                                  Closes: {log.new_end_date} {log.new_end_time || ""}
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-xs whitespace-nowrap">
                          <div className="space-y-0.5">
                            <span className="bg-slate-100 text-slate-800 border border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 px-2 py-0.5 text-[11px] font-semibold rounded-md inline-flex items-center">
                              {log.scope === "global"
                                ? "Global (All Faculty)"
                                : `${log.scope.toUpperCase()}: ${log.scope_target || "All"}`}
                            </span>
                            {log.academic_year ? (
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                                {log.academic_year} {log.semester ? `• ${log.semester}` : ""}
                              </div>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-xs">
                          <div className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                            {log.actor_name || "Administrator"}
                          </div>
                          <div className="text-slate-600 dark:text-slate-300 text-[11px] mt-0.5 font-medium">
                            {log.reason || "Schedule configured"}
                          </div>
                          {cleanReasonDetails && (
                            <button
                              type="button"
                              onClick={() => setSelectedLogForDetails(log)}
                              className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300 underline cursor-pointer"
                            >
                              See remarks →
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-2.5 font-medium text-xs whitespace-nowrap text-slate-600 dark:text-slate-400">
                          {formatDate(log.created_at)}
                        </td>
                        <td className="px-4 py-2.5 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setSelectedLogForDetails(log)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
                            title="View log details"
                          >
                            <AppIcon icon={Eye} size="xs" color="inherit" />
                            <span>View</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Footer & Pagination */}
        <div className="border-t border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-850">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Showing {filteredLogs.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}–
            {Math.min(currentPage * itemsPerPage, filteredLogs.length)} of {filteredLogs.length} events
          </div>

          <div className="flex items-center gap-2">
            {totalPages > 1 ? (
              <div className="flex items-center gap-1 mr-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 cursor-pointer"
                  aria-label="Previous page"
                >
                  <NavArrowLeft className="h-3.5 w-3.5" />
                </button>
                <span className="text-xs px-2 font-medium">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 cursor-pointer"
                  aria-label="Next page"
                >
                  <NavArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : null}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] text-xs font-bold transition cursor-pointer shadow-xs active:scale-95"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Uncompressed Full Details Modal */}
      {selectedLogForDetails && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden flex flex-col">
            <ModalHeader
              icon={ClockRotateRight}
              title="Schedule Log Details"
              subtitle={`Audit record #${filteredLogs.findIndex((l) => l.id === selectedLogForDetails.id) + 1}`}
              onClose={() => setSelectedLogForDetails(null)}
              className="rounded-t-2xl border-b border-slate-200 dark:border-slate-800 px-6 py-4"
            />

            <div className="p-6 space-y-4 text-xs overflow-y-auto max-h-[70vh]">
              {/* Event & Status */}
              <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Action / Event</span>
                  <span
                    className={`${getBadgeStyle(selectedLogForDetails.action_type).bg} px-2.5 py-1 rounded-md text-[10px] font-bold border uppercase tracking-wider inline-flex items-center gap-1.5`}
                  >
                    {getBadgeStyle(selectedLogForDetails.action_type).icon}
                    <span>{getBadgeStyle(selectedLogForDetails.action_type).label}</span>
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Status</span>
                  <span
                    className={`${getLogStatus(selectedLogForDetails, currentSchedule).badgeClass} px-2.5 py-1 text-xs font-semibold rounded-md inline-flex items-center shadow-2xs`}
                  >
                    {getLogStatus(selectedLogForDetails, currentSchedule).label}
                  </span>
                </div>
              </div>

              {/* Scope & Academic Term */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Scope</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {selectedLogForDetails.scope === "global"
                      ? "Global (All Faculty)"
                      : `${selectedLogForDetails.scope.toUpperCase()}: ${selectedLogForDetails.scope_target || "All"}`}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Academic Term</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {selectedLogForDetails.academic_year
                      ? `${selectedLogForDetails.academic_year} • ${selectedLogForDetails.semester || ""}`
                      : "Not specified"}
                  </span>
                </div>
              </div>

              {/* Submission Window */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Submission Window</span>
                {selectedLogForDetails.start_date && (
                  <div className="flex justify-between font-mono">
                    <span className="text-slate-500">Opens:</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {selectedLogForDetails.start_date} {selectedLogForDetails.start_time || ""}
                    </span>
                  </div>
                )}
                {selectedLogForDetails.old_end_date && (
                  <div className="flex justify-between font-mono">
                    <span className="text-slate-500">Previous Deadline:</span>
                    <span className="line-through text-slate-400">
                      {selectedLogForDetails.old_end_date} {selectedLogForDetails.old_end_time || ""}
                    </span>
                  </div>
                )}
                {selectedLogForDetails.new_end_date && (
                  <div className="flex justify-between font-mono">
                    <span className="text-slate-500">Closes:</span>
                    <span className="font-bold text-amber-700 dark:text-amber-400">
                      {selectedLogForDetails.new_end_date} {selectedLogForDetails.new_end_time || ""}
                    </span>
                  </div>
                )}
              </div>

              {/* Configured By & Date */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Configured By</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {selectedLogForDetails.actor_name || "Administrator"}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Timestamp</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {formatDate(selectedLogForDetails.created_at)}
                  </span>
                </div>
              </div>

              {/* Reason & Uncompressed Full Remarks */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Reason & Full Remarks</span>
                <p className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                  {selectedLogForDetails.reason || "Submission window configured"}
                </p>
                {selectedLogForDetails.reason_details && (
                  <p className="text-slate-700 dark:text-slate-300 text-xs whitespace-pre-wrap leading-relaxed pt-1 border-t border-slate-200 dark:border-slate-700">
                    {selectedLogForDetails.reason_details}
                  </p>
                )}
              </div>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-800 px-6 py-3 bg-slate-50 dark:bg-slate-850 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedLogForDetails(null)}
                className="px-4 py-2 rounded-xl bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] text-xs font-bold transition cursor-pointer shadow-xs active:scale-95"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SubmissionScheduleLogsModal;
