"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import {
  Archive,
  Calendar,
  Check,
  Database,
  Download,
  Eye,
  HardDrive,
  Hourglass,
  MultiplePages,
  NavArrowDown,
  Refresh,
  Search,
  Trash,
  User,
  WarningTriangle,
  Xmark,
} from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";
import { ModalHeader } from "@/components/ui/modal-header";
import { AlertPopup } from "@/components/ui/alert-popup";
import { useRealtimeSync } from "@/lib/realtime";
import type {
  SystemBackup,
  ArchivedTermSummary,
  AvailableAcademicTerm,
  BackupStats,
  FacultyOption,
} from "@/features/backup-archive/types/backup-archive.types";

export function BackupArchivePanel() {
  const [backups, setBackups] = useState<SystemBackup[]>([]);
  const [archivedTerms, setArchivedTerms] = useState<ArchivedTermSummary[]>([]);
  const [availableTerms, setAvailableTerms] = useState<AvailableAcademicTerm[]>([]);
  const [academicYears, setAcademicYears] = useState<string[]>([]);
  const [facultyList, setFacultyList] = useState<FacultyOption[]>([]);
  const [stats, setStats] = useState<BackupStats>({
    total_backups: 0,
    archived_academic_years: 0,
    last_backup_date: null,
    total_archived_documents: 0,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const hasLoadedRef = useRef(false);
  const [isGeneratingBackup, setIsGeneratingBackup] = useState(false);
  const [exportingTermKey, setExportingTermKey] = useState<string | null>(null);
  const [exportProgress, setExportProgress] = useState<string | null>(null);

  // Separate state for row-level ZIP downloads (independent from filter bar)
  const [rowExportingKey, setRowExportingKey] = useState<string | null>(null);
  const [rowExportProgress, setRowExportProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Scope filter states
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>("all");
  const [selectedSemester, setSelectedSemester] = useState<string>("all");
  const [selectedFacultyId, setSelectedFacultyId] = useState<string>("all");
  const [backupSearchQuery, setBackupSearchQuery] = useState("");

  // Searchable faculty dropdown state
  const [isFacultyDropdownOpen, setIsFacultyDropdownOpen] = useState(false);
  const [facultySearchQuery, setFacultySearchQuery] = useState("");
  const facultyDropdownRef = useRef<HTMLDivElement>(null);

  // Vault / Snapshot inspection modal
  const [inspectedBackup, setInspectedBackup] = useState<SystemBackup | null>(null);
  const [inspectedTerm, setInspectedTerm] = useState<ArchivedTermSummary | null>(null);
  const [backupToDelete, setBackupToDelete] = useState<SystemBackup | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteCountdown, setDeleteCountdown] = useState<number>(10);

  const loadBackupData = async (options?: { silent?: boolean }) => {
    const showLoading = !options?.silent && !hasLoadedRef.current;
    try {
      if (showLoading) {
        setIsLoading(true);
      }
      setError(null);
      const res = await fetch("/api/staff/backups");
      if (!res.ok) {
        throw new Error("Failed to load backups and archive records");
      }
      const data = await res.json();
      setBackups(data.backups || []);
      setArchivedTerms(data.archivedTerms || []);
      setAvailableTerms(data.availableTerms || []);

      if (data.availableTerms && Array.isArray(data.availableTerms)) {
        const current = data.availableTerms.find((t: AvailableAcademicTerm) => t.status === "Current");
        if (current && !hasLoadedRef.current) {
          setSelectedAcademicYear((prev) => (prev === "all" ? current.academic_year : prev));
          setSelectedSemester((prev) => (prev === "all" ? current.semester : prev));
        }
      }

      if (data.academicYears && Array.isArray(data.academicYears)) {
        setAcademicYears(data.academicYears);
      }
      if (data.facultyList && Array.isArray(data.facultyList)) {
        setFacultyList(data.facultyList);
      }
      if (data.stats) {
        setStats(data.stats);
      }
      hasLoadedRef.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading backup data");
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    void loadBackupData();
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const ay = params.get("academic_year") || params.get("ay");
      const sem = params.get("semester") || params.get("sem");
      if (ay) setSelectedAcademicYear(ay);
      if (sem) setSelectedSemester(sem);
    }
  }, []);

  useRealtimeSync(() => {
    void loadBackupData({ silent: true });
  });

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await loadBackupData({ silent: true });
    } finally {
      setIsRefreshing(false);
    }
  };

  // 10-second countdown timer for delete confirmation
  useEffect(() => {
    if (!backupToDelete) {
      setDeleteCountdown(10);
      return;
    }
    setDeleteCountdown(10);
    const timer = setInterval(() => {
      setDeleteCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [backupToDelete]);

  // Handle click outside to close searchable faculty dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        facultyDropdownRef.current &&
        !facultyDropdownRef.current.contains(event.target as Node)
      ) {
        setIsFacultyDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isAdministrativeFacultyOption = (fac: FacultyOption) => {
    const email = (fac.email || "").toLowerCase().trim();
    const name = (fac.name || "").toLowerCase().trim();
    if (
      email === "pupbataanfocus.superadmin@gmail.com" ||
      email === "preview@pupfocus.dev" ||
      email === "christianjaycmandani@iskolarngbayan.pup.edu.ph" ||
      email.includes("superadmin") ||
      email.includes("admin@") ||
      email.endsWith("@pupfocus.dev")
    ) {
      return true;
    }
    if (
      name.includes("super admin") ||
      name.includes("developer preview") ||
      name === "pup focus super admin" ||
      name.includes("system administrator")
    ) {
      return true;
    }
    return false;
  };

  const verifiedFacultyList = useMemo(() => {
    return facultyList.filter((fac) => !isAdministrativeFacultyOption(fac));
  }, [facultyList]);

  const isScopeFiltered = useMemo(() => {
    return (
      selectedAcademicYear !== "all" ||
      selectedSemester !== "all" ||
      selectedFacultyId !== "all"
    );
  }, [selectedAcademicYear, selectedSemester, selectedFacultyId]);

  const selectedFacultyObj = useMemo(() => {
    if (selectedFacultyId === "all") return null;
    return verifiedFacultyList.find((f) => f.id === selectedFacultyId) || null;
  }, [selectedFacultyId, verifiedFacultyList]);

  const filteredFacultyList = useMemo(() => {
    const q = facultySearchQuery.trim().toLowerCase();
    if (!q) return verifiedFacultyList;
    return verifiedFacultyList.filter((f) => {
      const nameMatch = f.name.toLowerCase().includes(q);
      const deptMatch = f.department ? f.department.toLowerCase().includes(q) : false;
      const emailMatch = f.email ? f.email.toLowerCase().includes(q) : false;
      return nameMatch || deptMatch || emailMatch;
    });
  }, [verifiedFacultyList, facultySearchQuery]);

  const currentActiveTerm = useMemo(() => {
    return availableTerms.find((t) => t.status === "Current") || null;
  }, [availableTerms]);

  const isTermBackedUp = (ay: string, sem: string) => {
    const targetAy = (ay || "").trim().toLowerCase();
    const targetSem = (sem || "").trim().toLowerCase();

    return backups.some((b) => {
      if (b.status && b.status !== "completed") return false;
      const meta = b.metadata ?? {};
      const scope = typeof meta.scope === "object" && meta.scope !== null ? meta.scope : {};
      const bAy = (b.academic_year || meta.academic_year || scope.academic_year || "").trim().toLowerCase();
      const bSem = (meta.semester || scope.semester || "").trim().toLowerCase();
      if (bAy === targetAy && bSem && bSem !== "all" && bSem === targetSem) return true;
      const name = (b.backup_name || "").toLowerCase();
      const safeAy = targetAy.replace(/[^a-zA-Z0-9]/g, "_");
      const safeSem = targetSem.replace(/[^a-zA-Z0-9]/g, "_");
      return name.includes(safeAy) && name.includes(safeSem);
    });
  };

  const isCurrentTermBackedUp = useMemo(() => {
    if (!currentActiveTerm) return false;
    return isTermBackedUp(currentActiveTerm.academic_year, currentActiveTerm.semester);
  }, [currentActiveTerm, backups]);

  const isSelectedCurrent = useMemo(() => {
    if (!currentActiveTerm) return false;
    const ayMatch =
      selectedAcademicYear === "all" ||
      selectedAcademicYear === currentActiveTerm.academic_year;
    const semMatch =
      selectedSemester === "all" ||
      selectedSemester === currentActiveTerm.semester;
    return ayMatch && semMatch;
  }, [selectedAcademicYear, selectedSemester, currentActiveTerm]);

  const isSelectedBackedUp = useMemo(() => {
    const targetAy = selectedAcademicYear !== "all" ? selectedAcademicYear : currentActiveTerm?.academic_year || "";
    const targetSem = selectedSemester !== "all" ? selectedSemester : currentActiveTerm?.semester || "";
    if (!targetAy || !targetSem) return false;
    return isTermBackedUp(targetAy, targetSem);
  }, [selectedAcademicYear, selectedSemester, currentActiveTerm, backups]);

  const isExactCurrentActiveTerm = useMemo(() => {
    if (!currentActiveTerm) return false;
    return (
      selectedAcademicYear === currentActiveTerm.academic_year &&
      selectedSemester === currentActiveTerm.semester
    );
  }, [selectedAcademicYear, selectedSemester, currentActiveTerm]);

  const dynamicBackupButtonLabel = "Generate & Download Backup (.ZIP)";

  const filteredBackups = useMemo(() => {
    const q = backupSearchQuery.trim().toLowerCase();
    if (!q) return backups;
    return backups.filter((bk) => {
      const nameMatch = (bk.backup_name || "").toLowerCase().includes(q);
      const ayMatch = (bk.academic_year || bk.metadata?.academic_year || "").toLowerCase().includes(q);
      const semMatch = (bk.metadata?.semester || "").toLowerCase().includes(q);
      const facMatch = (bk.metadata?.faculty_name || "").toLowerCase().includes(q);
      return nameMatch || ayMatch || semMatch || facMatch;
    });
  }, [backups, backupSearchQuery]);

  const resetFilters = () => {
    if (currentActiveTerm) {
      setSelectedAcademicYear(currentActiveTerm.academic_year);
      setSelectedSemester(currentActiveTerm.semester);
    } else {
      setSelectedAcademicYear("all");
      setSelectedSemester("all");
    }
    setSelectedFacultyId("all");
    setFacultySearchQuery("");
    setIsFacultyDropdownOpen(false);
  };

  const handleBackupSpecificTerm = async (ay: string, sem: string) => {
    try {
      setIsGeneratingBackup(true);
      setError(null);

      const res = await fetch("/api/staff/backups/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          academic_year: ay,
          semester: sem,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to create semester backup");
      }

      if (data.backup) {
        setBackups((prev) => [data.backup, ...prev.filter((b) => b.id !== data.backup.id)]);
        setStats((prev) => ({
          ...prev,
          total_backups: prev.total_backups + 1,
          last_backup_date: data.backup.created_at,
        }));
      }

      setSuccess(`Verified document backup for S.Y. ${ay} (${sem}) completed and stored!`);
      setTimeout(() => setSuccess(null), 6000);

      await handleDownloadZip(ay, sem);
      await loadBackupData({ silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create semester backup");
    } finally {
      setIsGeneratingBackup(false);
    }
  };

  const handleGenerateBackup = async () => {
    try {
      setIsGeneratingBackup(true);
      setError(null);

      const targetAy = selectedAcademicYear !== "all" ? selectedAcademicYear : currentActiveTerm?.academic_year;
      const targetSem = selectedSemester !== "all" ? selectedSemester : currentActiveTerm?.semester;

      const payload = {
        academic_year: targetAy,
        semester: targetSem,
      };

      const res = await fetch("/api/staff/backups/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error ||
            "Failed to save backup history to database. Please ensure SQL migration 0021 was executed."
        );
      }

      if (data.backup) {
        setBackups((prev) => [data.backup, ...prev.filter((b) => b.id !== data.backup.id)]);
        setStats((prev) => ({
          ...prev,
          total_backups: prev.total_backups + 1,
          last_backup_date: data.backup.created_at,
        }));
      }

      const scopeDesc = `S.Y. ${targetAy || "All"} · ${targetSem || "All Semesters"} (All Faculty)`;
      setSuccess(`Verified semester backup for ${scopeDesc} generated successfully!`);
      setTimeout(() => setSuccess(null), 5000);

      // Trigger automatic browser download of document vault ZIP
      await handleDownloadZip(targetAy, targetSem);
      await loadBackupData({ silent: true });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to create semester backup snapshot."
      );
    } finally {
      setIsGeneratingBackup(false);
    }
  };

  const handleDownloadZip = async (
    targetAY?: string,
    targetSem?: string,
  ) => {
    const ay = targetAY !== undefined ? targetAY : (selectedAcademicYear !== "all" ? selectedAcademicYear : currentActiveTerm?.academic_year || "all");
    const sem = targetSem !== undefined ? targetSem : (selectedSemester !== "all" ? selectedSemester : currentActiveTerm?.semester || "all");

    const key = `${ay || "all"}__${sem || "all"}__all`;
    try {
      setExportingTermKey(key);
      setExportProgress("Preparing files... 20%");
      setError(null);

      const params = new URLSearchParams();
      if (ay && ay !== "all") params.set("academic_year", ay);
      if (sem && sem !== "all") params.set("semester", sem);
      params.set("faculty_id", "all");

      const timer1 = setTimeout(() => {
        setExportProgress("Zipping documents... 60%");
      }, 600);

      const timer2 = setTimeout(() => {
        setExportProgress("Finalizing ZIP archive... 90%");
      }, 1400);

      const res = await fetch(`/api/staff/backups/export-zip?${params.toString()}`);
      clearTimeout(timer1);
      clearTimeout(timer2);

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to generate document vault ZIP");
      }

      setExportProgress("Finalizing ZIP archive... 100%");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      const safeAY = ay && ay !== "all" ? ay.replace(/[^a-zA-Z0-9]/g, "_") : "All_AY";
      const safeSem = sem && sem !== "all" ? sem.replace(/[^a-zA-Z0-9]/g, "_") : "All_Sem";

      const dateStr = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      a.download = `Backup_${safeAY}_${safeSem}_${dateStr}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const scopeDesc = `S.Y. ${ay} · ${sem} (All Faculty)`;
      setSuccess(`Document Vault ZIP (${scopeDesc}) downloaded successfully!`);
      setTimeout(() => setSuccess(null), 5000);

      // Refresh list so the newly created system_backups record appears
      await loadBackupData({ silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error exporting document vault ZIP");
    } finally {
      setExportingTermKey(null);
      setExportProgress(null);
    }
  };

  // Separate ZIP handler for table row buttons — uses independent state
  const handleRowDownloadZip = async (ay: string, sem: string, fac: string) => {
    const key = `${ay}__${sem}__${fac}`;
    try {
      setRowExportingKey(key);
      setRowExportProgress("Preparing... 20%");
      setError(null);

      const params = new URLSearchParams();
      if (ay && ay !== "all") params.set("academic_year", ay);
      if (sem && sem !== "all") params.set("semester", sem);
      if (fac && fac !== "all") params.set("faculty_id", fac);

      const t1 = setTimeout(() => setRowExportProgress("Zipping documents... 60%"), 600);
      const t2 = setTimeout(() => setRowExportProgress("Finalizing... 90%"), 1400);

      const res = await fetch(`/api/staff/backups/export-zip?${params.toString()}`);
      clearTimeout(t1);
      clearTimeout(t2);

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to generate document vault ZIP");
      }

      setRowExportProgress("Done! 100%");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      const safeAY = ay && ay !== "all" ? ay.replace(/[^a-zA-Z0-9]/g, "_") : "All_AY";
      const safeSem = sem && sem !== "all" ? sem.replace(/[^a-zA-Z0-9]/g, "_") : "All_Sem";
      const facultyObj = facultyList.find((f) => f.id === fac);
      const safeFac = facultyObj
        ? `${facultyObj.name.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 20)}_`
        : "";

      const dateStr = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      a.download = `Backup_${safeAY}_${safeSem}_${dateStr}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSuccess(`Document Vault ZIP downloaded successfully!`);
      setTimeout(() => setSuccess(null), 4000);

      // Refresh list so the newly created system_backups record appears
      await loadBackupData({ silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error exporting document vault ZIP");
    } finally {
      setRowExportingKey(null);
      setRowExportProgress(null);
    }
  };

  const handleDeleteBackup = async () => {
    if (!backupToDelete) return;

    try {
      setIsDeleting(true);
      setError(null);
      const res = await fetch(`/api/staff/backups?id=${backupToDelete.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete backup log");
      }

      setSuccess(`Backup record "${backupToDelete.backup_name}" deleted.`);
      setTimeout(() => setSuccess(null), 4000);
      setBackupToDelete(null);
      await loadBackupData({ silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error deleting backup");
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDateTime = (isoString?: string | null) => {
    if (!isoString) return "Never";
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  const formatFileSize = (kb: number) => {
    if (kb < 1024) return `${kb} KB`;
    return `${(kb / 1024).toFixed(2)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Top 3 Stat Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Backups
            </span>
            <HardDrive className="h-5 w-5 text-slate-400" strokeWidth={2} />
          </div>
          <div className="mt-2">
            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              {stats.total_backups}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Saved backups you can download anytime
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Archived Terms
            </span>
            <span className="w-2 h-2 rounded-full bg-[#0b5336]" />
          </div>
          <div className="mt-2">
            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              {stats.archived_academic_years}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Past academic terms safely stored
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Last Backup
            </span>
            <Hourglass className="h-5 w-5 text-slate-400" strokeWidth={2} />
          </div>
          <div className="mt-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight truncate">
              {formatDateTime(stats.last_backup_date)}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Most recent backup saved
            </p>
          </div>
        </div>
      </section>

      {/* Notifications */}
      <AlertPopup type="error" message={error} onClose={() => setError(null)} />
      <AlertPopup type="success" message={success} onClose={() => setSuccess(null)} />

      {/* UNIFIED SEMESTER COMPLIANCE & BACKUP COMMAND CENTER */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm shadow-slate-200/50 dark:shadow-none p-5 sm:p-6 transition-all space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="p-2 rounded-xl bg-amber-500 text-slate-950 border border-amber-600 shrink-0 shadow-2xs">
                <AppIcon icon={Archive} size="sm" color="inherit" />
              </span>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>Semester Compliance Backup &amp; Document Vault</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Every backup comprehensively captures <strong>all faculty members</strong>, their submitted requirements, and verified file types for the selected semester.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {currentActiveTerm && !isExactCurrentActiveTerm && (
              <button
                type="button"
                onClick={() => {
                  setSelectedAcademicYear(currentActiveTerm.academic_year);
                  setSelectedSemester(currentActiveTerm.semester);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-amber-500/40 bg-amber-500/15 hover:bg-amber-500/25 text-amber-950 dark:text-amber-200 transition-all cursor-pointer shadow-2xs active:scale-[0.98]"
                title="Reset filters to active operational term"
              >
                <AppIcon icon={Calendar} size="xs" color="inherit" />
                <span>Active Term Preset</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => void handleRefresh()}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-white hover:bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 transition-all cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Refresh className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              <span>{isRefreshing ? "Syncing..." : "Refresh"}</span>
            </button>
          </div>
        </div>

        {/* Compact Operational Term Alert Banner */}
        {currentActiveTerm && (
          <div
            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-4 py-2.5 rounded-xl border text-xs shadow-xs font-medium transition-all ${
              isCurrentTermBackedUp
                ? "bg-[#0b5336] text-white border-[#08412a]"
                : "bg-amber-500 text-slate-950 border-amber-600"
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="shrink-0 text-sm">💡</span>
              <span className="truncate">
                Active Operational Term: <strong className="font-bold">A.Y. {currentActiveTerm.academic_year} · {currentActiveTerm.semester}</strong>
                <span
                  className={`ml-1.5 hidden md:inline ${
                    isCurrentTermBackedUp ? "text-emerald-100" : "text-slate-900/80 font-normal"
                  }`}
                >
                  ({isCurrentTermBackedUp ? "Verified backup on file" : "Backup required before term change"})
                </span>
              </span>
            </div>
            <span
              className={`shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1.5 shadow-2xs ${
                isCurrentTermBackedUp
                  ? "bg-white/20 text-white border border-white/30"
                  : "bg-white text-amber-950 border border-amber-300/80"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isCurrentTermBackedUp ? "bg-emerald-300" : "bg-amber-600"
                }`}
              />
              {isCurrentTermBackedUp ? "Backup Saved" : "Backup Required"}
            </span>
          </div>
        )}

        {/* Controls: Term Selector & Primary Action Button */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end pt-1">
          {/* Academic Year Selector */}
          <div className="md:col-span-3 space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <AppIcon icon={Calendar} size="xs" color="default" />
              <span>Academic Year</span>
            </label>
            <select
              value={selectedAcademicYear}
              onChange={(e) => setSelectedAcademicYear(e.target.value)}
              className="w-full h-10 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl px-3 text-xs outline-none focus:border-amber-500 transition cursor-pointer font-medium"
            >
              <option value="all">All Academic Years</option>
              {academicYears.map((ay) => (
                <option key={ay} value={ay}>
                  A.Y. {ay}
                </option>
              ))}
            </select>
          </div>

          {/* Semester Selector */}
          <div className="md:col-span-3 space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <AppIcon icon={MultiplePages} size="xs" color="default" />
              <span>Semester</span>
            </label>
            <select
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
              className="w-full h-10 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl px-3 text-xs outline-none focus:border-amber-500 transition cursor-pointer font-medium"
            >
              <option value="all">All Semesters</option>
              <option value="1st Semester">1st Semester</option>
              <option value="2nd Semester">2nd Semester</option>
              <option value="Summer Semester">Summer Semester</option>
            </select>
          </div>

          {/* Primary Action Button: Documents Archive */}
          <div className="md:col-span-6 flex items-center justify-end">
            <button
              type="button"
              disabled={Boolean(exportingTermKey) || isGeneratingBackup}
              onClick={() => void handleDownloadZip()}
              className="w-full h-10 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-600 font-bold rounded-xl text-xs sm:text-sm px-4 transition shadow-xs cursor-pointer active:scale-[0.98] disabled:opacity-50"
              title="Download all faculty submitted requirement documents as a verified ZIP vault"
            >
              {exportingTermKey === `${selectedAcademicYear}__${selectedSemester}__all` ? (
                <>
                  <Refresh className="w-4 h-4 animate-spin text-slate-950" />
                  <span>{exportProgress || "Packaging documents..."}</span>
                </>
              ) : (
                <>
                  <AppIcon icon={Archive} size="sm" color="inherit" />
                  <span>Generate &amp; Download Backup (.ZIP)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* SECTION 2: System Backup History Manager */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <AppIcon icon={HardDrive} size="sm" color="default" />
              <span>Saved Backups &amp; Archive Records</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Verified backups and downloadable document vaults with term association.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Search backups input */}
            <div className="relative min-w-[220px] sm:min-w-[280px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={backupSearchQuery}
                onChange={(e) => setBackupSearchQuery(e.target.value)}
                placeholder="Search backups by name, AY, sem..."
                className="w-full pl-8.5 pr-7 py-1.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-amber-500 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 transition"
              />
              {backupSearchQuery && (
                <button
                  type="button"
                  onClick={() => setBackupSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <AppIcon icon={Xmark} size="xs" color="default" />
                </button>
              )}
            </div>

            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700/60 shrink-0">
              {filteredBackups.length} of {backups.length}
            </span>
          </div>
        </div>

        {/* Backups Table */}
        <div className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm shadow-slate-300/50 dark:shadow-none overflow-hidden transition-colors">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-xs border-collapse">
              <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-300 text-[11px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-3 text-center w-10 text-slate-400 dark:text-slate-500">#</th>
                  <th className="py-3 px-4 min-w-[220px]">Backup Name</th>
                  <th className="py-3 px-4 whitespace-nowrap">Included Data</th>
                  <th className="py-3 px-4 whitespace-nowrap">Date &amp; Time</th>
                  <th className="py-3 px-4 whitespace-nowrap">File Size</th>
                  <th className="py-3 px-4 text-center whitespace-nowrap">Items Saved</th>
                  <th className="py-3 px-4 text-center whitespace-nowrap">Status</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap pr-5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500">
                      <Refresh className="h-5 w-5 animate-spin mx-auto mb-2 text-amber-500" strokeWidth={2} />
                      Loading backups...
                    </td>
                  </tr>
                ) : filteredBackups.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500">
                      <AppIcon icon={HardDrive} size="xl" color="muted" className="mx-auto mb-2" />
                      <p className="font-semibold text-slate-700 dark:text-slate-300">
                        {backupSearchQuery ? "No matching backups found" : "No backups yet"}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {backupSearchQuery
                          ? "Try a different search keyword or clear filters."
                          : "Create a snapshot or download files above to save your first backup record."}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredBackups.map((bk, idx) => {
                    const scope = bk.metadata?.scope;
                    const hasScope = Boolean(
                      scope?.academic_year ||
                        scope?.semester ||
                        scope?.faculty_name ||
                        bk.academic_year ||
                        bk.metadata?.semester ||
                        bk.metadata?.faculty_name
                    );

                    const scopeAy = scope?.academic_year || bk.academic_year || null;
                    const scopeSem = scope?.semester || bk.metadata?.semester || null;
                    const scopeFac = scope?.faculty_name || bk.metadata?.faculty_name || null;

                    return (
                      <tr
                        key={bk.id}
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors align-middle"
                      >
                        {/* Column 1: Row Index (#) */}
                        <td className="py-3.5 px-3 text-center text-slate-400 dark:text-slate-500 font-mono text-xs select-none">
                          {idx + 1}
                        </td>

                        {/* Column 2: Backup Name */}
                        <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-slate-100">
                          <div className="flex items-center gap-2 max-w-[280px] sm:max-w-xs md:max-w-sm">
                            <Archive className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span
                              className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-100 truncate cursor-help"
                              title={bk.backup_name}
                            >
                              {bk.backup_name}
                            </span>
                          </div>
                        </td>

                        {/* Column 3: Included Data */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {hasScope ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-medium text-[11px] whitespace-nowrap">
                              {scopeAy ? (scopeAy.startsWith("A.Y.") ? scopeAy : `A.Y. ${scopeAy}`) : "All Academic Years"}
                              {scopeSem ? ` • ${scopeSem}` : ""}
                              {scopeFac ? ` • ${scopeFac}` : ""}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 text-[11px] whitespace-nowrap">
                              Everything
                            </span>
                          )}
                        </td>

                        {/* Column 4: Date & Time */}
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {formatDateTime(bk.created_at)}
                        </td>

                        {/* Column 5: File Size */}
                        <td className="py-3.5 px-4 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap font-mono text-xs">
                          {formatFileSize(bk.file_size_kb)}
                        </td>

                        {/* Column 6: Items Saved */}
                        <td className="py-3.5 px-4 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap text-center">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[11px] inline-block">
                            {bk.total_records.toLocaleString()} items
                          </span>
                        </td>

                        {/* Column 7: Status */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-center">
                          {bk.status === "completed" ? (
                            <span className="inline-flex items-center gap-1.5 bg-[#0b5336] text-white border border-[#08412a] px-2 py-0.5 text-xs font-semibold rounded-md shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
                              Completed
                            </span>
                          ) : bk.status === "failed" ? (
                            <span className="inline-flex items-center gap-1.5 bg-[#780000] text-white border border-[#5e0000] px-2 py-0.5 text-xs font-semibold rounded-md shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-300" />
                              Failed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 bg-amber-500/15 text-amber-900 border border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-400/30 px-2 py-0.5 text-xs font-semibold rounded-md">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                              Processing
                            </span>
                          )}
                        </td>

                        {/* Column 8: Actions */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap pr-5">
                          <div className="inline-flex items-center gap-1.5 justify-end">
                            <button
                              type="button"
                              onClick={() => setInspectedBackup(bk)}
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition cursor-pointer flex items-center gap-1 shrink-0"
                              title="View backup details"
                            >
                              <AppIcon icon={Eye} size="xs" color="default" />
                              <span>View</span>
                            </button>

                            <button
                              type="button"
                              disabled={Boolean(rowExportingKey) || isGeneratingBackup}
                              onClick={() =>
                                void handleRowDownloadZip(
                                  scopeAy ?? "all",
                                  scopeSem ?? "all",
                                  "all"
                                )
                              }
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-600 transition cursor-pointer flex items-center gap-1 shadow-xs disabled:opacity-50 shrink-0"
                              title="Download document archive (.ZIP)"
                            >
                              {rowExportingKey === `${scopeAy ?? "all"}__${scopeSem ?? "all"}__all` ? (
                                <>
                                  <Refresh className="w-3 h-3 animate-spin text-slate-950" />
                                  <span>{rowExportProgress || "Zipping..."}</span>
                                </>
                              ) : (
                                <>
                                  <AppIcon icon={Archive} size="xs" color="inherit" />
                                  <span>Download (.ZIP)</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => setBackupToDelete(bk)}
                              className="p-1 text-red-500 hover:bg-red-500/10 border border-transparent hover:border-red-200 dark:hover:border-red-900/60 rounded-lg transition cursor-pointer shrink-0"
                              title="Delete backup"
                            >
                              <AppIcon icon={Trash} size="sm" color="inherit" />
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
      </section>

      {/* SECTION 3: Institutional Compliance Archive Vault */}
      <section className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <AppIcon icon={Archive} size="md" color="default" />
            <span>Academic Terms &amp; Semester Archive Vault</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Monitor per-semester backup readiness across all academic periods. Active terms require a verified backup before changing term.
          </p>
        </div>

        {/* Academic Terms Table */}
        <div className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm shadow-slate-300/50 dark:shadow-none overflow-hidden transition-colors">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs border-collapse">
              <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-300 text-[11px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-3 text-center w-10 text-slate-400 dark:text-slate-500">#</th>
                  <th className="py-3 px-4 min-w-[200px]">Academic Year &amp; Semester</th>
                  <th className="py-3 px-4 whitespace-nowrap">Term State</th>
                  <th className="py-3 px-4 whitespace-nowrap">Semester Backup Status</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap pr-5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                {(availableTerms.length > 0 ? availableTerms : archivedTerms).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-500">
                      <AppIcon icon={Archive} size="md" color="muted" className="mx-auto mb-2" />
                      <p className="font-semibold text-slate-700 dark:text-slate-300">
                        No academic terms found
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Academic terms configured in settings will display here.
                      </p>
                    </td>
                  </tr>
                ) : (
                  (availableTerms.length > 0 ? availableTerms : archivedTerms).map((term, idx) => {
                    const isBackedUp = isTermBackedUp(term.academic_year, term.semester);
                    const isCurrent = term.status === "Current";
                    const isArchived = term.status === "Archived" || term.is_archived;
                    const zipKey = `${term.academic_year}__${term.semester}__all`;
                    const isRowExporting = exportingTermKey === zipKey;

                    return (
                      <tr
                        key={`${term.academic_year}-${term.semester}`}
                        className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors align-middle ${
                          isCurrent ? "bg-amber-500/5 dark:bg-amber-500/10" : ""
                        }`}
                      >
                        {/* Column 1: Row Index (#) */}
                        <td className="py-3.5 px-3 text-center text-slate-400 dark:text-slate-500 font-mono text-xs select-none">
                          {idx + 1}
                        </td>

                        {/* Column 2: Academic Year & Semester */}
                        <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-slate-100">
                          <div className="flex items-center gap-2.5">
                            <div className="p-1.5 rounded-lg shrink-0 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                              <AppIcon icon={Calendar} size="sm" color="default" />
                            </div>
                            <div>
                              <span className="font-bold text-xs block text-slate-900 dark:text-slate-100">
                                {term.academic_year}
                              </span>
                              <span className="text-xs text-slate-500 dark:text-slate-400 block">
                                {term.semester}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Column 3: Term State */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {isCurrent ? (
                            <span className="inline-flex items-center gap-1.5 bg-amber-500 text-slate-950 border border-amber-600 px-2 py-0.5 text-xs font-bold rounded-md shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-pulse" />
                              Current Term
                            </span>
                          ) : isArchived ? (
                            <span className="inline-flex items-center gap-1.5 bg-[#0b5336] text-white border border-[#08412a] px-2 py-0.5 text-xs font-semibold rounded-md shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
                              Archived
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 px-2 py-0.5 text-xs font-semibold rounded-md shadow-2xs">
                              Upcoming
                            </span>
                          )}
                        </td>

                        {/* Column 4: Semester Backup Status */}
                        <td className="py-3.5 px-4 font-medium whitespace-nowrap">
                          {isBackedUp ? (
                            <span className="inline-flex items-center gap-1.5 text-xs text-white font-semibold bg-[#0b5336] border border-[#08412a] px-2.5 py-0.5 rounded-md shadow-2xs">
                              <AppIcon icon={Check} size="xs" color="inherit" strokeWidth={2.5} />
                              <span>Verified Snapshot Stored</span>
                            </span>
                          ) : isCurrent ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-950 bg-amber-500 border border-amber-600 px-2.5 py-0.5 rounded-md shadow-2xs">
                              <AppIcon icon={WarningTriangle} size="xs" color="inherit" />
                              <span>Backup Required Before Changing Term</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-normal">
                              <span>No snapshot taken</span>
                            </span>
                          )}
                        </td>

                        {/* Column 5: Actions */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap pr-5">
                          <div className="inline-flex items-center gap-1.5 justify-end">
                            <button
                              type="button"
                              disabled={Boolean(exportingTermKey)}
                              onClick={() =>
                                void handleDownloadZip(
                                  term.academic_year,
                                  term.semester,
                                  "all"
                                )
                              }
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-600 transition cursor-pointer inline-flex items-center gap-1 shadow-xs disabled:opacity-50 shrink-0"
                              title="Download faculty files archive (.ZIP)"
                            >
                              {isRowExporting ? (
                                <>
                                  <Refresh className="w-3 h-3 animate-spin" />
                                  <span>{exportProgress || "Zipping..."}</span>
                                </>
                              ) : (
                                <>
                                  <AppIcon icon={Archive} size="xs" color="inherit" />
                                  <span>Download (.ZIP)</span>
                                </>
                              )}
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
      </section>

      {/* Backup Inspection Modal */}
      {inspectedBackup && (() => {
        const snap = inspectedBackup.metadata?.snapshot as any;
        const fileTypes = inspectedBackup.metadata?.file_types_summary || snap?.summary?.file_types_summary || {};
        const facultyRoster = snap?.faculty_roster || snap?.faculty_list || null;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl text-slate-900 dark:text-slate-100 max-h-[88vh] overflow-hidden flex flex-col">
              <ModalHeader title={inspectedBackup.backup_name} icon={Archive} onClose={() => setInspectedBackup(null)} />
              <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
                {/* Meta stats bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200 dark:bg-slate-950/60 dark:border-slate-800">
                  <div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                      Academic Term
                    </span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {inspectedBackup.academic_year || inspectedBackup.metadata?.academic_year || "All A.Y."}
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      {inspectedBackup.metadata?.semester || "All Semesters"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                      Faculty Count
                    </span>
                    <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                      {inspectedBackup.metadata?.users_count ?? (facultyRoster ? facultyRoster.length : "All Faculty")}
                    </span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block font-semibold">
                      All Faculty Scope
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                      Requirements Saved
                    </span>
                    <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                      {inspectedBackup.metadata?.submissions_count ?? inspectedBackup.total_records}
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      {formatFileSize(inspectedBackup.file_size_kb)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                      Date Generated
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate">
                      {formatDateTime(inspectedBackup.created_at)}
                    </span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block">
                      Verified Snapshot
                    </span>
                  </div>
                </div>

                {/* File Types Breakdown */}
                {Object.keys(fileTypes).length > 0 && (
                  <div className="p-3.5 rounded-xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 space-y-2">
                    <span className="text-[11px] font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider block flex items-center gap-1.5">
                      <AppIcon icon={MultiplePages} size="xs" color="inherit" />
                      <span>Captured File Types in this Semester</span>
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                      {Object.entries(fileTypes).map(([type, count]) => (
                        <span
                          key={type}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs font-semibold text-xs"
                        >
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-slate-950">
                            {type}
                          </span>
                          <span className="text-slate-700 dark:text-slate-200">
                            {Number(count)} file{Number(count) === 1 ? "" : "s"}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Faculty & Submitted Requirements Roster */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                      <AppIcon icon={User} size="xs" color="default" />
                      <span>Faculty &amp; Submitted Requirements Roster</span>
                    </h4>
                    {facultyRoster && (
                      <span className="text-[11px] text-slate-500">
                        {facultyRoster.length} Faculty Members Included
                      </span>
                    )}
                  </div>

                  {facultyRoster && facultyRoster.length > 0 ? (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                      {facultyRoster.map((fac: any) => (
                        <div key={fac.faculty_id} className="p-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <span className="font-bold text-slate-900 dark:text-slate-100 block">
                                {fac.name}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {fac.department ? `${fac.department} • ` : ""}{fac.email || "Faculty"}
                              </span>
                            </div>
                            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                              {fac.total_submitted_requirements ?? (fac.requirements?.length || 0)} requirement{(fac.requirements?.length || 0) === 1 ? "" : "s"}
                            </span>
                          </div>

                          {fac.requirements && fac.requirements.length > 0 ? (
                            <div className="mt-2 pl-2 border-l-2 border-slate-200 dark:border-slate-800 space-y-1.5">
                              {fac.requirements.map((req: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between gap-2 text-[11px]">
                                  <div className="flex items-center gap-1.5 truncate">
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                      {req.file?.file_type || "FILE"}
                                    </span>
                                    <span className="text-slate-800 dark:text-slate-200 font-medium truncate">
                                      {req.requirement_title || req.requirement_code}
                                    </span>
                                    {req.file?.file_name && (
                                      <span className="text-[10px] text-slate-400 truncate max-w-[150px]">
                                        ({req.file.file_name})
                                      </span>
                                    )}
                                  </div>
                                  <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                                    {req.status || "Submitted"}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-1 text-[11px] text-slate-400 italic">
                              No submissions recorded for this semester.
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-center text-slate-500">
                      <p className="font-medium">Snapshot contains institutional compliance records.</p>
                      <p className="text-[11px] mt-1">Download the document vault (.ZIP) below to view all files.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
                <button
                  type="button"
                  onClick={() => setInspectedBackup(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] transition cursor-pointer shadow-xs"
                >
                  Close
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={Boolean(exportingTermKey)}
                    onClick={() => {
                      const ay = inspectedBackup.academic_year || inspectedBackup.metadata?.academic_year || undefined;
                      const sem = inspectedBackup.metadata?.semester || undefined;
                      void handleDownloadZip(ay, sem);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-600 transition cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                  >
                    <AppIcon icon={Archive} size="sm" color="inherit" />
                    <span>Download Documents (.ZIP)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Term Vault Inspection Modal */}
      {inspectedTerm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl text-slate-900 dark:text-slate-100 overflow-hidden flex flex-col">
            <ModalHeader title="Archived Term Details" icon={Archive} />
            <div className="p-6 space-y-3 text-xs">
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200/80 dark:bg-slate-900/50 dark:border-slate-800 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">School Year:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {inspectedTerm.academic_year}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Semester:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {inspectedTerm.semester}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">File Status:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    Safely Stored
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Date Archived:</span>
                  <span className="text-slate-700 dark:text-slate-300">
                    {formatDateTime(inspectedTerm.archived_at)}
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                All submitted files and records from this term are safely stored and can be downloaded anytime.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                disabled={Boolean(exportingTermKey)}
                onClick={() =>
                  void handleDownloadZip(
                    inspectedTerm.academic_year,
                    inspectedTerm.semester,
                    "all"
                  )
                }
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-600 transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50 shadow-xs"
              >
                {exportingTermKey === `${inspectedTerm.academic_year}__${inspectedTerm.semester}__all` ? (
                  <>
                    <Refresh className="w-3.5 h-3.5 animate-spin" />
                    <span>{exportProgress || "Zipping..."}</span>
                  </>
                ) : (
                  <>
                    <AppIcon icon={Archive} size="sm" color="inherit" />
                    <span>Download Files (.ZIP)</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setInspectedTerm(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] transition cursor-pointer shadow-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Backup Confirmation Modal */}
      {backupToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl text-slate-900 dark:text-slate-100">
            {/* Modal Header */}
            <ModalHeader
              icon={Trash}
              title="Delete Backup"
              subtitle="Remove this backup from the list"
              className="-mx-6 -mt-6 mb-4 rounded-t-2xl"
            />

            {/* Description & Warnings */}
            <div className="space-y-3">
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                Are you sure you want to permanently delete{" "}
                <strong className="text-slate-900 dark:text-slate-100">
                  &ldquo;{backupToDelete.backup_name}&rdquo;
                </strong>
                ?
              </p>

              <div className="rounded-xl border border-amber-600 bg-amber-500 p-3 text-xs text-slate-950 space-y-1 shadow-xs">
                <p className="font-bold">Safety Notice:</p>
                <p className="font-medium">
                  Deleting this removes the backup from your list permanently. If you still need a copy, download the file first before deleting.
                </p>
              </div>

              {deleteCountdown > 0 ? (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  Safety lock active. The confirmation button will be available in{" "}
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {deleteCountdown} seconds
                  </span>
                  .
                </p>
              ) : null}
            </div>

            {/* Footer Actions */}
            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setBackupToDelete(null)}
                className="px-4 py-2 rounded-xl bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] text-xs font-semibold transition cursor-pointer shadow-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting || deleteCountdown > 0}
                onClick={() => void handleDeleteBackup()}
                className="bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] text-xs font-semibold px-4 py-2 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-xs"
              >
                {isDeleting
                  ? "Deleting..."
                  : deleteCountdown > 0
                  ? `Confirm Delete (${deleteCountdown}s)`
                  : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
