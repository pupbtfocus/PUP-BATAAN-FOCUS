"use client";

import React, { useState, useMemo } from "react";
import {
  CheckCircle,
  EditPencil,
  Eye,
  Group,
  Shield,
  Trash,
  UserBadgeCheck,
  UserXmark,
  Xmark,
  XmarkCircle,
} from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";
import { AlertPopup } from "@/components/ui/alert-popup";
import { ROLE, type AppRole, canManageAdminAccount } from "@/config/roles";
import { exportReportToExcel, exportReportToPdf } from "@/lib/report-export";

export interface AdminAccount {
  id?: string;
  profile_id: string;
  full_name: string;
  email: string;
  profileImageUrl?: string | null;
  profile?: {
    firstName?: string | null;
    middleName?: string | null;
    lastName?: string | null;
    avatar_url?: string | null;
    picture?: string | null;
    fullName?: string | null;
  } | null;
  role: AppRole;
  is_active: boolean;
  department?: string | null;
  permissions?: string[];
  created_at: string;
  last_sign_in_at?: string | null;
  lastLoginAt?: string | null;
}

export interface AdminAccountsTableProps {
  adminAccounts: AdminAccount[];
  isLoading: boolean;
  onEditAdmin: (profileId: string) => void;
  onViewDetails: (profileId: string) => void;
  onDeactivateAdmin: (profileId: string) => void;
  onActivateAdmin: (profileId: string) => void;
  onDeleteAdmin: (profileId: string) => void;
  loadingAdminIds?: Set<string>;
  deletingAdminIds?: Set<string>;
  accountsError?: string | null;
  accountActionError?: string | null;
  accountActionSuccess?: string | null;
  onClearMessages?: () => void;
  currentAdminEmail?: string | null;
}

function getInitials(name?: string | null, fallback = "AD"): string {
  if (!name || !name.trim()) return fallback;
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return parts[0].slice(0, 2).toUpperCase() || fallback;
}

function formatAdminName(admin: AdminAccount): string {
  const profile = admin.profile;
  const firstName = profile?.firstName?.trim() || "";
  const middleName = profile?.middleName?.trim() || "";
  const lastName = profile?.lastName?.trim() || "";

  if (firstName || lastName) {
    const middleInitial = middleName ? `${middleName[0]}.` : "";
    return [firstName, middleInitial, lastName].filter(Boolean).join(" ");
  }

  if (admin.full_name?.trim()) {
    return admin.full_name.trim();
  }

  const parts = (admin.email || "").split("@")[0].split(/[._-]/);
  return parts
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function formatLastLogin(isoDate?: string | null): string {
  if (!isoDate) return "Never logged in";
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "Never logged in";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function isAdministratorAccount(account: AdminAccount): boolean {
  const r = (account.role || "").toLowerCase().trim();
  return (
    r === "admin" ||
    r.includes("super") ||
    account.email?.toLowerCase() === "pupbataanfocus.superadmin@gmail.com" ||
    account.email?.toLowerCase() === "pupbataanfocus.admin@gmail.com"
  );
}

export function AdminStatsCards({
  adminAccounts,
  isLoading = false,
  entityLabel = "Staff",
}: {
  adminAccounts: AdminAccount[];
  isLoading?: boolean;
  entityLabel?: string;
}) {
  const totalCount = adminAccounts.length;
  const activeCount = adminAccounts.filter((a) => a.is_active).length;
  const inactiveCount = adminAccounts.filter((a) => !a.is_active).length;

  return (
    <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
      {/* 1. TOTAL */}
      <div className="rounded-xl bg-white text-slate-900 border border-slate-200 shadow-xs dark:bg-slate-900 dark:text-slate-100 dark:border-slate-800 p-3 sm:p-5 transition-colors flex flex-col justify-between">
        <div className="flex items-center justify-between gap-1.5">
          <p className="text-slate-500 dark:text-slate-400 text-[10px] sm:text-xs font-medium uppercase tracking-wide sm:tracking-wider leading-tight">
            Total {entityLabel}
          </p>
          <Group className="hidden sm:block h-5 w-5 text-slate-400 shrink-0" strokeWidth={2} />
        </div>
        <p className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
          {isLoading ? "..." : totalCount}
        </p>
      </div>

      {/* 2. ACTIVE */}
      <div className="rounded-xl bg-white text-slate-900 border border-slate-200 shadow-xs dark:bg-slate-900 dark:text-slate-100 dark:border-slate-800 p-3 sm:p-5 transition-colors flex flex-col justify-between">
        <div className="flex items-center justify-between gap-1.5">
          <p className="text-slate-500 dark:text-slate-400 text-[10px] sm:text-xs font-medium uppercase tracking-wide sm:tracking-wider leading-tight">
            Active {entityLabel}
          </p>
          <CheckCircle className="hidden sm:block h-5 w-5 text-slate-400 shrink-0" strokeWidth={2} />
        </div>
        <p className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
          {isLoading ? "..." : activeCount}
        </p>
      </div>

      {/* 3. INACTIVE */}
      <div className="rounded-xl bg-white text-slate-900 border border-slate-200 shadow-xs dark:bg-slate-900 dark:text-slate-100 dark:border-slate-800 p-3 sm:p-5 transition-colors flex flex-col justify-between">
        <div className="flex items-center justify-between gap-1.5">
          <p className="text-slate-500 dark:text-slate-400 text-[10px] sm:text-xs font-medium uppercase tracking-wide sm:tracking-wider leading-tight">
            Inactive {entityLabel}
          </p>
          <XmarkCircle className="hidden sm:block h-5 w-5 text-slate-400 shrink-0" strokeWidth={2} />
        </div>
        <p className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
          {isLoading ? "..." : inactiveCount}
        </p>
      </div>
    </div>
  );
}

export function AdminFilterBar({
  searchTerm,
  onSearchChange,
  roleFilter,
  onRoleFilterChange,
  statusFilter,
  onStatusFilterChange,
  onExportPdf,
  onExportExcel,
  placeholder = "Search staff by name or email...",
  showRoleFilter = true,
  exportLabel = "Staff",
}: {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  roleFilter: "all" | string;
  onRoleFilterChange: (role: "all" | string) => void;
  statusFilter: "all" | "active" | "inactive";
  onStatusFilterChange: (status: "all" | "active" | "inactive") => void;
  onExportPdf?: () => void;
  onExportExcel?: () => void;
  placeholder?: string;
  showRoleFilter?: boolean;
  exportLabel?: string;
}) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3.5 sm:p-4 bg-white text-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs dark:bg-slate-900 dark:text-slate-100 rounded-xl transition-colors">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto flex-wrap flex-1">
        <input
          type="text"
          value={searchTerm}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={placeholder}
          className="w-full sm:flex-1 sm:min-w-[200px] lg:max-w-xs h-9 rounded-xl bg-white text-slate-900 border border-slate-200 focus:border-slate-400 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-800 dark:focus:border-slate-600 px-3 text-xs placeholder-slate-400 dark:placeholder-slate-500 outline-none transition"
        />

        {showRoleFilter && (
          <select
            value={roleFilter}
            onChange={(e) => onRoleFilterChange(e.target.value)}
            className="w-full sm:w-44 h-9 rounded-xl bg-white text-slate-900 border border-slate-200 focus:border-slate-400 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-800 dark:focus:border-slate-600 px-3 text-xs outline-none transition cursor-pointer"
          >
            <option value="all">All Roles</option>
            <option value={ROLE.STAFF}>Staff</option>
            <option value={ROLE.ADMIN}>Admin</option>
          </select>
        )}

        <div className="grid grid-cols-3 sm:inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-1 h-9 w-full sm:w-auto shrink-0">
          <button
            type="button"
            onClick={() => onStatusFilterChange("all")}
            className={`inline-flex items-center justify-center rounded-lg px-2.5 py-1 text-xs transition cursor-pointer ${
              statusFilter === "all"
                ? "bg-amber-500 text-slate-950 font-semibold shadow-xs border border-amber-600/30"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800/60 font-normal"
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => onStatusFilterChange("active")}
            className={`inline-flex items-center justify-center rounded-lg px-2.5 py-1 text-xs transition cursor-pointer ${
              statusFilter === "active"
                ? "bg-amber-500 text-slate-950 font-semibold shadow-xs border border-amber-600/30"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800/60 font-normal"
            }`}
          >
            Active
          </button>
          <button
            type="button"
            onClick={() => onStatusFilterChange("inactive")}
            className={`inline-flex items-center justify-center rounded-lg px-2.5 py-1 text-xs transition cursor-pointer ${
              statusFilter === "inactive"
                ? "bg-amber-500 text-slate-950 font-semibold shadow-xs border border-amber-600/30"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800/60 font-normal"
            }`}
          >
            Inactive
          </button>
        </div>
      </div>

      {(onExportPdf || onExportExcel) && (
        <div className="grid grid-cols-2 sm:inline-flex items-center gap-2 shrink-0 w-full lg:w-auto">
          {onExportPdf && (
            <button
              type="button"
              onClick={onExportPdf}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] px-3 py-2 sm:py-1.5 text-xs font-bold transition cursor-pointer shadow-xs"
              title={`Export ${exportLabel} List to PDF`}
            >
              <img
                src="/icons/adobe-pdf.svg"
                alt="PDF"
                className="h-4 w-4 shrink-0 object-contain"
              />
              <span>Export PDF</span>
            </button>
          )}
          {onExportExcel && (
            <button
              type="button"
              onClick={onExportExcel}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#0b5336] hover:bg-[#08412a] text-white border border-[#08412a] px-3 py-2 sm:py-1.5 text-xs font-bold transition cursor-pointer shadow-xs"
              title={`Export ${exportLabel} List to Excel`}
            >
              <img
                src="/icons/microsoft-excel.svg"
                alt="Excel"
                className="h-4 w-4 shrink-0 object-contain"
              />
              <span>Export Excel</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function AdminAccountsTable({
  adminAccounts,
  isLoading,
  onEditAdmin,
  onViewDetails,
  onDeactivateAdmin,
  onActivateAdmin,
  onDeleteAdmin,
  loadingAdminIds = new Set(),
  deletingAdminIds = new Set(),
  accountsError,
  accountActionError,
  accountActionSuccess,
  onClearMessages = () => {},
  currentAdminEmail,
}: AdminAccountsTableProps) {
  const [activeTab, setActiveTab] = useState<"all" | "admin" | "staff">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | string>("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("all");
  const [failedImageIds, setFailedImageIds] = useState<Set<string>>(new Set());

  const staffOnlyAccounts = useMemo(
    () => adminAccounts.filter((a) => !isAdministratorAccount(a)),
    [adminAccounts]
  );
  const adminOnlyAccounts = useMemo(
    () => adminAccounts.filter((a) => isAdministratorAccount(a)),
    [adminAccounts]
  );

  const currentTabBaseAccounts = useMemo(() => {
    if (activeTab === "staff") return staffOnlyAccounts;
    if (activeTab === "admin") return adminOnlyAccounts;
    return adminAccounts;
  }, [activeTab, staffOnlyAccounts, adminOnlyAccounts, adminAccounts]);

  const filteredAccounts = useMemo(() => {
    let result = currentTabBaseAccounts;

    if (activeTab === "all" && roleFilter !== "all") {
      result = result.filter((a) => {
        const isAdmin = isAdministratorAccount(a);
        if (roleFilter === ROLE.ADMIN) {
          return isAdmin;
        }
        return !isAdmin;
      });
    }

    if (statusFilter === "active") {
      result = result.filter((a) => a.is_active);
    } else if (statusFilter === "inactive") {
      result = result.filter((a) => !a.is_active);
    }

    const query = searchTerm.trim().toLowerCase();
    if (!query) return result.slice().sort((a, b) => formatAdminName(a).localeCompare(formatAdminName(b)));

    return result
      .filter((admin) => {
        const name = formatAdminName(admin).toLowerCase();
        const email = (admin.email || "").toLowerCase();
        return name.includes(query) || email.includes(query);
      })
      .slice()
      .sort((a, b) => formatAdminName(a).localeCompare(formatAdminName(b)));
  }, [currentTabBaseAccounts, activeTab, roleFilter, statusFilter, searchTerm]);

  const entityLabel =
    activeTab === "admin"
      ? "Administrator"
      : activeTab === "staff"
      ? "Staff"
      : "Admin & Staff";

  const buildStaffReportPayload = () => {
    const activeCount = filteredAccounts.filter((a) => a.is_active).length;
    const inactiveCount = filteredAccounts.length - activeCount;

    return {
      title: `${entityLabel} Directory Report`,
      subtitle: `View: ${
        activeTab === "staff"
          ? "Staff Accounts"
          : activeTab === "admin"
          ? "Administrator Accounts"
          : "All Accounts"
      } • Status: ${statusFilter.toUpperCase()}`,
      fileName: `PUP_FOCUS_${activeTab === "admin" ? "Admin" : "Staff"}_Report_${new Date().toISOString().slice(0, 10)}`,
      summaryStats: [
        {
          label: `Total Listed ${entityLabel}`,
          value: filteredAccounts.length,
          tone: "default" as const,
        },
        { label: `Active ${entityLabel}`, value: activeCount, tone: "success" as const },
        {
          label: `Inactive ${entityLabel}`,
          value: inactiveCount,
          tone: "danger" as const,
        },
      ],
      columns: [
        { header: "#", key: "index", align: "center" as const },
        { header: `${entityLabel} Member`, key: "name" },
        { header: "Email Address", key: "email" },
        { header: "Role", key: "role", align: "center" as const },
        { header: "Status", key: "status", align: "center" as const },
        { header: "Last Login", key: "lastLogin" },
      ],
      rows: filteredAccounts.map((admin, index) => {
        const isSuperAdmin = isAdministratorAccount(admin);
        return {
          index: index + 1,
          name: formatAdminName(admin),
          email: admin.email || "—",
          role: isSuperAdmin ? "Admin" : "Staff",
          status: admin.is_active ? "Active" : "Inactive",
          lastLogin: formatLastLogin(
            admin.last_sign_in_at || admin.lastLoginAt,
          ),
        };
      }),
    };
  };

  return (
    <div className="space-y-4">
      <AlertPopup
        type="error"
        message={accountsError}
        onClose={onClearMessages}
      />

      <AlertPopup
        type="error"
        message={accountActionError}
        onClose={onClearMessages}
      />

      <AlertPopup
        type="success"
        message={accountActionSuccess}
        onClose={onClearMessages}
      />

      {/* Segmented Workspace Tabs - Separates Admin and Staff accounts */}
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:inline-flex items-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-full lg:w-auto">
        <button
          type="button"
          onClick={() => {
            setActiveTab("all");
            setRoleFilter("all");
          }}
          className={`w-full lg:w-auto inline-flex items-center justify-between lg:justify-center gap-2 px-3.5 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeTab === "all"
              ? "bg-[#780000] text-white border border-[#5e0000] shadow-xs"
              : "bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-750 shadow-2xs"
          }`}
        >
          <span className="inline-flex items-center gap-2 min-w-0">
            <AppIcon icon={Group} size="sm" color="inherit" />
            <span className="truncate">All Accounts</span>
          </span>
          <span
            className={`px-1.5 py-0.5 rounded-md text-[10px] font-black shrink-0 ${
              activeTab === "all"
                ? "bg-amber-400 text-slate-950"
                : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600"
            }`}
          >
            {adminAccounts.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("admin");
            setRoleFilter("all");
          }}
          className={`w-full lg:w-auto inline-flex items-center justify-between lg:justify-center gap-2 px-3.5 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeTab === "admin"
              ? "bg-[#780000] text-white border border-[#5e0000] shadow-xs"
              : "bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-750 shadow-2xs"
          }`}
        >
          <span className="inline-flex items-center gap-2 min-w-0">
            <AppIcon icon={Shield} size="sm" color="inherit" />
            <span className="truncate">Administrator Accounts</span>
          </span>
          <span
            className={`px-1.5 py-0.5 rounded-md text-[10px] font-black shrink-0 ${
              activeTab === "admin"
                ? "bg-amber-400 text-slate-950"
                : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600"
            }`}
          >
            {adminOnlyAccounts.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("staff");
            setRoleFilter("all");
          }}
          className={`w-full lg:w-auto inline-flex items-center justify-between lg:justify-center gap-2 px-3.5 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeTab === "staff"
              ? "bg-[#780000] text-white border border-[#5e0000] shadow-xs"
              : "bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-750 shadow-2xs"
          }`}
        >
          <span className="inline-flex items-center gap-2 min-w-0">
            <AppIcon icon={UserBadgeCheck} size="sm" color="inherit" />
            <span className="truncate">Staff Accounts</span>
          </span>
          <span
            className={`px-1.5 py-0.5 rounded-md text-[10px] font-black shrink-0 ${
              activeTab === "staff"
                ? "bg-amber-400 text-slate-950"
                : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600"
            }`}
          >
            {staffOnlyAccounts.length}
          </span>
        </button>
      </div>

      {/* 3 Stat Cards tailored to active tab */}
      <AdminStatsCards
        adminAccounts={currentTabBaseAccounts}
        isLoading={isLoading}
        entityLabel={
          activeTab === "admin"
            ? "Administrators"
            : activeTab === "staff"
            ? "Staff"
            : "Accounts"
        }
      />

      {/* Filter Bar */}
      <AdminFilterBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        roleFilter={roleFilter}
        onRoleFilterChange={setRoleFilter}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        onExportPdf={() => exportReportToPdf(buildStaffReportPayload())}
        onExportExcel={() => exportReportToExcel(buildStaffReportPayload())}
        placeholder={
          activeTab === "admin"
            ? "Search administrators by name or email..."
            : activeTab === "staff"
            ? "Search staff by name or email..."
            : "Search accounts by name or email..."
        }
        showRoleFilter={activeTab === "all"}
        exportLabel={
          activeTab === "admin"
            ? "Administrator"
            : activeTab === "staff"
            ? "Staff"
            : "Admin & Staff"
        }
      />

      {/* Mobile Card List (aligned cleanly without horizontal table clipping) */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-8 text-center text-xs text-slate-500 dark:text-slate-400">
            Loading accounts...
          </div>
        ) : filteredAccounts.length === 0 ? (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-8 text-center text-xs text-slate-500 dark:text-slate-400">
            {activeTab === "staff"
              ? "No staff members match the selected criteria."
              : activeTab === "admin"
              ? "No administrator accounts match the selected criteria."
              : "No accounts match the selected criteria."}
          </div>
        ) : (
          filteredAccounts.map((admin, index) => {
            const isSuperAdmin = isAdministratorAccount(admin);
            const hasAvatar =
              admin.profileImageUrl && !failedImageIds.has(admin.profile_id);
            const isDeactivatingOrActivating = loadingAdminIds.has(
              admin.profile_id,
            );
            const isDeleting = deletingAdminIds.has(admin.profile_id);
            const canEdit = canManageAdminAccount({
              targetEmail: admin.email,
              targetRole: admin.role,
              actorEmail: currentAdminEmail,
              action: "edit",
            });
            const canDeactivate = canManageAdminAccount({
              targetEmail: admin.email,
              targetRole: admin.role,
              actorEmail: currentAdminEmail,
              action: "deactivate",
            });
            const canDelete = canManageAdminAccount({
              targetEmail: admin.email,
              targetRole: admin.role,
              actorEmail: currentAdminEmail,
              action: "delete",
            });

            return (
              <div
                key={admin.profile_id}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-xs space-y-3"
              >
                <div className="flex items-start justify-between gap-2.5">
                  <div
                    className="flex items-center gap-2.5 min-w-0 cursor-pointer flex-1"
                    onClick={() => onViewDetails(admin.profile_id)}
                  >
                    <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500 shrink-0 w-4 text-center">
                      {index + 1}
                    </span>
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300"
                      aria-hidden="true"
                    >
                      {hasAvatar ? (
                        <img
                          src={admin.profileImageUrl!}
                          alt=""
                          className="h-full w-full object-cover"
                          onError={() =>
                            setFailedImageIds((prev) =>
                              new Set(prev).add(admin.profile_id),
                            )
                          }
                        />
                      ) : (
                        <span>
                          {getInitials(
                            formatAdminName(admin),
                            isSuperAdmin ? "SA" : "AD",
                          )}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm truncate">
                        {formatAdminName(admin)}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {admin.email}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {admin.is_active ? (
                      <span className="bg-[#0b5336] text-white border border-[#08412a] px-2 py-0.5 text-[10px] font-bold rounded-md inline-flex items-center shadow-2xs">
                        Active
                      </span>
                    ) : (
                      <span className="bg-[#780000] text-white border border-[#5e0000] px-2 py-0.5 text-[10px] font-bold rounded-md inline-flex items-center shadow-2xs">
                        Inactive
                      </span>
                    )}
                    <span className="bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 px-2 py-0.5 text-[10px] font-semibold rounded-md inline-flex items-center">
                      {isSuperAdmin ? "Admin" : "Staff"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-2">
                  <span>Last Login</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {admin.last_sign_in_at || admin.lastLoginAt
                      ? formatLastLogin(
                          admin.last_sign_in_at || admin.lastLoginAt,
                        )
                      : "Never logged in"}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => onViewDetails(admin.profile_id)}
                    className="flex-1 min-w-[100px] bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold border border-amber-600/30 text-xs rounded-lg px-2.5 py-1.5 transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5 shadow-2xs"
                  >
                    <AppIcon icon={Eye} size="sm" color="inherit" className="text-slate-950" />
                    <span>View Details</span>
                  </button>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => onEditAdmin(admin.profile_id)}
                      className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold border border-amber-600/30 text-xs rounded-lg px-2.5 py-1.5 transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5 shadow-2xs"
                    >
                      <AppIcon icon={EditPencil} size="sm" color="inherit" className="text-slate-950" />
                      <span>Edit</span>
                    </button>
                  )}
                  {canDeactivate ? (
                    admin.is_active ? (
                      <button
                        type="button"
                        onClick={() => onDeactivateAdmin(admin.profile_id)}
                        disabled={isDeactivatingOrActivating || isDeleting}
                        className="bg-[#780000] hover:bg-[#5e0000] text-white font-semibold border border-[#5e0000] text-xs rounded-lg px-2.5 py-1.5 transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-2xs"
                      >
                        <AppIcon icon={UserXmark} size="sm" color="white" />
                        <span>{isDeactivatingOrActivating ? "Deactivating..." : "Deactivate"}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onActivateAdmin(admin.profile_id)}
                        disabled={isDeactivatingOrActivating || isDeleting}
                        className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold border border-amber-600/30 text-xs rounded-lg px-2.5 py-1.5 transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-2xs"
                      >
                        <AppIcon icon={UserBadgeCheck} size="sm" color="inherit" className="text-slate-950" />
                        <span>{isDeactivatingOrActivating ? "Activating..." : "Activate"}</span>
                      </button>
                    )
                  ) : null}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => onDeleteAdmin(admin.profile_id)}
                      disabled={isDeactivatingOrActivating || isDeleting}
                      className="bg-[#780000] hover:bg-[#5e0000] text-white font-semibold border border-[#5e0000] text-xs rounded-lg px-2.5 py-1.5 transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-2xs"
                    >
                      <AppIcon icon={Trash} size="sm" color="white" />
                      <span>{isDeleting ? "Deleting..." : "Delete"}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Desktop Data Table */}
      <div className="hidden md:block w-full overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100 shadow-xs transition-colors">
        <table className="w-full text-left border-collapse text-xs text-slate-800 dark:text-slate-300 min-w-[700px]">
          <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 uppercase tracking-wider text-[10px] text-slate-600 dark:text-slate-400">
            <tr>
              <th className="px-3 py-2.5 font-semibold w-10 text-center">#</th>
              <th className="px-4 py-2.5 font-semibold">
                {activeTab === "staff"
                  ? "Staff Member"
                  : activeTab === "admin"
                  ? "Administrator"
                  : "Member"}
              </th>
              <th className="px-4 py-2.5 font-semibold">Role</th>
              <th className="px-4 py-2.5 font-semibold">Status</th>
              <th className="px-4 py-2.5 font-semibold">Last Login</th>
              <th className="px-4 py-2.5 text-right font-semibold whitespace-nowrap">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
            {isLoading ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-xs text-slate-500 dark:text-slate-400"
                >
                  Loading accounts...
                </td>
              </tr>
            ) : filteredAccounts.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-xs text-slate-500 dark:text-slate-400"
                >
                  {activeTab === "staff"
                    ? "No staff members match the selected criteria."
                    : activeTab === "admin"
                    ? "No administrator accounts match the selected criteria."
                    : "No accounts match the selected criteria."}
                </td>
              </tr>
            ) : (
              filteredAccounts.map((admin, index) => {
                const isSuperAdmin = isAdministratorAccount(admin);
                const hasAvatar =
                  admin.profileImageUrl &&
                  !failedImageIds.has(admin.profile_id);
                const isDeactivatingOrActivating = loadingAdminIds.has(
                  admin.profile_id,
                );
                const isDeleting = deletingAdminIds.has(admin.profile_id);
                const canEdit = canManageAdminAccount({
                  targetEmail: admin.email,
                  targetRole: admin.role,
                  actorEmail: currentAdminEmail,
                  action: "edit",
                });
                const canDeactivate = canManageAdminAccount({
                  targetEmail: admin.email,
                  targetRole: admin.role,
                  actorEmail: currentAdminEmail,
                  action: "deactivate",
                });
                const canDelete = canManageAdminAccount({
                  targetEmail: admin.email,
                  targetRole: admin.role,
                  actorEmail: currentAdminEmail,
                  action: "delete",
                });

                return (
                  <tr
                    key={admin.profile_id}
                    className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    {/* Index */}
                    <td className="px-3 py-2.5 text-center text-xs font-mono text-slate-400 dark:text-slate-500">
                      {index + 1}
                    </td>

                    {/* Admin Member */}
                    <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-slate-200">
                      <div
                        className="flex items-center gap-2.5 cursor-pointer"
                        onClick={() => onViewDetails(admin.profile_id)}
                      >
                        <div
                          className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-slate-700 dark:text-slate-300"
                          aria-hidden="true"
                        >
                          {hasAvatar ? (
                            <img
                              src={admin.profileImageUrl!}
                              alt=""
                              className="h-full w-full object-cover"
                              onError={() =>
                                setFailedImageIds((prev) =>
                                  new Set(prev).add(admin.profile_id),
                                )
                              }
                            />
                          ) : (
                            <span>
                              {getInitials(
                                formatAdminName(admin),
                                isSuperAdmin ? "SA" : "AD",
                              )}
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-slate-900 dark:text-slate-200 text-xs hover:text-amber-600 dark:hover:text-amber-300 transition">
                            {formatAdminName(admin)}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                            {admin.email}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Role Badge */}
                    <td className="px-4 py-2.5 font-medium text-xs">
                      <span className="bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 px-2 py-0.5 text-xs font-semibold rounded-md inline-flex items-center">
                        {isSuperAdmin ? "Admin" : "Staff"}
                      </span>
                    </td>

                    {/* Status Badge */}
                    <td className="px-4 py-2.5 font-medium">
                      {admin.is_active ? (
                        <span className="bg-[#0b5336] text-white border border-[#08412a] px-2 py-0.5 text-xs font-semibold rounded-md inline-flex items-center shadow-2xs">
                          Active
                        </span>
                      ) : (
                        <span className="bg-[#780000] text-white border border-[#5e0000] px-2 py-0.5 text-xs font-semibold rounded-md inline-flex items-center shadow-2xs">
                          Inactive
                        </span>
                      )}
                    </td>

                    {/* Last Login */}
                    <td className="px-4 py-2.5 font-medium text-xs whitespace-nowrap text-slate-700 dark:text-slate-300">
                      {admin.last_sign_in_at || admin.lastLoginAt ? (
                        <span>
                          {formatLastLogin(
                            admin.last_sign_in_at || admin.lastLoginAt,
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500 italic text-[11px]">
                          Never logged in
                        </span>
                      )}
                    </td>

                    {/* Inline Actions */}
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5 shrink-0">
                        {/* View Details Button */}
                        <button
                          type="button"
                          onClick={() => onViewDetails(admin.profile_id)}
                          title={`View ${isSuperAdmin ? "Admin" : "Staff"} Details`}
                          className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold border border-amber-600/30 text-xs rounded-md px-2.5 py-1 transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-2xs shrink-0 whitespace-nowrap"
                        >
                          <AppIcon
                            icon={Eye}
                            size="sm"
                            color="inherit"
                            className="text-slate-950"
                          />
                          <span>View Details</span>
                        </button>

                        {/* Edit Button */}
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => onEditAdmin(admin.profile_id)}
                            title={`Edit ${isSuperAdmin ? "Admin" : "Staff"}`}
                            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold border border-amber-600/30 text-xs rounded-md px-2.5 py-1 transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-2xs shrink-0 whitespace-nowrap"
                          >
                            <AppIcon
                              icon={EditPencil}
                              size="sm"
                              color="inherit"
                              className="text-slate-950"
                            />
                            <span>Edit</span>
                          </button>
                        )}

                        {/* Deactivate / Activate Button */}
                        {canDeactivate ? (
                          admin.is_active ? (
                            <button
                              type="button"
                              onClick={() =>
                                onDeactivateAdmin(admin.profile_id)
                              }
                              disabled={
                                isDeactivatingOrActivating || isDeleting
                              }
                              title={`Deactivate ${isSuperAdmin ? "Admin" : "Staff"}`}
                              className="bg-[#780000] hover:bg-[#5e0000] text-white font-semibold border border-[#5e0000] text-xs rounded-md px-2.5 py-1 transition-colors cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50 shadow-2xs shrink-0 whitespace-nowrap"
                            >
                              <AppIcon
                                icon={UserXmark}
                                size="sm"
                                color="white"
                              />
                              <span>
                                {isDeactivatingOrActivating
                                  ? "Deactivating..."
                                  : "Deactivate"}
                              </span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onActivateAdmin(admin.profile_id)}
                              disabled={
                                isDeactivatingOrActivating || isDeleting
                              }
                              title={`Activate ${isSuperAdmin ? "Admin" : "Staff"}`}
                              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold border border-amber-600/30 text-xs rounded-md px-2.5 py-1 transition-colors cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50 shadow-2xs shrink-0 whitespace-nowrap"
                            >
                              <AppIcon
                                icon={UserBadgeCheck}
                                size="sm"
                                color="inherit"
                                className="text-slate-950"
                              />
                              <span>
                                {isDeactivatingOrActivating
                                  ? "Activating..."
                                  : "Activate"}
                              </span>
                            </button>
                          )
                        ) : null}

                        {/* Delete Button */}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => onDeleteAdmin(admin.profile_id)}
                            disabled={isDeactivatingOrActivating || isDeleting}
                            title={`Delete ${isSuperAdmin ? "Admin" : "Staff"}`}
                            className="bg-[#780000] hover:bg-[#5e0000] text-white font-semibold border border-[#5e0000] text-xs rounded-md px-2.5 py-1 transition-colors cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50 shadow-2xs shrink-0 whitespace-nowrap"
                          >
                            <AppIcon icon={Trash} size="sm" color="white" />
                            <span>{isDeleting ? "Deleting..." : "Delete"}</span>
                          </button>
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
    </div>
  );
}

export default AdminAccountsTable;
