"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
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
import { emitRealtimeSync, useRealtimeSync } from "@/lib/realtime";

export interface ProgramItem {
  id: string;
  code: string;
  name: string;
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
  const [internalRefreshTrigger, setInternalRefreshTrigger] = useState(0);

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
  const hasLoadedProgramsRef = useRef(false);
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

  const loadPrograms = async (showLoadingSpinner = false) => {
    if (showLoadingSpinner && !hasLoadedProgramsRef.current) {
      setIsLoadingPrograms(true);
    }
    setIsRefreshingPrograms(true);
    try {
      const pRes = await fetch("/api/programs?includeHidden=true", { cache: "no-store" });
      if (pRes.ok) {
        const pData = await pRes.json();
        if (Array.isArray(pData.programs) && pData.programs.length > 0) {
          setPrograms(pData.programs);
          hasLoadedProgramsRef.current = true;
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
    void loadPrograms(!hasLoadedProgramsRef.current);
  }, [refreshTrigger]);

  useRealtimeSync(() => {
    void loadPrograms(false);
  });

  const filteredPrograms = useMemo(() => {
    return programs.filter((p) => {
      const matchesSearch =
        p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase());

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
      emitRealtimeSync({ source: "program-updated", timestamp: Date.now() });
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
    setIsAddProgramOpen(true);
  };

  const handleOpenEditModal = (prog: ProgramItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProgram(prog);
    setProgramCodeInput(prog.code);
    setProgramNameInput(prog.name);
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
                }
              : p
          )
        );

        setEditingProgram(null);
        setFeedback({
          type: "success",
          message: `Program ${data.program?.code || programCodeInput} updated successfully.`,
        });
        emitRealtimeSync({ source: "program-updated", timestamp: Date.now() });
      } else {
        const res = await fetch("/api/programs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: programCodeInput.trim().toUpperCase(),
            name: programNameInput.trim(),
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
            is_hidden: false,
          },
          ...prev,
        ]);

        setIsAddProgramOpen(false);
        setFeedback({
          type: "success",
          message: `Program ${programCodeInput.toUpperCase()} added successfully!`,
        });
        emitRealtimeSync({ source: "program-created", timestamp: Date.now() });
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
      emitRealtimeSync({ source: "program-deleted", timestamp: Date.now() });
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
            disabled={isRefreshingPrograms}
            onClick={() => {
              setInternalRefreshTrigger((prev) => prev + 1);
              void loadPrograms(false);
              emitRealtimeSync({ source: "manual-refresh", timestamp: Date.now() });
            }}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 px-3.5 py-2 sm:py-1.5 text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer shadow-xs active:scale-[0.98]"
            title="Refresh active panel data"
          >
            <AppIcon icon={Refresh} size="sm" className={isRefreshingPrograms ? "animate-spin" : ""} />
            <span>{isRefreshingPrograms ? "Refreshing..." : "Refresh"}</span>
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
              <AppIcon icon={CheckCircle} size="sm" color="success" />
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
          <RequirementTemplatesPanel refreshTrigger={(refreshTrigger ?? 0) + internalRefreshTrigger} />
        </div>
      )}

      {/* ─── TAB 2: ACADEMIC PROGRAMS ────────────────────────────── */}
      {activeTab === "programs" && (
        <div className="w-full space-y-4">
          {/* 3-Card Stat Summary Header matching RequirementTemplatesPanel */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {/* 1. TOTAL DEGREE PROGRAMS */}
            <div className="rounded-2xl bg-white text-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs dark:bg-slate-900 dark:text-slate-100 p-5 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider">
                  Total Degree Programs
                </span>
                <GraduationCap className="h-5 w-5 text-slate-400" strokeWidth={2} />
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
                {isLoadingPrograms ? "..." : totalPrograms}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Bataan campus degree offerings
              </p>
            </div>

            {/* 2. ACTIVE & VISIBLE */}
            <div className="rounded-2xl bg-white text-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs dark:bg-slate-900 dark:text-slate-100 p-5 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider">
                  Active & Visible
                </span>
                <span className="w-2 h-2 rounded-full bg-[#0b5336]" />
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
                {isLoadingPrograms ? "..." : activeProgramsCount}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Available for faculty selection
              </p>
            </div>

            {/* 3. HIDDEN OFFERINGS */}
            <div className="rounded-2xl bg-white text-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs dark:bg-slate-900 dark:text-slate-100 p-5 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider">
                  Hidden Offerings
                </span>
                <span className="w-2 h-2 rounded-full bg-[#780000]" />
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
                {isLoadingPrograms ? "..." : hiddenProgramsCount}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Hidden from faculty forms
              </p>
            </div>
          </div>

          {/* Filter & Actions Bar matching RequirementTemplatesPanel */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-white text-slate-900 border border-slate-300 shadow-xs dark:bg-slate-900 dark:text-slate-100 dark:border-slate-800 rounded-2xl mb-6 transition-colors">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5 w-full sm:w-auto flex-wrap">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search programs by code or name..."
                  className="w-full sm:w-64 h-9 rounded-xl bg-white text-slate-900 border border-slate-300 focus:border-slate-400 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-800 dark:focus:border-slate-600 pl-8 pr-3 text-xs placeholder-slate-400 dark:placeholder-slate-500 outline-none transition"
                />
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700">
                {(["all", "active", "hidden"] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setVisibilityFilter(st)}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg capitalize transition-all cursor-pointer ${
                      visibilityFilter === st
                        ? "bg-amber-500 text-slate-950 font-semibold shadow-xs border border-amber-600/30"
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
                onClick={handleOpenAddModal}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-600 font-semibold px-4 py-2 rounded-xl text-xs transition-all shadow-xs cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                <span>+ Add Academic Program</span>
              </button>
            </div>
          </div>

          {/* Main Data Table matching RequirementTemplatesPanel */}
          <div className="w-full overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs dark:shadow-none overflow-hidden transition-colors">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead className="border-b border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 text-[11px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-2.5 font-semibold w-10 text-center">#</th>
                  <th className="py-3 px-4">Program Code</th>
                  <th className="py-3 px-4">Program Name</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300 dark:divide-slate-800/60 text-xs">
                {isLoadingPrograms ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-500 dark:text-slate-400">
                      <Refresh className="h-5 w-5 animate-spin mx-auto mb-2 text-amber-500" strokeWidth={2} />
                      Loading academic programs...
                    </td>
                  </tr>
                ) : filteredPrograms.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-500 dark:text-slate-400">
                      <GraduationCap className="h-8 w-8 mx-auto mb-2 text-slate-400 opacity-60" strokeWidth={2} />
                      <p className="font-semibold text-slate-700 dark:text-slate-300">No academic programs found</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {searchQuery
                          ? "Try modifying your search filter"
                          : "Get started by adding an academic program using the button above"}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredPrograms.map((prog, index) => (
                    <tr
                      key={prog.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      {/* Index */}
                      <td className="px-3 py-3 text-center text-xs font-mono text-slate-400 dark:text-slate-500">
                        {index + 1}
                      </td>

                      {/* Column 1: Program Code */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold bg-amber-500 text-slate-950 border border-amber-600 shadow-2xs">
                          {prog.code}
                        </span>
                      </td>

                      {/* Column 2: Program Name */}
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100 text-xs sm:text-sm">
                        {prog.name}
                      </td>

                      {/* Column 3: Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {!prog.is_hidden ? (
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

                      {/* Column 4: Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          {/* Edit Button */}
                          <button
                            type="button"
                            onClick={(e) => handleOpenEditModal(prog, e)}
                            className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:text-slate-300 dark:border-slate-700 text-xs font-medium rounded-md px-2.5 py-1 transition-colors cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                            title="Edit program"
                          >
                            <EditPencil className="h-3.5 w-3.5" strokeWidth={2} />
                            <span>Edit</span>
                          </button>

                          {/* Hide / Unhide Button */}
                          <button
                            type="button"
                            onClick={(e) => void handleToggleHideProgram(prog, e)}
                            className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:text-slate-300 dark:border-slate-700 text-xs font-medium rounded-md px-2.5 py-1 transition-colors cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                            title={prog.is_hidden ? "Unhide program for faculty" : "Hide program from faculty"}
                          >
                            {!prog.is_hidden ? (
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
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(prog);
                            }}
                            className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-md transition cursor-pointer"
                            title="Delete program"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div
            className="w-full max-w-md rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl text-slate-900 dark:text-slate-100"
            role="dialog"
            aria-modal="true"
          >
            <ModalHeader
              icon={Trash}
              title="Delete Academic Program"
              subtitle="Confirm Permanent Program Deletion"
              className="-mx-6 -mt-6 mb-4 rounded-t-2xl"
            />

            <div className="space-y-3">
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                Are you sure you want to permanently delete{" "}
                <strong className="text-slate-900 dark:text-slate-100">
                  &ldquo;{deleteTarget.name}&rdquo;
                </strong>{" "}
                ({deleteTarget.code})?
              </p>

              <div className="rounded-xl border border-amber-600 bg-amber-500 p-3 text-xs text-slate-950 space-y-1 shadow-xs">
                <p className="font-bold">Safety Notice:</p>
                <p className="font-medium">
                  To temporarily remove this program from faculty selection dropdowns while preserving historic compliance logs, use the <strong>Hide</strong> option instead.
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

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] text-xs font-semibold transition cursor-pointer shadow-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isSubmitting || deleteCountdown > 0}
                className="bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] text-xs font-semibold px-4 py-2 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-xs"
              >
                {isSubmitting
                  ? "Deleting..."
                  : deleteCountdown > 0
                  ? `Confirm Delete (${deleteCountdown}s)`
                  : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

