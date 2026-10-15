"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Check,
  CheckCircle,
  Eye,
  EyeClosed,
  GraduationCap,
  Page,
  Plus,
  Refresh,
  Search,
  Trash,
  WarningCircle,
  Xmark,
  EditPencil,
} from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";
import { ModalHeader } from "@/components/ui/modal-header";
import { RequirementTemplatesPanel } from "@/features/requirement-templates/components/requirement-templates-panel";

export interface ProgramItem {
  id: string;
  code: string;
  name: string;
  description?: string;
  is_hidden: boolean;
  created_at?: string;
}

const DEFAULT_FALLBACK_PROGRAMS: ProgramItem[] = [
  { id: "p-beed", code: "BEED", name: "Bachelor of Elementary Education", is_hidden: false },
  { id: "p-bsa", code: "BSA", name: "Bachelor of Science in Accountancy", is_hidden: false },
  { id: "p-bsma", code: "BSMA", name: "Bachelor of Science in Management Accounting", is_hidden: false },
  { id: "p-bsie", code: "BSIE", name: "Bachelor of Science in Industrial Engineering", is_hidden: false },
  { id: "p-bsit", code: "BSIT", name: "Bachelor of Science in Information Technology", is_hidden: false },
  { id: "p-bsbahrm", code: "BSBAHRM", name: "Bachelor of Science in Business Administration major in Human Resource Management", is_hidden: false },
  { id: "p-bsent", code: "BSEnt", name: "Bachelor of Science in Entrepreneurship", is_hidden: false },
  { id: "p-dit", code: "DIT", name: "Diploma in Information Technology", is_hidden: false },
  { id: "p-domt", code: "DOMT-LOM", name: "Diploma in Office Management Technology major in Legal Office Management", is_hidden: false },
];

export interface TemplatesAndProgramsPanelProps {
  initialTab?: "templates" | "programs";
  refreshTrigger?: number;
}

export function TemplatesAndProgramsPanel({
  initialTab = "templates",
  refreshTrigger,
}: TemplatesAndProgramsPanelProps) {
  const [activeTab, setActiveTab] = useState<"templates" | "programs">(initialTab);

  // Sync if initialTab prop changes
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Program Management States
  const [programs, setPrograms] = useState<ProgramItem[]>(DEFAULT_FALLBACK_PROGRAMS);
  const [isLoadingPrograms, setIsLoadingPrograms] = useState<boolean>(true);
  const [isRefreshingPrograms, setIsRefreshingPrograms] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [visibilityFilter, setVisibilityFilter] = useState<"all" | "active" | "hidden">("all");

  // Program Modals & Forms
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isAddProgramOpen, setIsAddProgramOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<ProgramItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProgramItem | null>(null);
  const [deleteCountdown, setDeleteCountdown] = useState<number>(10);

  const [programCodeInput, setProgramCodeInput] = useState("");
  const [programNameInput, setProgramNameInput] = useState("");
  const [programDescInput, setProgramDescInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-dismiss feedback
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  // 10-second countdown timer for delete confirmation
  useEffect(() => {
    if (!deleteTarget) {
      setDeleteCountdown(10);
      return;
    }
    setDeleteCountdown(10);
    const timer = setInterval(() => {
      setDeleteCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [deleteTarget]);

  const loadPrograms = async (showLoadingSpinner = true) => {
    if (showLoadingSpinner) setIsLoadingPrograms(true);
    setIsRefreshingPrograms(true);
    try {
      const pRes = await fetch("/api/programs?includeHidden=true", { cache: "no-store" });
      if (pRes.ok) {
        const pData = await pRes.json();
        if (Array.isArray(pData.programs) && pData.programs.length > 0) {
          setPrograms(pData.programs);
        }
      }
    } catch {
      // Keep fallbacks
    } finally {
      setIsLoadingPrograms(false);
      setIsRefreshingPrograms(false);
    }
  };

  useEffect(() => {
    void loadPrograms(true);
  }, [refreshTrigger]);

  const filteredPrograms = useMemo(() => {
    return programs.filter((p) => {
      const matchesSearch =
        p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.description || "").toLowerCase().includes(searchQuery.toLowerCase());

      const matchesVisibility =
        visibilityFilter === "all" ||
        (visibilityFilter === "active" && !p.is_hidden) ||
        (visibilityFilter === "hidden" && p.is_hidden);

      return matchesSearch && matchesVisibility;
    });
  }, [programs, searchQuery, visibilityFilter]);

  const totalPrograms = programs.length;
  const activeProgramsCount = programs.filter((p) => !p.is_hidden).length;
  const hiddenProgramsCount = programs.filter((p) => p.is_hidden).length;

  const handleToggleHideProgram = async (program: ProgramItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = !program.is_hidden;

    setPrograms((prev) =>
      prev.map((p) => (p.id === program.id ? { ...p, is_hidden: newStatus } : p))
    );

    try {
      const res = await fetch("/api/programs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: program.id, is_hidden: newStatus }),
      });

      if (!res.ok) {
        throw new Error("Failed to update program visibility.");
      }

      setFeedback({
        type: "success",
        message: `Program ${program.code} is now ${newStatus ? "hidden from dropdowns" : "active and visible"}.`,
      });
    } catch (err) {
      setPrograms((prev) =>
        prev.map((p) => (p.id === program.id ? { ...p, is_hidden: program.is_hidden } : p))
      );
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to toggle visibility.",
      });
    }
  };

  const handleOpenAddModal = () => {
    setProgramCodeInput("");
    setProgramNameInput("");
    setProgramDescInput("");
    setIsAddProgramOpen(true);
  };

  const handleOpenEditModal = (prog: ProgramItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProgram(prog);
    setProgramCodeInput(prog.code);
    setProgramNameInput(prog.name);
    setProgramDescInput(prog.description || "");
  };

  const handleSubmitProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!programCodeInput.trim() || !programNameInput.trim()) {
      setFeedback({ type: "error", message: "Program code and name are required." });
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingProgram) {
        const res = await fetch("/api/programs", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingProgram.id,
            code: programCodeInput.trim().toUpperCase(),
            name: programNameInput.trim(),
            description: programDescInput.trim(),
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to update program.");
        }

        const data = await res.json();
        setPrograms((prev) =>
          prev.map((p) =>
            p.id === editingProgram.id
              ? {
                  ...p,
                  code: programCodeInput.trim().toUpperCase(),
                  name: programNameInput.trim(),
                  description: programDescInput.trim(),
                }
              : p
          )
        );

        setEditingProgram(null);
        setFeedback({
          type: "success",
          message: `Program ${data.program?.code || programCodeInput} updated successfully.`,
        });
      } else {
        const res = await fetch("/api/programs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: programCodeInput.trim().toUpperCase(),
            name: programNameInput.trim(),
            description: programDescInput.trim(),
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to create program.");
        }

        const data = await res.json();
        const newProg = data.program;
        setPrograms((prev) => [
          {
            id: newProg?.id || `prog-${Date.now()}`,
            code: programCodeInput.trim().toUpperCase(),
            name: programNameInput.trim(),
            description: programDescInput.trim(),
            is_hidden: false,
          },
          ...prev,
        ]);

        setIsAddProgramOpen(false);
        setFeedback({
          type: "success",
          message: `Program ${programCodeInput.toUpperCase()} added successfully!`,
        });
      }
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Error saving program.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/programs?id=${encodeURIComponent(deleteTarget.id)}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to delete program.");
      }

      setPrograms((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setDeleteTarget(null);
      setFeedback({
        type: "success",
        message: `Program ${deleteTarget.code} deleted successfully.`,
      });
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to delete program.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <article className="space-y-6 p-2 sm:p-4 md:p-5">
      {/* Solid Amber Card Header */}
      <div className="relative overflow-hidden rounded-2xl border-2 border-amber-500 dark:border-amber-500/70 bg-amber-400 dark:bg-[#2a1705] p-5 sm:p-6 shadow-md shadow-amber-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-950 dark:text-amber-100 tracking-tight">
            Requirement Templates & Academic Programs
          </h1>
          <p className="mt-1.5 text-sm sm:text-base text-amber-950/90 dark:text-amber-200/90 font-medium leading-relaxed max-w-3xl">
            Configure compliance submission document checklists and manage degree programs for PUP Bataan campus.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              if (activeTab === "programs") {
                void loadPrograms(false);
              }
            }}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 px-3.5 py-2 sm:py-1.5 text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer shadow-xs active:scale-[0.98]"
            title="Refresh active panel data"
          >
            <AppIcon icon={Refresh} size="sm" className={isRefreshingPrograms ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Floating Feedback Alert */}
      {feedback && (
        <div
          className={`flex items-center justify-between gap-3 p-4 rounded-xl border text-sm font-medium shadow-md transition-all ${
            feedback.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800"
              : "bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 border-rose-300 dark:border-rose-800"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === "success" ? (
              <AppIcon icon={CheckCircle} size="sm" color="inherit" />
            ) : (
              <AppIcon icon={WarningCircle} size="sm" color="inherit" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-current cursor-pointer"
          >
            <AppIcon icon={Xmark} size="xs" color="inherit" />
          </button>
        </div>
      )}

      {/* Segmented Workspace Tabs */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setActiveTab("templates")}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeTab === "templates"
              ? "bg-[#780000] text-white shadow-xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-slate-200"
          }`}
        >
          <AppIcon icon={Page} size="sm" color="inherit" />
          <span>Requirement Templates</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("programs")}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeTab === "programs"
              ? "bg-[#780000] text-white shadow-xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-slate-200"
          }`}
        >
          <AppIcon icon={GraduationCap} size="sm" color="inherit" />
          <span>Academic Programs</span>
          <span
            className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
              activeTab === "programs"
                ? "bg-amber-400 text-slate-950"
                : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
            }`}
          >
            {programs.length}
          </span>
        </button>
      </div>

      {/* ─── TAB 1: REQUIREMENT TEMPLATES ────────────────────────── */}
      {activeTab === "templates" && (
        <div className="space-y-4">
          <RequirementTemplatesPanel refreshTrigger={refreshTrigger} />
        </div>
      )}

      {/* ─── TAB 2: ACADEMIC PROGRAMS ────────────────────────────── */}
      {activeTab === "programs" && (
        <div className="space-y-6">
          {/* Quick Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="p-4 rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span className="text-xs font-bold uppercase tracking-wider">Total Degree Programs</span>
                <AppIcon icon={GraduationCap} size="sm" />
              </div>
              <p className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">{totalPrograms}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Bataan campus degree offerings</p>
            </div>

            <div className="p-4 rounded-2xl border border-emerald-300/80 dark:border-emerald-800/80 bg-emerald-50/60 dark:bg-emerald-950/20 shadow-xs">
              <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-300">
                <span className="text-xs font-bold uppercase tracking-wider">Active & Visible</span>
                <AppIcon icon={Check} size="sm" />
              </div>
              <p className="mt-2 text-2xl font-black text-emerald-900 dark:text-emerald-100">{activeProgramsCount}</p>
              <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80 mt-0.5">Available for faculty selection</p>
            </div>

            <div className="p-4 rounded-2xl border border-amber-300/80 dark:border-amber-800/80 bg-amber-50/60 dark:bg-amber-950/20 shadow-xs">
              <div className="flex items-center justify-between text-amber-700 dark:text-amber-300">
                <span className="text-xs font-bold uppercase tracking-wider">Hidden Offerings</span>
                <AppIcon icon={EyeClosed} size="sm" />
              </div>
              <p className="mt-2 text-2xl font-black text-amber-900 dark:text-amber-100">{hiddenProgramsCount}</p>
              <p className="text-xs text-amber-700/80 dark:text-amber-300/80 mt-0.5">Hidden from faculty forms</p>
            </div>
          </div>

          {/* Programs Management Workspace Card */}
          <div className="rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
            {/* Filter Bar */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-950/20">
              <div className="relative flex-1 max-w-md">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <AppIcon icon={Search} size="sm" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search programs by code, name, or description..."
                  className="w-full pl-10 pr-4 py-2 rounded-xl text-xs sm:text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                {/* Visibility Filters */}
                <div className="inline-flex items-center p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setVisibilityFilter("all")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      visibilityFilter === "all"
                        ? "bg-white dark:bg-slate-900 text-slate-950 dark:text-amber-400 shadow-xs"
                        : "text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    All ({programs.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisibilityFilter("active")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      visibilityFilter === "active"
                        ? "bg-white dark:bg-slate-900 text-slate-950 dark:text-amber-400 shadow-xs"
                        : "text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    Active ({activeProgramsCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisibilityFilter("hidden")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      visibilityFilter === "hidden"
                        ? "bg-white dark:bg-slate-900 text-slate-950 dark:text-amber-400 shadow-xs"
                        : "text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    Hidden ({hiddenProgramsCount})
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleOpenAddModal}
                  className="inline-flex items-center gap-1.5 bg-[#780000] hover:bg-[#5e0000] text-white px-4 py-2 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-95"
                >
                  <AppIcon icon={Plus} size="sm" color="white" />
                  <span>Add Academic Program</span>
                </button>
              </div>
            </div>

            {/* Programs Table */}
            {isLoadingPrograms ? (
              <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                Loading academic programs...
              </div>
            ) : filteredPrograms.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <AppIcon icon={GraduationCap} size="lg" className="mx-auto text-slate-400" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Programs Found</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {searchQuery
                    ? "Try adjusting your search criteria or visibility filter."
                    : "Add your first academic program using the button above."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase text-[11px] tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Program Code</th>
                      <th className="py-3 px-4">Program Name</th>
                      <th className="py-3 px-4 hidden lg:table-cell">Description</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {filteredPrograms.map((prog) => (
                      <tr
                        key={prog.id}
                        className={`hover:bg-slate-50/70 dark:hover:bg-slate-850/50 transition-colors ${
                          prog.is_hidden ? "opacity-60 bg-slate-50/40 dark:bg-slate-950/20" : ""
                        }`}
                      >
                        <td className="py-3.5 px-4 font-black">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-black bg-amber-400 text-slate-950">
                            {prog.code}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-slate-100">
                          {prog.name}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 hidden lg:table-cell text-xs">
                          {prog.description || "—"}
                        </td>
                        <td className="py-3.5 px-4">
                          <button
                            type="button"
                            onClick={(e) => handleToggleHideProgram(prog, e)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all ${
                              prog.is_hidden
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
                                : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                            }`}
                            title={prog.is_hidden ? "Click to make active" : "Click to hide from dropdowns"}
                          >
                            <AppIcon icon={prog.is_hidden ? EyeClosed : Check} size="xs" color="inherit" />
                            <span>{prog.is_hidden ? "Hidden" : "Active"}</span>
                          </button>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => handleOpenEditModal(prog, e)}
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer"
                              title="Edit program"
                            >
                              <AppIcon icon={EditPencil} size="xs" color="inherit" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTarget(prog);
                              }}
                              className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 transition cursor-pointer"
                              title="Delete program"
                            >
                              <AppIcon icon={Trash} size="xs" color="inherit" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── ADD / EDIT PROGRAM MODAL ─────────────────────────────── */}
      {(isAddProgramOpen || editingProgram) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
          >
            <ModalHeader
              icon={GraduationCap}
              title={editingProgram ? `Edit Program: ${editingProgram.code}` : "Add Academic Degree Program"}
              subtitle="PUP Bataan Campus degree program registry"
            />
            <form onSubmit={handleSubmitProgram} className="p-5 sm:p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Program Code <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={programCodeInput}
                  onChange={(e) => setProgramCodeInput(e.target.value.toUpperCase())}
                  placeholder="e.g. BSIT, BSA, BEED"
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Full Program Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={programNameInput}
                  onChange={(e) => setProgramNameInput(e.target.value)}
                  placeholder="e.g. Bachelor of Science in Information Technology"
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Description / Department Notes (Optional)
                </label>
                <textarea
                  rows={3}
                  value={programDescInput}
                  onChange={(e) => setProgramDescInput(e.target.value)}
                  placeholder="Optional brief notes or description of this degree offering..."
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddProgramOpen(false);
                    setEditingProgram(null);
                  }}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center justify-center gap-1.5 bg-[#0b5336] hover:bg-[#083e28] text-white font-bold px-5 py-2 rounded-xl text-xs shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  <AppIcon icon={Check} size="sm" color="white" />
                  <span>{isSubmitting ? "Saving..." : editingProgram ? "Update Program" : "Create Program"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── DELETE PROGRAM CONFIRMATION MODAL ────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
          >
            <div className="p-5 sm:p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 shrink-0">
                  <AppIcon icon={Trash} size="md" color="inherit" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Delete Program: {deleteTarget.code}?
                  </h3>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Are you sure you want to delete <strong>{deleteTarget.name}</strong> ({deleteTarget.code})? You can also hide it instead to preserve historic compliance logs.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-xs text-amber-900 dark:text-amber-200">
                Safety wait: Delete button unlocks in <strong>{deleteCountdown}s</strong>.
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isSubmitting || deleteCountdown > 0}
                  className="inline-flex items-center justify-center gap-1.5 bg-[#780000] hover:bg-[#5e0000] text-white font-bold px-4 py-2 rounded-xl text-xs shadow-xs transition-all cursor-pointer disabled:opacity-40"
                >
                  <AppIcon icon={Trash} size="sm" color="white" />
                  <span>{deleteCountdown > 0 ? `Wait ${deleteCountdown}s` : "Confirm Delete"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

// Backward compatible export for existing routes/imports
export const CurriculumManagementPanel = TemplatesAndProgramsPanel;
