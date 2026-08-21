"use client";

import { useState, useEffect } from "react";
import { Users, UserCheck, ShieldAlert, RefreshCw, AlertCircle, Search } from "lucide-react";

export interface AdminAccountItem {
  id: string;
  full_name: string;
  email: string;
  role: string;
  status: string;
  avatar_url?: string | null;
  created_at: string;
}

function getInitials(name?: string | null, fallback = "AD"): string {
  if (!name || !name.trim()) return fallback;
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return parts[0].slice(0, 2).toUpperCase() || fallback;
}

function getAccountRole(acc: any): string {
  const r =
    acc.role ||
    acc.user_metadata?.role ||
    acc.app_metadata?.role ||
    acc.role_name ||
    "";
  const lower = String(r).toLowerCase().trim();
  if (lower.includes("super")) return "super_admin";
  return "admin"; // Default fallback so NO account disappears
}

export function AdminAccountsDirectory() {
  const [accounts, setAccounts] = useState<AdminAccountItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [failedImageIds, setFailedImageIds] = useState<Set<string>>(new Set());

  // Search & Tab Filter States
  const [activeTab, setActiveTab] = useState<"all" | "admin" | "super_admin">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const fetchAccounts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/super-admin/accounts");
      if (!res.ok) {
        // Fallback to legacy endpoint if available
        const fallbackRes = await fetch("/api/super-admin/admin/list");
        if (!fallbackRes.ok) {
          throw new Error("Failed to load admin accounts");
        }
        const fallbackData = await fallbackRes.json();
        const rawFallback = Array.isArray(fallbackData)
          ? fallbackData
          : fallbackData.admins || fallbackData.accounts || fallbackData.data || [];
        const mappedAdmins = rawFallback.map((adm: any) => ({
          id: adm.id,
          full_name: adm.full_name || adm.profile?.fullName || "Admin User",
          email: adm.email,
          role: getAccountRole(adm),
          status: adm.is_active ? "active" : "inactive",
          avatar_url: adm.profileImageUrl || null,
          created_at: adm.created_at,
        }));
        setAccounts(mappedAdmins);
        return;
      }
      const data = await res.json();
      const loadedAccounts = Array.isArray(data)
        ? data
        : data.accounts || data.data || [];
      setAccounts(loadedAccounts);
    } catch (err: any) {
      console.error("Accounts fetch error:", err);
      setError(err?.message || "Failed to load admin accounts");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchAccounts();
  }, []);

  console.log("=== FRONTEND RECEIVED ACCOUNTS ===", accounts);

  const handleImageError = (id: string) => {
    setFailedImageIds((prev) => new Set(prev).add(id));
  };

  // Filter accounts based on tab and search query
  const filteredAccounts = accounts.filter((acc) => {
    const role = getAccountRole(acc);
    const matchesSearch =
      !searchQuery ||
      acc.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      acc.email?.toLowerCase().includes(searchQuery.toLowerCase());

    if (activeTab === "admin") {
      return matchesSearch && role === "admin";
    }
    if (activeTab === "super_admin") {
      return matchesSearch && role === "super_admin";
    }
    return matchesSearch;
  });

  // Stat Counters
  const totalAccounts = accounts.length;
  const activeAccounts = accounts.filter(
    (a) => !a.status || a.status?.toLowerCase() === "active" || a.status === "true"
  ).length;

  const superAdminAccounts = accounts.filter(
    (acc) => getAccountRole(acc) === "super_admin"
  ).length;

  const adminAccounts = accounts.filter(
    (acc) => getAccountRole(acc) === "admin"
  ).length;

  return (
    <div className="w-full space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-400 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Admin Accounts Directory
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Overview of all system administrative and super admin user accounts.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void fetchAccounts()}
          disabled={isLoading}
          className="bg-slate-100 dark:bg-slate-800 border border-slate-400 dark:border-slate-700 text-slate-900 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold px-3.5 py-1.5 rounded-xl transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-amber-500 dark:text-amber-400 ${isLoading ? "animate-spin" : ""}`} />
          {isLoading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-400 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Total Accounts
              </p>
              <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{totalAccounts}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-400 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Active Accounts
              </p>
              <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{activeAccounts}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-400 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-700 dark:text-blue-400">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Admin Accounts
              </p>
              <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{adminAccounts}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-400 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-700 dark:text-purple-400">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Super Admins
              </p>
              <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{superAdminAccounts}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Graceful Error Recovery Banner */}
      {error && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-950/20 p-4 text-xs text-amber-900 dark:text-amber-300 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>Unable to load account directory automatically ({error}).</span>
          </div>
          <button
            type="button"
            onClick={() => void fetchAccounts()}
            className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-900 dark:text-amber-300 px-3 py-1 rounded-lg text-xs font-semibold border border-amber-300 dark:border-amber-500/40 transition cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Filter Tabs & Search Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900/60 p-1 rounded-xl border border-slate-400 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === "all"
                ? "bg-amber-500/15 text-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            All Accounts ({totalAccounts})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("admin")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === "admin"
                ? "bg-amber-500/15 text-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            Admin Accounts ({adminAccounts})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("super_admin")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === "super_admin"
                ? "bg-amber-500/15 text-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            Super Admins ({superAdminAccounts})
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full bg-white dark:bg-slate-950 border border-slate-400 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl text-xs pl-8 pr-3 py-2 outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Accounts Directory Table */}
      <div className="w-full overflow-x-auto rounded-2xl border border-slate-400 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <table className="w-full text-left border-collapse min-w-[600px]">
            <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-400 dark:border-slate-800 text-slate-700 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Account Profile</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Created Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-400 dark:divide-slate-800">
              {isLoading ? (
                <tr className="bg-white dark:bg-slate-900">
                  <td colSpan={5} className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                    Loading admin accounts directory...
                  </td>
                </tr>
              ) : filteredAccounts.length === 0 ? (
                <tr className="bg-white dark:bg-slate-900">
                  <td colSpan={5} className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                    No accounts match the selected filter.
                  </td>
                </tr>
              ) : (
                filteredAccounts.map((account) => {
                  const hasImage =
                    account.avatar_url && !failedImageIds.has(account.id);
                  const isSuperAdmin =
                    getAccountRole(account) === "super_admin";
                  const isActive =
                    !account.status ||
                    account.status?.toLowerCase() === "active" ||
                    account.status === "true";

                  return (
                    <tr
                      key={account.id}
                      className="bg-white dark:bg-slate-900 border-b border-slate-400 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors py-3 px-4 text-xs"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {hasImage ? (
                            <img
                              src={account.avatar_url!}
                              alt={account.full_name}
                              className="w-9 h-9 rounded-full object-cover border border-slate-400 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 shadow-sm"
                              onError={() => handleImageError(account.id)}
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-400 font-bold text-xs flex items-center justify-center shadow-sm">
                              {getInitials(account.full_name, isSuperAdmin ? "SA" : "AD")}
                            </div>
                          )}
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {account.full_name}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-mono text-[11px]">
                        {account.email}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                            isSuperAdmin
                              ? "bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-500/10 dark:text-purple-300 dark:border-purple-500/30"
                              : "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/30"
                          }`}
                        >
                          {isSuperAdmin ? "Super Admin" : "Admin"}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                            isActive ? "text-emerald-700 dark:text-emerald-400" : "text-slate-500"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              isActive ? "bg-emerald-500" : "bg-slate-400"
                            }`}
                          />
                          {isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-400 text-[11px]">
                        {account.created_at
                          ? new Date(account.created_at).toLocaleDateString()
                          : "N/A"}
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

export default AdminAccountsDirectory;
