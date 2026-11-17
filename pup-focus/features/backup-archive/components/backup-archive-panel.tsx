"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import {
  Archive,
  Calendar,
  Check,
  CheckCircle,
  Database,
  Download,
  Eye,
  EyeClosed,
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
import { emitRealtimeSync, useRealtimeSync } from "@/lib/realtime";
import {
  pauseSessionVerification,
  recordActiveSessionLogin,
  resumeSessionVerification,
} from "@/components/auth/single-session-enforcer";
import type {
  SystemBackup,
  ArchivedTermSummary,
  AvailableAcademicTerm,
  BackupStats,
  FacultyOption,
} from "@/features/backup-archive/types/backup-archive.types";

let cachedBackupData: {
  backups: SystemBackup[];
  archivedTerms: ArchivedTermSummary[];
  availableTerms: AvailableAcademicTerm[];
  academicYears: string[];
  facultyList: FacultyOption[];
  stats: BackupStats;
} | null = null;

export interface BackupArchivePanelProps {
  onNavigateToTerms?: () => void;
}

export function BackupArchivePanel({
  onNavigateToTerms,
}: BackupArchivePanelProps = {}) {
  const [backups, setBackups] = useState<SystemBackup[]>(() => {
    if (cachedBackupData) return cachedBackupData.backups;
    if (typeof window !== "undefined") {
      try {
        const stored = sessionStorage.getItem("pup_focus_backup_data");
        if (stored) {
          const parsed = JSON.parse(stored);
          cachedBackupData = parsed;
          return parsed.backups || [];
        }
      } catch {}
    }
    return [];
  });
  const [archivedTerms, setArchivedTerms] = useState<ArchivedTermSummary[]>(
    () => cachedBackupData?.archivedTerms || [],
  );
  const [availableTerms, setAvailableTerms] = useState<AvailableAcademicTerm[]>(
    () => cachedBackupData?.availableTerms || [],
  );
  const [academicYears, setAcademicYears] = useState<string[]>(
    () => cachedBackupData?.academicYears || [],
  );
  const [facultyList, setFacultyList] = useState<FacultyOption[]>(
    () => cachedBackupData?.facultyList || [],
  );
  const [stats, setStats] = useState<BackupStats>(
    () =>
      cachedBackupData?.stats || {
        total_backups: 0,
        archived_academic_years: 0,
        last_backup_date: null,
        total_archived_documents: 0,
      },
  );

  const [isLoading, setIsLoading] = useState(() => !cachedBackupData);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const hasLoadedRef = useRef(Boolean(cachedBackupData));
  const [isGeneratingBackup, setIsGeneratingBackup] = useState(false);
  const [exportingTermKey, setExportingTermKey] = useState<string | null>(null);
  const [exportProgress, setExportProgress] = useState<string | null>(null);

  // Separate state for row-level ZIP downloads (independent from filter bar)
  const [rowExportingKey, setRowExportingKey] = useState<string | null>(null);
  const [rowExportProgress, setRowExportProgress] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Scope filter states — default to active operational term when present
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>(
    () => {
      if (cachedBackupData?.availableTerms) {
        const cur = cachedBackupData.availableTerms.find(
          (t) => t.status === "Current",
        );
        if (cur) return cur.academic_year;
      }
      return "all";
    },
  );
  const [selectedSemester, setSelectedSemester] = useState<string>(() => {
    if (cachedBackupData?.availableTerms) {
      const cur = cachedBackupData.availableTerms.find(
        (t) => t.status === "Current",
      );
      if (cur) return cur.semester;
    }
    return "all";
  });
  const [selectedFacultyId, setSelectedFacultyId] = useState<string>("all");
  const [backupSearchQuery, setBackupSearchQuery] = useState("");
  const [archiveVaultFilter, setArchiveVaultFilter] = useState<
    "all" | "backed_up" | "past"
  >("all");

  // Searchable faculty dropdown state
  const [isFacultyDropdownOpen, setIsFacultyDropdownOpen] = useState(false);
  const [facultySearchQuery, setFacultySearchQuery] = useState("");
  const facultyDropdownRef = useRef<HTMLDivElement>(null);

  // Vault / Snapshot inspection modal
  const [inspectedBackup, setInspectedBackup] = useState<SystemBackup | null>(
    null,
  );
  const [inspectedTerm, setInspectedTerm] =
    useState<ArchivedTermSummary | AvailableAcademicTerm | null>(null);
  const [backupToDelete, setBackupToDelete] = useState<SystemBackup | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteCountdown, setDeleteCountdown] = useState<number>(10);

  // Semester cleanup modal state
  const [cleanTermTarget, setCleanTermTarget] = useState<{
    academic_year: string;
    semester: string;
  } | null>(null);
  const [cleanPreview, setCleanPreview] = useState<{
    submissionsCount: number;
    storageFilesCount: number;
    orphanedFilesCount?: number;
    totalSizeBytes: number;
    orphanedSizeBytes?: number;
    classesCount: number;
    transactionLogsCount?: number;
    notificationsCount?: number;
    extensionRequestsCount?: number;
    keepaliveLogsCount?: number;
    isBackedUp: boolean;
  } | null>(null);
  const [isLoadingCleanPreview, setIsLoadingCleanPreview] = useState(false);
  const [isCleaningTerm, setIsCleaningTerm] = useState(false);
  const [cleanCountdown, setCleanCountdown] = useState<number>(30);
  const [cleanConfirmText, setCleanConfirmText] = useState("");
  const [cleanAdminPassword, setCleanAdminPassword] = useState("");
  const [showCleanPassword, setShowCleanPassword] = useState(false);
  const [cleanModalError, setCleanModalError] = useState<string | null>(null);

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
        const current = data.availableTerms.find(
          (t: AvailableAcademicTerm) => t.status === "Current",
        );
        if (current) {
          setSelectedAcademicYear((prev) =>
            !prev || prev === "all" ? current.academic_year : prev,
          );
          setSelectedSemester((prev) =>
            !prev || prev === "all" ? current.semester : prev,
          );
        } else if (data.availableTerms.length === 0) {
          setSelectedAcademicYear("all");
          setSelectedSemester("all");
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
      cachedBackupData = {
        backups: data.backups || [],
        archivedTerms: data.archivedTerms || [],
        availableTerms: data.availableTerms || [],
        academicYears: data.academicYears || [],
        facultyList: data.facultyList || [],
        stats: data.stats || stats,
      };
      if (typeof window !== "undefined") {
        try {
          sessionStorage.setItem(
            "pup_focus_backup_data",
            JSON.stringify(cachedBackupData),
          );
        } catch {}
      }
      hasLoadedRef.current = true;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error loading backup data",
      );
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

  // 30-second countdown timer for semester cleanup confirmation
  useEffect(() => {
    if (!cleanTermTarget) {
      setCleanCountdown(30);
      return;
    }
    setCleanCountdown(30);
    const timer = setInterval(() => {
      setCleanCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cleanTermTarget]);

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
      const deptMatch = f.department
        ? f.department.toLowerCase().includes(q)
        : false;
      const emailMatch = f.email ? f.email.toLowerCase().includes(q) : false;
      return nameMatch || deptMatch || emailMatch;
    });
  }, [verifiedFacultyList, facultySearchQuery]);

  const currentActiveTerm = useMemo(() => {
    return availableTerms.find((t) => t.status === "Current") || null;
  }, [availableTerms]);

  // Always keep selectors defaulted to the current active term and semester
  useEffect(() => {
    if (currentActiveTerm) {
      if (!selectedAcademicYear || selectedAcademicYear === "all") {
        setSelectedAcademicYear(currentActiveTerm.academic_year);
      }
      if (!selectedSemester || selectedSemester === "all") {
        setSelectedSemester(currentActiveTerm.semester);
      }
    }
  }, [currentActiveTerm]);

  const isTermBackedUp = (ay: string, sem: string) => {
    const targetAy = (ay || "").trim().toLowerCase();
    const targetSem = (sem || "").trim().toLowerCase();

    return backups.some((b) => {
      if (b.status && b.status !== "completed") return false;
      const meta = b.metadata ?? {};
      const scope =
        typeof meta.scope === "object" && meta.scope !== null ? meta.scope : {};
      const bAy = (
        b.academic_year ||
        meta.academic_year ||
        scope.academic_year ||
        ""
      )
        .trim()
        .toLowerCase();
      const bSem = (meta.semester || scope.semester || "").trim().toLowerCase();
      if (bAy === targetAy && bSem && bSem !== "all" && bSem === targetSem)
        return true;
      const name = (b.backup_name || "").toLowerCase();
      const safeAy = targetAy.replace(/[^a-zA-Z0-9]/g, "_");
      const safeSem = targetSem.replace(/[^a-zA-Z0-9]/g, "_");
      return name.includes(safeAy) && name.includes(safeSem);
    });
  };

  const getTermFileAvailability = (
    ay?: string | null,
    sem?: string | null,
  ): { canDownload: boolean; isCleaned: boolean; canClean: boolean } => {
    const terms = availableTerms.length > 0 ? availableTerms : archivedTerms;
    if (terms.length === 0)
      return { canDownload: false, isCleaned: false, canClean: false };

    const normAy = (ay || "").trim().toLowerCase();
    const normSem = (sem || "").trim().toLowerCase();
    const matching = terms.filter((t) => {
      const ayOk =
        !normAy || normAy === "all" || t.academic_year.trim().toLowerCase() === normAy;
      const semOk =
        !normSem ||
        normSem === "all" ||
        t.semester.trim().toLowerCase().includes(normSem) ||
        normSem.includes(t.semester.trim().toLowerCase());
      return ayOk && semOk;
    });

    if (matching.length === 0)
      return { canDownload: false, isCleaned: false, canClean: false };
    const canDownload = matching.some((t) => t.has_downloadable_files === true);
    const isCleaned =
      !canDownload && matching.some((t) => t.is_files_cleaned === true);
    const canClean = matching.some((t) => t.has_cleanable_data === true);
    return { canDownload, isCleaned, canClean };
  };

  const selectedTermAvailability = useMemo(
    () => getTermFileAvailability(selectedAcademicYear, selectedSemester),
    [availableTerms, archivedTerms, selectedAcademicYear, selectedSemester],
  );

  const isCurrentTermBackedUp = useMemo(() => {
    if (!currentActiveTerm) return false;
    return isTermBackedUp(
      currentActiveTerm.academic_year,
      currentActiveTerm.semester,
    );
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
    const targetAy =
      selectedAcademicYear !== "all"
        ? selectedAcademicYear
        : currentActiveTerm?.academic_year || "";
    const targetSem =
      selectedSemester !== "all"
        ? selectedSemester
        : currentActiveTerm?.semester || "";
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
      const ayMatch = (bk.academic_year || bk.metadata?.academic_year || "")
        .toLowerCase()
        .includes(q);
      const semMatch = (bk.metadata?.semester || "").toLowerCase().includes(q);
      const facMatch = (bk.metadata?.faculty_name || "")
        .toLowerCase()
        .includes(q);
      return nameMatch || ayMatch || semMatch || facMatch;
    });
  }, [backups, backupSearchQuery]);

  // Section 3: Academic Terms & Semester Archive Vault terms
  // Shows archived/past semesters and semesters with verified backups. Ongoing active terms that cannot be archived yet are excluded.
  const allVaultCandidateTerms = useMemo(() => {
    const rawList = availableTerms.length > 0 ? availableTerms : archivedTerms;
    return rawList.filter((term) => {
      const isBackedUp = isTermBackedUp(term.academic_year, term.semester);
      const isPast = term.status === "Archived" || Boolean(term.is_archived);
      return isPast || isBackedUp;
    });
  }, [availableTerms, archivedTerms, backups]);

  const vaultBackedUpCount = useMemo(() => {
    const rawList = availableTerms.length > 0 ? availableTerms : archivedTerms;
    return rawList.filter((term) =>
      isTermBackedUp(term.academic_year, term.semester),
    ).length;
  }, [availableTerms, archivedTerms, backups]);

  const vaultPastCount = useMemo(() => {
    const rawList = availableTerms.length > 0 ? availableTerms : archivedTerms;
    return rawList.filter(
      (term) => term.status === "Archived" || Boolean(term.is_archived),
    ).length;
  }, [availableTerms, archivedTerms]);

  const displayedVaultTerms = useMemo(() => {
    return allVaultCandidateTerms;
  }, [allVaultCandidateTerms]);

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
        setBackups((prev) => [
          data.backup,
          ...prev.filter((b) => b.id !== data.backup.id),
        ]);
        setStats((prev) => ({
          ...prev,
          total_backups: prev.total_backups + 1,
          last_backup_date: data.backup.created_at,
        }));
      }

      setSuccess(
        `Verified document backup for S.Y. ${ay} (${sem}) completed and stored!`,
      );
      setTimeout(() => setSuccess(null), 6000);

      await handleDownloadZip(ay, sem);
      await loadBackupData({ silent: true });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create semester backup",
      );
    } finally {
      setIsGeneratingBackup(false);
    }
  };

  const handleGenerateBackup = async () => {
    try {
      setIsGeneratingBackup(true);
      setError(null);

      const targetAy =
        selectedAcademicYear !== "all"
          ? selectedAcademicYear
          : currentActiveTerm?.academic_year;
      const targetSem =
        selectedSemester !== "all"
          ? selectedSemester
          : currentActiveTerm?.semester;

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
            "Failed to save backup history to database. Please ensure SQL migration 0021 was executed.",
        );
      }

      if (data.backup) {
        setBackups((prev) => [
          data.backup,
          ...prev.filter((b) => b.id !== data.backup.id),
        ]);
        setStats((prev) => ({
          ...prev,
          total_backups: prev.total_backups + 1,
          last_backup_date: data.backup.created_at,
        }));
      }

      const scopeDesc = `S.Y. ${targetAy || "All"} · ${targetSem || "All Semesters"} (All Faculty)`;
      setSuccess(
        `Verified semester backup for ${scopeDesc} generated successfully!`,
      );
      setTimeout(() => setSuccess(null), 5000);

      // Trigger automatic browser download of document vault ZIP
      await handleDownloadZip(targetAy, targetSem);
      await loadBackupData({ silent: true });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to create semester backup snapshot.",
      );
    } finally {
      setIsGeneratingBackup(false);
    }
  };

  const handleDownloadZip = async (
    targetAY?: string,
    targetSem?: string,
    targetFac?: string,
    customZipName?: string,
  ) => {
    const ay =
      targetAY !== undefined
        ? targetAY
        : selectedAcademicYear !== "all"
          ? selectedAcademicYear
          : currentActiveTerm?.academic_year || "all";
    const sem =
      targetSem !== undefined
        ? targetSem
        : selectedSemester !== "all"
          ? selectedSemester
          : currentActiveTerm?.semester || "all";

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

      const res = await fetch(
        `/api/staff/backups/export-zip?${params.toString()}`,
      );
      clearTimeout(timer1);
      clearTimeout(timer2);

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(
          errJson.error || "Failed to generate document vault ZIP",
        );
      }

      setExportProgress("Finalizing ZIP archive... 100%");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      const safeAY =
        ay && ay !== "all" ? ay.replace(/[^a-zA-Z0-9]/g, "_") : "All_AY";
      const safeSem =
        sem && sem !== "all" ? sem.replace(/[^a-zA-Z0-9]/g, "_") : "All_Sem";

      const dateStr = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .slice(0, 19);
      a.download = customZipName || `Backup_${safeAY}_${safeSem}_${dateStr}.zip`;
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
      setError(
        err instanceof Error
          ? err.message
          : "Error exporting document vault ZIP",
      );
    } finally {
      setExportingTermKey(null);
      setExportProgress(null);
    }
  };

  // Separate ZIP handler for table row buttons — uses independent state
  const handleRowDownloadZip = async (
    ay: string,
    sem: string,
    fac: string,
    customZipName?: string,
  ) => {
    const key = `${ay}__${sem}__${fac}`;
    try {
      setRowExportingKey(key);
      setRowExportProgress("Preparing... 20%");
      setError(null);

      const params = new URLSearchParams();
      if (ay && ay !== "all") params.set("academic_year", ay);
      if (sem && sem !== "all") params.set("semester", sem);
      if (fac && fac !== "all") params.set("faculty_id", fac);

      const t1 = setTimeout(
        () => setRowExportProgress("Zipping documents... 60%"),
        600,
      );
      const t2 = setTimeout(
        () => setRowExportProgress("Finalizing... 90%"),
        1400,
      );

      const res = await fetch(
        `/api/staff/backups/export-zip?${params.toString()}`,
      );
      clearTimeout(t1);
      clearTimeout(t2);

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(
          errJson.error || "Failed to generate document vault ZIP",
        );
      }

      setRowExportProgress("Done! 100%");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      const safeAY =
        ay && ay !== "all" ? ay.replace(/[^a-zA-Z0-9]/g, "_") : "All_AY";
      const safeSem =
        sem && sem !== "all" ? sem.replace(/[^a-zA-Z0-9]/g, "_") : "All_Sem";
      const facultyObj = facultyList.find((f) => f.id === fac);
      const safeFac = facultyObj
        ? `${facultyObj.name.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 20)}_`
        : "";

      const dateStr = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .slice(0, 19);
      a.download = customZipName || `Backup_${safeAY}_${safeSem}_${dateStr}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSuccess(`Document Vault ZIP downloaded successfully!`);
      setTimeout(() => setSuccess(null), 4000);

      // Refresh list so the newly created system_backups record appears
      await loadBackupData({ silent: true });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Error exporting document vault ZIP",
      );
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

  const formatBytesReadable = (bytes: number) => {
    if (!bytes || bytes <= 0) return "0 MB";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const openCleanTermModal = async (ay: string, sem: string) => {
    if (!ay || ay === "all" || !sem || sem === "all") {
      setError("Select a specific Academic Year and Semester to clean.");
      return;
    }
    setCleanPreview(null);
    setCleanConfirmText("");
    setCleanAdminPassword("");
    setShowCleanPassword(false);
    setCleanModalError(null);
    setCleanTermTarget({ academic_year: ay, semester: sem });
    setIsLoadingCleanPreview(true);
    try {
      const params = new URLSearchParams({ academic_year: ay, semester: sem });
      const res = await fetch(
        `/api/staff/backups/clean-term?${params.toString()}`,
      );
      if (res.ok) {
        const data = await res.json();
        setCleanPreview(data);
      }
    } catch {
      // preview is optional
    } finally {
      setIsLoadingCleanPreview(false);
    }
  };

  const handleConfirmCleanTerm = async () => {
    if (!cleanTermTarget) return;
    if (cleanConfirmText.trim().toLowerCase() !== "delete") {
      setCleanModalError('Type "delete" to continue.');
      return;
    }
    if (!cleanAdminPassword) {
      setCleanModalError("Enter your admin password.");
      return;
    }
    let didRecordSessionLogin = false;
    try {
      setIsCleaningTerm(true);
      setCleanModalError(null);
      setError(null);
      pauseSessionVerification(30000);
      const res = await fetch("/api/staff/backups/clean-term", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          academic_year: cleanTermTarget.academic_year,
          semester: cleanTermTarget.semester,
          mode: "files_only",
          clean_logs_and_notifications: true,
          include_orphan_storage: true,
          confirm_text: cleanConfirmText.trim(),
          password: cleanAdminPassword,
        }),
      });
      const data = await res.json();
      if (data?.loginTime) {
        recordActiveSessionLogin(data.loginTime, data.userId);
        didRecordSessionLogin = true;
      }
      if (!res.ok) {
        throw new Error(data.error || "Failed to clean semester storage");
      }
      if (!didRecordSessionLogin) {
        recordActiveSessionLogin(new Date().toISOString(), data?.userId);
        didRecordSessionLogin = true;
      }
      setSuccess(
        data.message ||
          `Cleaned ${cleanTermTarget.academic_year} (${cleanTermTarget.semester}).`,
      );
      setTimeout(() => setSuccess(null), 6000);
      setCleanTermTarget(null);
      setCleanConfirmText("");
      setCleanAdminPassword("");
      setShowCleanPassword(false);
      emitRealtimeSync();
      await loadBackupData({ silent: true });
    } catch (err) {
      setCleanModalError(
        err instanceof Error ? err.message : "Failed to clean semester storage",
      );
    } finally {
      if (!didRecordSessionLogin) {
        resumeSessionVerification();
      }
      setIsCleaningTerm(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Top 3 Stat Cards */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
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

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs transition-colors md:col-span-2 xl:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Last Backup
            </span>
            <Hourglass className="h-5 w-5 text-slate-400" strokeWidth={2} />
          </div>
          <div className="mt-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight break-words">
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
      <AlertPopup
        type="success"
        message={success}
        onClose={() => setSuccess(null)}
      />

      {/* UNIFIED SEMESTER COMPLIANCE & BACKUP COMMAND CENTER */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm shadow-slate-200/50 dark:shadow-none p-4 sm:p-6 transition-all space-y-4 sm:space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5 sm:gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="space-y-1 min-w-0">
            <div className="flex items-start sm:items-center gap-3">
              <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60 shadow-2xs">
                <AppIcon icon={Archive} size="sm" color="default" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                  Semester Compliance Backup &amp; Document Vault
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Every backup comprehensively captures{" "}
                  <strong>all faculty members</strong>, their submitted
                  requirements, and verified file types for the selected
                  semester.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
            <button
              type="button"
              onClick={() => void handleRefresh()}
              disabled={isRefreshing}
              className="w-full md:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-white hover:bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 transition-all cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Refresh
                className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`}
              />
              <span>{isRefreshing ? "Syncing..." : "Refresh"}</span>
            </button>
          </div>
        </div>

        {/* Centered Operational Term Notice — Clean Inline Bold */}
        {currentActiveTerm && (
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-center justify-center gap-2 py-1 text-xs text-slate-800 dark:text-slate-200 text-center font-bold">
            <div className="flex items-start sm:items-center justify-center gap-2">
              <AppIcon
                icon={isCurrentTermBackedUp ? CheckCircle : WarningTriangle}
                size="sm"
                color={isCurrentTermBackedUp ? "success" : "warning"}
                className="shrink-0 mt-0.5 sm:mt-0"
              />
              <span className="leading-relaxed">
                Active Operational Term:{" "}
                <span className="text-slate-900 dark:text-white font-extrabold">
                  A.Y. {currentActiveTerm.academic_year} · {currentActiveTerm.semester}
                </span>
                {" — "}
                {isCurrentTermBackedUp ? (
                  <span className="text-[#0b5336] dark:text-emerald-400 font-extrabold">
                    Verified backup on file · Safe to change semester now
                  </span>
                ) : (
                  <span className="text-amber-700 dark:text-amber-400 font-extrabold">
                    Backup required before changing terms
                  </span>
                )}
              </span>
            </div>
            {isCurrentTermBackedUp && (
              <button
                type="button"
                onClick={() => {
                  if (onNavigateToTerms) {
                    onNavigateToTerms();
                  } else if (typeof window !== "undefined") {
                    window.location.assign("/admin/dashboard?section=terms");
                  }
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-1.5 sm:py-1 rounded-lg bg-[#0b5336] hover:bg-[#08412a] text-white border border-[#08412a] text-[11px] font-bold shadow-2xs transition cursor-pointer active:scale-[0.98]"
                title="Go to Academic Terms to switch to the next semester"
              >
                <AppIcon icon={Calendar} size="xs" color="white" />
                <span>Change Semester</span>
              </button>
            )}
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
              {Array.from(
                new Set([
                  ...(currentActiveTerm
                    ? [currentActiveTerm.academic_year]
                    : []),
                  ...academicYears,
                ]),
              ).map((ay) => (
                <option key={ay} value={ay}>
                  A.Y. {ay}{" "}
                  {currentActiveTerm?.academic_year === ay
                    ? "(Current Active)"
                    : ""}
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
              <option value="1st Semester">
                1st Semester{" "}
                {currentActiveTerm?.semester === "1st Semester"
                  ? "(Current)"
                  : ""}
              </option>
              <option value="2nd Semester">
                2nd Semester{" "}
                {currentActiveTerm?.semester === "2nd Semester"
                  ? "(Current)"
                  : ""}
              </option>
              <option value="Summer Semester">
                Summer Semester{" "}
                {currentActiveTerm?.semester === "Summer Semester"
                  ? "(Current)"
                  : ""}
              </option>
            </select>
          </div>

          {/* Primary Action Buttons: Documents Archive & Clean Semester */}
          <div className="md:col-span-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2">
            <button
              type="button"
              disabled={
                Boolean(exportingTermKey) ||
                isGeneratingBackup ||
                !selectedTermAvailability.canDownload
              }
              onClick={() => void handleDownloadZip()}
              className="flex-1 h-10 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-900 border border-amber-600 font-bold rounded-xl text-xs sm:text-sm px-4 transition shadow-xs cursor-pointer active:scale-[0.98] disabled:bg-slate-200 disabled:text-slate-400 disabled:border-slate-300 dark:disabled:bg-slate-800 dark:disabled:text-slate-500 dark:disabled:border-slate-700 disabled:shadow-none disabled:cursor-not-allowed disabled:hover:bg-slate-200 dark:disabled:hover:bg-slate-800 disabled:active:scale-100"
              title={
                selectedTermAvailability.canDownload
                  ? "Download all faculty submitted requirement documents as a verified ZIP vault"
                  : selectedTermAvailability.isCleaned
                    ? "Files for this semester were cleaned from Storage"
                    : "No uploaded files available for the selected scope"
              }
            >
              {exportingTermKey ===
              `${selectedAcademicYear}__${selectedSemester}__all` ? (
                <>
                  <Refresh className="w-4 h-4 animate-spin text-slate-900" />
                  <span>{exportProgress || "Packaging documents..."}</span>
                </>
              ) : (
                <>
                  <AppIcon icon={Archive} size="sm" color="inherit" />
                  <span>Generate &amp; Download Backup (.ZIP)</span>
                </>
              )}
            </button>

            <button
              type="button"
              disabled={
                selectedAcademicYear === "all" ||
                selectedSemester === "all" ||
                isCleaningTerm ||
                Boolean(exportingTermKey) ||
                !selectedTermAvailability.canClean
              }
              onClick={() =>
                void openCleanTermModal(selectedAcademicYear, selectedSemester)
              }
              className="h-10 flex items-center justify-center gap-2 bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] font-bold rounded-xl text-xs sm:text-sm px-4 transition shadow-xs cursor-pointer active:scale-[0.98] disabled:bg-slate-200 disabled:text-slate-400 disabled:border-slate-300 dark:disabled:bg-slate-800 dark:disabled:text-slate-500 dark:disabled:border-slate-700 disabled:shadow-none disabled:cursor-not-allowed disabled:hover:bg-slate-200 dark:disabled:hover:bg-slate-800 disabled:active:scale-100 shrink-0"
              title={
                selectedAcademicYear === "all" || selectedSemester === "all"
                  ? "Select a specific Academic Year & Semester first"
                  : !selectedTermAvailability.canClean
                    ? "All files and logs for this semester have already been deleted"
                    : "Optional: permanently delete uploaded files, notifications, transaction logs & extension requests for this semester if database/storage is getting full"
              }
            >
              <AppIcon icon={Trash} size="sm" color="inherit" />
              <span>Delete Semester Files &amp; Logs</span>
            </button>
          </div>
        </div>

        <p className="text-[11px] text-slate-500 dark:text-slate-400 text-left sm:text-right leading-relaxed">
          <strong className="text-slate-700 dark:text-slate-300">Note:</strong>{" "}
          Deleting semester files &amp; logs is{" "}
          <strong className="text-slate-700 dark:text-slate-300">optional</strong>{" "}
          (only use when storage or database space is getting full). After deleting a semester, it cannot be deleted again unless new files or logs are added.
        </p>
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
              Verified backups and downloadable document vaults with term
              association.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Search backups input */}
            <div className="relative flex-1 sm:w-72 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={backupSearchQuery}
                onChange={(e) => setBackupSearchQuery(e.target.value)}
                placeholder="Search backups by name, AY, sem..."
                className="w-full pl-8.5 pr-7 py-2 sm:py-1.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-amber-500 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 transition"
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

        {/* Backups Mobile Card View (< md) */}
        <div className="md:hidden space-y-2.5">
          {isLoading && filteredBackups.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-10 px-4 text-center text-xs text-slate-500 shadow-sm">
              <Refresh className="h-5 w-5 animate-spin mx-auto mb-2 text-amber-500" strokeWidth={2} />
              Loading backups...
            </div>
          ) : filteredBackups.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-10 px-4 text-center text-xs text-slate-500 shadow-sm">
              <AppIcon icon={HardDrive} size="xl" color="muted" className="mx-auto mb-2" />
              <p className="font-semibold text-slate-700 dark:text-slate-300">
                {backupSearchQuery ? "No matching backups found" : "No backups yet"}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {backupSearchQuery
                  ? "Try a different search keyword or clear filters."
                  : "Create a snapshot or download files above to save your first backup record."}
              </p>
            </div>
          ) : (
            filteredBackups.map((bk, idx) => {
              const scope = bk.metadata?.scope;
              const hasScope = Boolean(
                scope?.academic_year ||
                scope?.semester ||
                scope?.faculty_name ||
                bk.academic_year ||
                bk.metadata?.semester ||
                bk.metadata?.faculty_name,
              );
              const scopeAy = scope?.academic_year || bk.academic_year || null;
              const scopeSem = scope?.semester || bk.metadata?.semester || null;
              const scopeFac = scope?.faculty_name || bk.metadata?.faculty_name || null;
              const zipDisplay =
                bk.metadata?.zip_name ||
                (bk.backup_name?.endsWith(".zip") ? bk.backup_name : `${bk.backup_name}.zip`);

              return (
                <div
                  key={`mobile-bk-${bk.id}`}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 space-y-2.5 shadow-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded shrink-0">
                        #{idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100 break-all leading-snug">
                          {zipDisplay}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {formatDateTime(bk.created_at)}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {bk.status === "completed" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-md bg-[#0b5336] text-white border border-[#08412a] shadow-2xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-200" />
                          Completed
                        </span>
                      ) : bk.status === "failed" ? (
                        <span className="inline-flex items-center gap-1 bg-[#780000] text-white border border-[#5e0000] px-2 py-0.5 text-[11px] font-semibold rounded-md shadow-2xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-200" />
                          Failed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-amber-500 text-slate-950 border border-amber-600 px-2 py-0.5 text-[11px] font-semibold rounded-md shadow-2xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-900 animate-pulse" />
                          Processing
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {hasScope ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#780000] text-white border border-[#5e0000] font-semibold text-[10.5px] shadow-2xs">
                        {scopeAy
                          ? scopeAy.startsWith("A.Y.")
                            ? scopeAy
                            : `A.Y. ${scopeAy}`
                          : "All Academic Years"}
                        {scopeSem ? ` • ${scopeSem}` : ""}
                        {scopeFac ? ` • ${scopeFac}` : ""}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#780000] text-white border border-[#5e0000] text-[10.5px] font-semibold shadow-2xs">
                        Everything
                      </span>
                    )}

                    <div className="flex items-center gap-1.5 text-[11px]">
                      <span className="font-mono font-medium text-slate-600 dark:text-slate-300">
                        {formatFileSize(bk.file_size_kb)}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-amber-500 text-slate-900 border border-amber-600 font-mono text-[10.5px] font-bold shadow-2xs">
                        {bk.total_records.toLocaleString()} items
                      </span>
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setInspectedBackup(bk)}
                        className="px-2.5 py-1.5 text-[11px] font-semibold rounded-lg bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] transition cursor-pointer flex items-center gap-1 shadow-2xs active:scale-[0.98]"
                        title="View backup details"
                      >
                        <AppIcon icon={Eye} size="xs" color="white" />
                        <span>View</span>
                      </button>

                      <button
                        type="button"
                        disabled={
                          Boolean(rowExportingKey) ||
                          isGeneratingBackup ||
                          bk.has_downloadable_files !== true
                        }
                        onClick={() =>
                          void handleRowDownloadZip(
                            scopeAy ?? "all",
                            scopeSem ?? "all",
                            "all",
                            zipDisplay,
                          )
                        }
                        className="px-2.5 py-1.5 text-[11px] font-semibold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 border border-amber-600 transition cursor-pointer flex items-center gap-1 shadow-xs disabled:bg-slate-200 disabled:text-slate-400 disabled:border-slate-300 dark:disabled:bg-slate-800 dark:disabled:text-slate-500 dark:disabled:border-slate-700 disabled:shadow-none disabled:cursor-not-allowed"
                        title={
                          bk.has_downloadable_files === true
                            ? "Download document archive (.ZIP)"
                            : bk.is_files_cleaned
                              ? "Files for this semester were cleaned from Storage"
                              : "No uploaded files remain in Storage"
                        }
                      >
                        {rowExportingKey ===
                        `${scopeAy ?? "all"}__${scopeSem ?? "all"}__all` ? (
                          <>
                            <Refresh className="w-3 h-3 animate-spin text-slate-900" />
                            <span>{rowExportProgress || "Zipping..."}</span>
                          </>
                        ) : (
                          <>
                            <AppIcon icon={Archive} size="xs" color="inherit" />
                            <span>.ZIP</span>
                          </>
                        )}
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setBackupToDelete(bk)}
                      className="p-1.5 bg-red-600 hover:bg-red-700 text-white border border-red-700 rounded-lg transition cursor-pointer shadow-2xs active:scale-[0.98]"
                      title="Delete backup"
                    >
                      <AppIcon icon={Trash} size="xs" color="white" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Backups Desktop Table (>= md) */}
        <div className="hidden md:block w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm shadow-slate-300/50 dark:shadow-none overflow-hidden transition-colors">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-300 text-[10.5px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-2.5 text-center w-8 text-slate-400 dark:text-slate-500">
                    #
                  </th>
                  <th className="py-2.5 px-2.5">Backup Name</th>
                  <th className="py-2.5 px-2.5 whitespace-nowrap">Scope</th>
                  <th className="py-2.5 px-2.5 whitespace-nowrap">
                    Date &amp; Time
                  </th>
                  <th className="py-2.5 px-2.5 whitespace-nowrap">Size</th>
                  <th className="py-2.5 px-2.5 text-center whitespace-nowrap">
                    Items
                  </th>
                  <th className="py-2.5 px-2.5 text-center whitespace-nowrap">
                    Status
                  </th>
                  <th className="py-2.5 px-2.5 text-right whitespace-nowrap pr-3">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                {isLoading && filteredBackups.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-12 text-center text-slate-500"
                    >
                      <Refresh
                        className="h-5 w-5 animate-spin mx-auto mb-2 text-amber-500"
                        strokeWidth={2}
                      />
                      Loading backups...
                    </td>
                  </tr>
                ) : filteredBackups.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-12 text-center text-slate-500"
                    >
                      <AppIcon
                        icon={HardDrive}
                        size="xl"
                        color="muted"
                        className="mx-auto mb-2"
                      />
                      <p className="font-semibold text-slate-700 dark:text-slate-300">
                        {backupSearchQuery
                          ? "No matching backups found"
                          : "No backups yet"}
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
                      bk.metadata?.faculty_name,
                    );

                    const scopeAy =
                      scope?.academic_year || bk.academic_year || null;
                    const scopeSem =
                      scope?.semester || bk.metadata?.semester || null;
                    const scopeFac =
                      scope?.faculty_name || bk.metadata?.faculty_name || null;

                    return (
                      <tr
                        key={bk.id}
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors align-middle"
                      >
                        {/* Column 1: Row Index (#) */}
                        <td className="py-3 px-2.5 text-center text-slate-400 dark:text-slate-500 font-mono text-xs select-none">
                          {idx + 1}
                        </td>

                        {/* Column 2: Backup Name */}
                        <td className="py-3 px-2.5 font-semibold text-slate-900 dark:text-slate-100">
                          <div className="flex items-center gap-1.5 max-w-[140px] lg:max-w-[175px] xl:max-w-[210px]">
                            <Archive className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span
                              className="font-mono text-[11px] font-semibold text-slate-900 dark:text-slate-100 truncate cursor-help"
                              title={
                                bk.metadata?.zip_name ||
                                (bk.backup_name?.endsWith(".zip")
                                  ? bk.backup_name
                                  : `${bk.backup_name}.zip`)
                              }
                            >
                              {bk.metadata?.zip_name ||
                                (bk.backup_name?.endsWith(".zip")
                                  ? bk.backup_name
                                  : `${bk.backup_name}.zip`)}
                            </span>
                          </div>
                        </td>

                        {/* Column 3: Included Data */}
                        <td className="py-3 px-2.5 whitespace-nowrap">
                          {hasScope ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#780000] text-white border border-[#5e0000] font-semibold text-[10.5px] whitespace-nowrap shadow-2xs">
                              {scopeAy
                                ? scopeAy.startsWith("A.Y.")
                                  ? scopeAy
                                  : `A.Y. ${scopeAy}`
                                : "All Academic Years"}
                              {scopeSem ? ` • ${scopeSem}` : ""}
                              {scopeFac ? ` • ${scopeFac}` : ""}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#780000] text-white border border-[#5e0000] text-[10.5px] font-semibold whitespace-nowrap shadow-2xs">
                              Everything
                            </span>
                          )}
                        </td>

                        {/* Column 4: Date & Time */}
                        <td className="py-3 px-2.5 text-[11px] text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {formatDateTime(bk.created_at)}
                        </td>

                        {/* Column 5: File Size */}
                        <td className="py-3 px-2.5 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap font-mono text-[11px]">
                          {formatFileSize(bk.file_size_kb)}
                        </td>

                        {/* Column 6: Items Saved */}
                        <td className="py-3 px-2.5 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap text-center">
                          <span className="px-2 py-0.5 rounded-md bg-amber-500 text-slate-900 border border-amber-600 font-mono text-[10.5px] inline-block font-bold shadow-2xs">
                            {bk.total_records.toLocaleString()}
                          </span>
                        </td>

                        {/* Column 7: Status */}
                        <td className="py-3 px-2.5 whitespace-nowrap text-center">
                          {bk.status === "completed" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-md bg-[#0b5336] text-white border border-[#08412a] shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-200" />
                              Completed
                            </span>
                          ) : bk.status === "failed" ? (
                            <span className="inline-flex items-center gap-1 bg-[#780000] text-white border border-[#5e0000] px-2 py-0.5 text-[11px] font-semibold rounded-md shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-200" />
                              Failed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-amber-500 text-slate-950 border border-amber-600 px-2 py-0.5 text-[11px] font-semibold rounded-md shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-900 animate-pulse" />
                              Processing
                            </span>
                          )}
                        </td>

                        {/* Column 8: Actions */}
                        <td className="py-3 px-2.5 text-right whitespace-nowrap pr-3">
                          <div className="inline-flex items-center gap-1 justify-end">
                            <button
                              type="button"
                              onClick={() => setInspectedBackup(bk)}
                              className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] transition cursor-pointer flex items-center gap-1 shrink-0 shadow-2xs active:scale-[0.98]"
                              title="View backup details"
                            >
                              <AppIcon icon={Eye} size="xs" color="white" />
                              <span>View</span>
                            </button>

                            <button
                              type="button"
                              disabled={
                                Boolean(rowExportingKey) ||
                                isGeneratingBackup ||
                                bk.has_downloadable_files !== true
                              }
                              onClick={() =>
                                void handleRowDownloadZip(
                                  scopeAy ?? "all",
                                  scopeSem ?? "all",
                                  "all",
                                  bk.metadata?.zip_name ||
                                    (bk.backup_name?.endsWith(".zip")
                                      ? bk.backup_name
                                      : `${bk.backup_name}.zip`),
                                )
                              }
                              className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 border border-amber-600 transition cursor-pointer flex items-center gap-1 shadow-xs disabled:bg-slate-200 disabled:text-slate-400 disabled:border-slate-300 dark:disabled:bg-slate-800 dark:disabled:text-slate-500 dark:disabled:border-slate-700 disabled:shadow-none disabled:cursor-not-allowed disabled:hover:bg-slate-200 dark:disabled:hover:bg-slate-800 shrink-0"
                              title={
                                bk.has_downloadable_files === true
                                  ? "Download document archive (.ZIP)"
                                  : bk.is_files_cleaned
                                    ? "Files for this semester were cleaned from Storage"
                                    : "No uploaded files remain in Storage"
                              }
                            >
                              {rowExportingKey ===
                              `${scopeAy ?? "all"}__${scopeSem ?? "all"}__all` ? (
                                <>
                                  <Refresh className="w-3 h-3 animate-spin text-slate-900" />
                                  <span>
                                    {rowExportProgress || "Zipping..."}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <AppIcon
                                    icon={Archive}
                                    size="xs"
                                    color="inherit"
                                  />
                                  <span>.ZIP</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => setBackupToDelete(bk)}
                              className="p-1.5 bg-red-600 hover:bg-red-700 text-white border border-red-700 rounded-lg transition cursor-pointer shadow-2xs active:scale-[0.98] shrink-0"
                              title="Delete backup"
                            >
                              <AppIcon icon={Trash} size="xs" color="white" />
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <AppIcon icon={Archive} size="md" color="default" />
              <span>Academic Terms &amp; Semester Archive Vault</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Historical archive of finalized academic terms and verified semester snapshot backups.
            </p>
          </div>
        </div>

        {/* Academic Terms Mobile Cards (< md) */}
        <div className="md:hidden space-y-2.5">
          {displayedVaultTerms.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-10 px-4 text-center text-xs text-slate-500 shadow-sm">
              <AppIcon icon={Archive} size="xl" color="muted" className="mx-auto mb-2" />
              <p className="font-semibold text-slate-700 dark:text-slate-300">
                No archived semesters in vault
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Past academic terms and verified semester backups are safely preserved in this archive vault.
              </p>
            </div>
          ) : (
            displayedVaultTerms.map((term, idx) => {
              const isBackedUp = isTermBackedUp(term.academic_year, term.semester);
              const isCurrent = term.status === "Current";
              const isArchived = term.status === "Archived" || term.is_archived;
              const zipKey = `${term.academic_year}__${term.semester}__all`;
              const isRowExporting = exportingTermKey === zipKey;

              return (
                <div
                  key={`mobile-term-${term.academic_year}-${term.semester}`}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 space-y-2.5 shadow-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded shrink-0">
                        #{idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-slate-900 dark:text-slate-100">
                          {term.academic_year}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {term.semester}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0">
                      {isCurrent ? (
                        <span className="inline-flex items-center gap-1.5 bg-amber-500 text-slate-900 border border-amber-600 px-2 py-0.5 text-[11px] font-bold rounded-md shadow-2xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-900 animate-pulse" />
                          Current Term
                        </span>
                      ) : isArchived ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold rounded-md bg-[#780000] text-white border border-[#5e0000] shadow-2xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-200" />
                          Archived
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          Upcoming
                        </span>
                      )}

                      {isBackedUp ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold rounded-md bg-[#0b5336] text-white border border-[#08412a] shadow-2xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-200" />
                          Backed Up
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                          No Backup
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setInspectedTerm(term)}
                        className="px-2.5 py-1.5 text-[11px] font-semibold rounded-lg bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] transition cursor-pointer flex items-center gap-1 shadow-2xs active:scale-[0.98]"
                        title="View archived term details"
                      >
                        <AppIcon icon={Eye} size="xs" color="white" />
                        <span>View</span>
                      </button>

                      <button
                        type="button"
                        disabled={
                          Boolean(exportingTermKey) ||
                          term.has_downloadable_files !== true
                        }
                        onClick={() =>
                          void handleDownloadZip(
                            term.academic_year,
                            term.semester,
                          )
                        }
                        className="px-2.5 py-1.5 text-[11px] font-semibold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 border border-amber-600 transition cursor-pointer flex items-center gap-1 shadow-xs disabled:bg-slate-200 disabled:text-slate-400 disabled:border-slate-300 dark:disabled:bg-slate-800 dark:disabled:text-slate-500 dark:disabled:border-slate-700 disabled:shadow-none disabled:cursor-not-allowed"
                        title={
                          term.has_downloadable_files === true
                            ? "Download faculty files archive (.ZIP)"
                            : term.is_files_cleaned
                              ? "Files for this semester were cleaned from Storage"
                              : "No uploaded files available for this term"
                        }
                      >
                        {isRowExporting ? (
                          <>
                            <Refresh className="w-3.5 h-3.5 animate-spin" />
                            <span>{exportProgress || "Zipping..."}</span>
                          </>
                        ) : (
                          <>
                            <AppIcon icon={Archive} size="xs" color="inherit" />
                            <span>.ZIP</span>
                          </>
                        )}
                      </button>
                    </div>

                    <button
                      type="button"
                      disabled={
                        isCleaningTerm ||
                        term.has_cleanable_data !== true
                      }
                      onClick={() =>
                        void openCleanTermModal(
                          term.academic_year,
                          term.semester,
                        )
                      }
                      className="p-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white border border-red-700 transition cursor-pointer shadow-2xs active:scale-[0.98] disabled:bg-slate-200 disabled:text-slate-400 disabled:border-slate-300 dark:disabled:bg-slate-800 dark:disabled:text-slate-500 dark:disabled:border-slate-700 disabled:shadow-none disabled:cursor-not-allowed"
                      title={
                        term.has_cleanable_data === true
                          ? "Optional: permanently delete semester files, logs, notifications & extension requests (cannot be restored)"
                          : "All files and logs for this semester have already been deleted"
                      }
                    >
                      <AppIcon icon={Trash} size="xs" color="inherit" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Academic Terms Desktop Table (>= md) */}
        <div className="hidden md:block w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm shadow-slate-300/50 dark:shadow-none overflow-hidden transition-colors">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 text-[11px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-2.5 text-center w-9 text-slate-400 dark:text-slate-500">
                    #
                  </th>
                  <th className="py-2.5 px-2.5">
                    Academic Year &amp; Semester
                  </th>
                  <th className="py-2.5 px-2.5 whitespace-nowrap">Term State</th>
                  <th className="py-2.5 px-2.5 whitespace-nowrap">
                    Backup Status
                  </th>
                  <th className="py-2.5 px-2.5 text-right whitespace-nowrap pr-3">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                {displayedVaultTerms.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-10 text-center text-slate-500"
                    >
                      <AppIcon
                        icon={Archive}
                        size="xl"
                        color="muted"
                        className="mx-auto mb-2"
                      />
                      <p className="font-semibold text-slate-700 dark:text-slate-300">
                        No archived semesters in vault
                      </p>
                      <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                        Past academic terms and verified semester backups are safely preserved in this archive vault.
                      </p>
                    </td>
                  </tr>
                ) : (
                  displayedVaultTerms.map((term, idx) => {
                    const isBackedUp = isTermBackedUp(
                      term.academic_year,
                      term.semester,
                    );
                    const isCurrent = term.status === "Current";
                    const isArchived =
                      term.status === "Archived" || term.is_archived;
                    const zipKey = `${term.academic_year}__${term.semester}__all`;
                    const isRowExporting = exportingTermKey === zipKey;

                    return (
                      <tr
                        key={`${term.academic_year}-${term.semester}`}
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors align-middle"
                      >
                        {/* Column 1: Row Index (#) */}
                        <td className="py-3 px-2.5 text-center text-slate-400 dark:text-slate-500 font-mono text-xs select-none">
                          {idx + 1}
                        </td>

                        {/* Column 2: Academic Year & Semester */}
                        <td className="py-3 px-2.5 font-semibold text-slate-900 dark:text-slate-100">
                          <div>
                            <span className="font-bold text-xs block text-slate-900 dark:text-slate-100">
                              {term.academic_year}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                              {term.semester}
                            </span>
                          </div>
                        </td>

                        {/* Column 3: Term State */}
                        <td className="py-3 px-2.5 whitespace-nowrap">
                          {isCurrent ? (
                            <span className="inline-flex items-center gap-1.5 bg-amber-500 text-slate-900 border border-amber-600 px-2 py-0.5 text-[11px] font-bold rounded-md shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-900 animate-pulse" />
                              Current Term
                            </span>
                          ) : isArchived ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold rounded-md bg-[#780000] text-white border border-[#5e0000] shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-200" />
                              Archived
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                              Upcoming
                            </span>
                          )}
                        </td>

                        {/* Column 4: Semester Backup Status */}
                        <td className="py-3 px-2.5 font-medium whitespace-nowrap">
                          {isBackedUp ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold rounded-md bg-[#0b5336] text-white border border-[#08412a] shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-200" />
                              Backed Up
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                              No Backup
                            </span>
                          )}
                        </td>

                        {/* Column 5: Actions */}
                        <td className="py-3 px-2.5 text-right whitespace-nowrap pr-3">
                          <div className="inline-flex items-center gap-1 justify-end">
                            <button
                              type="button"
                              onClick={() => setInspectedTerm(term)}
                              className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] transition cursor-pointer flex items-center gap-1 shrink-0 shadow-2xs active:scale-[0.98]"
                              title="View archived term details"
                            >
                              <AppIcon icon={Eye} size="xs" color="white" />
                              <span>View</span>
                            </button>

                            <button
                              type="button"
                              disabled={
                                Boolean(exportingTermKey) ||
                                term.has_downloadable_files !== true
                              }
                              onClick={() =>
                                void handleDownloadZip(
                                  term.academic_year,
                                  term.semester,
                                )
                              }
                              className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 border border-amber-600 transition cursor-pointer flex items-center gap-1 shadow-xs disabled:bg-slate-200 disabled:text-slate-400 disabled:border-slate-300 dark:disabled:bg-slate-800 dark:disabled:text-slate-500 dark:disabled:border-slate-700 disabled:shadow-none disabled:cursor-not-allowed disabled:hover:bg-slate-200 dark:disabled:hover:bg-slate-800 shrink-0"
                              title={
                                term.has_downloadable_files === true
                                  ? "Download faculty files archive (.ZIP)"
                                  : term.is_files_cleaned
                                    ? "Files for this semester were cleaned from Storage"
                                    : "No uploaded files available for this term"
                              }
                            >
                              {isRowExporting ? (
                                <>
                                  <Refresh className="w-3.5 h-3.5 animate-spin" />
                                  <span>{exportProgress || "Zipping..."}</span>
                                </>
                              ) : (
                                <>
                                  <AppIcon
                                    icon={Archive}
                                    size="xs"
                                    color="inherit"
                                  />
                                  <span>.ZIP</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              disabled={
                                isCleaningTerm ||
                                term.has_cleanable_data !== true
                              }
                              onClick={() =>
                                void openCleanTermModal(
                                  term.academic_year,
                                  term.semester,
                                )
                              }
                              className="p-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white border border-red-700 transition cursor-pointer shadow-2xs active:scale-[0.98] disabled:bg-slate-200 disabled:text-slate-400 disabled:border-slate-300 dark:disabled:bg-slate-800 dark:disabled:text-slate-500 dark:disabled:border-slate-700 disabled:shadow-none disabled:cursor-not-allowed disabled:hover:bg-slate-200 dark:disabled:hover:bg-slate-800 shrink-0"
                              title={
                                term.has_cleanable_data === true
                                  ? "Optional: permanently delete semester files, logs, notifications & extension requests (cannot be restored)"
                                  : "All files and logs for this semester have already been deleted"
                              }
                            >
                              <AppIcon icon={Trash} size="xs" color="inherit" />
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
      {inspectedBackup &&
        (() => {
          const snap = inspectedBackup.metadata?.snapshot as any;
          const meta = inspectedBackup.metadata as any;
          const fileTypes =
            meta?.file_types_summary || snap?.summary?.file_types_summary || {};
          const facultyRoster =
            snap?.faculty_roster || snap?.faculty_list || null;

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-4 backdrop-blur-sm animate-in fade-in">
              <div className="w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl text-slate-900 dark:text-slate-100 max-h-[90dvh] overflow-hidden flex flex-col">
                <ModalHeader
                  title={
                    inspectedBackup.metadata?.zip_name ||
                    (inspectedBackup.backup_name?.endsWith(".zip")
                      ? inspectedBackup.backup_name
                      : `${inspectedBackup.backup_name}.zip`)
                  }
                  icon={Archive}
                />
                <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 text-xs">
                  {/* Meta stats bar */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200 dark:bg-slate-950/60 dark:border-slate-800">
                    <div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                        Academic Term
                      </span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {inspectedBackup.academic_year ||
                          inspectedBackup.metadata?.academic_year ||
                          "All A.Y."}
                      </span>
                      <span className="text-[11px] text-slate-500 block">
                        {inspectedBackup.metadata?.semester || "All Semesters"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider block font-medium">
                        Faculty Scope
                      </span>
                      <span className="font-bold text-slate-900 dark:text-slate-100 text-sm block break-words">
                        {inspectedBackup.metadata?.users_count
                          ? `${inspectedBackup.metadata.users_count} Members`
                          : facultyRoster
                            ? `${facultyRoster.length} Members`
                            : (inspectedBackup.metadata?.scope?.faculty_name || "All Faculty")}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                        Requirements Saved
                      </span>
                      <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                        {inspectedBackup.metadata?.submissions_count ??
                          inspectedBackup.total_records}
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        {formatFileSize(inspectedBackup.file_size_kb)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                        Date Generated
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 block break-words">
                        {formatDateTime(inspectedBackup.created_at)}
                      </span>
                    </div>
                  </div>

                  {/* File Types Breakdown */}
                  {Object.keys(fileTypes).length > 0 && (
                    <div className="p-3.5 rounded-xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 space-y-2">
                      <span className="text-[11px] font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider block flex items-center gap-1.5">
                        <AppIcon
                          icon={MultiplePages}
                          size="xs"
                          color="inherit"
                        />
                        <span>Captured File Types in this Semester</span>
                      </span>
                      <div className="flex items-center gap-2 flex-wrap">
                        {Object.entries(fileTypes).map(([type, count]) => (
                          <span
                            key={type}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs font-semibold text-xs"
                          >
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-slate-900">
                              {type}
                            </span>
                            <span className="text-slate-700 dark:text-slate-200">
                              {Number(count)} file
                              {Number(count) === 1 ? "" : "s"}
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Faculty & Submitted Requirements Roster */}
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                        <span>
                          {facultyRoster && facultyRoster.length > 0
                            ? "Faculty & Submitted Requirements Roster"
                            : "Archived Documents & Scope"}
                        </span>
                      </h4>
                      {facultyRoster && (
                        <span className="text-[11px] text-slate-500 font-medium">
                          {facultyRoster.length} Faculty Members Included
                        </span>
                      )}
                    </div>

                    {facultyRoster && facultyRoster.length > 0 ? (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                        {facultyRoster.map((fac: any) => (
                          <div
                            key={fac.faculty_id}
                            className="p-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0">
                                <span className="font-bold text-slate-900 dark:text-slate-100 block break-words">
                                  {fac.name}
                                </span>
                                <span className="text-[10px] text-slate-400 break-all block">
                                  {fac.department ? `${fac.department} • ` : ""}
                                  {fac.email || "Faculty"}
                                </span>
                              </div>
                              <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 shrink-0">
                                {fac.total_submitted_requirements ??
                                  (fac.requirements?.length || 0)}{" "}
                                requirement
                                {(fac.requirements?.length || 0) === 1
                                  ? ""
                                  : "s"}
                              </span>
                            </div>

                            {fac.requirements && fac.requirements.length > 0 ? (
                              <div className="mt-2 pl-2 border-l-2 border-slate-200 dark:border-slate-800 space-y-1.5">
                                {fac.requirements.map(
                                  (req: any, idx: number) => (
                                    <div
                                      key={idx}
                                      className="flex flex-wrap items-center justify-between gap-2 text-[11px]"
                                    >
                                      <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shrink-0">
                                          {req.file?.file_type || "FILE"}
                                        </span>
                                        <span className="text-slate-800 dark:text-slate-200 font-medium break-words">
                                          {req.requirement_title ||
                                            req.requirement_code}
                                        </span>
                                        {req.file?.file_name && (
                                          <span className="text-[10px] text-slate-400 truncate max-w-[150px]">
                                            ({req.file.file_name})
                                          </span>
                                        )}
                                      </div>
                                      <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-semibold bg-[#0b5336] text-white border border-[#08412a]">
                                        {req.status || "Submitted"}
                                      </span>
                                    </div>
                                  ),
                                )}
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
                      <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3.5">
                        <div>
                          <h5 className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm">
                            Verified Institutional Document Vault
                          </h5>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                            This archive safely preserves faculty requirements, syllabi, class records, and verified submissions packaged for institutional reporting.
                          </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-slate-200 dark:border-slate-800">
                          <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Package Format</span>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">Compressed .ZIP Vault</span>
                          </div>
                          <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Saved Files</span>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">
                              {inspectedBackup.metadata?.submissions_count ?? inspectedBackup.total_records} Documents ({formatFileSize(inspectedBackup.file_size_kb)})
                            </span>
                          </div>
                          <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Archive Term</span>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5 block break-words">
                              {inspectedBackup.academic_year || inspectedBackup.metadata?.academic_year || "All A.Y."} • {inspectedBackup.metadata?.semester || "All Semesters"}
                            </span>
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-amber-500 text-slate-950 border border-amber-600 text-xs font-semibold shadow-2xs">
                          {inspectedBackup.has_downloadable_files === true ? (
                            <span>Click <strong>Download Documents (.ZIP)</strong> below to extract and browse all individual faculty compliance files.</span>
                          ) : (
                            <span>Uploaded files for this semester were cleaned from Storage. Use the offline <strong>.ZIP</strong> backup downloaded before cleaning.</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2.5 p-3.5 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 shrink-0">
                  <button
                    type="button"
                    onClick={() => setInspectedBackup(null)}
                    className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 rounded-xl text-xs font-semibold bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] transition cursor-pointer shadow-xs"
                  >
                    Close
                  </button>

                  <button
                    type="button"
                    disabled={
                      Boolean(exportingTermKey) ||
                      inspectedBackup.has_downloadable_files !== true
                    }
                    onClick={() => {
                      const ay =
                        inspectedBackup.academic_year ||
                        inspectedBackup.metadata?.academic_year ||
                        undefined;
                      const sem =
                        inspectedBackup.metadata?.semester || undefined;
                      const customZipName =
                        inspectedBackup.metadata?.zip_name ||
                        (inspectedBackup.backup_name?.endsWith(".zip")
                          ? inspectedBackup.backup_name
                          : `${inspectedBackup.backup_name}.zip`);
                      void handleDownloadZip(ay, sem, undefined, customZipName);
                    }}
                    title={
                      inspectedBackup.has_downloadable_files === true
                        ? "Download Documents (.ZIP)"
                        : "Files for this semester were cleaned from Storage"
                    }
                    className="w-full sm:w-auto justify-center px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-900 border border-amber-600 transition cursor-pointer flex items-center gap-1.5 shadow-xs disabled:bg-slate-200 disabled:text-slate-400 disabled:border-slate-300 dark:disabled:bg-slate-800 dark:disabled:text-slate-500 dark:disabled:border-slate-700 disabled:shadow-none disabled:cursor-not-allowed disabled:hover:bg-slate-200 dark:disabled:hover:bg-slate-800"
                  >
                    <AppIcon icon={Archive} size="sm" color="inherit" />
                    <span>Download Documents (.ZIP)</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {/* Term Vault Inspection Modal */}
      {inspectedTerm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-4 backdrop-blur-sm">
          <div className="w-full max-w-md max-h-[90dvh] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl text-slate-900 dark:text-slate-100 overflow-hidden flex flex-col">
            <ModalHeader title="Archived Term Details" icon={Archive} />
            <div className="p-4 sm:p-6 space-y-3 text-xs overflow-y-auto flex-1">
              <div className="p-3.5 sm:p-4 rounded-lg bg-slate-50 border border-slate-200/80 dark:bg-slate-900/50 dark:border-slate-800 space-y-2">
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500 dark:text-slate-400">
                    School Year:
                  </span>
                  <span className="font-bold text-slate-900 dark:text-slate-100 text-right">
                    {inspectedTerm.academic_year}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500 dark:text-slate-400">
                    Semester:
                  </span>
                  <span className="font-bold text-slate-900 dark:text-slate-100 text-right">
                    {inspectedTerm.semester}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500 dark:text-slate-400">
                    File Status:
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 text-right">
                    {inspectedTerm.is_files_cleaned
                      ? "Cleaned from Storage"
                      : inspectedTerm.has_downloadable_files
                        ? "Safely Stored"
                        : "No Uploaded Files"}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500 dark:text-slate-400">
                    Date Archived:
                  </span>
                  <span className="text-slate-700 dark:text-slate-300 text-right">
                    {"archived_at" in inspectedTerm && inspectedTerm.archived_at
                      ? formatDateTime(inspectedTerm.archived_at)
                      : "Preserved in Vault"}
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                {inspectedTerm.is_files_cleaned
                  ? "Uploaded files for this term were cleaned from Storage. Use the offline .ZIP backup downloaded before cleaning."
                  : "All submitted files and records from this term are safely stored and can be downloaded anytime."}
              </p>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2 p-4 border-t border-slate-200 dark:border-slate-800 shrink-0">
              <button
                type="button"
                onClick={() => setInspectedTerm(null)}
                className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 rounded-xl text-xs font-semibold bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] transition cursor-pointer shadow-xs"
              >
                Close
              </button>
              <button
                type="button"
                disabled={
                  Boolean(exportingTermKey) ||
                  inspectedTerm.has_downloadable_files !== true
                }
                onClick={() =>
                  void handleDownloadZip(
                    inspectedTerm.academic_year,
                    inspectedTerm.semester,
                    "all",
                  )
                }
                title={
                  inspectedTerm.has_downloadable_files === true
                    ? "Download Files (.ZIP)"
                    : inspectedTerm.is_files_cleaned
                      ? "Files for this term were cleaned from Storage"
                      : "No uploaded files available for this term"
                }
                className="w-full sm:w-auto justify-center px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-900 border border-amber-600 transition cursor-pointer flex items-center gap-1.5 disabled:bg-slate-200 disabled:text-slate-400 disabled:border-slate-300 dark:disabled:bg-slate-800 dark:disabled:text-slate-500 dark:disabled:border-slate-700 disabled:shadow-none disabled:cursor-not-allowed disabled:hover:bg-slate-200 dark:disabled:hover:bg-slate-800 shadow-xs"
              >
                {exportingTermKey ===
                `${inspectedTerm.academic_year}__${inspectedTerm.semester}__all` ? (
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
            </div>
          </div>
        </div>
      )}

      {/* Delete Backup Confirmation Modal */}
      {backupToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-4 backdrop-blur-sm">
          <div className="w-full max-w-md max-h-[90dvh] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 shadow-2xl text-slate-900 dark:text-slate-100 overflow-y-auto">
            {/* Modal Header */}
            <ModalHeader
              icon={Trash}
              title="Delete Backup"
              subtitle="Remove this backup from the list"
              className="-mx-4 -mt-4 sm:-mx-6 sm:-mt-6 mb-4 rounded-t-2xl"
            />

            {/* Description & Warnings */}
            <div className="space-y-3">
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed break-words">
                Are you sure you want to permanently delete{" "}
                <strong className="text-slate-900 dark:text-slate-100">
                  &ldquo;{backupToDelete.backup_name}&rdquo;
                </strong>
                ?
              </p>

              <div className="rounded-xl border border-amber-600 bg-amber-500 p-3 text-xs text-slate-900 space-y-1 shadow-xs">
                <p className="font-bold">Safety Notice:</p>
                <p className="font-medium">
                  Deleting this removes the backup from your list permanently.
                  If you still need a copy, download the file first before
                  deleting.
                </p>
              </div>

              {deleteCountdown > 0 ? (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  Safety lock active. The confirmation button will be available
                  in{" "}
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {deleteCountdown} seconds
                  </span>
                  .
                </p>
              ) : null}
            </div>

            {/* Footer Actions */}
            <div className="mt-5 sm:mt-6 grid grid-cols-2 sm:flex sm:items-center sm:justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setBackupToDelete(null)}
                className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 rounded-xl bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] text-xs font-semibold transition cursor-pointer shadow-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting || deleteCountdown > 0}
                onClick={() => void handleDeleteBackup()}
                className="w-full sm:w-auto inline-flex items-center justify-center bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] text-xs font-semibold px-4 py-2 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-xs"
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

      {/* Clean Semester Storage Modal */}
      {cleanTermTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg max-h-[90dvh] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 shadow-2xl text-slate-900 dark:text-slate-100 overflow-y-auto">
            <ModalHeader
              icon={Trash}
              title={`Delete Semester Files & Logs · A.Y. ${cleanTermTarget.academic_year}`}
              subtitle={`${cleanTermTarget.semester} — Optional cleanup if storage/DB is full (cannot be restored once deleted)`}
              className="-mx-4 -mt-4 sm:-mx-6 sm:-mt-6 mb-4 rounded-t-2xl"
            />

            <div className="space-y-3.5 text-xs">
              {/* Term Storage Summary */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3.5">
                {isLoadingCleanPreview ? (
                  <div className="flex items-center gap-2 text-slate-500">
                    <Refresh className="h-3.5 w-3.5 animate-spin" />
                    <span>Checking sem data...</span>
                  </div>
                ) : cleanPreview ? (
                  <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-6 gap-2.5">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-slate-500 block whitespace-nowrap">
                        Files
                      </span>
                      <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                        {cleanPreview.storageFilesCount +
                          (cleanPreview.orphanedFilesCount || 0)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-slate-500 block whitespace-nowrap">
                        Storage
                      </span>
                      <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                        {formatBytesReadable(
                          cleanPreview.totalSizeBytes +
                            (cleanPreview.orphanedSizeBytes || 0),
                        )}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-slate-500 block whitespace-nowrap">
                        Logs
                      </span>
                      <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                        {cleanPreview.transactionLogsCount ?? 0}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-slate-500 block whitespace-nowrap">
                        Notifs
                      </span>
                      <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                        {cleanPreview.notificationsCount ?? 0}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-slate-500 block whitespace-nowrap">
                        Extensions
                      </span>
                      <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                        {cleanPreview.extensionRequestsCount ?? 0}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-slate-500 block whitespace-nowrap">
                        Keep-Alive
                      </span>
                      <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                        {cleanPreview.keepaliveLogsCount ?? 0}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-500">
                    Ready to clean {cleanTermTarget.academic_year} ({cleanTermTarget.semester}).
                  </p>
                )}
              </div>

              {/* Backup Warning */}
              {cleanPreview && !cleanPreview.isBackedUp && (
                <div className="rounded-xl border border-amber-600 bg-amber-500 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-slate-950 shadow-xs">
                  <div>
                    <p className="font-bold">No .ZIP backup yet for this sem</p>
                    <p className="text-[11px] font-medium">
                      Download a backup first if you still need copies of the files.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={Boolean(exportingTermKey)}
                    onClick={() =>
                      void handleDownloadZip(
                        cleanTermTarget.academic_year,
                        cleanTermTarget.semester,
                      )
                    }
                    className="w-full sm:w-auto px-3 py-1.5 rounded-lg bg-[#780000] hover:bg-[#5e0000] text-white font-bold text-[11px] border border-[#5e0000] shrink-0 cursor-pointer text-center"
                  >
                    Download .ZIP
                  </button>
                </div>
              )}

              {/* Solid Color Summary Card */}
              <div className="rounded-xl border border-amber-600 bg-amber-500 p-3.5 text-slate-950 space-y-2 shadow-xs">
                <p className="font-bold">
                  Permanently deletes for this sem only:
                </p>
                <ul className="list-disc pl-4 space-y-0.5 text-[11px] font-semibold">
                  <li>Uploaded files (profile photos stay)</li>
                  <li>Notifications for this sem</li>
                  <li>Transaction logs for this sem</li>
                  <li>Extension requests for this sem</li>
                  <li>Database keep-alive logs for this sem</li>
                </ul>
                <p className="text-[11px] font-bold text-[#780000] pt-1 border-t border-amber-600/40">
                  Cannot be restored once deleted: all files and records above are permanently erased.
                </p>
                <p className="text-[11px] font-semibold">
                  Stays untouched: all accounts, verification history, programs, and tables.
                </p>
              </div>

              {/* Safety Confirmation Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                    Type <span className="font-mono text-[#780000] dark:text-amber-400">delete</span> to confirm
                  </label>
                  <input
                    type="text"
                    value={cleanConfirmText}
                    onChange={(e) => {
                      setCleanConfirmText(e.target.value);
                      if (cleanModalError) setCleanModalError(null);
                    }}
                    placeholder="delete"
                    autoComplete="off"
                    className="w-full h-9 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-[#780000]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                    Admin password
                  </label>
                  <div className="relative">
                    <input
                      type={showCleanPassword ? "text" : "password"}
                      value={cleanAdminPassword}
                      onChange={(e) => {
                        setCleanAdminPassword(e.target.value);
                        if (cleanModalError) setCleanModalError(null);
                      }}
                      placeholder="Enter password"
                      autoComplete="current-password"
                      className="w-full h-9 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 pl-3 pr-9 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-[#780000]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCleanPassword((prev) => !prev)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 transition-colors cursor-pointer"
                      aria-label={
                        showCleanPassword ? "Hide password" : "Show password"
                      }
                      title={showCleanPassword ? "Hide password" : "Show password"}
                    >
                      {showCleanPassword ? (
                        <AppIcon
                          icon={Eye}
                          size="md"
                          color="inherit"
                          strokeWidth={2.2}
                        />
                      ) : (
                        <AppIcon
                          icon={EyeClosed}
                          size="md"
                          color="inherit"
                          strokeWidth={2.2}
                        />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {cleanModalError ? (
                <div className="rounded-xl bg-[#780000] border border-[#5e0000] px-3 py-2 text-[11px] font-semibold text-white">
                  {cleanModalError}
                </div>
              ) : null}

              {cleanCountdown > 0 ? (
                <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                  Safety timer:{" "}
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {cleanCountdown}s
                  </span>{" "}
                  left before you can delete.
                </p>
              ) : null}
            </div>

            <div className="mt-5 grid grid-cols-2 sm:flex sm:items-center sm:justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setCleanTermTarget(null)}
                className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 rounded-xl border border-amber-600 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition cursor-pointer shadow-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  isCleaningTerm ||
                  cleanCountdown > 0 ||
                  cleanConfirmText.trim().toLowerCase() !== "delete" ||
                  !cleanAdminPassword
                }
                onClick={() => void handleConfirmCleanTerm()}
                className="w-full sm:w-auto inline-flex items-center justify-center bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] text-xs font-bold px-4 py-2 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-xs"
              >
                {isCleaningTerm
                  ? "Cleaning..."
                  : cleanCountdown > 0
                    ? `Delete (${cleanCountdown}s)`
                    : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
