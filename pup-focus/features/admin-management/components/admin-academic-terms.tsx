"use client";

import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";

type AcademicTermStatus = "Current" | "Upcoming" | "Archived" | "Completed";

type AcademicTermItem = {
  academicYear: string;
  semester: string;
  status: AcademicTermStatus;
  canDelete: boolean;
  deleteReason?: string;
};

function getTermScore(academicYear: string, semester: string): number {
  const startYear = parseInt(academicYear.split("-")[0], 10) || 0;
  const semNorm = (semester || "").toLowerCase();
  let semValue = 1;
  if (semNorm.includes("2nd") || semNorm.includes("second")) semValue = 2;
  else if (semNorm.includes("3rd") || semNorm.includes("third") || semNorm.includes("summer")) semValue = 3;
  return startYear * 10 + semValue;
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
  const [countdown, setCountdown] = useState<number>(10);

  useEffect(() => {
    void loadTerms();
  }, []);

  // 10-second countdown timer for action confirmation modals
  useEffect(() => {
    if (!termToSetCurrent && !termToDelete) {
      setCountdown(10);
      return;
    }

    setCountdown(10);
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [termToSetCurrent, termToDelete]);

  // Progression calculation: find current active term & immediate next upcoming term
  const currentTermItem = useMemo(
    () => terms.find((t) => t.status === "Current"),
    [terms],
  );

  const currentScore = useMemo(
    () =>
      currentTermItem
        ? getTermScore(currentTermItem.academicYear, currentTermItem.semester)
        : 0,
    [currentTermItem],
  );

  // Immediate next upcoming term in sequence
  const immediateNextTerm = useMemo(() => {
    const upcoming = terms
      .filter(
        (t) =>
          t.status !== "Current" &&
          t.status !== "Archived" &&
          (t.status as string) !== "Completed" &&
          (currentScore === 0 ||
            getTermScore(t.academicYear, t.semester) > currentScore),
      )
      .sort(
        (a, b) =>
          getTermScore(a.academicYear, a.semester) -
          getTermScore(b.academicYear, b.semester),
      );
    return upcoming.length > 0 ? upcoming[0] : null;
  }, [terms, currentScore]);

  // Compute next academic year dynamically from existing terms if available
  const computedNextAcademicYear = useMemo(() => {
    if (!terms.length) return nextAcademicYear;
    let maxStartYear = 0;
    terms.forEach((term) => {
      const parts = term.academicYear.split("-");
      const startYear = parseInt(parts[0], 10);
      if (!isNaN(startYear) && startYear > maxStartYear) {
        maxStartYear = startYear;
      }
    });
    if (maxStartYear > 0) {
      return `${maxStartYear + 1}-${maxStartYear + 2}`;
    }
    return nextAcademicYear;
  }, [terms, nextAcademicYear]);

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

      setSuccess(`Created academic year ${computedNextAcademicYear}.`);
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
    if (term.status === "Current") return;
    const termScore = getTermScore(term.academicYear, term.semester);
    if (
      term.status === "Archived" ||
      (term.status as string) === "Completed" ||
      (currentScore > 0 && termScore < currentScore)
    ) {
      setError("Cannot reactivate a completed or past academic term.");
      return;
    }
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

  function handleDeleteClick(term: AcademicTermItem) {
    if (term.status === "Current" || !term.canDelete) return;
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
    if (status === "Current") {
      return (
        <span className="text-emerald-400 font-semibold text-xs">
          Current 🟢
        </span>
      );
    }
    if (status === "Archived" || (status as string) === "Completed") {
      return (
        <span className="text-slate-500 font-medium text-xs">
          Archived
        </span>
      );
    }
    return (
      <span className="text-amber-400 font-medium text-xs">
        Upcoming
      </span>
    );
  }

  function renderSetCurrentAction(term: AcademicTermItem) {
    if (term.status === "Current") {
      return (
        <span className="text-slate-500 font-medium text-xs px-3 py-1.5 inline-block select-none">
          Active
        </span>
      );
    }

    const termScore = getTermScore(term.academicYear, term.semester);
    const isPastOrClosed =
      term.status === "Archived" ||
      (term.status as string) === "Completed" ||
      (currentScore > 0 && termScore < currentScore);

    if (isPastOrClosed) {
      return (
        <span
          title="Term Closed / Completed"
          className="text-slate-500/70 font-medium text-xs px-2.5 py-1 rounded-md bg-slate-900/60 border border-slate-800/80 cursor-not-allowed select-none inline-flex items-center gap-1"
        >
          🔒 Term Closed / Completed
        </span>
      );
    }

    const isImmediateNext =
      immediateNextTerm &&
      immediateNextTerm.academicYear === term.academicYear &&
      immediateNextTerm.semester === term.semester;

    if (!isImmediateNext && currentScore > 0) {
      return (
        <button
          type="button"
          disabled
          title={
            immediateNextTerm
              ? `Terms must be activated sequentially (Activate ${immediateNextTerm.academicYear} ${immediateNextTerm.semester} first)`
              : "Terms must be activated sequentially"
          }
          className="bg-amber-500/5 text-amber-400/40 border border-amber-500/10 text-xs font-medium px-3 py-1.5 rounded-lg cursor-not-allowed select-none"
        >
          Set Current
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={() => handleSetCurrent(term)}
        disabled={isLoading || isSaving}
        className="bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 text-xs font-medium px-3 py-1.5 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Set Current
      </button>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* Top Header Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-200">Academic Terms</h2>
          <p className="text-xs text-slate-400">
            Manage academic years and active term status across the campus system.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsCreateModalOpen(true)}
          disabled={isLoading || isSaving}
          className="bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 hover:text-amber-200 text-xs font-semibold px-4 py-2 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          + Create Next Academic Year
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-950/40 p-3.5 text-xs text-red-300">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-3.5 text-xs text-emerald-300">
          {success}
        </div>
      ) : null}

      {/* Dark Slate Table Container matching other Admin Cards */}
      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="border-b border-slate-800 bg-slate-900/60 text-slate-400 text-[11px] font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Academic Year</th>
                <th className="py-3 px-4">Semester</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr className="bg-slate-950/40 py-2.5 px-4 text-xs">
                  <td colSpan={4} className="py-6 text-center text-slate-500">
                    Loading academic terms...
                  </td>
                </tr>
              ) : terms.length === 0 ? (
                <tr className="bg-slate-950/40 py-2.5 px-4 text-xs">
                  <td colSpan={4} className="py-6 text-center text-slate-500">
                    No academic terms have been created yet.
                  </td>
                </tr>
              ) : (
                terms.map((term) => (
                  <tr
                    key={`${term.academicYear}-${term.semester}`}
                    className="bg-slate-950/40 border-b border-slate-800/60 hover:bg-slate-900/50 transition-colors py-2.5 px-4 text-xs"
                  >
                    <td className="py-2.5 px-4 font-medium text-slate-200">
                      {term.academicYear}
                    </td>
                    <td className="py-2.5 px-4 text-slate-300">
                      {term.semester}
                    </td>
                    <td className="py-2.5 px-4">
                      {renderStatusBadge(term.status)}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <div className="inline-flex items-center gap-2 justify-end">
                        {/* Set Current Action with Term Progression Guardrails */}
                        {renderSetCurrentAction(term)}

                        {/* Delete Action Guardrail: Disabled/Hidden if Current */}
                        {term.status !== "Current" && (
                          <button
                            type="button"
                            onClick={() => handleDeleteClick(term)}
                            disabled={!term.canDelete || isLoading || isSaving}
                            title={
                              term.deleteReason ||
                              (!term.canDelete
                                ? "Cannot delete term with existing data"
                                : "Delete academic term")
                            }
                            className="text-rose-400/80 hover:text-rose-300 hover:bg-rose-950/30 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-all disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Create Next Academic Year */}
      {isCreateModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-xl border border-slate-800 bg-slate-950 p-6 shadow-2xl text-slate-200">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-slate-100">
                  Create Next Academic Year
                </h3>
                <p className="mt-1 text-xs text-slate-400">
                  Automatically generate terms for the upcoming academic cycle.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="mt-5 rounded-lg border border-slate-800/80 bg-slate-900/50 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-400/90">
                Next Academic Year
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-100">
                {computedNextAcademicYear}
              </p>
              
              <div className="mt-4 space-y-2.5">
                <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold">
                    ✓
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-slate-200">
                      {computedNextAcademicYear} • 1st Semester
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Auto-generated for First Semester.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold">
                    ✓
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-slate-200">
                      {computedNextAcademicYear} • 2nd Semester
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Auto-generated for Second Semester.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                disabled={isSaving}
                className="px-3.5 py-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 text-xs font-medium transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateNextAcademicYear}
                disabled={isSaving}
                className="bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 text-xs font-semibold px-4 py-1.5 rounded-lg transition-all disabled:opacity-50"
              >
                {isSaving ? "Creating..." : "Confirm & Create"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal: Confirm Set Current with Safety Timed Countdown */}
      {termToSetCurrent ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-950 p-6 shadow-2xl text-slate-200">
            <h3 className="text-base font-semibold text-slate-100">
              Set Current Academic Term
            </h3>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              Are you sure you want to set <strong className="text-slate-200">{termToSetCurrent.academicYear} ({termToSetCurrent.semester})</strong> as the active term? This will update system submission parameters.
            </p>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setTermToSetCurrent(null)}
                disabled={isSaving}
                className="px-3.5 py-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 text-xs font-medium transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmSetCurrent}
                disabled={isSaving || countdown > 0}
                className="bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 text-xs font-semibold px-4 py-1.5 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving
                  ? "Saving..."
                  : countdown > 0
                  ? `Confirm Switch (${countdown}s)`
                  : "Confirm Switch"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal: Confirm Delete with Safety Timed Countdown */}
      {termToDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-950 p-6 shadow-2xl text-slate-200">
            <h3 className="text-base font-semibold text-slate-100">
              Delete Academic Term
            </h3>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              Are you sure you want to permanently delete <strong className="text-slate-200">{termToDelete.academicYear} ({termToDelete.semester})</strong>?
            </p>
            {termToDelete.deleteReason ? (
              <p className="mt-2 text-xs text-amber-400/90 bg-amber-950/20 p-2.5 rounded-lg border border-amber-500/20">
                {termToDelete.deleteReason}
              </p>
            ) : null}

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setTermToDelete(null)}
                disabled={isSaving}
                className="px-3.5 py-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 text-xs font-medium transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteTerm}
                disabled={isSaving || !termToDelete.canDelete || countdown > 0}
                className="bg-rose-500/10 text-rose-300 border border-rose-500/30 hover:bg-rose-500/20 text-xs font-semibold px-4 py-1.5 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving
                  ? "Deleting..."
                  : countdown > 0
                  ? `Confirm Delete (${countdown}s)`
                  : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

