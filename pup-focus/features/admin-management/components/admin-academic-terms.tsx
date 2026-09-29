"use client";

import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";

import {
  Archive,
  Calendar,
  Check,
  Database,
  Eye,
  Lock,
  SystemRestart,
  TaskList,
  WarningTriangle,
  Xmark,
} from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";
import { ModalHeader } from "@/components/ui/modal-header";
import { HistoricalSubmissionsModal } from "./historical-submissions-modal";

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
  isSuperAdmin = false,
  onNavigateToRequirements,
  onNavigateToBackups,
}: {
  adminName?: string | null;
  isSuperAdmin?: boolean;
  onNavigateToRequirements?: () => void;
  onNavigateToBackups?: () => void;
}) {
  const [terms, setTerms] = useState<AcademicTermItem[]>([]);
  const [warningModalData, setWarningModalData] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    hasIncompleteRequirements?: boolean;
    missingBackup?: boolean;
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
  const [historyModalData, setHistoryModalData] = useState<{
    isOpen: boolean;
    academicYear?: string;
    semester?: string;
  }>({ isOpen: false });
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
          data?.error?.includes("Incomplete") ||
          data?.error?.includes("Requirements") ||
          data?.error?.includes("Backup") ||
          data?.details?.includes("unvalidated") ||
          data?.details?.includes("backup")
        ) {
          setWarningModalData({
            isOpen: true,
            title: data?.error || "Incomplete Term Transition Requirements",
            description:
              data?.details ||
              "All requirements must be submitted and validated, and a backup must be created before changing the academic term.",
            hasIncompleteRequirements: data?.hasIncompleteRequirements ?? true,
            missingBackup: Boolean(data?.missingBackup),
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
        <span className="inline-flex items-center gap-1.5 bg-[#0b5336] text-white border border-[#08412a] px-2.5 py-0.5 text-xs font-semibold rounded-md shadow-2xs">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
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
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-amber-500 text-slate-950 border border-amber-600 shadow-2xs">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-950" />
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
          <AppIcon icon={Lock} size="sm" color="inherit" />
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
        className="bg-[#0b5336] hover:bg-[#073d2a] text-white border border-[#08412a] text-xs font-semibold px-3 py-1.5 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
      >
        Set Current
      </button>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* Top Header Actions */}
      <div className="flex items-center justify-end gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => setHistoryModalData({ isOpen: true })}
          className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 font-semibold px-3.5 py-2 rounded-xl text-xs transition-all cursor-pointer shadow-2xs"
          title="Browse read-only historical submissions from past inactive terms"
        >
          <AppIcon icon={Archive} size="xs" color="inherit" />
          <span>Browse Past Submissions</span>
        </button>

        <button
          type="button"
          onClick={() => setIsCreateModalOpen(true)}
          disabled={isLoading || isSaving}
          className="bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-600 font-semibold px-4 py-2 rounded-xl text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm"
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
      <div className="w-full overflow-x-auto rounded-xl border-2 border-amber-400 dark:border-amber-500/60 bg-white dark:bg-slate-900 shadow-xs dark:shadow-none overflow-hidden transition-colors">
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
                        {/* Submissions View Button */}
                        <button
                          type="button"
                          onClick={() =>
                            setHistoryModalData({
                              isOpen: true,
                              academicYear: term.academicYear,
                              semester: term.semester,
                            })
                          }
                          title={
                            term.status === "Current"
                              ? "View submissions for the current active academic term"
                              : "Browse read-only historical submissions from this academic term"
                          }
                          className="inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 text-xs font-medium px-2.5 py-1 rounded-lg transition-all cursor-pointer shadow-2xs"
                        >
                          <AppIcon icon={Eye} size="xs" color="inherit" />
                          <span>Submissions</span>
                        </button>

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
                            className="bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] text-xs font-semibold px-3 py-1 rounded-lg transition-all disabled:opacity-30 disabled:hover:bg-[#780000] disabled:cursor-not-allowed cursor-pointer shadow-2xs"
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
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-2xl text-slate-900 dark:text-slate-100 overflow-hidden flex flex-col">
            <ModalHeader
              title="Create Next Academic Year"
              subtitle="Automatically generate terms for the upcoming academic cycle."
              icon={Calendar}
            />
            <div className="p-6">
              <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400/90">
                  Next Academic Year
                </p>
                <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {computedNextAcademicYear}
                </p>

                <div className="mt-4 space-y-2.5">
                  <div className="flex items-center gap-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-950/60 p-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0b5336] text-white border border-[#08412a] shadow-xs shrink-0">
                      <Check className="h-4 w-4 text-white" strokeWidth={2.5} />
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
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0b5336] text-white border border-[#08412a] shadow-xs shrink-0">
                      <Check className="h-4 w-4 text-white" strokeWidth={2.5} />
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
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow-xs ${
                    isSaving
                      ? "bg-[#780000] text-white/80 border border-[#5e0000] cursor-not-allowed pointer-events-none brightness-90"
                      : "bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] cursor-pointer"
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateNextAcademicYear}
                  disabled={isSaving}
                  className={`inline-flex items-center justify-center font-semibold px-4 py-2 rounded-xl text-xs transition-all shadow-sm ${
                    isSaving
                      ? "bg-amber-500 text-slate-950 border border-amber-600 cursor-wait"
                      : "bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-600 cursor-pointer"
                  }`}
                >
                  {isSaving ? (
                    <>
                      <AppIcon
                        icon={SystemRestart}
                        size="xs"
                        color="inherit"
                        className="animate-spin mr-1.5 shrink-0"
                      />
                      <span>Creating...</span>
                    </>
                  ) : (
                    "Confirm & Create"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal: Confirm Set Current with Safety Timed Countdown */}
      {termToSetCurrent ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-2xl text-slate-900 dark:text-slate-100 overflow-hidden flex flex-col">
            <ModalHeader
              title="Set Current Academic Term"
              subtitle="Update active institutional academic period"
              icon={Calendar}
              onClose={isSaving ? undefined : () => setTermToSetCurrent(null)}
              closeDisabled={isSaving}
            />
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Are you sure you want to set{" "}
                <strong className="text-slate-900 dark:text-slate-100 font-semibold">
                  {termToSetCurrent.academicYear} ({termToSetCurrent.semester})
                </strong>{" "}
                as the active term? This will update system submission parameters and active semester records.
              </p>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setTermToSetCurrent(null)}
                  disabled={isSaving}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow-xs ${
                    isSaving
                      ? "bg-[#780000] text-white/80 border border-[#5e0000] cursor-not-allowed pointer-events-none brightness-90"
                      : "bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] cursor-pointer"
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void confirmSetCurrent()}
                  disabled={isSaving || countdown > 0}
                  className={`inline-flex items-center justify-center font-semibold px-4 py-2 rounded-xl text-xs transition-all shadow-sm ${
                    isSaving
                      ? "bg-[#0b5336] text-white border border-[#08412a] cursor-wait"
                      : countdown > 0
                      ? "bg-[#0b5336]/80 text-white/80 border border-[#08412a]/80 cursor-not-allowed"
                      : "bg-[#0b5336] hover:bg-[#073d2a] text-white border border-[#08412a] cursor-pointer"
                  }`}
                >
                  {isSaving ? (
                    <>
                      <AppIcon
                        icon={SystemRestart}
                        size="xs"
                        color="inherit"
                        className="animate-spin mr-1.5 shrink-0"
                      />
                      <span>Switching Term...</span>
                    </>
                  ) : countdown > 0 ? (
                    `Confirm Switch (${countdown}s)`
                  ) : (
                    "Confirm Switch"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal: Confirm Delete with Safety Timed Countdown */}
      {termToDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-2xl text-slate-900 dark:text-slate-100 overflow-hidden flex flex-col">
            <ModalHeader
              title="Delete Academic Term"
              subtitle="Permanently remove scheduled academic term"
              icon={WarningTriangle}
              onClose={isSaving ? undefined : () => setTermToDelete(null)}
              closeDisabled={isSaving}
            />
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Are you sure you want to permanently delete{" "}
                <strong className="text-slate-900 dark:text-slate-100 font-semibold">
                  {termToDelete.academicYear} ({termToDelete.semester})
                </strong>
                ?
              </p>
              {termToDelete.deleteReason ? (
                <p className="text-xs text-amber-800 dark:text-amber-400/90 bg-amber-50 dark:bg-amber-950/20 p-2.5 rounded-lg border border-amber-300 dark:border-amber-500/20">
                  {termToDelete.deleteReason}
                </p>
              ) : null}

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setTermToDelete(null)}
                  disabled={isSaving}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow-xs ${
                    isSaving
                      ? "bg-[#780000] text-white/80 border border-[#5e0000] cursor-not-allowed pointer-events-none brightness-90"
                      : "bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] cursor-pointer"
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteTerm}
                  disabled={isSaving || !termToDelete.canDelete || countdown > 0}
                  className={`inline-flex items-center justify-center font-semibold px-4 py-2 rounded-xl text-xs transition-all shadow-sm ${
                    isSaving
                      ? "bg-[#780000] text-white border border-[#5e0000] cursor-wait"
                      : countdown > 0 || !termToDelete.canDelete
                      ? "bg-[#780000]/70 text-white/70 border border-[#5e0000]/70 cursor-not-allowed"
                      : "bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] cursor-pointer"
                  }`}
                >
                  {isSaving ? (
                    <>
                      <AppIcon
                        icon={SystemRestart}
                        size="xs"
                        color="inherit"
                        className="animate-spin mr-1.5 shrink-0"
                      />
                      <span>Deleting...</span>
                    </>
                  ) : countdown > 0 ? (
                    `Confirm Delete (${countdown}s)`
                  ) : (
                    "Confirm Delete"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal: Requirements & Backup Required (System Transition Guard) */}
      {warningModalData.isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-2xl text-slate-900 dark:text-slate-100 overflow-hidden flex flex-col">
            <ModalHeader
              title="Requirements & Backup"
              subtitle="Semester requirements and backup status"
              icon={WarningTriangle}
              onClose={() =>
                setWarningModalData({ ...warningModalData, isOpen: false })
              }
            />

            <div className="p-6 space-y-4">
              {/* Requirements & Backup Checklist */}
              <div className="space-y-2.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Requirements &amp; Backup
                </p>

                {/* Item 1: Faculty Compliance */}
                <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-2xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
                        warningModalData.hasIncompleteRequirements !== false
                          ? "bg-amber-500 text-slate-950 border border-amber-600"
                          : "bg-[#0b5336] text-white border border-[#08412a]"
                      }`}
                    >
                      {warningModalData.hasIncompleteRequirements !== false ? (
                        <AppIcon
                          icon={TaskList}
                          size="sm"
                          color="inherit"
                        />
                      ) : (
                        <AppIcon icon={Check} size="sm" color="inherit" strokeWidth={2.5} />
                      )}
                    </div>
                    <div className="space-y-0.5 min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        1. Faculty Compliance Requirements
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        {warningModalData.hasIncompleteRequirements !== false
                          ? "All faculty members must submit required semester documents and have them validated."
                          : "All faculty compliance submissions for this semester have been validated."}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-lg shadow-2xs ${
                      warningModalData.hasIncompleteRequirements !== false
                        ? "bg-amber-500 text-slate-950 border border-amber-600"
                        : "bg-[#0b5336] text-white border border-[#08412a]"
                    }`}
                  >
                    {warningModalData.hasIncompleteRequirements !== false
                      ? "Action Required"
                      : "Validated"}
                  </span>
                </div>

                {/* Item 2: Semester Backup */}
                <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-2xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
                        warningModalData.missingBackup
                          ? "bg-amber-500 text-slate-950 border border-amber-600"
                          : "bg-[#0b5336] text-white border border-[#08412a]"
                      }`}
                    >
                      {warningModalData.missingBackup ? (
                        <AppIcon
                          icon={Database}
                          size="sm"
                          color="inherit"
                        />
                      ) : (
                        <AppIcon icon={Check} size="sm" color="inherit" strokeWidth={2.5} />
                      )}
                    </div>
                    <div className="space-y-0.5 min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        2. Semester Backup
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        {warningModalData.missingBackup
                          ? "A recovery backup of this semester must exist in Backup & Archive."
                          : "System backup for this semester has been confirmed."}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-lg shadow-2xs ${
                      warningModalData.missingBackup
                        ? "bg-amber-500 text-slate-950 border border-amber-600"
                        : "bg-[#0b5336] text-white border border-[#08412a]"
                    }`}
                  >
                    {warningModalData.missingBackup
                      ? "Backup Needed"
                      : "Backed Up"}
                  </span>
                </div>
              </div>

              {/* Action Buttons Footer */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 flex flex-col-reverse sm:flex-row items-center justify-between gap-2.5">
                <button
                  type="button"
                  onClick={() =>
                    setWarningModalData({ ...warningModalData, isOpen: false })
                  }
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] text-xs font-semibold transition-all cursor-pointer shadow-xs"
                >
                  Close
                </button>

                <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center gap-2">
                  {warningModalData.hasIncompleteRequirements !== false ? (
                    <button
                      type="button"
                      onClick={() => {
                        setWarningModalData({
                          ...warningModalData,
                          isOpen: false,
                        });
                        if (onNavigateToRequirements) {
                          onNavigateToRequirements();
                          return;
                        }
                        const isSuper =
                          isSuperAdmin ||
                          (typeof window !== "undefined" &&
                            window.location.pathname.startsWith("/super-admin"));
                        if (isSuper) {
                          window.location.href =
                            "/super-admin/dashboard?tab=verification";
                        } else {
                          window.location.href =
                            "/admin/dashboard?tab=requirements";
                        }
                      }}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-600 font-semibold text-xs transition-all cursor-pointer shadow-xs active:scale-[0.98]"
                    >
                      <AppIcon icon={TaskList} size="xs" color="inherit" />
                      <span>Review Requirements</span>
                    </button>
                  ) : null}

                  {warningModalData.missingBackup ? (
                    <button
                      type="button"
                      onClick={() => {
                        setWarningModalData({
                          ...warningModalData,
                          isOpen: false,
                        });
                        if (onNavigateToBackups) {
                          onNavigateToBackups();
                          return;
                        }
                        window.location.href =
                          "/super-admin/dashboard?tab=backups";
                      }}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white border border-slate-900 dark:border-slate-100 font-semibold text-xs transition-all cursor-pointer shadow-xs active:scale-[0.98]"
                    >
                      <AppIcon icon={Database} size="xs" color="inherit" />
                      <span>Backup Semester</span>
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Historical Submissions Modal for Inactive / Past Terms */}
      <HistoricalSubmissionsModal
        isOpen={historyModalData.isOpen}
        onClose={() => setHistoryModalData({ isOpen: false })}
        initialAcademicYear={historyModalData.academicYear}
        initialSemester={historyModalData.semester}
        allTerms={terms.map((t) => ({
          academicYear: t.academicYear,
          semester: t.semester,
          status: t.status,
        }))}
      />
    </div>
  );
}

