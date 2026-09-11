"use client";

import { useEffect, useState, useMemo } from "react";
import {
  EditPencil,
  Eye,
  EyeClosed,
  MultiplePages,
  Page,
  Plus,
  Refresh,
  Search,
  Trash,
  WarningTriangle,
  Xmark,
} from "iconoir-react";
import type { RequirementTemplate } from "@/features/requirement-templates/types/requirement-template.types";
import { RequirementTemplateModal } from "./requirement-template-modal";

interface RequirementTemplatesPanelProps {
  refreshTrigger?: number;
}

export function RequirementTemplatesPanel({
  refreshTrigger,
}: RequirementTemplatesPanelProps) {
  const [templates, setTemplates] = useState<RequirementTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "hidden">("all");

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [templateToEdit, setTemplateToEdit] = useState<RequirementTemplate | null>(null);
  const [templateToDelete, setTemplateToDelete] = useState<RequirementTemplate | null>(null);
  const [countdown, setCountdown] = useState<number>(10);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState<string | null>(null);
  const [isRestoringDefaults, setIsRestoringDefaults] = useState(false);

  const loadTemplates = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch("/api/admin/requirement-templates");
      if (!res.ok) {
        throw new Error("Failed to load requirement templates");
      }
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading requirement templates");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadTemplates();
  }, [refreshTrigger]);

  // 10-second countdown timer for delete confirmation
  useEffect(() => {
    if (!templateToDelete) {
      setCountdown(10);
      return;
    }

    setCountdown(10);
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [templateToDelete]);

  const filteredTemplates = useMemo(() => {
    return templates.filter((tpl) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        tpl.title.toLowerCase().includes(q) ||
        tpl.code.toLowerCase().includes(q) ||
        (tpl.description && tpl.description.toLowerCase().includes(q));

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && tpl.is_active) ||
        (statusFilter === "hidden" && !tpl.is_active);

      return matchesSearch && matchesStatus;
    });
  }, [templates, searchQuery, statusFilter]);

  const stats = useMemo(() => {
    const total = templates.length;
    const active = templates.filter((t) => t.is_active).length;
    const hidden = templates.filter((t) => !t.is_active).length;
    return { total, active, hidden };
  }, [templates]);

  const handleOpenAddModal = () => {
    setTemplateToEdit(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (tpl: RequirementTemplate) => {
    setTemplateToEdit(tpl);
    setIsModalOpen(true);
  };

  const handleToggleHide = async (tpl: RequirementTemplate) => {
    const willBeActive = !tpl.is_active;
    try {
      setIsTogglingStatus(tpl.id);
      setError(null);
      const res = await fetch("/api/admin/requirement-templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: tpl.id,
          is_active: willBeActive,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update visibility");
      }

      setSuccess(
        willBeActive
          ? `Requirement "${tpl.title}" is now active and visible to faculty.`
          : `Requirement "${tpl.title}" is now hidden from faculty submission.`
      );
      setTimeout(() => setSuccess(null), 4000);
      await loadTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error updating template visibility");
    } finally {
      setIsTogglingStatus(null);
    }
  };

  const handleRestoreDefaults = async () => {
    try {
      setIsRestoringDefaults(true);
      setError(null);
      const res = await fetch("/api/admin/requirement-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore_defaults" }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to restore default requirement templates");
      }

      setSuccess(
        data.restoredCount > 0
          ? `Restored ${data.restoredCount} default requirement templates.`
          : "All standard faculty & admin requirement templates are already intact."
      );
      setTimeout(() => setSuccess(null), 4000);
      await loadTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error restoring default templates");
    } finally {
      setIsRestoringDefaults(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!templateToDelete || countdown > 0) return;

    try {
      setIsDeleting(true);
      setError(null);
      const res = await fetch(`/api/admin/requirement-templates?id=${templateToDelete.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete requirement template");
      }

      setSuccess(`Requirement template "${templateToDelete.title}" deleted.`);
      setTimeout(() => setSuccess(null), 4000);
      setTemplateToDelete(null);
      await loadTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error deleting template");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* 3-Card Stat Summary Header matching AdminStatsCards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {/* 1. TOTAL TEMPLATES */}
        <div className="rounded-2xl bg-white text-slate-900 border border-slate-300 shadow-xs dark:bg-slate-900 dark:text-slate-100 dark:border-slate-800 p-5 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider">
              Total Templates
            </span>
            <MultiplePages className="h-5 w-5 text-slate-400" strokeWidth={2} />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
            {isLoading ? "..." : stats.total}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Configured compliance documents
          </p>
        </div>

        {/* 2. ACTIVE REQUIREMENTS */}
        <div className="rounded-2xl bg-white text-slate-900 border border-slate-300 shadow-xs dark:bg-slate-900 dark:text-slate-100 dark:border-slate-800 p-5 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider">
              Active Requirements
            </span>
            <span className="w-2 h-2 rounded-full bg-[#0b5336]" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
            {isLoading ? "..." : stats.active}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Visible in faculty checklist
          </p>
        </div>

        {/* 3. HIDDEN REQUIREMENTS */}
        <div className="rounded-2xl bg-white text-slate-900 border border-slate-300 shadow-xs dark:bg-slate-900 dark:text-slate-100 dark:border-slate-800 p-5 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider">
              Hidden Requirements
            </span>
            <span className="w-2 h-2 rounded-full bg-[#780000]" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
            {isLoading ? "..." : stats.hidden}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Hidden from faculty view
          </p>
        </div>
      </div>

      {/* Notifications */}
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

      {/* Filter & Actions Bar matching AdminFilterBar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-white text-slate-900 border border-slate-300 shadow-xs dark:bg-slate-900 dark:text-slate-100 dark:border-slate-800 rounded-2xl mb-6 transition-colors">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5 w-full sm:w-auto flex-wrap">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search templates by title or code..."
              className="w-full sm:w-64 h-9 rounded-xl bg-white text-slate-900 border border-slate-300 focus:border-slate-400 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-800 dark:focus:border-slate-600 pl-8 pr-3 text-xs placeholder-slate-400 dark:placeholder-slate-500 outline-none transition"
            />
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700">
            {(["all", "active", "hidden"] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg capitalize transition-all cursor-pointer ${
                  statusFilter === st
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-2xs font-semibold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800/60"
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={() => void handleRestoreDefaults()}
            disabled={isRestoringDefaults || isLoading}
            className="px-3 py-2 rounded-xl text-xs font-medium border border-slate-300 dark:border-slate-700 bg-white hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition cursor-pointer disabled:opacity-50"
            title="Restore default faculty/admin requirement files if missing"
          >
            {isRestoringDefaults ? "Restoring..." : "Restore Defaults"}
          </button>

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-600 font-semibold px-4 py-2 rounded-xl text-xs transition-all shadow-xs cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            <span>+ Add Requirement Template</span>
          </button>
        </div>
      </div>

      {/* Main Data Table matching adaptive table standard */}
      <div className="w-full overflow-x-auto rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm shadow-slate-300/50 dark:shadow-none overflow-hidden transition-colors">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead className="border-b border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 text-[11px] font-bold uppercase tracking-wider">
            <tr>
              <th className="py-3 px-4">Document Title & Description</th>
              <th className="py-3 px-4">Allowed Formats</th>
              <th className="py-3 px-4">Max Size</th>
              <th className="py-3 px-4">Requirement Type</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-300 dark:divide-slate-800/60 text-xs">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-slate-500 dark:text-slate-400">
                  <Refresh className="h-5 w-5 animate-spin mx-auto mb-2 text-amber-500" strokeWidth={2} />
                  Loading requirement templates...
                </td>
              </tr>
            ) : filteredTemplates.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-500 dark:text-slate-400">
                  <Page className="h-8 w-8 mx-auto mb-2 text-slate-400 opacity-60" strokeWidth={2} />
                  <p className="font-semibold text-slate-700 dark:text-slate-300">No requirement templates found</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {searchQuery
                      ? "Try modifying your search filter"
                      : "Get started by adding a requirement template or restoring defaults"}
                  </p>
                </td>
              </tr>
            ) : (
              filteredTemplates.map((tpl) => (
                <tr
                  key={tpl.id}
                  className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                >
                  {/* Column 1: Document Title & Description */}
                  <td className="py-3 px-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 mt-0.5 shrink-0">
                        <Page className="h-4 w-4" strokeWidth={2} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-slate-100 text-xs sm:text-sm">
                          {tpl.title}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-[10px] px-1.5 py-0.2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded">
                            {tpl.code}
                          </span>
                          {tpl.description ? (
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-sm">
                              • {tpl.description}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Column 2: Allowed Formats */}
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1">
                      {tpl.allowed_formats.map((fmt) => (
                        <span
                          key={fmt}
                          className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700"
                        >
                          {fmt}
                        </span>
                      ))}
                    </div>
                  </td>

                  {/* Column 3: Max Size */}
                  <td className="py-3 px-4">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {tpl.max_size_mb} MB
                    </span>
                  </td>

                  {/* Column 4: Mandatory */}
                  <td className="py-3 px-4">
                    {tpl.is_mandatory ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-500/15 text-amber-900 border border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-400/30">
                        Mandatory
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700">
                        Optional
                      </span>
                    )}
                  </td>

                  {/* Column 5: Status */}
                  <td className="py-3 px-4">
                    {tpl.is_active ? (
                      <span className="bg-[#0b5336] text-white border border-[#08412a] px-2 py-0.5 text-xs font-semibold rounded-md inline-flex items-center gap-1.5 shadow-2xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
                        Active
                      </span>
                    ) : (
                      <span className="bg-[#780000] text-white border border-[#5e0000] px-2 py-0.5 text-xs font-semibold rounded-md inline-flex items-center gap-1.5 shadow-2xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-300" />
                        Hidden
                      </span>
                    )}
                  </td>

                  {/* Column 6: Actions */}
                  <td className="py-3 px-4 text-right">
                    <div className="inline-flex items-center gap-1.5 justify-end">
                      {/* Edit Button */}
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(tpl)}
                        className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:text-slate-300 dark:border-slate-700 text-xs font-medium rounded-md px-2.5 py-1 transition-colors cursor-pointer inline-flex items-center gap-1"
                      >
                        <EditPencil className="h-3.5 w-3.5" strokeWidth={2} />
                        <span>Edit</span>
                      </button>

                      {/* Hide / Unhide Button */}
                      <button
                        type="button"
                        disabled={isTogglingStatus === tpl.id}
                        onClick={() => void handleToggleHide(tpl)}
                        className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:text-slate-300 dark:border-slate-700 text-xs font-medium rounded-md px-2.5 py-1 transition-colors cursor-pointer inline-flex items-center gap-1"
                        title={tpl.is_active ? "Hide requirement from faculty" : "Unhide requirement for faculty"}
                      >
                        {tpl.is_active ? (
                          <>
                            <EyeClosed className="h-3.5 w-3.5" strokeWidth={2} />
                            <span>Hide</span>
                          </>
                        ) : (
                          <>
                            <Eye className="h-3.5 w-3.5" strokeWidth={2} />
                            <span>Unhide</span>
                          </>
                        )}
                      </button>

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={() => setTemplateToDelete(tpl)}
                        className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-md transition cursor-pointer"
                        title="Delete requirement template"
                      >
                        <Trash className="h-4 w-4" strokeWidth={2} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Modal */}
      <RequirementTemplateModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={() => void loadTemplates()}
        templateToEdit={templateToEdit}
      />

      {/* Delete Confirmation Modal with 10-Second Safety Timer */}
      {templateToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl text-slate-900 dark:text-slate-100">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-300 dark:border-slate-800">
              <div className="flex items-center gap-2.5 text-red-500">
                <div className="p-2 rounded-xl bg-red-500/10">
                  <WarningTriangle className="h-5 w-5 text-red-500" strokeWidth={2} />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Delete Requirement Template
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setTemplateToDelete(null)}
                className="rounded-lg border border-[#5e0000] bg-[#780000] hover:bg-[#5e0000] text-white p-1.5 transition-colors cursor-pointer shadow-2xs"
                aria-label="Close dialog"
              >
                <Xmark className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>

            {/* Description & Warnings */}
            <div className="space-y-3">
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                Are you sure you want to permanently delete{" "}
                <strong className="text-slate-900 dark:text-slate-100">
                  "{templateToDelete.title}"
                </strong>{" "}
                ({templateToDelete.code})?
              </p>

              <div className="rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-950/20 p-3 text-xs text-amber-800 dark:text-amber-400 space-y-1">
                <p className="font-semibold">Safety Notice:</p>
                <p>
                  If faculty members have already submitted files for this requirement, deleting it will remove the template definition. To temporarily suspend submissions without deleting the template, use the <strong>Hide</strong> option instead.
                </p>
              </div>

              {countdown > 0 ? (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  Safety lock active. The confirmation button will be available in{" "}
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {countdown} seconds
                  </span>
                  .
                </p>
              ) : null}
            </div>

            {/* Footer Actions */}
            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setTemplateToDelete(null)}
                className="px-4 py-2 rounded-xl bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] text-xs font-semibold transition cursor-pointer shadow-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting || countdown > 0}
                onClick={() => void handleDeleteConfirm()}
                className="bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] text-xs font-semibold px-4 py-2 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-xs"
              >
                {isDeleting
                  ? "Deleting..."
                  : countdown > 0
                  ? `Confirm Delete (${countdown}s)`
                  : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
