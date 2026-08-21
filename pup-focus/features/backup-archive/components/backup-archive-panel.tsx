"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Database,
  Archive,
  Download,
  CheckCircle2,
  Calendar,
  AlertTriangle,
  RefreshCw,
  Plus,
  Trash2,
  Eye,
  FileCheck,
  HardDrive,
  Clock,
  Layers,
  X,
} from "lucide-react";
import type {
  SystemBackup,
  ArchivedTermSummary,
  AvailableAcademicTerm,
  BackupStats,
  BackupSnapshotData,
} from "@/features/backup-archive/types/backup-archive.types";

export function BackupArchivePanel() {
  const [backups, setBackups] = useState<SystemBackup[]>([]);
  const [archivedTerms, setArchivedTerms] = useState<ArchivedTermSummary[]>([]);
  const [availableTerms, setAvailableTerms] = useState<AvailableAcademicTerm[]>([]);
  const [stats, setStats] = useState<BackupStats>({
    total_backups: 0,
    archived_academic_years: 0,
    last_backup_date: null,
    total_archived_documents: 0,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingBackup, setIsGeneratingBackup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Archiving selection state
  const [selectedTermToArchive, setSelectedTermToArchive] = useState<string>("");
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  // Vault / Snapshot inspection modal
  const [inspectedBackup, setInspectedBackup] = useState<SystemBackup | null>(null);
  const [inspectedTerm, setInspectedTerm] = useState<ArchivedTermSummary | null>(null);
  const [backupToDelete, setBackupToDelete] = useState<SystemBackup | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
      if (data.stats) {
        setStats(data.stats);
      }

      // Preselect first unarchived term if available
      const unarchived = (data.availableTerms || []).find((t: AvailableAcademicTerm) => !t.is_archived);
      if (unarchived) {
        setSelectedTermToArchive(`${unarchived.academic_year}__${unarchived.semester}`);
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

  const handleGenerateBackup = async () => {
    try {
      setIsGeneratingBackup(true);
      setError(null);
      const res = await fetch("/api/admin/backups/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate backup");
      }

      const data = await res.json();
      setSuccess("Full system backup snapshot generated successfully.");
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

      await loadBackupData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creating backup");
    } finally {
      setIsGeneratingBackup(false);
    }
  };

  const handleArchiveTermConfirm = async () => {
    if (!selectedTermToArchive) return;
    const [academicYear, semester] = selectedTermToArchive.split("__");

    try {
      setIsArchiving(true);
      setError(null);
      const res = await fetch("/api/admin/backups/archive-term", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ academic_year: academicYear, semester }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to archive term");
      }

      const data = await res.json();
      setSuccess(data.message || `Archived ${academicYear} (${semester}) successfully.`);
      setTimeout(() => setSuccess(null), 5000);
      setIsArchiveModalOpen(false);
      await loadBackupData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error archiving term");
    } finally {
      setIsArchiving(false);
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

  const activeTermsToArchive = useMemo(() => {
    return availableTerms.filter((t) => !t.is_archived && t.status !== "Archived");
  }, [availableTerms]);

  return (
    <article className="space-y-6">
      {/* Header Banner */}
      <section className="relative overflow-hidden rounded-2xl border border-slate-400 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-7 shadow-sm transition-colors">
        <div className="relative z-10 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-700 dark:text-amber-400">
              System Administration & Compliance
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Automated Data Archiving & Backup Manager
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 font-normal">
            Safeguard institutional compliance data, generate system recovery snapshots, and manage historical academic archives.
          </p>
        </div>
      </section>

      {/* Top 3 Stat Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-400 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Total Backups Generated</span>
            <HardDrive className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="mt-2">
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              {stats.total_backups}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Recovery snapshots in repository
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-400 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Archived Academic Years</span>
            <Archive className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-2">
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              {stats.archived_academic_years}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Preserved in historical vault
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-400 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Last Backup Date</span>
            <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
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
      {error ? (
        <div className="rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-xs sm:text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/40 px-4 py-3 text-xs sm:text-sm text-emerald-300">
          {success}
        </div>
      ) : null}

      {/* SECTION 1: System Backup Manager */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-400 dark:border-slate-800 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Database className="w-4 h-4 text-amber-500" />
              <span>System Backup Manager</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Create full database snapshots containing users, compliance submissions, terms, and audit records.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadBackupData()}
              className="p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer"
              title="Refresh backups"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>

            <button
              type="button"
              disabled={isGeneratingBackup}
              onClick={() => void handleGenerateBackup()}
              className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs sm:text-sm px-4 py-2 transition shadow-sm cursor-pointer disabled:opacity-50"
            >
              {isGeneratingBackup ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Generating Snapshot...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Generate Full Backup Snapshot</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Backups Table */}
        <div className="rounded-2xl border border-slate-400 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden transition-colors">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-300 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  <th className="py-3.5 px-4">Backup Name</th>
                  <th className="py-3.5 px-4">Date & Time</th>
                  <th className="py-3.5 px-4">File Size</th>
                  <th className="py-3.5 px-4">Total Records</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-500" />
                      Loading backup records...
                    </td>
                  </tr>
                ) : backups.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      <HardDrive className="w-8 h-8 mx-auto mb-2 text-slate-400 opacity-60" />
                      <p className="font-semibold text-slate-700 dark:text-slate-300">No backup records found</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Click "+ Generate Full Backup Snapshot" to create your first recovery snapshot.
                      </p>
                    </td>
                  </tr>
                ) : (
                  backups.map((bk) => (
                    <tr
                      key={bk.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-slate-100">
                        <div className="flex items-center gap-2.5">
                          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                            <Database className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <span className="font-mono text-xs">{bk.backup_name}</span>
                            {bk.academic_year && (
                              <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                {bk.academic_year}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                        {formatDateTime(bk.created_at)}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-700 dark:text-slate-300">
                        {formatFileSize(bk.file_size_kb)}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-700 dark:text-slate-300">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono text-[11px]">
                          {bk.total_records.toLocaleString()} rows
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {bk.status === "completed" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Completed
                          </span>
                        ) : bk.status === "failed" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-red-500/15 text-red-900 dark:bg-red-500/20 dark:text-red-300 border border-red-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                            Failed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-900 dark:bg-amber-500/20 dark:text-amber-300 border border-amber-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            Processing
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-2 justify-end">
                          <button
                            type="button"
                            onClick={() => setInspectedBackup(bk)}
                            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition cursor-pointer flex items-center gap-1"
                            title="Inspect details"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Inspect</span>
                          </button>

                          <a
                            href={`/api/admin/backups/download?id=${bk.id}`}
                            download
                            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 transition cursor-pointer flex items-center gap-1 shadow-sm"
                            title="Download JSON Snapshot"
                          >
                            <Download className="w-3 h-3" />
                            <span>JSON</span>
                          </a>

                          <button
                            type="button"
                            onClick={() => setBackupToDelete(bk)}
                            className="p-1 text-red-500 hover:bg-red-500/10 rounded-lg transition cursor-pointer"
                            title="Delete backup log"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

      {/* SECTION 2: Academic Year Archiving Vault */}
      <section className="space-y-4 pt-4 border-t border-slate-300 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-400 dark:border-slate-800 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Archive className="w-4 h-4 text-emerald-500" />
              <span>Academic Year Archiving Vault</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Preserve and freeze completed semester compliance cycles into the permanent historical archive.
            </p>
          </div>

          {/* Archiving Selector Box */}
          <div className="flex items-center gap-2">
            <select
              value={selectedTermToArchive}
              onChange={(e) => setSelectedTermToArchive(e.target.value)}
              className="bg-white dark:bg-slate-950 border border-slate-400 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl px-3 py-1.5 text-xs outline-none focus:border-amber-500 transition cursor-pointer"
            >
              {activeTermsToArchive.length === 0 ? (
                <option value="">No Active Terms to Archive</option>
              ) : (
                activeTermsToArchive.map((t) => (
                  <option key={`${t.academic_year}__${t.semester}`} value={`${t.academic_year}__${t.semester}`}>
                    {t.academic_year} ({t.semester})
                  </option>
                ))
              )}
            </select>

            <button
              type="button"
              disabled={!selectedTermToArchive || activeTermsToArchive.length === 0}
              onClick={() => setIsArchiveModalOpen(true)}
              className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-950 font-semibold rounded-xl text-xs px-3.5 py-1.5 transition shadow-sm cursor-pointer disabled:opacity-40 whitespace-nowrap"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>Archive Selected Term</span>
            </button>
          </div>
        </div>

        {/* Archived Terms Table */}
        <div className="rounded-2xl border border-slate-400 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden transition-colors">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-300 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  <th className="py-3.5 px-4">Academic Year & Semester</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Preserved Documents</th>
                  <th className="py-3.5 px-4">Archive Date</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80">
                {archivedTerms.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-500">
                      <Archive className="w-7 h-7 mx-auto mb-2 text-slate-400 opacity-60" />
                      <p className="font-semibold text-slate-700 dark:text-slate-300">No archived academic terms</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Select an active academic term above to archive and freeze submissions.
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
                          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                            <Calendar className="w-3.5 h-3.5" />
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
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                          Archived
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-700 dark:text-slate-300">
                        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                          <FileCheck className="w-3.5 h-3.5" />
                          <span>Protected & Retained</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                        {formatDateTime(term.archived_at)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setInspectedTerm(term)}
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition cursor-pointer inline-flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" />
                          <span>View Vault Details</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Archive Warning Modal */}
      {isArchiveModalOpen && selectedTermToArchive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-400 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl text-slate-900 dark:text-slate-100">
            <div className="flex items-center gap-3 text-amber-500 mb-3">
              <div className="p-2 rounded-xl bg-amber-500/10">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold">Archive Academic Term?</h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              You are about to archive{" "}
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {selectedTermToArchive.replace("__", " - ")}
              </span>
              .
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
              Archiving will freeze active faculty submissions for this cycle into the historical compliance vault. The term will no longer accept active submissions.
            </p>
            <div className="flex items-center justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => setIsArchiveModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isArchiving}
                onClick={() => void handleArchiveTermConfirm()}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition cursor-pointer disabled:opacity-50"
              >
                {isArchiving ? "Archiving..." : "Confirm & Archive Term"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Backup Inspection Modal */}
      {inspectedBackup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-400 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl text-slate-900 dark:text-slate-100 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-300 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
                  <Database className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold truncate">{inspectedBackup.backup_name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectedBackup(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-100 hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800">
                <div>
                  <span className="text-[11px] text-slate-500 uppercase tracking-wider block">Created Date</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{formatDateTime(inspectedBackup.created_at)}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 uppercase tracking-wider block">File Size</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{formatFileSize(inspectedBackup.file_size_kb)}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 uppercase tracking-wider block">Total Records</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{inspectedBackup.total_records.toLocaleString()} items</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 uppercase tracking-wider block">Status</span>
                  <span className="font-semibold text-emerald-600 capitalize">{inspectedBackup.status}</span>
                </div>
              </div>

              {inspectedBackup.metadata && (
                <div className="space-y-1.5 pt-2">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Snapshot Data Breakdown
                  </h4>
                  <ul className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-300 dark:border-slate-800 rounded-xl overflow-hidden text-xs">
                    <li className="p-2.5 flex justify-between bg-slate-50/50 dark:bg-slate-950/40">
                      <span className="text-slate-600 dark:text-slate-400">User Profiles & Accounts:</span>
                      <span className="font-mono font-semibold">{inspectedBackup.metadata.users_count ?? 0}</span>
                    </li>
                    <li className="p-2.5 flex justify-between bg-slate-50/50 dark:bg-slate-950/40">
                      <span className="text-slate-600 dark:text-slate-400">Academic Terms:</span>
                      <span className="font-mono font-semibold">{inspectedBackup.metadata.terms_count ?? 0}</span>
                    </li>
                    <li className="p-2.5 flex justify-between bg-slate-50/50 dark:bg-slate-950/40">
                      <span className="text-slate-600 dark:text-slate-400">Faculty Submissions:</span>
                      <span className="font-mono font-semibold">{inspectedBackup.metadata.submissions_count ?? 0}</span>
                    </li>
                    <li className="p-2.5 flex justify-between bg-slate-50/50 dark:bg-slate-950/40">
                      <span className="text-slate-600 dark:text-slate-400">Requirement Templates:</span>
                      <span className="font-mono font-semibold">{inspectedBackup.metadata.templates_count ?? 0}</span>
                    </li>
                    <li className="p-2.5 flex justify-between bg-slate-50/50 dark:bg-slate-950/40">
                      <span className="text-slate-600 dark:text-slate-400">System Audit Logs:</span>
                      <span className="font-mono font-semibold">{inspectedBackup.metadata.audit_logs_count ?? 0}</span>
                    </li>
                  </ul>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-300 dark:border-slate-800">
              <a
                href={`/api/admin/backups/download?id=${inspectedBackup.id}`}
                download
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition cursor-pointer flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download JSON</span>
              </a>
              <button
                type="button"
                onClick={() => setInspectedBackup(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700"
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
          <div className="w-full max-w-md rounded-2xl border border-slate-400 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-300 dark:border-slate-800">
              <div className="flex items-center gap-2 text-emerald-500">
                <Archive className="w-5 h-5" />
                <h3 className="text-base font-bold">Archive Vault Inspection</h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectedTerm(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-100 hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Academic Year:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{inspectedTerm.academic_year}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Semester:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{inspectedTerm.semester}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Vault Status:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">Archived & Retained</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                All submitted grade sheets, syllabi, midterm/final exam packages, and verification records for this cycle remain secured in cloud storage and available in historical compliance reports.
              </p>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-300 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setInspectedTerm(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700"
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
          <div className="w-full max-w-md rounded-2xl border border-slate-400 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl text-slate-900 dark:text-slate-100">
            <div className="flex items-center gap-3 text-red-500 mb-3">
              <div className="p-2 rounded-xl bg-red-500/10">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold">Delete Backup Record</h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Are you sure you want to delete backup log <span className="font-semibold text-slate-900 dark:text-slate-100">"{backupToDelete.backup_name}"</span>?
            </p>
            <div className="flex items-center justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => setBackupToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => void handleDeleteBackup()}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-500 text-white transition cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
