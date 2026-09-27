"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Check,
  Clock,
  Eye,
  Page,
  Refresh,
  SendMail,
  Trash,
  User,
  WarningTriangle,
  Xmark,
} from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";
import { ModalHeader } from "@/components/ui/modal-header";
import type { RegistrationLogItem } from "@/app/api/admin/user-registration-logs/route";

export interface UserRegistrationLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetRole?: "all" | "faculty" | "admin";
  onInviteCancelled?: () => void;
}

function formatDate(isoDate?: string | null): string {
  if (!isoDate) return "N/A";
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function getInitials(name?: string | null): string {
  if (!name || !name.trim()) return "U";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return parts[0].slice(0, 2).toUpperCase();
}

export function UserRegistrationLogsModal({
  isOpen,
  onClose,
  targetRole = "all",
  onInviteCancelled,
}: UserRegistrationLogsModalProps) {
  const [logs, setLogs] = useState<RegistrationLogItem[]>([]);
  const [stats, setStats] = useState({ total: 0, accepted: 0, pending: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [adminRoleFilter, setAdminRoleFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");

  const [resendingEmail, setResendingEmail] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  // Child modals state
  const [selectedLogForDetails, setSelectedLogForDetails] = useState<RegistrationLogItem | null>(null);
  const [pendingCancelLog, setPendingCancelLog] = useState<RegistrationLogItem | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const roleParam = targetRole !== "all" ? `&role=${targetRole}` : "";
      const response = await fetch(
        `/api/admin/user-registration-logs?_t=${Date.now()}${roleParam}`,
        { cache: "no-store" }
      );
      if (!response.ok) {
        throw new Error("Failed to load registration logs");
      }
      const data = await response.json();
      setLogs(data.logs || []);
      if (data.stats) {
        setStats(data.stats);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load registration logs");
    } finally {
      setIsLoading(false);
    }
  }, [targetRole]);

  useEffect(() => {
    if (isOpen) {
      setStatusFilter("all");
      setAdminRoleFilter("all");
      setSearchTerm("");
      setFeedbackMessage(null);
      setSelectedLogForDetails(null);
      setPendingCancelLog(null);
      setCancelError(null);
      void fetchLogs();
    } else {
      setSelectedLogForDetails(null);
      setPendingCancelLog(null);
      setCancelError(null);
    }
  }, [isOpen, fetchLogs]);

  const handleResendInvite = async (log: RegistrationLogItem) => {
    setResendingEmail(log.email);
    setFeedbackMessage(null);
    try {
      const res = await fetch("/api/admin/user-registration-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: log.email,
          fullName: log.fullName,
          role: log.role.toLowerCase(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to resend invite");
      }

      setFeedbackMessage({
        text: `Invitation resent to ${log.email} successfully!`,
        type: "success",
      });
      void fetchLogs();
    } catch (err: any) {
      setFeedbackMessage({
        text: err?.message || "Error resending invitation",
        type: "error",
      });
    } finally {
      setResendingEmail(null);
    }
  };

  const handleConfirmCancelInvite = async () => {
    if (!pendingCancelLog) return;
    setIsCancelling(true);
    setCancelError(null);
    try {
      const res = await fetch("/api/admin/user-registration-logs", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: pendingCancelLog.email,
          id: pendingCancelLog.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to cancel invitation");
      }

      setFeedbackMessage({
        text: `Invitation for ${pendingCancelLog.fullName} (${pendingCancelLog.email}) has been cancelled successfully.`,
        type: "success",
      });

      if (selectedLogForDetails?.email === pendingCancelLog.email) {
        setSelectedLogForDetails(null);
      }

      // Optimistically remove the cancelled user from logs and decrement counts
      setLogs((prev) =>
        prev.filter(
          (item) => item.email.toLowerCase() !== pendingCancelLog.email.toLowerCase()
        )
      );
      setStats((prev) => ({
        ...prev,
        total: Math.max(0, prev.total - 1),
        pending: Math.max(0, prev.pending - 1),
      }));

      setPendingCancelLog(null);
      void fetchLogs();
      onInviteCancelled?.();
    } catch (err: any) {
      setCancelError(err?.message || "Failed to cancel invitation");
    } finally {
      setIsCancelling(false);
    }
  };

  const filteredLogs = useMemo(() => {
    return logs.filter((item) => {
      // If admin mode and specific sub-role chosen
      if (targetRole === "admin" && adminRoleFilter !== "all") {
        if (adminRoleFilter === "super" && item.role !== "Super Admin") return false;
        if (adminRoleFilter === "regular" && item.role !== "Admin") return false;
      }
      // Status match
      if (statusFilter !== "all" && item.status.toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }
      // Search match
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        const matchesName = item.fullName.toLowerCase().includes(query);
        const matchesEmail = item.email.toLowerCase().includes(query);
        const matchesProgram = item.program?.toLowerCase().includes(query) ?? false;
        if (!matchesName && !matchesEmail && !matchesProgram) {
          return false;
        }
      }
      return true;
    });
  }, [logs, targetRole, adminRoleFilter, statusFilter, searchTerm]);

  if (!isOpen) return null;

  const isFacultyMode = targetRole === "faculty";
  const isAdminMode = targetRole === "admin";

  const modalTitle = isFacultyMode
    ? "Faculty Registration Logs"
    : isAdminMode
    ? "Admin Registration Logs"
    : "User Registration Logs";

  const modalSubtitle = isFacultyMode
    ? "Track sent faculty invitations, delivery status, and account activation progress."
    : isAdminMode
    ? "Track sent administrator invitations, delivery status, and account activation progress."
    : "Track sent invitations, delivery status, and account activation progress.";

  const totalLabel = isFacultyMode
    ? "Total Faculty Invites"
    : isAdminMode
    ? "Total Admin Invites"
    : "Total Invitations";

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-5 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl text-slate-900 dark:text-slate-100 overflow-hidden">
          {/* Modal Header */}
          <div className="p-6 pb-4 border-b border-slate-200 dark:border-slate-800">
            <ModalHeader
              icon={Page}
              title={modalTitle}
              subtitle={modalSubtitle}
              className="-mx-6 -mt-6 mb-4 rounded-t-2xl"
            />

            {feedbackMessage ? (
              <div
                className={`p-3 rounded-xl text-xs font-semibold flex items-center justify-between transition-all ${
                  feedbackMessage.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60"
                    : "bg-red-50 text-red-800 border border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800/60"
                }`}
              >
                <span>{feedbackMessage.text}</span>
                <button
                  type="button"
                  onClick={() => setFeedbackMessage(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 ml-2 cursor-pointer"
                >
                  <AppIcon icon={Xmark} size="sm" color="inherit" />
                </button>
              </div>
            ) : null}

            {/* Stats Summary Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3">
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {totalLabel}
                </span>
                <p className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                  {stats.total}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3">
                <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Accepted
                </span>
                <p className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                  {stats.accepted}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3">
                <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Pending
                </span>
                <p className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                  {stats.pending}
                </p>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-4">
              <div className="flex flex-wrap items-center gap-2 flex-1">
                <input
                  type="text"
                  placeholder={
                    isFacultyMode
                      ? "Search faculty by name or email..."
                      : isAdminMode
                      ? "Search admin by name or email..."
                      : "Search by name or email..."
                  }
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full sm:w-64 h-9 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 text-xs placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:border-amber-500 transition"
                />

                {isAdminMode ? (
                  <select
                    value={adminRoleFilter}
                    onChange={(e) => setAdminRoleFilter(e.target.value)}
                    className="h-9 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 text-xs outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="all">All Admin Roles</option>
                    <option value="regular">Admin</option>
                    <option value="super">Super Admin</option>
                  </select>
                ) : null}

                {/* Status Filter Pills */}
                <div className="flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-1 h-9 shrink-0">
                  <button
                    type="button"
                    onClick={() => setStatusFilter("all")}
                    className={`rounded-lg px-2.5 py-1 text-xs transition cursor-pointer ${
                      statusFilter === "all"
                        ? "bg-amber-500 text-slate-950 font-semibold shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                    }`}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter("accepted")}
                    className={`rounded-lg px-2.5 py-1 text-xs transition cursor-pointer ${
                      statusFilter === "accepted"
                        ? "bg-amber-500 text-slate-950 font-semibold shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                    }`}
                  >
                    Accepted
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter("pending")}
                    className={`rounded-lg px-2.5 py-1 text-xs transition cursor-pointer ${
                      statusFilter === "pending"
                        ? "bg-amber-500 text-slate-950 font-semibold shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                    }`}
                  >
                    Pending
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void fetchLogs()}
                disabled={isLoading}
                title="Refresh logs"
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-850 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 transition cursor-pointer disabled:opacity-50"
              >
                <Refresh className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Scrollable Data Table */}
          <div className="flex-1 overflow-y-auto overflow-x-auto min-h-[250px] p-6 pt-2">
            <table className="w-full text-left border-collapse text-xs min-w-[850px]">
              <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 uppercase tracking-wider text-[10px] text-slate-600 dark:text-slate-400 sticky top-0 z-10 backdrop-blur-sm">
                <tr>
                  <th className="px-3 py-2.5 font-semibold w-10 text-center">#</th>
                  <th className="px-4 py-2.5 font-semibold">
                    {isFacultyMode ? "Faculty Member" : isAdminMode ? "Admin Member" : "User"}
                  </th>
                  <th className="px-4 py-2.5 font-semibold">
                    {isFacultyMode ? "Program" : "Role"}
                  </th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  <th className="px-4 py-2.5 font-semibold">Sent At</th>
                  <th className="px-4 py-2.5 text-right font-semibold min-w-[280px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-xs text-slate-500 dark:text-slate-400">
                      Loading registration logs...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-xs text-red-500">
                      {error}
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-xs text-slate-500 dark:text-slate-400">
                      No registration logs found matching the filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log, index) => {
                    const isAccepted = log.status === "Accepted";
                    const isResending = resendingEmail === log.email;

                    return (
                      <tr
                        key={`${log.email}-${log.invitedAt}-${index}`}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        {/* # Index */}
                        <td className="px-3 py-2.5 text-center text-xs font-mono text-slate-400 dark:text-slate-500">
                          {index + 1}
                        </td>

                        {/* Member Column */}
                        <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-slate-100">
                          <div className="flex items-center gap-2.5">
                            <div
                              className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-slate-700 dark:text-slate-300"
                              aria-hidden="true"
                            >
                              {log.avatarUrl ? (
                                <img
                                  src={log.avatarUrl}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <span>{getInitials(log.fullName)}</span>
                              )}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900 dark:text-slate-100 text-xs">
                                {log.fullName}
                              </div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-normal font-mono">
                                {log.email}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Program or Role Badge */}
                        <td className="px-4 py-2.5 font-medium text-xs">
                          {isFacultyMode ? (
                            <span className="bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 px-2 py-0.5 text-xs font-semibold rounded-md inline-flex items-center">
                              {log.program || "Unassigned"}
                            </span>
                          ) : (
                            <span className="bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 px-2 py-0.5 text-xs font-semibold rounded-md inline-flex items-center">
                              {log.role}
                            </span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-2.5 font-medium">
                          {isAccepted ? (
                            <span className="bg-[#0b5336] text-white border border-[#08412a] px-2 py-0.5 text-xs font-semibold rounded-md inline-flex items-center gap-1 shadow-2xs">
                              <Check className="h-3 w-3" />
                              <span>Accepted</span>
                            </span>
                          ) : (
                            <span className="bg-amber-500 text-slate-950 border border-amber-600 px-2 py-0.5 text-xs font-semibold rounded-md inline-flex items-center gap-1 shadow-2xs">
                              <Clock className="h-3 w-3 text-slate-950" />
                              <span>Pending</span>
                            </span>
                          )}
                        </td>

                        {/* Sent At */}
                        <td className="px-4 py-2.5 font-medium text-xs whitespace-nowrap text-slate-600 dark:text-slate-400">
                          <div>{formatDate(log.invitedAt)}</div>
                          {isAccepted && log.confirmedAt ? (
                            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-normal">
                              Accepted: {formatDate(log.confirmedAt)}
                            </div>
                          ) : null}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-2.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* View Details Button */}
                            <button
                              type="button"
                              onClick={() => setSelectedLogForDetails(log)}
                              title="View Details"
                              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold border border-amber-600/30 text-xs rounded-md px-2.5 py-1 transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                            >
                              <AppIcon
                                icon={Eye}
                                size="sm"
                                color="inherit"
                                className="text-slate-950"
                              />
                              <span>View Details</span>
                            </button>

                            {!isAccepted ? (
                              <>
                                {/* Cancel Invite Button */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCancelError(null);
                                    setPendingCancelLog(log);
                                  }}
                                  title="Cancel Invitation"
                                  className="bg-[#780000] hover:bg-[#5e0000] text-white font-semibold border border-[#5e0000] text-xs rounded-md px-2.5 py-1 transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                                >
                                  <AppIcon icon={Trash} size="sm" color="white" />
                                  <span>Cancel Invite</span>
                                </button>

                                {/* Resend Invite Button */}
                                <button
                                  type="button"
                                  onClick={() => void handleResendInvite(log)}
                                  disabled={isResending}
                                  title="Resend invitation email"
                                  className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold border border-slate-300 dark:border-slate-700 text-xs rounded-md px-2.5 py-1 transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
                                >
                                  <AppIcon
                                    icon={SendMail}
                                    size="sm"
                                    color="inherit"
                                  />
                                  <span>
                                    {isResending ? "Resending..." : "Resend"}
                                  </span>
                                </button>
                              </>
                            ) : (
                              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium inline-flex items-center gap-1 pl-1">
                                <Check className="h-3 w-3" />
                                <span>Active</span>
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Modal Footer */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>
              Showing {filteredLogs.length} of {logs.length} registration logs
            </span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 px-4 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* View Details Modal */}
      {selectedLogForDetails ? (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl text-slate-900 dark:text-slate-100 max-h-[90vh] overflow-y-auto">
            <ModalHeader
              icon={User}
              title="Invitation Details"
              subtitle="Comprehensive registration and account invite status"
              onClose={() => setSelectedLogForDetails(null)}
              className="-mx-6 -mt-6 mb-5 rounded-t-2xl"
            />

            <div className="space-y-4">
              {/* Recipient Profile Card */}
              <div className="flex items-center gap-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-sm font-bold text-slate-700 dark:text-slate-200">
                  {selectedLogForDetails.avatarUrl ? (
                    <img
                      src={selectedLogForDetails.avatarUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span>{getInitials(selectedLogForDetails.fullName)}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 truncate">
                      {selectedLogForDetails.fullName}
                    </h3>
                    {selectedLogForDetails.status === "Accepted" ? (
                      <span className="bg-[#0b5336] text-white border border-[#08412a] px-2 py-0.5 text-[10px] font-semibold rounded-md inline-flex items-center gap-1 shadow-2xs">
                        <Check className="h-3 w-3" />
                        <span>Accepted</span>
                      </span>
                    ) : (
                      <span className="bg-amber-500 text-slate-950 border border-amber-600 px-2 py-0.5 text-[10px] font-semibold rounded-md inline-flex items-center gap-1 shadow-2xs">
                        <Clock className="h-3 w-3 text-slate-950" />
                        <span>Pending Acceptance</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate mt-0.5">
                    {selectedLogForDetails.email}
                  </p>
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 p-3">
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                    Assigned Role
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100 text-xs mt-1 inline-block">
                    {selectedLogForDetails.role}
                  </span>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 p-3">
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                    Department / Program
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100 text-xs mt-1 inline-block">
                    {selectedLogForDetails.program || "Administration / Campus-wide"}
                  </span>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 p-3">
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                    Email Delivery
                  </span>
                  <div className="flex items-center gap-1.5 mt-1">
                    {selectedLogForDetails.inviteSent ? (
                      <span className="text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
                        <Check className="h-3.5 w-3.5" />
                        Email Sent Successfully
                      </span>
                    ) : (
                      <span className="text-amber-700 dark:text-amber-400 font-semibold">
                        {selectedLogForDetails.sendError || "Link generated / awaiting delivery"}
                      </span>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 p-3">
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                    Date & Time Invited
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100 text-xs mt-1 inline-block">
                    {formatDate(selectedLogForDetails.invitedAt)}
                  </span>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 p-3">
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                    Date Accepted / Activated
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100 text-xs mt-1 inline-block">
                    {selectedLogForDetails.confirmedAt
                      ? formatDate(selectedLogForDetails.confirmedAt)
                      : "Awaiting user activation"}
                  </span>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 p-3">
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                    Last Login
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100 text-xs mt-1 inline-block">
                    {selectedLogForDetails.lastLoginAt
                      ? formatDate(selectedLogForDetails.lastLoginAt)
                      : "Never signed in"}
                  </span>
                </div>
              </div>

              {/* Informational notice for pending accounts */}
              {selectedLogForDetails.status === "Pending" ? (
                <div className="rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/70 dark:bg-amber-950/30 p-3 text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
                  <span className="font-semibold">Notice:</span> This account is pending invitation acceptance. It will not appear in the active{" "}
                  {selectedLogForDetails.role === "Faculty" ? "Faculty Management" : "Admin Management"} list until the user verifies their email and completes setup.
                </div>
              ) : null}

              {/* Modal Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
                <div>
                  {selectedLogForDetails.status === "Pending" ? (
                    <button
                      type="button"
                      onClick={() => {
                        const target = selectedLogForDetails;
                        setCancelError(null);
                        setPendingCancelLog(target);
                      }}
                      className="bg-[#780000] hover:bg-[#5e0000] text-white font-semibold border border-[#5e0000] text-xs rounded-xl px-3.5 py-2 transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                    >
                      <AppIcon icon={Trash} size="sm" color="white" />
                      <span>Cancel Invite</span>
                    </button>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  {selectedLogForDetails.status === "Pending" ? (
                    <button
                      type="button"
                      onClick={() => void handleResendInvite(selectedLogForDetails)}
                      disabled={resendingEmail === selectedLogForDetails.email}
                      className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold border border-amber-600/30 text-xs rounded-xl px-3.5 py-2 transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
                    >
                      <AppIcon icon={SendMail} size="sm" color="inherit" className="text-slate-950" />
                      <span>
                        {resendingEmail === selectedLogForDetails.email ? "Resending..." : "Resend Invite"}
                      </span>
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setSelectedLogForDetails(null)}
                    className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Cancel Invite Modal */}
      {pendingCancelLog ? (
        <div
          className="fixed inset-0 z-70 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl text-slate-900 dark:text-slate-100 animate-in zoom-in-95 duration-150">
            <ModalHeader
              icon={Trash}
              title="Cancel Invitation?"
              subtitle="Revoke pending account invitation"
              onClose={() => !isCancelling && setPendingCancelLog(null)}
              closeDisabled={isCancelling}
              className="-mx-6 -mt-6 mb-5 rounded-t-2xl"
            />

            <div className="space-y-4">
              {/* Member Card */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-3.5 flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {pendingCancelLog.avatarUrl ? (
                    <img
                      src={pendingCancelLog.avatarUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span>{getInitials(pendingCancelLog.fullName)}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {pendingCancelLog.fullName}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate">
                    {pendingCancelLog.email}
                  </p>
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">
                    {pendingCancelLog.role}{" "}
                    {pendingCancelLog.program ? `• ${pendingCancelLog.program}` : ""}
                  </p>
                </div>
              </div>

              {/* Revoke Notice */}
              <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/80 dark:bg-red-950/30 p-3.5 text-xs leading-relaxed text-red-800 dark:text-red-300">
                <p className="font-semibold text-red-900 dark:text-red-200 flex items-center gap-1.5 mb-1">
                  <AppIcon icon={WarningTriangle} size="sm" color="inherit" />
                  <span>Revoke Invitation Notice</span>
                </p>
                Are you sure you want to cancel the invitation for{" "}
                <strong>{pendingCancelLog.fullName}</strong>? The invitation link will be
                invalidated immediately. The user will not be able to activate this account,
                and their pending registration record will be removed.
              </div>

              {cancelError ? (
                <div className="p-3 rounded-xl text-xs font-semibold bg-red-50 text-red-800 border border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800/60">
                  {cancelError}
                </div>
              ) : null}

              {/* Confirmation Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setPendingCancelLog(null)}
                  disabled={isCancelling}
                  className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer disabled:opacity-50"
                >
                  Keep Invitation
                </button>
                <button
                  type="button"
                  onClick={() => void handleConfirmCancelInvite()}
                  disabled={isCancelling}
                  className="bg-[#780000] hover:bg-[#5e0000] text-white font-semibold border border-[#5e0000] text-xs rounded-xl px-4 py-2 transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
                >
                  <AppIcon icon={Trash} size="sm" color="white" />
                  <span>{isCancelling ? "Cancelling..." : "Yes, Cancel Invite"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default UserRegistrationLogsModal;
