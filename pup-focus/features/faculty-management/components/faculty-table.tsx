"use client";

import { useEffect, useMemo, useState } from "react";
import { EditPencil, Eye, Trash, UserBadgeCheck, UserXmark, Xmark } from "iconoir-react";
import { buildFacultyInitials } from "@/lib/faculty-profile";
import type { FacultyAccount } from "@/features/faculty-management/types/faculty-dashboard.types";
import { FacultyFilterBar } from "./faculty-filter-bar";
import { FacultyStatsCards } from "./faculty-stats-cards";

export interface FacultyTableProps {
  facultyAccounts: FacultyAccount[];
  isLoading: boolean;
  onSelectFaculty: (facultyId: string) => void;
  onDeleteFaculty: (facultyId: string) => void;
  onViewDetails: (facultyId: string) => void;
  onEditFaculty?: (facultyId: string) => void;
  onActivate: (facultyId: string) => void;
  onDeactivate: (facultyId: string) => void;
  loadingFacultyIds: Set<string>;
  deletingFacultyIds: Set<string>;
  deleteError: string | null;
  deleteSuccess: string | null;
  facultyActionError: string | null;
  onClearDeleteMessages: () => void;
  programs?: Array<{ id: string; code: string; name: string }>;
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

export function FacultyTable({
  facultyAccounts,
  isLoading,
  onSelectFaculty,
  onDeleteFaculty,
  onViewDetails,
  onEditFaculty,
  onActivate,
  onDeactivate,
  loadingFacultyIds,
  deletingFacultyIds,
  deleteError,
  deleteSuccess,
  facultyActionError,
  onClearDeleteMessages,
  programs: initialPrograms,
}: FacultyTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("all");
  const [programFilter, setProgramFilter] = useState("all");
  const [programs, setPrograms] = useState<
    Array<{ id: string; code: string; name: string }>
  >(initialPrograms ?? []);

  useEffect(() => {
    if (initialPrograms && initialPrograms.length > 0) {
      setPrograms(initialPrograms);
      return;
    }

    async function loadPrograms() {
      try {
        const res = await fetch("/api/programs");
        if (res.ok) {
          const data = await res.json();
          if (data.programs) {
            setPrograms(data.programs);
          }
        }
      } catch {
        // Ignore fetch error
      }
    }

    void loadPrograms();
  }, [initialPrograms]);

  const filteredFacultyAccounts = useMemo(() => {
    let result = facultyAccounts;

    if (statusFilter === "active") {
      result = result.filter((f) => f.is_active);
    } else if (statusFilter === "inactive") {
      result = result.filter((f) => !f.is_active);
    }

    if (programFilter && programFilter !== "all") {
      const targetProg = programFilter.toUpperCase();
      result = result.filter((f) => {
        const code = f.program?.code?.toUpperCase();
        const id = f.program?.id?.toLowerCase();
        return code === targetProg || id === programFilter.toLowerCase();
      });
    }

    const query = searchTerm.trim().toLowerCase();
    if (!query) {
      return result;
    }

    return result.filter((faculty) => {
      const haystack = `${faculty.fullName} ${faculty.email}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [facultyAccounts, searchTerm, statusFilter, programFilter]);

  return (
    <div className="space-y-3">
      {deleteError ? (
        <div className="rounded-xl border border-red-700/60 bg-red-950/30 px-3.5 py-2 text-xs text-red-300 flex justify-between items-center">
          <span>{deleteError}</span>
          <button
            type="button"
            onClick={onClearDeleteMessages}
            className="text-red-400 hover:text-red-200 transition-colors p-1"
            aria-label="Dismiss message"
          >
            <Xmark className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      {deleteSuccess ? (
        <div className="rounded-xl border border-emerald-700/60 bg-emerald-950/30 px-3.5 py-2 text-xs text-emerald-300 flex justify-between items-center">
          <span>{deleteSuccess}</span>
          <button
            type="button"
            onClick={onClearDeleteMessages}
            className="text-emerald-400 hover:text-emerald-200 transition-colors p-1"
            aria-label="Dismiss message"
          >
            <Xmark className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      {facultyActionError ? (
        <div className="rounded-xl border border-red-700/60 bg-red-950/30 px-3.5 py-2 text-xs text-red-300 flex justify-between items-center">
          <span>{facultyActionError}</span>
          <button
            type="button"
            onClick={onClearDeleteMessages}
            className="text-red-400 hover:text-red-200 transition-colors p-1"
            aria-label="Dismiss message"
          >
            <Xmark className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      <FacultyStatsCards
        facultyAccounts={facultyAccounts}
        isLoading={isLoading}
      />

      <FacultyFilterBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        programFilter={programFilter}
        onProgramFilterChange={setProgramFilter}
        programs={programs}
      />

      <div className="w-full overflow-x-auto rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm shadow-slate-300/50 dark:shadow-none overflow-hidden transition-colors">
        <table className="w-full text-left border-collapse text-xs text-slate-800 dark:text-slate-300 min-w-[700px]">
            <thead className="border-b border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 uppercase tracking-wider text-[10px] text-slate-700 dark:text-slate-400">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Faculty Member</th>
                <th className="px-4 py-2.5 font-semibold">Program</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold">Last Login</th>
                <th className="px-4 py-2.5 text-right font-semibold">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300 dark:divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-xs text-slate-500 dark:text-slate-400"
                  >
                    Loading faculty accounts...
                  </td>
                </tr>
              ) : filteredFacultyAccounts.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-xs text-slate-500 dark:text-slate-400"
                  >
                    No faculty members found.
                  </td>
                </tr>
              ) : (
                filteredFacultyAccounts.map((faculty) => {
                  const programCode =
                    faculty.program?.code ||
                    faculty.program?.name ||
                    "Unassigned";

                  return (
                    <tr
                      key={faculty.id}
                      className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-b border-slate-300 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-slate-200">
                        <div
                          className="flex items-center gap-2.5 cursor-pointer"
                          onClick={() => {
                            onSelectFaculty(faculty.id);
                            onViewDetails(faculty.id);
                          }}
                        >
                          <div
                            className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-amber-500/30 bg-amber-500/10 text-[10px] font-semibold text-amber-800 dark:text-amber-200"
                            aria-hidden="true"
                          >
                            {faculty.profileImageUrl ? (
                              <img
                                src={faculty.profileImageUrl}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span>
                                {buildFacultyInitials(faculty.fullName)}
                              </span>
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-slate-900 dark:text-slate-200 text-xs hover:text-amber-600 dark:hover:text-amber-300 transition">
                              {faculty.fullName}
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                              {faculty.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 font-medium text-xs">
                        <span className="bg-slate-900/80 text-slate-300 border border-slate-800 px-2 py-0.5 text-xs font-medium rounded-md inline-flex items-center">
                          {programCode}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-medium">
                        {faculty.is_active ? (
                          <span className="bg-emerald-950/30 text-emerald-400/90 border border-emerald-900/40 px-2 py-0.5 text-xs font-medium rounded-md inline-flex items-center">
                            Active
                          </span>
                        ) : (
                          <span className="bg-slate-900 text-slate-400 border border-slate-800 px-2 py-0.5 text-xs font-medium rounded-md inline-flex items-center">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-xs whitespace-nowrap text-slate-700 dark:text-slate-300">
                        {faculty.last_sign_in_at || faculty.lastLoginAt ? (
                          <span>
                            {formatLastLogin(
                              faculty.last_sign_in_at || faculty.lastLoginAt,
                            )}
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 italic text-[11px]">
                            Never logged in
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onViewDetails(faculty.id)}
                            title="View Faculty Details"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 px-2.5 py-1 text-xs font-medium transition cursor-pointer"
                          >
                            <Eye className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
                            <span>View Details</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onEditFaculty
                                ? onEditFaculty(faculty.id)
                                : onViewDetails(faculty.id)
                            }
                            title="Edit Faculty"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 px-2.5 py-1 text-xs font-medium transition cursor-pointer"
                          >
                            <EditPencil className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
                            <span>Edit</span>
                          </button>
                          {faculty.is_active ? (
                            <button
                              type="button"
                              onClick={() => onDeactivate(faculty.id)}
                              disabled={loadingFacultyIds.has(faculty.id)}
                              title="Deactivate Faculty"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 px-2.5 py-1 text-xs font-medium transition disabled:opacity-50 cursor-pointer"
                            >
                              <UserXmark className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
                              <span>
                                {loadingFacultyIds.has(faculty.id)
                                  ? "Deactivating..."
                                  : "Deactivate"}
                              </span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onActivate(faculty.id)}
                              disabled={loadingFacultyIds.has(faculty.id)}
                              title="Activate Faculty"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 px-2.5 py-1 text-xs font-medium transition disabled:opacity-50 cursor-pointer"
                            >
                              <UserBadgeCheck className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
                              <span>
                                {loadingFacultyIds.has(faculty.id)
                                  ? "Activating..."
                                  : "Activate"}
                              </span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onDeleteFaculty(faculty.id)}
                            disabled={deletingFacultyIds.has(faculty.id)}
                            title="Delete Faculty"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 px-2.5 py-1 text-xs font-medium transition disabled:opacity-50 cursor-pointer"
                          >
                            <Trash className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
                            <span>
                              {deletingFacultyIds.has(faculty.id)
                                ? "Deleting..."
                                : "Delete"}
                            </span>
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
