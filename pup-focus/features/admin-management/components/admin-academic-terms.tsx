"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type AcademicTermStatus = "Current" | "Upcoming" | "Archived";

type AcademicTermItem = {
  academicYear: string;
  semester: string;
  status: AcademicTermStatus;
  canDelete: boolean;
  deleteReason?: string;
};

type AcademicTermsApiResponse = {
  terms: AcademicTermItem[];
  nextAcademicYear: string;
};

const statusStyles: Record<AcademicTermStatus, string> = {
  Current: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/35",
  Upcoming: "bg-amber-500/15 text-amber-300 border border-amber-500/35",
  Archived: "bg-slate-500/15 text-slate-300 border border-slate-500/35",
};

function statusLabel(status: AcademicTermStatus) {
  return status;
}

export function AdminAcademicTerms({
  adminName,
}: {
  adminName?: string | null;
}) {
  const [terms, setTerms] = useState<AcademicTermItem[]>([]);
  const [nextAcademicYear, setNextAcademicYear] = useState("2026-2027");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [termToSetCurrent, setTermToSetCurrent] =
    useState<AcademicTermItem | null>(null);
  const [termToDelete, setTermToDelete] = useState<AcademicTermItem | null>(
    null,
  );

  useEffect(() => {
    void loadTerms();
  }, []);

  async function loadTerms() {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/admin/academic-terms", {
        credentials: "include",
      });
      const data = await response.json();

      if (!response.ok) {
        setError(
          data?.details
            ? `${data?.error || "Failed to load academic terms"}: ${data.details}`
            : data?.error ||
                `Failed to load academic terms (HTTP ${response.status})`,
        );
        return;
      }

      setTerms(Array.isArray(data.terms) ? data.terms : []);
      setNextAcademicYear(
        typeof data.nextAcademicYear === "string"
          ? data.nextAcademicYear
          : "2026-2027",
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load academic terms",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateNextAcademicYear() {
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/admin/academic-terms", {
        method: "POST",
        credentials: "include",
      });
      const data = await response.json();

      if (!response.ok) {
        setError(
          data?.error ||
            `Failed to create academic year (HTTP ${response.status})`,
        );
        return;
      }

      setSuccess(`Created academic year ${nextAcademicYear}.`);
      setIsCreateModalOpen(false);
      await loadTerms();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to create academic year",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSetCurrent(term: AcademicTermItem) {
    setTermToSetCurrent(term);
  }

  async function confirmSetCurrent() {
    if (!termToSetCurrent) {
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(
        `/api/admin/academic-terms?academicYear=${encodeURIComponent(
          termToSetCurrent.academicYear,
        )}&semester=${encodeURIComponent(termToSetCurrent.semester)}`,
        {
          method: "PATCH",
          credentials: "include",
        },
      );
      const data = await response.json();

      if (!response.ok) {
        setError(
          data?.error || `Failed to set current term (HTTP ${response.status})`,
        );
        return;
      }

      setSuccess(
        `Set ${termToSetCurrent.academicYear} ${termToSetCurrent.semester} as the current academic term.`,
      );
      setTermToSetCurrent(null);
      await loadTerms();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to set current academic term",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteTerm(term: AcademicTermItem) {
    setTermToDelete(term);
  }

  async function confirmDeleteTerm() {
    if (!termToDelete) {
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(
        `/api/admin/academic-terms?academicYear=${encodeURIComponent(
          termToDelete.academicYear,
        )}&semester=${encodeURIComponent(termToDelete.semester)}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );
      const data = await response.json();

      if (!response.ok) {
        setError(
          data?.error ||
            `Failed to delete academic term (HTTP ${response.status})`,
        );
        return;
      }

      setSuccess(
        `Deleted ${termToDelete.academicYear} ${termToDelete.semester}.`,
      );
      setTermToDelete(null);
      await loadTerms();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to delete academic term",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function renderStatusBadge(status: AcademicTermStatus) {
    return (
      <span
        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[status]}`}
      >
        {statusLabel(status)}
      </span>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Academic Terms</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            disabled={isLoading || isSaving}
          >
            Create Next Academic Year
          </Button>
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-700 bg-red-950/20 p-4 text-sm text-red-200">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="mb-4 rounded-xl border border-emerald-600 bg-emerald-950/20 p-4 text-sm text-emerald-200">
          {success}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-3xl border border-slate-700 bg-slate-950/80 shadow-lg shadow-black/20">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-700 text-sm text-left text-slate-300">
            <thead className="bg-slate-900/95 text-slate-400">
              <tr>
                <th className="px-4 py-3 font-semibold uppercase tracking-[0.16em]">
                  Academic Year
                </th>
                <th className="px-4 py-3 font-semibold uppercase tracking-[0.16em]">
                  Semester
                </th>
                <th className="px-4 py-3 font-semibold uppercase tracking-[0.16em]">
                  Status
                </th>
                <th className="px-4 py-3 font-semibold uppercase tracking-[0.16em]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700 bg-slate-950/60">
              {terms.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-6 text-center text-slate-400"
                  >
                    No academic terms have been created yet.
                  </td>
                </tr>
              ) : (
                terms.map((term) => (
                  <tr key={`${term.academicYear}-${term.semester}`}>
                    <td className="px-4 py-4">{term.academicYear}</td>
                    <td className="px-4 py-4">{term.semester}</td>
                    <td className="px-4 py-4">
                      {renderStatusBadge(term.status)}
                    </td>
                    <td className="px-4 py-4 space-x-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => handleSetCurrent(term)}
                        disabled={
                          term.status === "Current" || isLoading || isSaving
                        }
                      >
                        Set Current
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="bg-red-700 text-white hover:bg-red-600"
                        onClick={() => handleDeleteTerm(term)}
                        disabled={!term.canDelete || isLoading || isSaving}
                        title={term.deleteReason}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isCreateModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
          <div className="w-full max-w-2xl rounded-3xl border border-slate-700 bg-slate-950 p-6 shadow-2xl shadow-black/60">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-white">
                  Create New Academic Year
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  The system will create the next academic year and add both
                  semesters automatically.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="rounded-full border border-slate-600 bg-slate-900 px-3 py-1 text-sm text-slate-300 hover:bg-slate-800"
              >
                Close
              </button>
            </div>

            <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-900 p-5">
              <p className="text-sm uppercase tracking-[0.18em] text-amber-300">
                Next Academic Year
              </p>
              <p className="mt-2 text-3xl font-semibold text-white">
                {nextAcademicYear}
              </p>
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-950 p-4">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
                    ✓
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      First Semester
                    </p>
                    <p className="text-xs text-slate-400">
                      {terms.some(
                        (term) =>
                          term.academicYear === nextAcademicYear &&
                          term.semester === "1st Semester",
                      )
                        ? "Already exists"
                        : "Current if no active term exists, otherwise Upcoming."}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-950 p-4">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
                    ✓
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      Second Semester
                    </p>
                    <p className="text-xs text-slate-400">
                      Always created as Upcoming.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsCreateModalOpen(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleCreateNextAcademicYear}
                disabled={isSaving}
              >
                {isSaving ? "Creating..." : "Create"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {termToSetCurrent ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
          <div className="w-full max-w-lg rounded-3xl border border-slate-700 bg-slate-950 p-6 shadow-2xl shadow-black/60">
            <h2 className="text-xl font-semibold text-white">
              Confirm Current Term
            </h2>
            <p className="mt-3 text-sm text-slate-400">
              Set {termToSetCurrent.academicYear} {termToSetCurrent.semester} as
              the current academic term?
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setTermToSetCurrent(null)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={confirmSetCurrent}
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Confirm"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {termToDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
          <div className="w-full max-w-lg rounded-3xl border border-slate-700 bg-slate-950 p-6 shadow-2xl shadow-black/60">
            <h2 className="text-xl font-semibold text-white">
              Delete Academic Term
            </h2>
            <p className="mt-3 text-sm text-slate-400">
              Are you sure you want to delete {termToDelete.academicYear}{" "}
              {termToDelete.semester}?
            </p>
            {termToDelete.deleteReason ? (
              <p className="mt-3 text-sm text-slate-400">
                {termToDelete.deleteReason}
              </p>
            ) : null}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setTermToDelete(null)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={confirmDeleteTerm}
                disabled={isSaving || !termToDelete.canDelete}
                className="bg-red-700 text-white hover:bg-red-600"
              >
                {isSaving ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
