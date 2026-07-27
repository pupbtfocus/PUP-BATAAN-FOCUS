"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { buildFacultyInitials } from "@/lib/faculty-profile";
import type { FacultyAccount } from "@/features/faculty-management/types/faculty-dashboard.types";
import { FacultyFilterBar } from "./faculty-filter-bar";

export interface FacultyTableProps {
  facultyAccounts: FacultyAccount[];
  isLoading: boolean;
  onSelectFaculty: (facultyId: string) => void;
  onDeleteFaculty: (facultyId: string) => void;
  onViewDetails: (facultyId: string) => void;
  onActivate: (facultyId: string) => void;
  onDeactivate: (facultyId: string) => void;
  loadingFacultyIds: Set<string>;
  deletingFacultyIds: Set<string>;
  deleteError: string | null;
  deleteSuccess: string | null;
  facultyActionError: string | null;
  onClearDeleteMessages: () => void;
}

export function FacultyTable({
  facultyAccounts,
  isLoading,
  onSelectFaculty,
  onDeleteFaculty,
  onViewDetails,
  onActivate,
  onDeactivate,
  loadingFacultyIds,
  deletingFacultyIds,
  deleteError,
  deleteSuccess,
  facultyActionError,
  onClearDeleteMessages,
}: FacultyTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  const filteredFacultyAccounts = useMemo(() => {
    let result = facultyAccounts;

    if (statusFilter === "active") {
      result = result.filter((f) => f.is_active);
    } else if (statusFilter === "inactive") {
      result = result.filter((f) => !f.is_active);
    }

    const query = searchTerm.trim().toLowerCase();
    if (!query) {
      return result;
    }

    return result.filter((faculty) => {
      const haystack = `${faculty.fullName} ${faculty.email}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [facultyAccounts, searchTerm, statusFilter]);

  return (
    <div className="space-y-3">
      {deleteError ? (
        <div className="rounded-md border border-red-700 bg-red-950/20 px-3 py-2 text-sm text-red-300 flex justify-between items-center">
          <span>{deleteError}</span>
          <button
            type="button"
            onClick={onClearDeleteMessages}
            className="text-red-400 hover:text-red-200"
          >
            ✕
          </button>
        </div>
      ) : null}

      {deleteSuccess ? (
        <div className="rounded-md border border-emerald-700 bg-emerald-950/20 px-3 py-2 text-sm text-emerald-300 flex justify-between items-center">
          <span>{deleteSuccess}</span>
          <button
            type="button"
            onClick={onClearDeleteMessages}
            className="text-emerald-400 hover:text-emerald-200"
          >
            ✕
          </button>
        </div>
      ) : null}

      {facultyActionError ? (
        <div className="rounded-md border border-red-700 bg-red-950/20 px-3 py-2 text-sm text-red-300 flex justify-between items-center">
          <span>{facultyActionError}</span>
          <button
            type="button"
            onClick={onClearDeleteMessages}
            className="text-red-400 hover:text-red-200"
          >
            ✕
          </button>
        </div>
      ) : null}

      <FacultyFilterBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
      />

      {isLoading ? (
        <p className="rounded-md border border-dashed border-slate-700 px-4 py-6 text-sm text-slate-500 dark:text-slate-400">
          Loading faculty accounts...
        </p>
      ) : null}

      {!isLoading && facultyAccounts.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-700 px-4 py-6 text-sm text-slate-500 dark:text-slate-400">
          No faculty members found.
          <br />
          Click "Add Faculty" to create the first faculty account.
        </p>
      ) : null}

      {!isLoading &&
      facultyAccounts.length > 0 &&
      filteredFacultyAccounts.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-700 px-4 py-6 text-sm text-slate-500 dark:text-slate-400">
          No matching faculty members found.
        </p>
      ) : null}

      {!isLoading &&
      facultyAccounts.length > 0 &&
      filteredFacultyAccounts.length > 0
        ? filteredFacultyAccounts.map((faculty) => (
            <div
              key={faculty.id}
              className="rounded-xl border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950 p-4"
            >
              <div className="flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => onSelectFaculty(faculty.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-amber-400/30 bg-amber-400/10 text-sm font-semibold text-amber-200">
                    {faculty.profileImageUrl ? (
                      <img
                        src={faculty.profileImageUrl}
                        alt={faculty.fullName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span>{buildFacultyInitials(faculty.fullName)}</span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{faculty.fullName}</p>
                    <p className="truncate text-sm text-slate-500 dark:text-slate-400">
                      {faculty.email}
                    </p>
                    <span
                      className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                        faculty.is_active
                          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
                          : "border-rose-500/20 bg-rose-500/10 text-rose-200"
                      }`}
                    >
                      {faculty.is_active ? "🟢 Active" : "🔴 Inactive"}
                    </span>
                  </div>
                </button>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onViewDetails(faculty.id)}
                    className="text-blue-400 hover:text-blue-300"
                  >
                    View Details
                  </Button>
                  {faculty.is_active ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onDeactivate(faculty.id)}
                      disabled={loadingFacultyIds.has(faculty.id)}
                      className="text-[#7a0000] dark:text-amber-300 hover:text-amber-200"
                    >
                      {loadingFacultyIds.has(faculty.id)
                        ? "Deactivating..."
                        : "Deactivate"}
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onActivate(faculty.id)}
                      disabled={loadingFacultyIds.has(faculty.id)}
                      className="text-green-400 hover:text-green-300"
                    >
                      {loadingFacultyIds.has(faculty.id)
                        ? "Activating..."
                        : "Activate"}
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onDeleteFaculty(faculty.id)}
                    disabled={deletingFacultyIds.has(faculty.id)}
                    className="text-red-400 hover:text-red-300"
                  >
                    {deletingFacultyIds.has(faculty.id)
                      ? "Deleting..."
                      : "Delete"}
                  </Button>
                </div>
              </div>
            </div>
          ))
        : null}
    </div>
  );
}
