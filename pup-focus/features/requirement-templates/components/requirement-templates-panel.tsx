"use client";

import { useEffect, useState, useMemo } from "react";
import {
  FileText,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Archive,
  Trash2,
  Edit2,
  RefreshCw,
  Layers,
  FileCheck,
} from "lucide-react";
import type { RequirementTemplate } from "@/features/requirement-templates/types/requirement-template.types";
import { RequirementTemplateModal } from "./requirement-template-modal";

export function RequirementTemplatesPanel() {
  const [templates, setTemplates] = useState<RequirementTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "archived">("all");

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [templateToEdit, setTemplateToEdit] = useState<RequirementTemplate | null>(null);
  const [templateToDelete, setTemplateToDelete] = useState<RequirementTemplate | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState<string | null>(null);

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
  }, []);

  const filteredTemplates = useMemo(() => {
    return templates.filter((tpl) => {
      const matchesSearch =
        tpl.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tpl.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (tpl.description && tpl.description.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && tpl.is_active) ||
        (statusFilter === "archived" && !tpl.is_active);

      return matchesSearch && matchesStatus;
    });
  }, [templates, searchQuery, statusFilter]);

  const stats = useMemo(() => {
    const total = templates.length;
    const active = templates.filter((t) => t.is_active).length;
    const mandatory = templates.filter((t) => t.is_mandatory && t.is_active).length;
    return { total, active, mandatory };
  }, [templates]);

  const handleOpenAddModal = () => {
    setTemplateToEdit(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (tpl: RequirementTemplate) => {
    setTemplateToEdit(tpl);
    setIsModalOpen(true);
  };

  const handleToggleActive = async (tpl: RequirementTemplate) => {
    try {
      setIsTogglingStatus(tpl.id);
      setError(null);
      const res = await fetch("/api/admin/requirement-templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: tpl.id,
          is_active: !tpl.is_active,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update status");
      }

      setSuccess(`Requirement "${tpl.title}" ${tpl.is_active ? "archived" : "activated"} successfully.`);
      setTimeout(() => setSuccess(null), 4000);
      await loadTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error updating template status");
    } finally {
      setIsTogglingStatus(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!templateToDelete) return;

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
    <article className="space-y-6">
      {/* Header Banner */}
      <section className="relative overflow-hidden rounded-2xl border border-slate-400 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-7 shadow-sm transition-colors">
        <div className="relative z-10 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-700 dark:text-amber-400">
              Academic Cycle Management
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Dynamic Requirement Checklist Builder
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 font-normal">
            Manage and configure required faculty compliance documents across academic cycles.
          </p>
        </div>
      </section>

      {/* 3-Card Stat Summary Header */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-400 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Total Templates</span>
            <Layers className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="mt-2">
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              {stats.total}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Configured document requirements
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-400 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Active Requirements</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-2">
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              {stats.active}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Currently active in submission checklist
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-400 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Mandatory Items</span>
            <FileCheck className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="mt-2">
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              {stats.mandatory}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Enforced for faculty compliance
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

      {/* Actions & Filters Bar */}
      <section className="rounded-2xl border border-slate-400 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3 transition-colors">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search requirement templates by title or code..."
              className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-amber-500 transition"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* Status Pills */}
            <div className="flex items-center rounded-xl bg-slate-100 dark:bg-slate-800/80 p-1 border border-slate-300 dark:border-slate-700">
              {(["all", "active", "archived"] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg capitalize transition-all cursor-pointer ${
                    statusFilter === st
                      ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* Refresh */}
            <button
              type="button"
              onClick={() => void loadTemplates()}
              className="p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer"
              title="Refresh templates"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>

            {/* Add Button */}
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-xl text-xs sm:text-sm px-4 py-2 transition shadow-sm cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Add Requirement Template</span>
            </button>
          </div>
        </div>
      </section>

      {/* Main Data Table */}
      <section className="rounded-2xl border border-slate-400 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-300 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                <th className="py-3.5 px-4">Document Title & Code</th>
                <th className="py-3.5 px-4">Allowed Formats</th>
                <th className="py-3.5 px-4">Max Size</th>
                <th className="py-3.5 px-4">Mandatory</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-500" />
                    Loading requirement templates...
                  </td>
                </tr>
              ) : filteredTemplates.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <FileText className="w-8 h-8 mx-auto mb-2 text-slate-400 opacity-60" />
                    <p className="font-semibold text-slate-700 dark:text-slate-300">No requirement templates found</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {searchQuery ? "Try modifying your search filter" : "Get started by adding a new requirement template"}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredTemplates.map((tpl) => (
                  <tr
                    key={tpl.id}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    {/* Column 1: Document Title & Code */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 dark:text-slate-100 text-xs sm:text-sm">
                            {tpl.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
                              {tpl.code}
                            </span>
                            {tpl.description ? (
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-xs">
                                • {tpl.description}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Column 2: Allowed Formats */}
                    <td className="py-3.5 px-4">
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
                    <td className="py-3.5 px-4">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {tpl.max_size_mb} MB
                      </span>
                    </td>

                    {/* Column 4: Mandatory */}
                    <td className="py-3.5 px-4">
                      {tpl.is_mandatory ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-900 dark:bg-amber-500/20 dark:text-amber-300 border border-amber-500/30">
                          Required
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700">
                          Optional
                        </span>
                      )}
                    </td>

                    {/* Column 5: Status */}
                    <td className="py-3.5 px-4">
                      {tpl.is_active ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                          Archived
                        </span>
                      )}
                    </td>

                    {/* Column 6: Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(tpl)}
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition cursor-pointer flex items-center gap-1"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>

                        <button
                          type="button"
                          disabled={isTogglingStatus === tpl.id}
                          onClick={() => void handleToggleActive(tpl)}
                          className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition cursor-pointer flex items-center gap-1 ${
                            tpl.is_active
                              ? "bg-slate-100 hover:bg-amber-50 dark:bg-slate-800 dark:hover:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-slate-300 dark:border-slate-700"
                              : "bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700/50"
                          }`}
                        >
                          <Archive className="w-3 h-3" />
                          <span>{tpl.is_active ? "Archive" : "Activate"}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setTemplateToDelete(tpl)}
                          className="p-1 text-red-500 hover:bg-red-500/10 rounded-lg transition cursor-pointer"
                          title="Delete template"
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
      </section>

      {/* Add / Edit Modal */}
      <RequirementTemplateModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={() => void loadTemplates()}
        templateToEdit={templateToEdit}
      />

      {/* Delete Confirmation Modal */}
      {templateToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-400 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl text-slate-900 dark:text-slate-100">
            <div className="flex items-center gap-3 text-red-500 mb-3">
              <div className="p-2 rounded-xl bg-red-500/10">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold">Delete Requirement Template</h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Are you sure you want to delete <span className="font-semibold text-slate-900 dark:text-slate-100">"{templateToDelete.title}"</span> ({templateToDelete.code})?
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
              Note: If faculty have already submitted documents for this requirement, archiving it instead is recommended.
            </p>
            <div className="flex items-center justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => setTemplateToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => void handleDeleteConfirm()}
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
