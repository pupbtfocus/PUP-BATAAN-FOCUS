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
  Plus,
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

  const loadBackupData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch("/api/admin/backups");
      if (!res.ok) {
        throw new Error("Failed to load backups and archive records");
      }
      const data = await res.json();
      setBackups(data.backups || []);
      setArchivedTerms(data.archivedTerms || []);
      setAvailableTerms(data.availableTerms || []);
      if (data.academicYears && Array.isArray(data.academicYears)) {
        setAcademicYears(data.academicYears);
      }
      if (data.facultyList && Array.isArray(data.facultyList)) {
        setFacultyList(data.facultyList);
      }
      if (data.stats) {
        setStats(data.stats);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading backup data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadBackupData();
  }, []);

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

  const resetFilters = () => {
    setSelectedAcademicYear("all");
    setSelectedSemester("all");
    setSelectedFacultyId("all");
    setFacultySearchQuery("");
    setIsFacultyDropdownOpen(false);
  };

  const handleGenerateBackup = async () => {
    try {
      setIsGeneratingBackup(true);
      setError(null);

      const payload = {
        academic_year: selectedAcademicYear !== "all" ? selectedAcademicYear : undefined,
        semester: selectedSemester !== "all" ? selectedSemester : undefined,
        faculty_id: selectedFacultyId !== "all" ? selectedFacultyId : undefined,
        faculty_name: selectedFacultyObj ? selectedFacultyObj.name : undefined,
      };

      const res = await fetch("/api/admin/backups/create", {
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

      // Push the newly created backup directly to state immediately
      if (data.backup) {
        setBackups((prev) => [data.backup, ...prev.filter((b) => b.id !== data.backup.id)]);
        setStats((prev) => ({
          ...prev,
          total_backups: prev.total_backups + 1,
          last_backup_date: data.backup.created_at,
        }));
      }

      const scopeDesc = [
        selectedAcademicYear !== "all" ? selectedAcademicYear : "All A.Y.",
        selectedSemester !== "all" ? selectedSemester : "All Sem",
        selectedFacultyObj ? selectedFacultyObj.name : "All Faculty",
      ].join(" • ");

      setSuccess(`Backup snapshot (${scopeDesc}) generated successfully!`);
      setTimeout(() => setSuccess(null), 5000);

      // Trigger automatic browser download of snapshot
      if (data.snapshot) {
        const jsonStr = JSON.stringify(data.snapshot, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${data.backup?.backup_name || "PUP_FOCUS_Snapshot"}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      // Sync updated list
      await loadBackupData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save backup history to database. Please ensure SQL migration 0021 was executed."
      );
    } finally {
      setIsGeneratingBackup(false);
    }
  };

  const handleDownloadZip = async (
    targetAY?: string,
    targetSem?: string,
    targetFaculty?: string
  ) => {
    const ay = targetAY !== undefined ? targetAY : selectedAcademicYear;
    const sem = targetSem !== undefined ? targetSem : selectedSemester;
    const fac = targetFaculty !== undefined ? targetFaculty : selectedFacultyId;

    const key = `${ay || "all"}__${sem || "all"}__${fac || "all"}`;
    try {
      setExportingTermKey(key);
      setExportProgress("Preparing files... 20%");
      setError(null);

      const params = new URLSearchParams();
      if (ay && ay !== "all") params.set("academic_year", ay);
      if (sem && sem !== "all") params.set("semester", sem);
      if (fac && fac !== "all") params.set("faculty_id", fac);

      const timer1 = setTimeout(() => {
        setExportProgress("Zipping documents... 60%");
      }, 600);

      const timer2 = setTimeout(() => {
        setExportProgress("Finalizing ZIP archive... 90%");
      }, 1400);

      const res = await fetch(`/api/admin/backups/export-zip?${params.toString()}`);
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
      const facultyObj = facultyList.find((f) => f.id === fac);
      const safeFac = facultyObj
        ? `${facultyObj.name.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 20)}_`
        : "";

      a.download = `PUP_FOCUS_Document_Vault_${safeFac}${safeAY}_${safeSem}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const scopeDesc = [
        ay && ay !== "all" ? ay : "All A.Y.",
        sem && sem !== "all" ? sem : "All Sem",
        facultyObj ? facultyObj.name : "All Faculty",
      ].join(" • ");

      setSuccess(`Document Vault ZIP (${scopeDesc}) downloaded successfully!`);
      setTimeout(() => setSuccess(null), 5000);

      // Refresh list so the newly created system_backups record appears
      await loadBackupData();
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

      const res = await fetch(`/api/admin/backups/export-zip?${params.toString()}`);
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

      a.download = `PUP_FOCUS_Document_Vault_${safeFac}${safeAY}_${safeSem}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSuccess(`Document Vault ZIP downloaded successfully!`);
      setTimeout(() => setSuccess(null), 4000);

      // Refresh list so the newly created system_backups record appears
      await loadBackupData();
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
      const res = await fetch(`/api/admin/backups?id=${backupToDelete.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete backup log");
      }

      setSuccess(`Backup record "${backupToDelete.backup_name}" deleted.`);
      setTimeout(() => setSuccess(null), 4000);
      setBackupToDelete(null);
      await loadBackupData();
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
        <div className="rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Backups Generated
            </span>
            <HardDrive className="h-5 w-5 text-slate-400" strokeWidth={2} />
          </div>
          <div className="mt-2">
            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              {stats.total_backups}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Recovery snapshots in repository
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Archived Academic Years
            </span>
            <span className="w-2 h-2 rounded-full bg-[#0b5336]" />
          </div>
          <div className="mt-2">
            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              {stats.archived_academic_years}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Preserved in historical vault
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Last Backup Date
            </span>
            <Hourglass className="h-5 w-5 text-slate-400" strokeWidth={2} />
          </div>
          <div className="mt-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight truncate">
              {formatDateTime(stats.last_backup_date)}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Latest institutional snapshot
            </p>
          </div>
        </div>
      </section>

      {/* Notifications */}
      <AlertPopup type="error" message={error} onClose={() => setError(null)} />
      <AlertPopup type="success" message={success} onClose={() => setSuccess(null)} />

      {/* SECTION 1: Scope Selector & Backup Generator Bar */}
      <section className="rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs transition-colors space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <AppIcon icon={Database} size="md" color="default" />
              <span>Institutional Backup & Document Vault</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Generate full snapshots (.JSON) or download document vaults (.ZIP) filtered by academic year, semester, or faculty member.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadBackupData()}
            className="self-start sm:self-auto p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer"
            title="Refresh backups and terms"
          >
            <Refresh className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* 3 Scope Filters: Academic Year, Semester, Faculty with Search */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Academic Year Filter */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <AppIcon icon={Calendar} size="xs" color="default" />
              <span>Academic Year</span>
            </label>
            <select
              value={selectedAcademicYear}
              onChange={(e) => setSelectedAcademicYear(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl px-3 py-2 text-xs outline-none focus:border-slate-400 transition cursor-pointer font-medium"
            >
              <option value="all">All Academic Years</option>
              {academicYears.map((ay) => (
                <option key={ay} value={ay}>
                  A.Y. {ay}
                </option>
              ))}
            </select>
          </div>

          {/* Semester Filter */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <AppIcon icon={MultiplePages} size="xs" color="default" />
              <span>Semester</span>
            </label>
            <select
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl px-3 py-2 text-xs outline-none focus:border-slate-400 transition cursor-pointer font-medium"
            >
              <option value="all">All Semesters</option>
              <option value="1st Semester">1st Semester</option>
              <option value="2nd Semester">2nd Semester</option>
            </select>
          </div>

          {/* Faculty Member Filter with Search Bar */}
          <div className="space-y-1.5 relative" ref={facultyDropdownRef}>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <AppIcon icon={User} size="xs" color="default" />
              <span>Faculty Member</span>
            </label>

            {/* Custom Searchable Trigger Button */}
            <div
              onClick={() => setIsFacultyDropdownOpen((prev) => !prev)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-900 dark:text-slate-100 rounded-xl px-3 py-2 text-xs transition cursor-pointer flex items-center justify-between gap-2 select-none"
            >
              <div className="flex items-center gap-2 truncate min-w-0">
                <AppIcon icon={User} size="xs" color="default" />
                <span className="truncate font-medium">
                  {selectedFacultyObj
                    ? `${selectedFacultyObj.name} ${
                        selectedFacultyObj.department ? `(${selectedFacultyObj.department})` : ""
                      }`
                    : "All Faculty Members"}
                </span>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {selectedFacultyId !== "all" && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFacultyId("all");
                      setFacultySearchQuery("");
                    }}
                    className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
                    title="Clear faculty filter"
                  >
                    <AppIcon icon={Xmark} size="xs" color="default" />
                  </button>
                )}
                <NavArrowDown
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                    isFacultyDropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </div>
            </div>

            {/* Searchable Dropdown Popover */}
            {isFacultyDropdownOpen && (
              <div className="absolute top-full left-0 right-0 z-40 mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-2.5 space-y-2">
                {/* Search Bar Input */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={facultySearchQuery}
                    onChange={(e) => setFacultySearchQuery(e.target.value)}
                    placeholder="Search faculty by name, email, or dept..."
                    autoFocus
                    className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-slate-400 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                  />
                  {facultySearchQuery && (
                    <button
                      type="button"
                      onClick={() => setFacultySearchQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    >
                      <AppIcon icon={Xmark} size="xs" color="default" />
                    </button>
                  )}
                </div>

                {/* Options List */}
                <div className="max-h-52 overflow-y-auto space-y-0.5 divide-y divide-slate-100 dark:divide-slate-800/60">
                  {/* "All Faculty Members" option */}
                  <div
                    onClick={() => {
                      setSelectedFacultyId("all");
                      setIsFacultyDropdownOpen(false);
                      setFacultySearchQuery("");
                    }}
                    className={`p-2 rounded-lg text-xs cursor-pointer flex items-center justify-between transition ${
                      selectedFacultyId === "all"
                        ? "bg-slate-100 dark:bg-slate-800 font-bold text-slate-900 dark:text-slate-100"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <span>All Faculty Members</span>
                    {selectedFacultyId === "all" && (
                      <AppIcon icon={Check} size="xs" color="default" />
                    )}
                  </div>

                  {/* Filtered Faculty Members */}
                  {filteredFacultyList.length === 0 ? (
                    <div className="py-3 text-center text-xs text-slate-400">
                      No faculty found matching "{facultySearchQuery}"
                    </div>
                  ) : (
                    filteredFacultyList.map((fac) => {
                      const isSelected = selectedFacultyId === fac.id;
                      return (
                        <div
                          key={fac.id}
                          onClick={() => {
                            setSelectedFacultyId(fac.id);
                            setIsFacultyDropdownOpen(false);
                            setFacultySearchQuery("");
                          }}
                          className={`p-2 rounded-lg text-xs cursor-pointer flex items-center justify-between transition ${
                            isSelected
                              ? "bg-slate-100 dark:bg-slate-800 font-bold text-slate-900 dark:text-slate-100"
                              : "hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          <div className="truncate pr-2">
                            <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                              {fac.name}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              {fac.department ? fac.department : fac.email || "Faculty Account"}
                            </div>
                          </div>
                          {isSelected && (
                            <AppIcon icon={Check} size="xs" color="default" />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Active Scope Summary & Action Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          {/* Scope Indicator Pill */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-xs font-medium text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span className="font-semibold text-amber-900 dark:text-amber-200">Active Scope:</span>
              <span>
                {selectedAcademicYear === "all" ? "All A.Y." : selectedAcademicYear}
              </span>
              <span>•</span>
              <span>
                {selectedSemester === "all" ? "All Semesters" : selectedSemester}
              </span>
              <span>•</span>
              <span className="truncate max-w-[200px]">
                {selectedFacultyObj ? selectedFacultyObj.name : "All Faculty"}
              </span>
            </div>

            {isScopeFiltered && (
              <button
                type="button"
                onClick={resetFilters}
                className="text-xs text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200 underline cursor-pointer transition"
              >
                Reset to Full System
              </button>
            )}
          </div>

          {/* Action Trigger Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Download Vault ZIP */}
            <button
              type="button"
              disabled={Boolean(exportingTermKey) || isGeneratingBackup}
              onClick={() => void handleDownloadZip()}
              className="flex items-center gap-1.5 bg-white hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold rounded-xl text-xs sm:text-sm px-3.5 py-2 transition border border-slate-300 dark:border-slate-700 cursor-pointer disabled:opacity-50 shadow-2xs"
            >
              {exportingTermKey === `${selectedAcademicYear}__${selectedSemester}__${selectedFacultyId}` ? (
                <>
                  <Refresh className="w-3.5 h-3.5 animate-spin text-amber-500" />
                  <span>{exportProgress || "Zipping documents..."}</span>
                </>
              ) : (
                <>
                  <AppIcon icon={Archive} size="md" color="default" />
                  <span>Download Document Vault (.ZIP)</span>
                </>
              )}
            </button>

            {/* Generate Snapshot JSON */}
            <button
              type="button"
              disabled={isGeneratingBackup || Boolean(exportingTermKey)}
              onClick={() => void handleGenerateBackup()}
              className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-600 font-bold rounded-xl text-xs sm:text-sm px-4 py-2 transition shadow-xs cursor-pointer disabled:opacity-50"
            >
              {isGeneratingBackup ? (
                <>
                  <Refresh className="w-3.5 h-3.5 animate-spin" />
                  <span>Generating Snapshot...</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Generate Snapshot (.JSON)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* SECTION 2: System Backup History Manager */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              System Recovery Snapshots
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Historical database snapshots archived and available for recovery inspection.
            </p>
          </div>
          <span className="text-xs text-slate-500">
            {backups.length} snapshot{backups.length === 1 ? "" : "s"} recorded
          </span>
        </div>

        {/* Backups Table */}
        <div className="w-full overflow-x-auto rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm shadow-slate-300/50 dark:shadow-none overflow-hidden transition-colors">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="border-b border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 text-[11px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Backup Name</th>
                  <th className="py-3.5 px-4">Scope</th>
                  <th className="py-3.5 px-4">Date &amp; Time</th>
                  <th className="py-3.5 px-4">File Size</th>
                  <th className="py-3.5 px-4">Total Records</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300 dark:divide-slate-800/60">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      <Refresh className="h-5 w-5 animate-spin mx-auto mb-2 text-amber-500" strokeWidth={2} />
                      Loading backup records...
                    </td>
                  </tr>
                ) : backups.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      <AppIcon icon={HardDrive} size="xl" color="muted" className="mx-auto mb-2" />
                      <p className="font-semibold text-slate-700 dark:text-slate-300">
                        No backup records found
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Use the control bar above to generate your first recovery snapshot.
                      </p>
                    </td>
                  </tr>
                ) : (
                  backups.map((bk) => {
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
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-slate-100">
                          <div className="flex items-center gap-2.5">
                            <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shrink-0">
                              <AppIcon icon={Database} size="sm" color="default" />
                            </div>
                            <span className="font-mono text-xs truncate max-w-[240px]">
                              {bk.backup_name}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          {hasScope ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-medium text-[11px]">
                              {scopeAy ? scopeAy : "All A.Y."}
                              {scopeSem ? ` • ${scopeSem}` : ""}
                              {scopeFac ? ` • ${scopeFac}` : ""}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 text-[11px]">
                              Full System
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {formatDateTime(bk.created_at)}
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {formatFileSize(bk.file_size_kb)}
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[11px]">
                            {bk.total_records.toLocaleString()} rows
                          </span>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
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
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-2 justify-end">
                            <button
                              type="button"
                              onClick={() => setInspectedBackup(bk)}
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition cursor-pointer flex items-center gap-1"
                              title="Inspect details"
                            >
                              <AppIcon icon={Eye} size="xs" color="default" />
                              <span>Inspect</span>
                            </button>

                            <a
                              href={`/api/admin/backups/download?id=${bk.id}`}
                              download
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-600 transition cursor-pointer flex items-center gap-1 shadow-xs"
                              title="Download JSON Snapshot"
                            >
                              <AppIcon icon={Download} size="xs" color="inherit" />
                              <span>JSON</span>
                            </a>

                            <button
                              type="button"
                              disabled={Boolean(rowExportingKey) || isGeneratingBackup}
                              onClick={() =>
                                void handleRowDownloadZip(
                                  scopeAy ?? "all",
                                  scopeSem ?? "all",
                                  bk.metadata?.scope?.faculty_id ?? "all"
                                )
                              }
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition cursor-pointer flex items-center gap-1 shadow-2xs disabled:opacity-50"
                              title="Download Document Vault (.ZIP)"
                            >
                              {rowExportingKey === `${scopeAy ?? "all"}__${scopeSem ?? "all"}__${bk.metadata?.scope?.faculty_id ?? "all"}` ? (
                                <>
                                  <Refresh className="w-3 h-3 animate-spin text-amber-500" />
                                  <span>{rowExportProgress || "Zipping..."}</span>
                                </>
                              ) : (
                                <>
                                  <AppIcon icon={Archive} size="xs" color="default" />
                                  <span>ZIP</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => setBackupToDelete(bk)}
                              className="p-1 text-red-500 hover:bg-red-500/10 border border-transparent hover:border-red-200 dark:hover:border-red-900/60 rounded-lg transition cursor-pointer"
                              title="Delete backup log"
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
            <span>Institutional Compliance Archive Vault</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Historical academic cycles archived and retained in permanent institutional storage.
          </p>
        </div>

        {/* Archived Terms Table */}
        <div className="w-full overflow-x-auto rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm shadow-slate-300/50 dark:shadow-none overflow-hidden transition-colors">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="border-b border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 text-[11px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Academic Year &amp; Semester</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Preserved Documents</th>
                  <th className="py-3.5 px-4">Archive Date</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300 dark:divide-slate-800/60">
                {archivedTerms.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-500">
                      <AppIcon icon={Archive} size="md" color="muted" className="mx-auto mb-2" />
                      <p className="font-semibold text-slate-700 dark:text-slate-300">
                        No archived academic terms
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Completed terms archived in Academic Year and Semester will appear here.
                      </p>
                    </td>
                  </tr>
                ) : (
                  archivedTerms.map((term) => (
                    <tr
                      key={`${term.academic_year}-${term.semester}`}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-slate-100">
                        <div className="flex items-center gap-2.5">
                          <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shrink-0">
                            <AppIcon icon={Calendar} size="sm" color="default" />
                          </div>
                          <div>
                            <span className="font-bold text-xs">{term.academic_year}</span>
                            <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                              {term.semester}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1.5 bg-[#0b5336] text-white border border-[#08412a] px-2 py-0.5 text-xs font-semibold rounded-md shadow-2xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
                          Archived
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-700 dark:text-slate-300">
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 font-medium">
                          <AppIcon icon={Check} size="sm" color="default" />
                          <span>Protected & Retained</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                        {formatDateTime(term.archived_at)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <button
                            type="button"
                            onClick={() => setInspectedTerm(term)}
                            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition cursor-pointer inline-flex items-center gap-1"
                          >
                            <AppIcon icon={Eye} size="xs" color="default" />
                            <span>Details</span>
                          </button>

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
                            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-600 transition cursor-pointer inline-flex items-center gap-1 shadow-xs disabled:opacity-50"
                            title="Download Document Vault (.ZIP)"
                          >
                            {exportingTermKey === `${term.academic_year}__${term.semester}__all` ? (
                              <>
                                <Refresh className="w-3 h-3 animate-spin" />
                                <span>{exportProgress || "Zipping..."}</span>
                              </>
                            ) : (
                              <>
                                <AppIcon icon={Archive} size="xs" color="inherit" />
                                <span>Vault (.ZIP)</span>
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Backup Inspection Modal */}
      {inspectedBackup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl text-slate-900 dark:text-slate-100 max-h-[85vh] overflow-hidden flex flex-col">
            <ModalHeader title={inspectedBackup.backup_name} icon={Database} />
            <div className="p-6 overflow-y-auto flex-1 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-4 rounded-lg bg-slate-50 border border-slate-200/80 dark:bg-slate-900/50 dark:border-slate-800">
                <div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                    Created Date
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {formatDateTime(inspectedBackup.created_at)}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                    File Size
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {formatFileSize(inspectedBackup.file_size_kb)}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                    Total Records
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {inspectedBackup.total_records.toLocaleString()} items
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                    Status
                  </span>
                  <span className="font-semibold capitalize text-slate-800 dark:text-slate-200">
                    {inspectedBackup.status}
                  </span>
                </div>
              </div>

              {/* Scope Breakdown */}
              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-1.5">
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block">
                  Snapshot Scope Filter
                </span>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Academic Year</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {inspectedBackup.metadata?.scope?.academic_year ||
                        inspectedBackup.academic_year ||
                        "All Academic Years"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Semester</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {inspectedBackup.metadata?.scope?.semester ||
                        inspectedBackup.metadata?.semester ||
                        "All Semesters"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Faculty</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">
                      {inspectedBackup.metadata?.scope?.faculty_name ||
                        inspectedBackup.metadata?.faculty_name ||
                        "All Faculty Members"}
                    </span>
                  </div>
                </div>
              </div>

              {inspectedBackup.metadata && (
                <div className="space-y-1.5 pt-1">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Snapshot Data Breakdown
                  </h4>
                  <ul className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden text-xs">
                    <li className="p-2.5 flex justify-between bg-slate-50/50 dark:bg-slate-950/40">
                      <span className="text-slate-600 dark:text-slate-400">Faculty Profiles & Accounts:</span>
                      <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                        {inspectedBackup.metadata.users_count ?? 0}
                      </span>
                    </li>
                    <li className="p-2.5 flex justify-between bg-slate-50/50 dark:bg-slate-950/40">
                      <span className="text-slate-600 dark:text-slate-400">Academic Terms:</span>
                      <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                        {inspectedBackup.metadata.terms_count ?? 0}
                      </span>
                    </li>
                    <li className="p-2.5 flex justify-between bg-slate-50/50 dark:bg-slate-950/40">
                      <span className="text-slate-600 dark:text-slate-400">Faculty Submissions:</span>
                      <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                        {inspectedBackup.metadata.submissions_count ?? 0}
                      </span>
                    </li>
                    <li className="p-2.5 flex justify-between bg-slate-50/50 dark:bg-slate-950/40">
                      <span className="text-slate-600 dark:text-slate-400">Requirement Templates:</span>
                      <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                        {inspectedBackup.metadata.templates_count ?? 0}
                      </span>
                    </li>
                    <li className="p-2.5 flex justify-between bg-slate-50/50 dark:bg-slate-950/40">
                      <span className="text-slate-600 dark:text-slate-400">System Audit Logs:</span>
                      <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                        {inspectedBackup.metadata.audit_logs_count ?? 0}
                      </span>
                    </li>
                  </ul>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-200 dark:border-slate-800">
              <a
                href={`/api/admin/backups/download?id=${inspectedBackup.id}`}
                download
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-600 transition cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <AppIcon icon={Download} size="sm" color="inherit" />
                <span>Download JSON</span>
              </a>
              <button
                type="button"
                onClick={() => setInspectedBackup(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] transition cursor-pointer shadow-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Term Vault Inspection Modal */}
      {inspectedTerm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl text-slate-900 dark:text-slate-100 overflow-hidden flex flex-col">
            <ModalHeader title="Archive Vault Inspection" icon={Archive} />
            <div className="p-6 space-y-3 text-xs">
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200/80 dark:bg-slate-900/50 dark:border-slate-800 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Academic Year:</span>
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
                  <span className="text-slate-500 dark:text-slate-400">Vault Status:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    Archived & Retained
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Archive Date:</span>
                  <span className="text-slate-700 dark:text-slate-300">
                    {formatDateTime(inspectedTerm.archived_at)}
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                All submitted grade sheets, syllabi, midterm/final exam packages, and verification records for this cycle remain secured in cloud storage and available in historical compliance reports.
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
                    <span>Download Vault (.ZIP)</span>
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
          <div className="w-full max-w-md rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl text-slate-900 dark:text-slate-100">
            {/* Modal Header */}
            <ModalHeader
              icon={Trash}
              title="Delete Backup Record"
              subtitle="Confirm Permanent Backup Deletion"
              className="-mx-6 -mt-6 mb-4 rounded-t-2xl"
            />

            {/* Description & Warnings */}
            <div className="space-y-3">
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                Are you sure you want to permanently delete backup log{" "}
                <strong className="text-slate-900 dark:text-slate-100">
                  "{backupToDelete.backup_name}"
                </strong>
                ?
              </p>

              <div className="rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-950/20 p-3 text-xs text-amber-800 dark:text-amber-400 space-y-1">
                <p className="font-semibold">Safety Notice:</p>
                <p>
                  Deleting this record will permanently remove the backup log entry. The action cannot be undone. If you need this snapshot, download the JSON file first before deleting.
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
                className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 text-xs font-semibold transition cursor-pointer shadow-xs"
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
