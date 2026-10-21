"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Check,
  CheckCircle,
  Clock,
  EditPencil,
  Eye,
  NavArrowLeft,
  NavArrowRight,
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
import { AlertPopup } from "@/components/ui/alert-popup";
import type { RegistrationLogItem } from "@/app/api/staff/user-registration-logs/route";

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
  if (!name || !name.trim()) return "";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return parts[0].slice(0, 2).toUpperCase();
}

function parseFullName(fullName?: string | null): {
  firstName: string;
  middleName: string;
  lastName: string;
} {
  if (!fullName || !fullName.trim()) {
    return { firstName: "", middleName: "", lastName: "" };
  }
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return { firstName: parts[0], middleName: "", lastName: "" };
  }
  if (parts.length === 2) {
    return { firstName: parts[0], middleName: "", lastName: parts[1] };
  }
  if (parts.length === 3) {
    return { firstName: parts[0], middleName: parts[1], lastName: parts[2] };
  }
  const lastName = parts[parts.length - 1];
  const middleName = parts[parts.length - 2];
  const firstName = parts.slice(0, parts.length - 2).join(" ");
  return { firstName, middleName, lastName };
}

const DEFAULT_PROGRAMS: { id: string; code: string; name: string }[] = [
  { id: "BEED", code: "BEED", name: "Bachelor of Elementary Education" },
  { id: "BSA", code: "BSA", name: "Bachelor of Science in Accountancy" },
  { id: "BSMA", code: "BSMA", name: "Bachelor of Science in Management Accounting" },
  { id: "BSIE", code: "BSIE", name: "Bachelor of Science in Industrial Engineering" },
  { id: "BSIT", code: "BSIT", name: "Bachelor of Science in Information Technology" },
  { id: "BSBAHRM", code: "BSBAHRM", name: "Bachelor of Science in Business Administration major in Human Resource Management" },
  { id: "BSEnt", code: "BSEnt", name: "Bachelor of Science in Entrepreneurship" },
  { id: "DIT", code: "DIT", name: "Diploma in Information Technology" },
  { id: "DOMT-LOM", code: "DOMT-LOM", name: "Diploma in Office Management Technology major in Legal Office Management" },
];

function getPageNumbers(currentPage: number, totalPages: number): (number | string)[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages: (number | string)[] = [1];
  if (currentPage > 3) {
    pages.push("...");
  }
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }
  if (currentPage < totalPages - 2) {
    pages.push("...");
  }
  pages.push(totalPages);
  return pages;
}

interface UserLogAvatarProps {
  avatarUrl?: string | null;
  name?: string | null;
  className?: string;
  size?: "sm" | "md" | "lg";
}

function UserLogAvatar({
  avatarUrl,
  name,
  className = "",
  size = "md",
}: UserLogAvatarProps) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [avatarUrl]);

  const initials = getInitials(name);
  const trimmedUrl = avatarUrl?.trim();
  const showImage = Boolean(trimmedUrl) && !hasError;

  const sizeClasses =
    size === "sm"
      ? "h-7 w-7 text-[10px]"
      : size === "lg"
      ? "h-12 w-12 text-sm font-bold"
      : "h-9 w-9 text-xs font-semibold";

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 select-none shadow-2xs ${sizeClasses} ${className}`}
      aria-hidden="true"
    >
      {showImage ? (
        <img
          src={trimmedUrl}
          alt={name ? `${name}'s profile avatar` : "User profile avatar"}
          className="h-full w-full object-cover"
          onError={() => setHasError(true)}
          loading="lazy"
        />
      ) : initials ? (
        <span className="font-semibold tracking-wider">{initials}</span>
      ) : (
        <AppIcon icon={User} size={size === "lg" ? "md" : "sm"} color="inherit" />
      )}
    </div>
  );
}

const PAGE_SIZE = 10;

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
  const [currentPage, setCurrentPage] = useState<number>(1);

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
  const [pendingResendLog, setPendingResendLog] = useState<RegistrationLogItem | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);

  // Edit modal state
  const [editingLog, setEditingLog] = useState<RegistrationLogItem | null>(null);
  const [editFirstName, setEditFirstName] = useState("");
  const [editMiddleName, setEditMiddleName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editNameAlert, setEditNameAlert] = useState<string | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editProgram, setEditProgram] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [programsList, setProgramsList] = useState<{ id: string; code: string; name: string }[]>(DEFAULT_PROGRAMS);

  useEffect(() => {
    void fetch("/api/programs")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.programs) && data.programs.length > 0) {
          setProgramsList(data.programs);
        }
      })
      .catch(() => {});
  }, []);

  const openEditModal = (log: RegistrationLogItem) => {
    setEditingLog(log);
    const parsed = parseFullName(log.fullName);
    setEditFirstName(parsed.firstName);
    setEditMiddleName(parsed.middleName);
    setEditLastName(parsed.lastName);
    setEditEmail(log.email || "");

    const targetProg = (log.program || "").trim();
    const matched = programsList.find(
      (p) =>
        p.code.toLowerCase() === targetProg.toLowerCase() ||
        p.id.toLowerCase() === targetProg.toLowerCase() ||
        p.name.toLowerCase() === targetProg.toLowerCase()
    );
    setEditProgram(matched ? matched.code : targetProg);
    setEditError(null);
    setEditNameAlert(null);
  };

  const handleEditNameInput = (
    setter: (val: string) => void,
    raw: string
  ) => {
    if (/[^a-zA-Z\sñÑ]/.test(raw)) {
      setEditNameAlert("Cannot use numbers or special characters in name");
    } else {
      if (editNameAlert === "Cannot use numbers or special characters in name") {
        setEditNameAlert(null);
      }
    }
    const clean = raw.replace(/[^a-zA-Z\sñÑ]/g, "");
    setter(clean);
  };

  const handleSaveEdit = async (resendNow: boolean) => {
    if (!editingLog) return;
    setEditError(null);

    if (!editFirstName.trim() || !editLastName.trim()) {
      setEditError("First name and last name are required");
      return;
    }

    if (!editEmail.trim()) {
      setEditError("Email address is required");
      return;
    }

    const computedFullName = [editFirstName.trim(), editMiddleName.trim(), editLastName.trim()]
      .filter(Boolean)
      .join(" ");

    setIsSavingEdit(true);

    try {
      const res = await fetch("/api/staff/user-registration-logs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingLog.id,
          email: editingLog.email,
          newEmail: editEmail.trim(),
          newFullName: computedFullName,
          newProgram: editProgram.trim(),
          role: editingLog.role,
          resendNow,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update details");
      }

      setFeedbackMessage({
        text: data.message || "Invitation details updated successfully!",
        type: "success",
      });

      setEditingLog(null);
      await fetchLogs();
    } catch (err: any) {
      setEditError(err?.message || "Failed to update details");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const roleParam = targetRole !== "all" ? `&role=${targetRole}` : "";
      const response = await fetch(
        `/api/staff/user-registration-logs?_t=${Date.now()}${roleParam}`,
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
      setCurrentPage(1);
      setFeedbackMessage(null);
      setSelectedLogForDetails(null);
      setPendingCancelLog(null);
      setCancelError(null);
      setPendingResendLog(null);
      setResendError(null);
      void fetchLogs();
    } else {
      setSelectedLogForDetails(null);
      setPendingCancelLog(null);
      setCancelError(null);
      setPendingResendLog(null);
      setResendError(null);
    }
  }, [isOpen, fetchLogs]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, adminRoleFilter, searchTerm]);

  const openResendModal = (log: RegistrationLogItem) => {
    setResendError(null);
    setPendingResendLog(log);
  };

  const handleConfirmResendInvite = async () => {
    if (!pendingResendLog) return;
    setResendingEmail(pendingResendLog.email);
    setResendError(null);
    try {
      const res = await fetch("/api/staff/user-registration-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: pendingResendLog.email,
          fullName: pendingResendLog.fullName,
          role: pendingResendLog.role.toLowerCase(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to resend invite");
      }

      setFeedbackMessage({
        text: `Invitation resent to ${pendingResendLog.email} successfully!`,
        type: "success",
      });
      setPendingResendLog(null);
      void fetchLogs();
    } catch (err: any) {
      setResendError(err?.message || "Error resending invitation");
    } finally {
      setResendingEmail(null);
    }
  };

  const handleConfirmCancelInvite = async () => {
    if (!pendingCancelLog) return;
    setIsCancelling(true);
    setCancelError(null);
    try {
      const res = await fetch("/api/staff/user-registration-logs", {
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
      // Role filter
      if (targetRole === "admin") {
        if (adminRoleFilter === "super" && item.role !== "Admin" && item.role !== "Super Admin") return false;
        if (adminRoleFilter === "regular" && item.role !== "Staff") return false;
      } else if (targetRole === "all" && adminRoleFilter !== "all") {
        if (adminRoleFilter === "faculty" && item.role !== "Faculty") return false;
        if (adminRoleFilter === "regular" && item.role !== "Staff") return false;
        if (adminRoleFilter === "super" && item.role !== "Admin" && item.role !== "Super Admin") return false;
      }

      // Status match
      if (statusFilter !== "all" && item.status.toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }

      // Search match
      if (searchTerm.trim()) {
        const query = searchTerm.trim().toLowerCase();
        const matchesName = item.fullName.toLowerCase().includes(query);
        const matchesEmail = item.email.toLowerCase().includes(query);
        const matchesProgram = item.program?.toLowerCase().includes(query) ?? false;
        const matchesRole = item.role.toLowerCase().includes(query);
        if (!matchesName && !matchesEmail && !matchesProgram && !matchesRole) {
          return false;
        }
      }
      return true;
    });
  }, [logs, targetRole, adminRoleFilter, statusFilter, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedLogs = useMemo(() => {
    const startIndex = (validCurrentPage - 1) * PAGE_SIZE;
    return filteredLogs.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredLogs, validCurrentPage]);

  const pageNumbers = useMemo(() => {
    return getPageNumbers(validCurrentPage, totalPages);
  }, [validCurrentPage, totalPages]);

  if (!isOpen) return null;

  const isFacultyMode = targetRole === "faculty";
  const isAdminMode = targetRole === "admin";

  const modalTitle = isFacultyMode
    ? "Faculty Registration Logs"
    : isAdminMode
    ? "Staff Registration Logs"
    : "User Registration Logs";

  const modalSubtitle = isFacultyMode
    ? "Track sent faculty invitations, delivery status, and account activation progress."
    : isAdminMode
    ? "Track sent staff and administrator invitations, delivery status, and account activation progress."
    : "Track sent invitations, delivery status, and account activation progress.";

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-2 sm:p-4 md:p-6 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="w-full max-w-7xl xl:max-w-[1400px] h-[92vh] sm:h-auto sm:max-h-[90vh] flex flex-col rounded-2xl border-2 border-amber-400 dark:border-amber-500/70 bg-white dark:bg-slate-900 shadow-2xl text-slate-900 dark:text-slate-100 overflow-hidden transition-all">
          {/* Modal Header */}
          <div className="p-4 sm:p-6 pb-3 sm:pb-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
            <ModalHeader
              icon={Page}
              title={modalTitle}
              subtitle={modalSubtitle}
              onClose={onClose}
              className="-mx-4 -mt-4 sm:-mx-6 sm:-mt-6 mb-3 sm:mb-4 rounded-t-2xl"
            />

            {feedbackMessage ? (
              <div
                className={`p-3 rounded-xl text-xs font-semibold flex items-center justify-between transition-all ${
                  feedbackMessage.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60"
                    : "bg-red-50 text-red-800 border border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800/60"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {feedbackMessage.type === "success" && (
                    <AppIcon icon={Check} size="sm" color="success" className="shrink-0" />
                  )}
                  <span>{feedbackMessage.text}</span>
                </div>
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
            <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-3">
              <div className="rounded-xl bg-slate-100/70 dark:bg-slate-800/50 p-2.5 sm:p-3 text-center sm:text-left shadow-2xs transition-colors">
                <span className="text-[10px] sm:text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center justify-center sm:justify-start gap-1.5">
                  <span className="w-5 h-5 rounded-md bg-slate-700 dark:bg-slate-600 text-white shrink-0 flex items-center justify-center shadow-2xs">
                    <User className="h-3 w-3 text-white" />
                  </span>
                  <span>Total</span>
                </span>
                <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                  {stats.total}
                </p>
              </div>
              <div className="rounded-xl bg-slate-100/70 dark:bg-slate-800/50 p-2.5 sm:p-3 text-center sm:text-left shadow-2xs transition-colors">
                <span className="text-[10px] sm:text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center justify-center sm:justify-start gap-1.5">
                  <span className="w-5 h-5 rounded-md bg-[#0b5336] text-white shrink-0 flex items-center justify-center shadow-2xs">
                    <Check className="h-3 w-3 text-white" />
                  </span>
                  <span>Accepted</span>
                </span>
                <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                  {stats.accepted}
                </p>
              </div>
              <div className="rounded-xl bg-slate-100/70 dark:bg-slate-800/50 p-2.5 sm:p-3 text-center sm:text-left shadow-2xs transition-colors">
                <span className="text-[10px] sm:text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center justify-center sm:justify-start gap-1.5">
                  <span className="w-5 h-5 rounded-md bg-amber-500 text-slate-950 shrink-0 flex items-center justify-center shadow-2xs">
                    <Clock className="h-3 w-3 text-slate-950" />
                  </span>
                  <span>Pending</span>
                </span>
                <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                  {stats.pending}
                </p>
              </div>
            </div>

            {/* Filter & Search Bar - Realigned for Mobile View */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-3 sm:mt-4">
              {/* Row 1 on mobile: Search Input with Compact Refresh Button */}
              <div className="flex items-center gap-2 flex-1">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder={
                      isFacultyMode
                        ? "Search faculty by name or email..."
                        : isAdminMode
                        ? "Search staff by name or email..."
                        : "Search by name or email..."
                    }
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full h-9 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:border-[#780000] focus:ring-1 focus:ring-[#780000]/30 transition"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => void fetchLogs()}
                  disabled={isLoading}
                  title="Refresh logs"
                  className="h-9 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-850 px-3 text-xs font-semibold text-slate-700 dark:text-slate-300 transition cursor-pointer disabled:opacity-50 shrink-0 shadow-2xs"
                >
                  <Refresh className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
              </div>

              {/* Row 2 on mobile: Filter Dropdown(s) */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Role Dropdown */}
                {isAdminMode ? (
                  <select
                    value={adminRoleFilter}
                    onChange={(e) => setAdminRoleFilter(e.target.value)}
                    className="h-9 flex-1 sm:flex-initial sm:w-36 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none focus:border-[#780000] focus:ring-1 focus:ring-[#780000]/30 transition cursor-pointer shadow-2xs"
                  >
                    <option value="all">All Roles</option>
                    <option value="regular">Staff</option>
                    <option value="super">Admin</option>
                  </select>
                ) : targetRole === "all" ? (
                  <select
                    value={adminRoleFilter}
                    onChange={(e) => setAdminRoleFilter(e.target.value)}
                    className="h-9 flex-1 sm:flex-initial sm:w-36 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none focus:border-[#780000] focus:ring-1 focus:ring-[#780000]/30 transition cursor-pointer shadow-2xs"
                  >
                    <option value="all">All Roles</option>
                    <option value="faculty">Faculty</option>
                    <option value="regular">Staff</option>
                    <option value="super">Admin</option>
                  </select>
                ) : null}

                {/* Status Dropdown */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-9 flex-1 sm:flex-initial sm:w-36 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none focus:border-[#780000] focus:ring-1 focus:ring-[#780000]/30 transition cursor-pointer shadow-2xs"
                >
                  <option value="all">All Status</option>
                  <option value="accepted">Accepted</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
            </div>
          </div>

          {/* Main Log Content Area */}
          <div className="flex-1 overflow-y-auto min-h-[250px] p-3 sm:p-6 pt-3">
            {isLoading ? (
              <div className="py-16 text-center text-xs text-slate-500 dark:text-slate-400 flex flex-col items-center justify-center gap-2">
                <Refresh className="h-5 w-5 animate-spin text-[#780000]" />
                <span>Loading registration logs...</span>
              </div>
            ) : error ? (
              <div className="py-16 text-center text-xs text-red-500 flex flex-col items-center justify-center gap-2">
                <AppIcon icon={WarningTriangle} size="md" color="inherit" />
                <span>{error}</span>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="py-16 text-center text-xs text-slate-500 dark:text-slate-400">
                No registration logs found matching the filter criteria.
              </div>
            ) : (
              <>
                {/* ── Mobile View: Realigned Stacked Cards (< 768px) ── */}
                <div className="md:hidden space-y-3">
                  {paginatedLogs.map((log, index) => {
                    const isAccepted = log.status === "Accepted";
                    const isResending = resendingEmail === log.email;
                    const itemIndex = (validCurrentPage - 1) * PAGE_SIZE + index + 1;

                    return (
                      <div
                        key={`mobile-${log.email}-${log.invitedAt}-${index}`}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-3.5 shadow-2xs space-y-3"
                      >
                        {/* Header: Number, Avatar, Name/Email, Status */}
                        <div className="flex items-start justify-between gap-2.5">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <span className="text-[10px] font-mono font-semibold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md shrink-0">
                              #{itemIndex}
                            </span>
                            <UserLogAvatar
                              avatarUrl={log.avatarUrl}
                              name={log.fullName}
                              size="md"
                            />
                            <div className="min-w-0 flex-1">
                              <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-xs truncate">
                                {log.fullName}
                              </h4>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate">
                                {log.email}
                              </p>
                            </div>
                          </div>

                          <div className="shrink-0">
                            {isAccepted ? (
                              <span className="bg-[#0b5336] text-white border border-[#08412a] px-2 py-0.5 text-[10px] font-semibold rounded-md inline-flex items-center gap-1 shadow-2xs">
                                <Check className="h-3 w-3" />
                                <span>Accepted</span>
                              </span>
                            ) : (
                              <span className="bg-amber-500 text-slate-950 border border-amber-600 px-2 py-0.5 text-[10px] font-semibold rounded-md inline-flex items-center gap-1 shadow-2xs">
                                <Clock className="h-3 w-3 text-slate-950" />
                                <span>Pending</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Details row: Role / Program & Dates */}
                        <div className="grid grid-cols-2 gap-2 text-xs pt-2.5 border-t border-slate-100 dark:border-slate-850">
                          <div>
                            <span className="text-[9px] uppercase font-semibold text-slate-400 dark:text-slate-500 block">
                              {isFacultyMode ? "Program" : "Role"}
                            </span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs mt-0.5 inline-block">
                              {isFacultyMode ? log.program || "Unassigned" : log.role}
                            </span>
                          </div>

                          <div>
                            <span className="text-[9px] uppercase font-semibold text-slate-400 dark:text-slate-500 block">
                              Sent At
                            </span>
                            <span className="font-medium text-slate-700 dark:text-slate-300 text-[11px] mt-0.5 inline-block">
                              {formatDate(log.invitedAt)}
                            </span>
                            {isAccepted && log.confirmedAt ? (
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-normal block mt-0.5">
                                Accepted: {formatDate(log.confirmedAt)}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        {/* Actions bar - Solid Colors & Clean Realignment */}
                        <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-slate-100 dark:border-slate-850">
                          <button
                            type="button"
                            onClick={() => setSelectedLogForDetails(log)}
                            title="View Details"
                            className="bg-[#780000] hover:bg-[#5e0000] text-white font-semibold border border-[#5e0000] text-xs rounded-lg px-3 py-1.5 transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5 shadow-2xs"
                          >
                            <AppIcon icon={Eye} size="sm" color="white" />
                            <span>View Details</span>
                          </button>

                          {!isAccepted ? (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <button
                                type="button"
                                onClick={() => openEditModal(log)}
                                title="Edit Details"
                                className="bg-slate-800 hover:bg-slate-700 text-white font-semibold border border-slate-700 text-xs rounded-lg px-2.5 py-1.5 transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5 shadow-2xs"
                              >
                                <AppIcon icon={EditPencil} size="sm" color="white" />
                                <span>Edit</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setCancelError(null);
                                  setPendingCancelLog(log);
                                }}
                                title="Cancel Invitation"
                                className="bg-[#780000] hover:bg-[#5e0000] text-white font-semibold border border-[#5e0000] text-xs rounded-lg px-2.5 py-1.5 transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5 shadow-2xs"
                              >
                                <AppIcon icon={Trash} size="sm" color="white" />
                                <span>Cancel</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => openResendModal(log)}
                                disabled={isResending}
                                title="Resend invitation email"
                                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold border border-amber-600 text-xs rounded-lg px-2.5 py-1.5 transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5 shadow-2xs disabled:opacity-50"
                              >
                                <AppIcon icon={SendMail} size="sm" color="inherit" className="text-slate-950" />
                                <span>{isResending ? "Sending..." : "Resend"}</span>
                              </button>
                            </div>
                          ) : !log.lastLoginAt ? (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <button
                                type="button"
                                onClick={() => openEditModal(log)}
                                title="Edit Details"
                                className="bg-slate-800 hover:bg-slate-700 text-white font-semibold border border-slate-700 text-xs rounded-lg px-2.5 py-1.5 transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5 shadow-2xs"
                              >
                                <AppIcon icon={EditPencil} size="sm" color="white" />
                                <span>Edit</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setCancelError(null);
                                  setPendingCancelLog(log);
                                }}
                                title="Cancel or Remove Account"
                                className="bg-[#780000] hover:bg-[#5e0000] text-white font-semibold border border-[#5e0000] text-xs rounded-lg px-2.5 py-1.5 transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5 shadow-2xs"
                              >
                                <AppIcon icon={Trash} size="sm" color="white" />
                                <span>Cancel</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => openResendModal(log)}
                                disabled={isResending}
                                title="Resend login credentials email"
                                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold border border-amber-600 text-xs rounded-lg px-2.5 py-1.5 transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5 shadow-2xs disabled:opacity-50"
                              >
                                <AppIcon icon={SendMail} size="sm" color="inherit" className="text-slate-950" />
                                <span>{isResending ? "Sending..." : "Resend"}</span>
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ── Desktop View: Responsive Full-Width Table (>= 768px) ── */}
                <div className="hidden md:block overflow-x-auto rounded-xl border border-amber-400/40 dark:border-amber-500/30 shadow-2xs">
                  <table className="w-full text-left border-collapse text-xs">
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
                        <th className="px-4 py-2.5 text-right font-semibold whitespace-nowrap min-w-[200px]">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                      {paginatedLogs.map((log, index) => {
                        const isAccepted = log.status === "Accepted";
                        const isResending = resendingEmail === log.email;
                        const itemIndex = (validCurrentPage - 1) * PAGE_SIZE + index + 1;

                        return (
                          <tr
                            key={`desktop-${log.email}-${log.invitedAt}-${index}`}
                            className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                          >
                            {/* # Index */}
                            <td className="px-3 py-2.5 text-center text-xs font-mono text-slate-400 dark:text-slate-500">
                              {itemIndex}
                            </td>

                            {/* Member Column */}
                            <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-slate-100">
                              <div className="flex items-center gap-2.5">
                                <UserLogAvatar
                                  avatarUrl={log.avatarUrl}
                                  name={log.fullName}
                                  size="sm"
                                />
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

                            {/* Actions - Solid Colors */}
                            <td className="px-4 py-2.5 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                {/* View Details Button - Solid Maroon */}
                                <button
                                  type="button"
                                  onClick={() => setSelectedLogForDetails(log)}
                                  title="View Details"
                                  className="bg-[#780000] hover:bg-[#5e0000] text-white font-semibold border border-[#5e0000] text-xs rounded-md px-2.5 py-1 transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                                >
                                  <AppIcon
                                    icon={Eye}
                                    size="sm"
                                    color="white"
                                  />
                                  <span>View Details</span>
                                </button>

                                {!isAccepted ? (
                                  <>
                                    {/* Edit Invite Button - Solid Slate */}
                                    <button
                                      type="button"
                                      onClick={() => openEditModal(log)}
                                      title="Edit Details"
                                      className="bg-slate-800 hover:bg-slate-700 text-white font-semibold border border-slate-700 text-xs rounded-md px-2.5 py-1 transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                                    >
                                      <AppIcon icon={EditPencil} size="sm" color="white" />
                                      <span>Edit</span>
                                    </button>

                                    {/* Cancel Invite Button - Solid Maroon */}
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

                                    {/* Resend Invite Button - Solid Gold */}
                                    <button
                                      type="button"
                                      onClick={() => openResendModal(log)}
                                      disabled={isResending}
                                      title="Resend invitation email"
                                      className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold border border-amber-600 text-xs rounded-md px-2.5 py-1 transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
                                    >
                                      <AppIcon
                                        icon={SendMail}
                                        size="sm"
                                        color="inherit"
                                        className="text-slate-950"
                                      />
                                      <span>
                                        {isResending ? "Resending..." : "Resend"}
                                      </span>
                                    </button>
                                  </>
                                ) : !log.lastLoginAt ? (
                                  <>
                                    {/* Edit Details Button - Solid Slate */}
                                    <button
                                      type="button"
                                      onClick={() => openEditModal(log)}
                                      title="Edit Details"
                                      className="bg-slate-800 hover:bg-slate-700 text-white font-semibold border border-slate-700 text-xs rounded-md px-2.5 py-1 transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                                    >
                                      <AppIcon icon={EditPencil} size="sm" color="white" />
                                      <span>Edit</span>
                                    </button>

                                    {/* Cancel / Delete bugged or unlogged account */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setCancelError(null);
                                        setPendingCancelLog(log);
                                      }}
                                      title="Cancel or Remove Account"
                                      className="bg-[#780000] hover:bg-[#5e0000] text-white font-semibold border border-[#5e0000] text-xs rounded-md px-2.5 py-1 transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                                    >
                                      <AppIcon icon={Trash} size="sm" color="white" />
                                      <span>Cancel</span>
                                    </button>

                                    {/* Resend Credentials Button - Solid Gold */}
                                    <button
                                      type="button"
                                      onClick={() => openResendModal(log)}
                                      disabled={isResending}
                                      title="Resend login credentials email"
                                      className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold border border-amber-600 text-xs rounded-md px-2.5 py-1 transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
                                    >
                                      <AppIcon
                                        icon={SendMail}
                                        size="sm"
                                        color="inherit"
                                        className="text-slate-950"
                                      />
                                      <span>
                                        {isResending ? "Resending..." : "Resend Credentials"}
                                      </span>
                                    </button>
                                  </>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {/* Modal Footer with Responsive Pagination Controls */}
          <div className="p-3 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400 shrink-0">
            {/* Entry Counter */}
            <div className="text-center sm:text-left w-full sm:w-auto font-medium">
              Showing {filteredLogs.length === 0 ? 0 : (validCurrentPage - 1) * PAGE_SIZE + 1} to{" "}
              {Math.min(validCurrentPage * PAGE_SIZE, filteredLogs.length)} of {filteredLogs.length} logs
              {filteredLogs.length !== logs.length ? ` (filtered from ${logs.length})` : ""}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 ? (
              <div className="flex items-center justify-center gap-1 w-full sm:w-auto">
                <button
                  type="button"
                  disabled={validCurrentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer font-medium text-xs shadow-2xs"
                  aria-label="Previous page"
                >
                  <AppIcon icon={NavArrowLeft} size="sm" color="inherit" />
                  <span className="hidden sm:inline">Prev</span>
                </button>

                {/* Page Number Buttons */}
                <div className="flex items-center gap-1">
                  {pageNumbers.map((p, idx) =>
                    typeof p === "number" ? (
                      <button
                        key={`page-${p}`}
                        type="button"
                        onClick={() => setCurrentPage(p)}
                        className={`h-7 w-7 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center justify-center ${
                          validCurrentPage === p
                            ? "bg-[#780000] text-white border border-[#5e0000] shadow-xs"
                            : "border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                        }`}
                        aria-current={validCurrentPage === p ? "page" : undefined}
                      >
                        {p}
                      </button>
                    ) : (
                      <span key={`ellipsis-${idx}`} className="px-1 text-slate-400">
                        ...
                      </span>
                    )
                  )}
                </div>

                <button
                  type="button"
                  disabled={validCurrentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer font-medium text-xs shadow-2xs"
                  aria-label="Next page"
                >
                  <span className="hidden sm:inline">Next</span>
                  <AppIcon icon={NavArrowRight} size="sm" color="inherit" />
                </button>
              </div>
            ) : null}

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto rounded-xl border border-[#5e0000] bg-[#780000] hover:bg-[#5e0000] px-4 py-2 sm:py-1.5 text-xs font-semibold text-white transition cursor-pointer text-center shadow-xs"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* ── View Details Modal ── */}
      {selectedLogForDetails ? (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/75 p-3 sm:p-4 backdrop-blur-sm animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-2xl border-2 border-amber-400 dark:border-amber-500/70 bg-white dark:bg-slate-900 p-4 sm:p-6 shadow-2xl text-slate-900 dark:text-slate-100 max-h-[90vh] overflow-y-auto">
            <ModalHeader
              icon={User}
              title="Invitation Details"
              subtitle="Comprehensive registration and account invite status"
              onClose={() => setSelectedLogForDetails(null)}
              className="-mx-4 -mt-4 sm:-mx-6 sm:-mt-6 mb-4 sm:mb-5 rounded-t-2xl"
            />

            <div className="space-y-4">
              {/* Recipient Profile Card */}
              <div className="flex items-center gap-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-3.5 sm:p-4">
                <UserLogAvatar
                  avatarUrl={selectedLogForDetails.avatarUrl}
                  name={selectedLogForDetails.fullName}
                  size="lg"
                />
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 text-xs">
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
                  {selectedLogForDetails.role === "Faculty" ? "Faculty Management" : "Staff Management"} list until the user verifies their email and completes setup.
                </div>
              ) : null}

              {/* Modal Actions - Solid Colors */}
              <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
                <div>
                  {selectedLogForDetails.status === "Pending" || !selectedLogForDetails.lastLoginAt ? (
                    <button
                      type="button"
                      onClick={() => {
                        const target = selectedLogForDetails;
                        setCancelError(null);
                        setPendingCancelLog(target);
                      }}
                      className="w-full sm:w-auto bg-[#780000] hover:bg-[#5e0000] text-white font-semibold border border-[#5e0000] text-xs rounded-xl px-3.5 py-2 transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5 shadow-2xs"
                    >
                      <AppIcon icon={Trash} size="sm" color="white" />
                      <span>Cancel Invite</span>
                    </button>
                  ) : null}
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  {selectedLogForDetails.status === "Pending" ? (
                    <button
                      type="button"
                      onClick={() => {
                        const target = selectedLogForDetails;
                        setSelectedLogForDetails(null);
                        openEditModal(target);
                      }}
                      className="flex-1 sm:flex-initial bg-slate-800 hover:bg-slate-700 text-white font-semibold border border-slate-700 text-xs rounded-xl px-3.5 py-2 transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5 shadow-2xs"
                    >
                      <AppIcon icon={EditPencil} size="sm" color="white" />
                      <span>Edit Details</span>
                    </button>
                  ) : null}
                  {selectedLogForDetails.status === "Pending" || !selectedLogForDetails.lastLoginAt ? (
                    <button
                      type="button"
                      onClick={() => openResendModal(selectedLogForDetails)}
                      disabled={resendingEmail === selectedLogForDetails.email}
                      className="flex-1 sm:flex-initial bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold border border-amber-600 text-xs rounded-xl px-3.5 py-2 transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5 shadow-2xs disabled:opacity-50"
                    >
                      <AppIcon icon={SendMail} size="sm" color="inherit" className="text-slate-950" />
                      <span>
                        {resendingEmail === selectedLogForDetails.email
                          ? "Resending..."
                          : selectedLogForDetails.status === "Pending"
                          ? "Resend Invite"
                          : "Resend Credentials"}
                      </span>
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setSelectedLogForDetails(null)}
                    className="flex-1 sm:flex-initial rounded-xl border border-[#5e0000] bg-[#780000] hover:bg-[#5e0000] px-4 py-2 text-xs font-semibold text-white transition cursor-pointer text-center shadow-xs"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Edit Registration Details Modal ── */}
      {editingLog ? (
        <div
          className="fixed inset-0 z-70 flex items-center justify-center bg-black/75 p-3 sm:p-4 backdrop-blur-sm animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-xl sm:max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl text-slate-900 dark:text-slate-100 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
            <ModalHeader
              icon={EditPencil}
              title="Edit Registration Details"
              subtitle={`Update credentials for ${editingLog.role}`}
              onClose={() => !isSavingEdit && setEditingLog(null)}
              closeDisabled={isSavingEdit}
              className="rounded-t-2xl shrink-0"
            />

            <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
              <AlertPopup
                type="error"
                message={editError}
                position="inline"
                onClose={() => setEditError(null)}
              />
              <AlertPopup
                type="warning"
                message={editNameAlert}
                position="inline"
                autoCloseMs={3500}
                onClose={() => setEditNameAlert(null)}
              />

              {/* Row 1: Name Grid (3 Columns) - Matching Add Faculty & Add Staff format */}
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 block" htmlFor="editFirstName">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="editFirstName"
                    type="text"
                    value={editFirstName}
                    onChange={(e) => handleEditNameInput(setEditFirstName, e.target.value)}
                    placeholder="e.g. Juan"
                    className="mt-1.5 w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-slate-900 dark:focus:border-slate-100 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl px-4 py-2.5 text-sm outline-none transition-all focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-100/10"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 block" htmlFor="editMiddleName">
                    Middle Name
                  </label>
                  <input
                    id="editMiddleName"
                    type="text"
                    value={editMiddleName}
                    onChange={(e) => handleEditNameInput(setEditMiddleName, e.target.value)}
                    placeholder="e.g. Santos"
                    className="mt-1.5 w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-slate-900 dark:focus:border-slate-100 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl px-4 py-2.5 text-sm outline-none transition-all focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-100/10"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 block" htmlFor="editLastName">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="editLastName"
                    type="text"
                    value={editLastName}
                    onChange={(e) => handleEditNameInput(setEditLastName, e.target.value)}
                    placeholder="e.g. Dela Cruz"
                    className="mt-1.5 w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-slate-900 dark:focus:border-slate-100 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl px-4 py-2.5 text-sm outline-none transition-all focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-100/10"
                  />
                </div>
              </div>

              {/* Email Address */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 block" htmlFor="editEmail">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  id="editEmail"
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="e.g. user@pup.edu.ph"
                  className="mt-1.5 w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-slate-900 dark:focus:border-slate-100 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl px-4 py-2.5 text-sm outline-none transition-all focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-100/10"
                />
              </div>

              {/* Program for Faculty */}
              {editingLog.role === "Faculty" ? (
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 block" htmlFor="editProgram">
                    Department / Program
                  </label>
                  <select
                    id="editProgram"
                    value={editProgram}
                    onChange={(e) => setEditProgram(e.target.value)}
                    className="mt-1.5 w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-slate-900 dark:focus:border-slate-100 text-slate-900 dark:text-slate-100 rounded-xl px-4 py-2.5 text-sm outline-none transition-all focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-100/10 cursor-pointer"
                  >
                    <option value="">Select Department / Program</option>
                    {editProgram && !programsList.some((p) => p.code.toLowerCase() === editProgram.toLowerCase()) ? (
                      <option value={editProgram}>{editProgram}</option>
                    ) : null}
                    {programsList.map((prog) => (
                      <option key={prog.id || prog.code} value={prog.code}>
                        {prog.code} — {prog.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {/* Action Buttons */}
              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingLog(null)}
                  disabled={isSavingEdit}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-slate-600 hover:bg-slate-500 border border-slate-700 transition cursor-pointer text-center shadow-2xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveEdit(false)}
                  disabled={isSavingEdit || !editEmail.trim() || !editFirstName.trim() || !editLastName.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#780000] hover:bg-[#5e0000] border border-[#5e0000] transition cursor-pointer disabled:opacity-50 shadow-xs text-center"
                >
                  {isSavingEdit ? "Saving..." : "Save Changes"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveEdit(true)}
                  disabled={isSavingEdit || !editEmail.trim() || !editFirstName.trim() || !editLastName.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 border border-amber-600 transition cursor-pointer disabled:opacity-50 shadow-xs inline-flex items-center justify-center gap-1.5"
                >
                  <AppIcon icon={SendMail} size="sm" color="inherit" className="text-slate-950" />
                  <span>{isSavingEdit ? "Saving & Sending..." : "Save & Resend Invite"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Cancel Invite Modal ── */}
      {pendingCancelLog ? (
        <div
          className="fixed inset-0 z-70 flex items-center justify-center bg-black/75 p-3 sm:p-4 backdrop-blur-sm animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border-2 border-amber-400 dark:border-amber-500/70 bg-white dark:bg-slate-900 p-4 sm:p-6 shadow-2xl text-slate-900 dark:text-slate-100 animate-in zoom-in-95 duration-150">
            <ModalHeader
              icon={Trash}
              title="Cancel Invitation?"
              subtitle="Revoke pending account invitation"
              onClose={() => !isCancelling && setPendingCancelLog(null)}
              closeDisabled={isCancelling}
              className="-mx-4 -mt-4 sm:-mx-6 sm:-mt-6 mb-4 sm:mb-5 rounded-t-2xl"
            />

            <div className="space-y-4">
              {/* Member Card - Centered Content */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-4 flex flex-col items-center justify-center text-center">
                <UserLogAvatar
                  avatarUrl={pendingCancelLog.avatarUrl}
                  name={pendingCancelLog.fullName}
                  size="lg"
                />
                <div className="min-w-0 w-full mt-2.5">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {pendingCancelLog.fullName}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate mt-0.5">
                    {pendingCancelLog.email}
                  </p>
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-1">
                    {pendingCancelLog.role}{" "}
                    {pendingCancelLog.program ? `• ${pendingCancelLog.program}` : ""}
                  </p>
                </div>
              </div>

              {/* Revoke Notice - Solid Maroon Banner */}
              <div className="rounded-xl border border-[#5e0000] bg-[#780000] p-3.5 text-xs leading-relaxed text-white text-center shadow-2xs">
                <p className="font-bold text-white flex items-center justify-center gap-1.5 mb-1 text-center">
                  <AppIcon icon={WarningTriangle} size="sm" color="white" />
                  <span>Revoke Invitation Notice</span>
                </p>
                <p className="text-white/95">
                  Are you sure you want to cancel the invitation for{" "}
                  <strong className="text-white font-bold underline decoration-white/40">{pendingCancelLog.fullName}</strong>? The invitation link will be
                  invalidated immediately. The user will not be able to activate this account,
                  and their pending registration record will be removed.
                </p>
              </div>

              {cancelError ? (
                <div className="p-3 rounded-xl text-xs font-semibold bg-red-50 text-red-800 border border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800/60 text-center">
                  {cancelError}
                </div>
              ) : null}

              {/* Confirmation Buttons */}
              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setPendingCancelLog(null)}
                  disabled={isCancelling}
                  className="w-full sm:w-auto rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 px-4 py-2 text-xs font-semibold text-white transition cursor-pointer disabled:opacity-50 text-center shadow-2xs"
                >
                  Keep Invitation
                </button>
                <button
                  type="button"
                  onClick={() => void handleConfirmCancelInvite()}
                  disabled={isCancelling}
                  className="w-full sm:w-auto bg-[#780000] hover:bg-[#5e0000] text-white font-semibold border border-[#5e0000] text-xs rounded-xl px-4 py-2 transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5 shadow-2xs disabled:opacity-50"
                >
                  <AppIcon icon={Trash} size="sm" color="white" />
                  <span>{isCancelling ? "Cancelling..." : "Yes, Cancel Invite"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Resend Invite Confirmation Modal ── */}
      {pendingResendLog ? (
        <div
          className="fixed inset-0 z-70 flex items-center justify-center bg-black/75 p-3 sm:p-4 backdrop-blur-sm animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border-2 border-amber-400 dark:border-amber-500/70 bg-white dark:bg-slate-900 p-4 sm:p-6 shadow-2xl text-slate-900 dark:text-slate-100 animate-in zoom-in-95 duration-150">
            <ModalHeader
              icon={SendMail}
              title={pendingResendLog.status === "Pending" ? "Resend Invitation?" : "Resend Credentials?"}
              subtitle={
                pendingResendLog.status === "Pending"
                  ? "Dispatch fresh activation email"
                  : "Dispatch account credentials email"
              }
              onClose={() => !resendingEmail && setPendingResendLog(null)}
              closeDisabled={Boolean(resendingEmail)}
              className="-mx-4 -mt-4 sm:-mx-6 sm:-mt-6 mb-4 sm:mb-5 rounded-t-2xl"
            />

            <div className="space-y-4">
              {/* Member Card - Centered Content */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-4 flex flex-col items-center justify-center text-center">
                <UserLogAvatar
                  avatarUrl={pendingResendLog.avatarUrl}
                  name={pendingResendLog.fullName}
                  size="lg"
                />
                <div className="min-w-0 w-full mt-2.5">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {pendingResendLog.fullName}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate mt-0.5">
                    {pendingResendLog.email}
                  </p>
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-1">
                    {pendingResendLog.role}{" "}
                    {pendingResendLog.program ? `• ${pendingResendLog.program}` : ""}
                  </p>
                </div>
              </div>

              {/* Delivery Notice - Solid Amber Banner */}
              <div className="rounded-xl border border-amber-600 bg-amber-500 p-3.5 text-xs leading-relaxed text-slate-950 text-center shadow-2xs">
                <p className="font-bold text-slate-950 flex items-center justify-center gap-1.5 mb-1 text-center">
                  <AppIcon icon={SendMail} size="sm" color="inherit" className="text-slate-950" />
                  <span>Email Dispatch Notice</span>
                </p>
                <div className="text-slate-950/95 font-medium">
                  {pendingResendLog.status === "Pending" ? (
                    <>
                      Are you sure you want to resend the invitation email to{" "}
                      <strong className="text-slate-950 font-bold underline decoration-slate-950/40">{pendingResendLog.fullName}</strong>? An updated activation link will be sent to{" "}
                      <strong className="text-slate-950 font-bold underline decoration-slate-950/40">{pendingResendLog.email}</strong>.
                    </>
                  ) : (
                    <>
                      Are you sure you want to resend credentials to{" "}
                      <strong className="text-slate-950 font-bold underline decoration-slate-950/40">{pendingResendLog.fullName}</strong>? An email with login instructions will be sent to{" "}
                      <strong className="text-slate-950 font-bold underline decoration-slate-950/40">{pendingResendLog.email}</strong>.
                    </>
                  )}
                </div>
              </div>

              {resendError ? (
                <div className="p-3 rounded-xl text-xs font-semibold bg-red-50 text-red-800 border border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800/60 text-center">
                  {resendError}
                </div>
              ) : null}

              {/* Confirmation Buttons - Solid Colors & Centered */}
              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setPendingResendLog(null)}
                  disabled={Boolean(resendingEmail)}
                  className="w-full sm:w-auto rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 px-4 py-2 text-xs font-semibold text-white transition cursor-pointer disabled:opacity-50 text-center shadow-2xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleConfirmResendInvite()}
                  disabled={Boolean(resendingEmail)}
                  className="w-full sm:w-auto bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold border border-amber-600 text-xs rounded-xl px-4 py-2 transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5 shadow-2xs disabled:opacity-50"
                >
                  <AppIcon icon={SendMail} size="sm" color="inherit" className="text-slate-950" />
                  <span>{resendingEmail ? "Sending..." : "Yes, Resend Email"}</span>
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
