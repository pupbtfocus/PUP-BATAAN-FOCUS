"use client";

import React, { useState, useMemo } from "react";
import { ROLE, type AppRole } from "@/config/roles";

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
  accountsError?: string | null;
  accountActionError?: string | null;
  accountActionSuccess?: string | null;
  onClearMessages?: () => void;
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

export function AdminStatsCards({
  adminAccounts,
  isLoading = false,
}: {
  adminAccounts: AdminAccount[];
  isLoading?: boolean;
}) {
  const totalCount = adminAccounts.length;
  const activeCount = adminAccounts.filter((a) => a.is_active).length;
  const inactiveCount = adminAccounts.filter((a) => !a.is_active).length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
      {/* 1. TOTAL ADMINS */}
      <div className="rounded-2xl border border-slate-400 dark:border-slate-800 border-l-4 border-l-amber-500 bg-white dark:bg-slate-900 p-5 shadow-sm shadow-slate-200/60 dark:shadow-none transition-colors">
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
          Total Admins
        </p>
        <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
          {isLoading ? "..." : totalCount}
        </p>
      </div>

      {/* 2. ACTIVE ADMINS */}
      <div className="rounded-2xl border border-slate-400 dark:border-slate-800 border-l-4 border-l-emerald-500 bg-white dark:bg-slate-900 p-5 shadow-sm shadow-slate-200/60 dark:shadow-none transition-colors">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
          Active Admins
        </p>
        <p className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
          {isLoading ? "..." : activeCount}
        </p>
      </div>

      {/* 3. INACTIVE ADMINS */}
      <div className="rounded-2xl border border-slate-400 dark:border-slate-800 border-l-4 border-l-slate-400 dark:border-l-slate-600 bg-white dark:bg-slate-900 p-5 shadow-sm shadow-slate-200/60 dark:shadow-none transition-colors">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
          Inactive Admins
        </p>
        <p className="mt-2 text-2xl font-bold text-slate-700 dark:text-slate-300">
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
  placeholder = "Search admin by name or email...",
}: {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  roleFilter: "all" | string;
  onRoleFilterChange: (role: "all" | string) => void;
  statusFilter: "all" | "active" | "inactive";
  onStatusFilterChange: (status: "all" | "active" | "inactive") => void;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-400 dark:border-slate-800 mb-6 shadow-sm shadow-slate-200/60 dark:shadow-none text-slate-900 dark:text-slate-200">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5 w-full sm:w-auto flex-wrap">
        <input
          type="text"
          value={searchTerm}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={placeholder}
          className="w-full sm:w-64 h-9 rounded-xl border border-slate-400 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
        />

        <select
          value={roleFilter}
          onChange={(e) => onRoleFilterChange(e.target.value)}
          className="w-full sm:w-44 h-9 rounded-xl border border-slate-400 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 text-xs text-slate-900 dark:text-slate-100 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 cursor-pointer"
        >
          <option value="all">All Roles</option>
          <option value={ROLE.ADMIN}>Admin</option>
          <option value={ROLE.SUPER_ADMIN}>Super Admin</option>
        </select>

        <div className="flex items-center justify-start gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <div className="flex items-center gap-1 rounded-xl border border-slate-400 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 p-1 h-9 shrink-0">
            <button
              type="button"
              onClick={() => onStatusFilterChange("all")}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                statusFilter === "all"
                  ? "bg-amber-500 text-slate-950 font-semibold shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => onStatusFilterChange("active")}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                statusFilter === "active"
                  ? "bg-emerald-500 text-white font-semibold shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => onStatusFilterChange("inactive")}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                statusFilter === "inactive"
                  ? "bg-slate-300 dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-semibold shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              Inactive
            </button>
          </div>
        </div>
      </div>
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
  accountsError,
  accountActionError,
  accountActionSuccess,
  onClearMessages,
}: AdminAccountsTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [failedImageIds, setFailedImageIds] = useState<Set<string>>(new Set());

  const filteredAccounts = useMemo(() => {
    let result = adminAccounts;

    if (roleFilter !== "all") {
      result = result.filter((a) => {
        const r = (a.role || "").toLowerCase().trim();
        if (roleFilter === ROLE.SUPER_ADMIN) {
          return r.includes("super");
        }
        return !r.includes("super");
      });
    }

    if (statusFilter === "active") {
      result = result.filter((a) => a.is_active);
    } else if (statusFilter === "inactive") {
      result = result.filter((a) => !a.is_active);
    }

    const query = searchTerm.trim().toLowerCase();
    if (!query) return result;

    return result.filter((admin) => {
      const name = formatAdminName(admin).toLowerCase();
      const email = (admin.email || "").toLowerCase();
      return name.includes(query) || email.includes(query);
    });
  }, [adminAccounts, searchTerm, roleFilter, statusFilter]);

  return (
    <div className="space-y-3">
      {accountsError ? (
        <div className="rounded-xl border border-red-700/60 bg-red-950/30 px-3.5 py-2 text-xs text-red-300 flex justify-between items-center">
          <span>{accountsError}</span>
          {onClearMessages ? (
            <button type="button" onClick={onClearMessages} className="text-red-400 hover:text-red-200 text-xs">
              ✕
            </button>
          ) : null}
        </div>
      ) : null}

      {accountActionError ? (
        <div className="rounded-xl border border-red-700/60 bg-red-950/30 px-3.5 py-2 text-xs text-red-300 flex justify-between items-center">
          <span>{accountActionError}</span>
          {onClearMessages ? (
            <button type="button" onClick={onClearMessages} className="text-red-400 hover:text-red-200 text-xs">
              ✕
            </button>
          ) : null}
        </div>
      ) : null}

      {accountActionSuccess ? (
        <div className="rounded-xl border border-emerald-700/60 bg-emerald-950/30 px-3.5 py-2 text-xs text-emerald-300 flex justify-between items-center">
          <span>{accountActionSuccess}</span>
          {onClearMessages ? (
            <button type="button" onClick={onClearMessages} className="text-emerald-400 hover:text-emerald-200 text-xs">
              ✕
            </button>
          ) : null}
        </div>
      ) : null}

      {/* 3 Stat Cards */}
      <AdminStatsCards adminAccounts={adminAccounts} isLoading={isLoading} />

      {/* Filter Bar */}
      <AdminFilterBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        roleFilter={roleFilter}
        onRoleFilterChange={setRoleFilter}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
      />

      {/* Clean Data Table */}
      <div className="w-full overflow-x-auto rounded-2xl border border-slate-400/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm shadow-slate-200/60 dark:shadow-none">
        <table className="w-full text-left border-collapse text-xs text-slate-800 dark:text-slate-300 min-w-[650px]">
          <thead>
            <tr className="border-b border-slate-400 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-950/50 text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              <th className="py-3 px-4">Admin Member</th>
              <th className="py-3 px-4">Role</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-400 dark:divide-slate-800">
            {isLoading ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                  Loading admin accounts...
                </td>
              </tr>
            ) : filteredAccounts.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                  No admin members match the selected criteria.
                </td>
              </tr>
            ) : (
              filteredAccounts.map((admin) => {
                const isSuperAdmin = (admin.role || "").toLowerCase().includes("super");
                const hasAvatar = admin.profileImageUrl && !failedImageIds.has(admin.profile_id);
                const isLoadingAction = loadingAdminIds.has(admin.profile_id);

                return (
                  <tr
                    key={admin.profile_id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    {/* Admin Member */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          {hasAvatar ? (
                            <img
                              src={admin.profileImageUrl!}
                              alt={formatAdminName(admin)}
                              className="w-9 h-9 rounded-full object-cover border border-slate-400 dark:border-slate-700 shadow-xs"
                              onError={() => setFailedImageIds((prev) => new Set(prev).add(admin.profile_id))}
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-800 border border-slate-400 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 font-bold text-xs flex items-center justify-center shadow-xs">
                              {getInitials(formatAdminName(admin), isSuperAdmin ? "SA" : "AD")}
                            </div>
                          )}
                          <span
                            className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-900 ${
                              admin.is_active ? "bg-emerald-500" : "bg-slate-400"
                            }`}
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {formatAdminName(admin)}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {admin.email}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Role Badge */}
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                          isSuperAdmin
                            ? "bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20"
                            : "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20"
                        }`}
                      >
                        {isSuperAdmin ? "Super Admin" : "Admin"}
                      </span>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                          admin.is_active
                            ? "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
                            : "bg-slate-100 text-slate-700 border-slate-400 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                        }`}
                      >
                        {admin.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>

                    {/* Inline Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {/* Edit Button (Admin only) */}
                        {!isSuperAdmin && (
                          <button
                            type="button"
                            onClick={() => onEditAdmin(admin.profile_id)}
                            className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-200 border border-slate-400 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer"
                          >
                            Edit
                          </button>
                        )}

                        {/* Deactivate / Activate Button */}
                        {!isSuperAdmin ? (
                          admin.is_active ? (
                            <button
                              type="button"
                              onClick={() => onDeactivateAdmin(admin.profile_id)}
                              disabled={isLoadingAction}
                              className="bg-red-50 hover:bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-800 rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                            >
                              {isLoadingAction ? "..." : "Deactivate"}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onActivateAdmin(admin.profile_id)}
                              disabled={isLoadingAction}
                              className="bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                            >
                              {isLoadingAction ? "..." : "Activate"}
                            </button>
                          )
                        ) : null}

                        {/* Delete Button (Admin only) */}
                        {!isSuperAdmin && (
                          <button
                            type="button"
                            onClick={() => onDeleteAdmin(admin.profile_id)}
                            disabled={isLoadingAction}
                            className="bg-red-50 hover:bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-800 rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                          >
                            Delete
                          </button>
                        )}

                        {/* View Details Button */}
                        <button
                          type="button"
                          onClick={() => onViewDetails(admin.profile_id)}
                          className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-200 border border-slate-400 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer"
                        >
                          View Details
                        </button>
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
