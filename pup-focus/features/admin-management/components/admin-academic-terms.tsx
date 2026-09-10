"use client";

import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";

import { Check, Lock, WarningTriangle, Xmark } from "iconoir-react";

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
  const [warningModalData, setWarningModalData] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
  }>({ isOpen: false, title: "", description: "" });
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
        if (
          data?.error?.includes("unvalidated or incomplete requirements") ||
          data?.details?.includes("unvalidated") ||
          data?.error?.includes("Cannot close") ||
          data?.error?.includes("Incomplete Term Requirements")
        ) {
          setWarningModalData({
            isOpen: true,
            title: "Incomplete Term Requirements",
            description:
              "The submission window cannot be changed or closed yet. There are still missing requirements or unvalidated submissions for the current term.",
          });
          setTermToSetCurrent(null);
          return;
        }
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
        <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800/80 px-2 py-0.5 text-xs font-semibold rounded-md">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
          Current
        </span>
      );
    }
    if (status === "Archived" || (status as string) === "Completed") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
          Archived
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/60">
        Upcoming
      </span>
    );
  }

  function renderSetCurrentAction(term: AcademicTermItem) {
    if (term.status === "Current") {
      return (
        <span className="text-slate-500 dark:text-slate-400 font-semibold text-xs px-3 py-1.5 inline-block select-none">
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
          className="text-slate-600 dark:text-slate-400 font-medium text-[11px] sm:text-xs px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-not-allowed select-none inline-flex items-center gap-1 shrink-0 whitespace-nowrap"
        >
          <Lock className="h-3.5 w-3.5" />
          <span className="sm:hidden">Closed</span>
          <span className="hidden sm:inline">Term Closed / Completed</span>
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
          className="bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 text-xs font-medium px-3 py-1.5 rounded-lg cursor-not-allowed select-none"
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
        className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Academic Terms</h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Manage academic years and active term status across the campus system.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsCreateModalOpen(true)}
          disabled={isLoading || isSaving}
          className="bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-semibold px-4 py-2 rounded-xl text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm"
        >
          + Create Next Academic Year
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300 p-3.5 text-xs">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300 p-3.5 text-xs">
          {success}
        </div>
      ) : null}

      {/* Adaptive Table Container */}
      <div className="w-full overflow-x-auto rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm shadow-slate-300/50 dark:shadow-none overflow-hidden transition-colors">
        <table className="w-full text-left border-collapse min-w-[600px]">
            <thead className="border-b border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 text-[11px] font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Academic Year</th>
                <th className="py-3 px-4">Semester</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300 dark:divide-slate-800/60">
              {isLoading ? (
                <tr className="bg-white dark:bg-slate-900/40 py-2.5 px-4 text-xs">
                  <td colSpan={4} className="py-6 text-center text-slate-500 dark:text-slate-400">
                    Loading academic terms...
                  </td>
                </tr>
              ) : terms.length === 0 ? (
                <tr className="bg-white dark:bg-slate-900/40 py-2.5 px-4 text-xs">
                  <td colSpan={4} className="py-6 text-center text-slate-500 dark:text-slate-400">
                    No academic terms have been created yet.
                  </td>
                </tr>
              ) : (
                terms.map((term) => (
                  <tr
                    key={`${term.academicYear}-${term.semester}`}
                    className="bg-white dark:bg-slate-900/60 border-b border-slate-300 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors py-2.5 px-4 text-xs"
                  >
                    <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-slate-100">
                      {term.academicYear}
                    </td>
                    <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300 font-medium">
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
                            className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 text-xs font-semibold px-3 py-1 rounded-lg transition-all disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed cursor-pointer"
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

      {/* Modal: Create Next Academic Year */}
      {isCreateModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 shadow-2xl text-slate-900 dark:text-slate-100">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Create Next Academic Year
                </h3>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                  Automatically generate terms for the upcoming academic cycle.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 p-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
                aria-label="Close modal"
              >
                <Xmark className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400/90">
                Next Academic Year
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
                {computedNextAcademicYear}
              </p>

              <div className="mt-4 space-y-2.5">
                <div className="flex items-center gap-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-950/60 p-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-200">
                      {computedNextAcademicYear} • 1st Semester
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Auto-generated for First Semester.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-950/60 p-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-200">
                      {computedNextAcademicYear} • 2nd Semester
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
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
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-200 text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateNextAcademicYear}
                disabled={isSaving}
                className="bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-semibold px-4 py-2 rounded-xl text-xs transition-all disabled:opacity-50 cursor-pointer shadow-sm"
              >
                {isSaving ? "Creating..." : "Confirm & Create"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal: Confirm Set Current with Safety Timed Countdown */}
      {termToSetCurrent ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 shadow-2xl text-slate-900 dark:text-slate-100">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Set Current Academic Term
            </h3>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Are you sure you want to set <strong className="text-slate-900 dark:text-slate-200">{termToSetCurrent.academicYear} ({termToSetCurrent.semester})</strong> as the active term? This will update system submission parameters.
            </p>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setTermToSetCurrent(null)}
                disabled={isSaving}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-200 text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmSetCurrent}
                disabled={isSaving || countdown > 0}
                className="bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-semibold px-4 py-2 rounded-xl text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 shadow-2xl text-slate-900 dark:text-slate-100">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Delete Academic Term
            </h3>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Are you sure you want to permanently delete <strong className="text-slate-900 dark:text-slate-200">{termToDelete.academicYear} ({termToDelete.semester})</strong>?
            </p>
            {termToDelete.deleteReason ? (
              <p className="mt-2 text-xs text-amber-800 dark:text-amber-400/90 bg-amber-50 dark:bg-amber-950/20 p-2.5 rounded-lg border border-amber-300 dark:border-amber-500/20">
                {termToDelete.deleteReason}
              </p>
            ) : null}

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setTermToDelete(null)}
                disabled={isSaving}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-200 text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteTerm}
                disabled={isSaving || !termToDelete.canDelete || countdown > 0}
                className="bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold px-4 py-2 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm"
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

      {warningModalData.isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-950 border border-amber-500/40 rounded-3xl p-6 max-w-md w-full text-center shadow-2xl space-y-4 text-slate-900 dark:text-slate-100">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-full flex items-center justify-center mx-auto text-slate-600 dark:text-slate-400">
              <WarningTriangle className="w-8 h-8 animate-pulse" />
            </div>
            <h3 className="text-xl font-bold text-amber-800 dark:text-amber-200">
              {warningModalData.title}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {warningModalData.description}
            </p>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() =>
                  setWarningModalData({ ...warningModalData, isOpen: false })
                }
                className="flex-1 py-2.5 rounded-xl border border-slate-400 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 text-slate-800 dark:text-slate-300 text-xs font-semibold transition"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setWarningModalData({ ...warningModalData, isOpen: false });
                  window.location.href = "/admin/dashboard?tab=requirements";
                }}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-sm active:scale-[0.98] transition-all cursor-pointer"
              >
                Review Requirements
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

