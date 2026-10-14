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
} from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";

export interface ProgramItem {
  id: string;
  code: string;
  name: string;
  description?: string;
  is_hidden: boolean;
  curricula_count?: number;
  created_at?: string;
}

export interface CurriculumItem {
  id: string;
  program_id: string;
  code: string;
  name: string;
  description?: string;
  is_hidden: boolean;
  created_at?: string;
  program?: {
    id?: string;
    code: string;
    name: string;
  } | null;
}

const DEFAULT_FALLBACK_PROGRAMS: ProgramItem[] = [
  { id: "p-beed", code: "BEED", name: "Bachelor of Elementary Education", is_hidden: false, curricula_count: 1 },
  { id: "p-bsa", code: "BSA", name: "Bachelor of Science in Accountancy", is_hidden: false, curricula_count: 1 },
  { id: "p-bsma", code: "BSMA", name: "Bachelor of Science in Management Accounting", is_hidden: false, curricula_count: 1 },
  { id: "p-bsie", code: "BSIE", name: "Bachelor of Science in Industrial Engineering", is_hidden: false, curricula_count: 1 },
  { id: "p-bsit", code: "BSIT", name: "Bachelor of Science in Information Technology", is_hidden: false, curricula_count: 2 },
  { id: "p-bsbahrm", code: "BSBAHRM", name: "Bachelor of Science in Business Administration major in Human Resource Management", is_hidden: false, curricula_count: 1 },
  { id: "p-bsent", code: "BSEnt", name: "Bachelor of Science in Entrepreneurship", is_hidden: false, curricula_count: 1 },
  { id: "p-dit", code: "DIT", name: "Diploma in Information Technology", is_hidden: false, curricula_count: 1 },
  { id: "p-domt", code: "DOMT-LOM", name: "Diploma in Office Management Technology major in Legal Office Management", is_hidden: false, curricula_count: 1 },
];

export function CurriculumManagementPanel() {
  const [activeTab, setActiveTab] = useState<"programs" | "curricula">("programs");
  const [programs, setPrograms] = useState<ProgramItem[]>(DEFAULT_FALLBACK_PROGRAMS);
  const [curricula, setCurricula] = useState<CurriculumItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [visibilityFilter, setVisibilityFilter] = useState<"all" | "active" | "hidden">("all");
  const [selectedProgramFilter, setSelectedProgramFilter] = useState<string>("all");

  // Notifications / feedback
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Modals state
  const [isAddProgramOpen, setIsAddProgramOpen] = useState(false);
  const [isAddCurriculumOpen, setIsAddCurriculumOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "program" | "curriculum";
    id: string;
    title: string;
  } | null>(null);

  // Form states
  const [programCodeInput, setProgramCodeInput] = useState("");
  const [programNameInput, setProgramNameInput] = useState("");
  const [programDescInput, setProgramDescInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [curriculumProgramId, setCurriculumProgramId] = useState("");
  const [curriculumCodeInput, setCurriculumCodeInput] = useState("");
  const [curriculumNameInput, setCurriculumNameInput] = useState("");
  const [curriculumDescInput, setCurriculumDescInput] = useState("");

  // Dismiss feedback automatically
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  const loadData = async (showLoadingSpinner = true) => {
    if (showLoadingSpinner) setIsLoading(true);
    setIsRefreshing(true);

    try {
      // 1. Fetch programs
      const pRes = await fetch("/api/programs?includeHidden=true");
      if (pRes.ok) {
        const pData = await pRes.json();
        if (Array.isArray(pData.programs) && pData.programs.length > 0) {
          setPrograms(pData.programs);
        }
      }

      // 2. Fetch curricula
      const cRes = await fetch("/api/curriculum?includeHidden=true");
      if (cRes.ok) {
        const cData = await cRes.json();
        if (Array.isArray(cData.curricula)) {
          setCurricula(cData.curricula);
        }
      }
    } catch {
      // Keep existing or fallback state
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered programs
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

  // Filtered curricula
  const filteredCurricula = useMemo(() => {
    return curricula.filter((c) => {
      const matchesSearch =
        c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.program?.code || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.description || "").toLowerCase().includes(searchQuery.toLowerCase());

      const matchesVisibility =
        visibilityFilter === "all" ||
        (visibilityFilter === "active" && !c.is_hidden) ||
        (visibilityFilter === "hidden" && c.is_hidden);

      const matchesProgram =
        selectedProgramFilter === "all" || c.program_id === selectedProgramFilter;

      return matchesSearch && matchesVisibility && matchesProgram;
    });
  }, [curricula, searchQuery, visibilityFilter, selectedProgramFilter]);

  // Quick stats
  const totalPrograms = programs.length;
  const activeProgramsCount = programs.filter((p) => !p.is_hidden).length;
  const hiddenProgramsCount = programs.filter((p) => p.is_hidden).length;
  const totalCurricula = curricula.length;

  // Toggle Program Hide / Unhide
  const handleToggleHideProgram = async (program: ProgramItem) => {
    const nextHidden = !program.is_hidden;

    // Optimistic update
    setPrograms((prev) =>
      prev.map((item) =>
        item.id === program.id ? { ...item, is_hidden: nextHidden } : item
      )
    );

    try {
      const res = await fetch("/api/programs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: program.id,
          is_hidden: nextHidden,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to update status on server.");
      }

      setFeedback({
        type: "success",
        message: `Program "${program.code}" is now ${nextHidden ? "hidden from faculty" : "visible and active"}.`,
      });
    } catch {
      // Revert if error
      setPrograms((prev) =>
        prev.map((item) =>
          item.id === program.id ? { ...item, is_hidden: program.is_hidden } : item
        )
      );
      setFeedback({
        type: "error",
        message: "Failed to update program visibility. Please try again.",
      });
    }
  };

  // Toggle Curriculum Hide / Unhide
  const handleToggleHideCurriculum = async (curriculum: CurriculumItem) => {
    const nextHidden = !curriculum.is_hidden;

    setCurricula((prev) =>
      prev.map((item) =>
        item.id === curriculum.id ? { ...item, is_hidden: nextHidden } : item
      )
    );

    try {
      const res = await fetch("/api/curriculum", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: curriculum.id,
          is_hidden: nextHidden,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to update status on server.");
      }

      setFeedback({
        type: "success",
        message: `Curriculum "${curriculum.code}" is now ${nextHidden ? "hidden" : "active"}.`,
      });
    } catch {
      setCurricula((prev) =>
        prev.map((item) =>
          item.id === curriculum.id ? { ...item, is_hidden: curriculum.is_hidden } : item
        )
      );
      setFeedback({
        type: "error",
        message: "Failed to update curriculum visibility.",
      });
    }
  };

  // Delete Action Confirm
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    setIsSubmitting(true);
    try {
      if (deleteTarget.type === "program") {
        const res = await fetch(`/api/programs?id=${encodeURIComponent(deleteTarget.id)}`, {
          method: "DELETE",
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to delete program.");
        }

        setPrograms((prev) => prev.filter((p) => p.id !== deleteTarget.id));
        setCurricula((prev) => prev.filter((c) => c.program_id !== deleteTarget.id));
        setFeedback({
          type: "success",
          message: `Program "${deleteTarget.title}" and its related curriculum have been deleted.`,
        });
      } else {
        const res = await fetch(`/api/curriculum?id=${encodeURIComponent(deleteTarget.id)}`, {
          method: "DELETE",
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to delete curriculum.");
        }

        setCurricula((prev) => prev.filter((c) => c.id !== deleteTarget.id));
        setFeedback({
          type: "success",
          message: `Curriculum "${deleteTarget.title}" deleted successfully.`,
        });
      }
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err.message || "Failed to delete item.",
      });
    } finally {
      setIsSubmitting(false);
      setDeleteTarget(null);
    }
  };

  // Add Program Submit
  const handleAddProgramSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!programCodeInput.trim() || !programNameInput.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: programCodeInput.trim().toUpperCase(),
          name: programNameInput.trim(),
          description: programDescInput.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to add program.");
      }

      setPrograms((prev) => [
        {
          id: data.program?.id || `prog-${Date.now()}`,
          code: programCodeInput.trim().toUpperCase(),
          name: programNameInput.trim(),
          description: programDescInput.trim(),
          is_hidden: false,
          curricula_count: 0,
        },
        ...prev,
      ]);

      setFeedback({
        type: "success",
        message: `Program "${programCodeInput.trim().toUpperCase()}" created successfully!`,
      });

      setIsAddProgramOpen(false);
      setProgramCodeInput("");
      setProgramNameInput("");
      setProgramDescInput("");
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err.message || "Error creating program.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add Curriculum Submit
  const handleAddCurriculumSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!curriculumProgramId || !curriculumCodeInput.trim() || !curriculumNameInput.trim()) return;

    setIsSubmitting(true);
    try {
      const selectedProg = programs.find((p) => p.id === curriculumProgramId);

      const res = await fetch("/api/curriculum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          program_id: curriculumProgramId,
          code: curriculumCodeInput.trim(),
          name: curriculumNameInput.trim(),
          description: curriculumDescInput.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to add curriculum.");
      }

      const newCurriculum: CurriculumItem = {
        id: data.curriculum?.id || `curr-${Date.now()}`,
        program_id: curriculumProgramId,
        code: curriculumCodeInput.trim(),
        name: curriculumNameInput.trim(),
        description: curriculumDescInput.trim(),
        is_hidden: false,
        program: selectedProg ? { code: selectedProg.code, name: selectedProg.name } : null,
      };

      setCurricula((prev) => [newCurriculum, ...prev]);
      setPrograms((prev) =>
        prev.map((p) =>
          p.id === curriculumProgramId
            ? { ...p, curricula_count: (p.curricula_count || 0) + 1 }
            : p
        )
      );

      setFeedback({
        type: "success",
        message: `Curriculum "${curriculumCodeInput.trim()}" added successfully!`,
      });

      setIsAddCurriculumOpen(false);
      setCurriculumProgramId("");
      setCurriculumCodeInput("");
      setCurriculumNameInput("");
      setCurriculumDescInput("");
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err.message || "Error creating curriculum.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <article className="space-y-5 p-2 sm:p-4 md:p-5">
      {/* Solid Amber Card Header (Matching Academic Cycle theme) */}
      <div className="relative overflow-hidden rounded-2xl border-2 border-amber-500 dark:border-amber-500/70 bg-amber-400 dark:bg-[#2a1705] p-5 sm:p-6 shadow-md shadow-amber-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-950 dark:text-amber-100 tracking-tight">
              Curriculum & Programs
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-slate-900 text-amber-300 dark:bg-amber-400 dark:text-slate-950 border border-amber-600/50 shadow-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 dark:bg-slate-950 animate-pulse" />
              Coming Soon
            </span>
          </div>
          <p className="mt-1.5 text-sm sm:text-base text-amber-950/90 dark:text-amber-200/90 font-medium leading-relaxed max-w-3xl">
            Customization workspace for academic degree programs and curricula. Add new programs, hide inactive degree offerings from faculty forms, or remove obsolete curricula.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => loadData(false)}
            disabled={isRefreshing}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 px-3.5 py-2 sm:py-1.5 text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer shadow-xs active:scale-[0.98]"
            title="Refresh program and curriculum data"
          >
            <AppIcon icon={Refresh} size="sm" className={isRefreshing ? "animate-spin" : ""} />
            <span>{isRefreshing ? "Refreshing..." : "Refresh"}</span>
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

      {/* Quick Summary Cards (4 Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Total Programs</span>
            <AppIcon icon={GraduationCap} size="sm" />
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">{totalPrograms}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Bataan campus programs</p>
        </div>

        <div className="p-4 rounded-2xl border border-emerald-300/80 dark:border-emerald-800/80 bg-emerald-50/60 dark:bg-emerald-950/20 shadow-xs">
          <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-300">
            <span className="text-xs font-bold uppercase tracking-wider">Active & Visible</span>
            <AppIcon icon={Check} size="sm" />
          </div>
          <p className="mt-2 text-2xl font-black text-emerald-900 dark:text-emerald-100">{activeProgramsCount}</p>
          <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80 mt-0.5">Available for faculty</p>
        </div>

        <div className="p-4 rounded-2xl border border-amber-300/80 dark:border-amber-800/80 bg-amber-50/60 dark:bg-amber-950/20 shadow-xs">
          <div className="flex items-center justify-between text-amber-700 dark:text-amber-300">
            <span className="text-xs font-bold uppercase tracking-wider">Hidden Offerings</span>
            <AppIcon icon={EyeClosed} size="sm" />
          </div>
          <p className="mt-2 text-2xl font-black text-amber-900 dark:text-amber-100">{hiddenProgramsCount}</p>
          <p className="text-xs text-amber-700/80 dark:text-amber-300/80 mt-0.5">Archived from dropdowns</p>
        </div>

        <div className="p-4 rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Curricula Items</span>
            <AppIcon icon={Page} size="sm" />
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">{totalCurricula}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Configured frameworks</p>
        </div>
      </div>

      {/* Main Tabs Container */}
      <div className="rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
        {/* Navigation Tabs Header */}
        <div className="flex flex-wrap items-center justify-between border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 pt-3 pb-0 gap-3 bg-slate-50/60 dark:bg-slate-950/40">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("programs")}
              className={`pb-3 px-3 text-sm font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
                activeTab === "programs"
                  ? "border-[#800000] text-[#800000] dark:border-amber-400 dark:text-amber-300"
                  : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              }`}
            >
              <AppIcon icon={GraduationCap} size="sm" />
              <span>Degree Programs</span>
              <span className="ml-1 px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {programs.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("curricula")}
              className={`pb-3 px-3 text-sm font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
                activeTab === "curricula"
                  ? "border-[#800000] text-[#800000] dark:border-amber-400 dark:text-amber-300"
                  : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              }`}
            >
              <AppIcon icon={Page} size="sm" />
              <span>Curricula Versions</span>
              <span className="ml-1 px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {curricula.length}
              </span>
            </button>
          </div>

          {/* Action Button: Add */}
          <div className="pb-3">
            {activeTab === "programs" ? (
              <button
                type="button"
                onClick={() => setIsAddProgramOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-[#800000] hover:bg-[#680000] text-white px-4 py-2 text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
              >
                <AppIcon icon={Plus} size="xs" color="white" />
                <span>Add Program</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsAddCurriculumOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-[#800000] hover:bg-[#680000] text-white px-4 py-2 text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
              >
                <AppIcon icon={Plus} size="xs" color="white" />
                <span>Add Curriculum</span>
              </button>
            )}
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder={`Search ${activeTab === "programs" ? "programs by code or name" : "curricula"}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {activeTab === "curricula" && (
              <select
                value={selectedProgramFilter}
                onChange={(e) => setSelectedProgramFilter(e.target.value)}
                className="text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-amber-500 cursor-pointer"
              >
                <option value="all">All Programs</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} - {p.name}
                  </option>
                ))}
              </select>
            )}

            <div className="flex rounded-xl border border-slate-300 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setVisibilityFilter("all")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  visibilityFilter === "all"
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setVisibilityFilter("active")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  visibilityFilter === "active"
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                Active
              </button>
              <button
                type="button"
                onClick={() => setVisibilityFilter("hidden")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  visibilityFilter === "hidden"
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                Hidden
              </button>
            </div>
          </div>
        </div>

        {/* Content Table / Cards */}
        <div className="p-4 sm:p-6">
          {activeTab === "programs" ? (
            filteredPrograms.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                <AppIcon icon={GraduationCap} size="lg" className="mx-auto text-slate-400 mb-2" />
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">No Programs Found</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {searchQuery || visibilityFilter !== "all"
                    ? "Try adjusting your filters or search keywords."
                    : "Add your first academic degree program to begin."}
                </p>
                <button
                  type="button"
                  onClick={() => setIsAddProgramOpen(true)}
                  className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#800000] text-white text-xs font-semibold hover:bg-[#680000] cursor-pointer"
                >
                  <AppIcon icon={Plus} size="xs" color="white" />
                  <span>Add Program</span>
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-950/20">
                      <th className="py-3 px-4">Program Code</th>
                      <th className="py-3 px-4">Degree Title</th>
                      <th className="py-3 px-4 hidden md:table-cell">Curricula</th>
                      <th className="py-3 px-4">Visibility Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs sm:text-sm">
                    {filteredPrograms.map((prog) => (
                      <tr
                        key={prog.id}
                        className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                          prog.is_hidden ? "opacity-60 bg-slate-50/30 dark:bg-slate-950/20" : ""
                        }`}
                      >
                        <td className="py-3.5 px-4 font-bold whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-extrabold bg-[#800000]/10 text-[#800000] dark:bg-amber-400/15 dark:text-amber-300 border border-[#800000]/20 dark:border-amber-400/30">
                            {prog.code}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-slate-100">
                          <div>
                            <p>{prog.name}</p>
                            {prog.description && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 font-normal mt-0.5 line-clamp-1">
                                {prog.description}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 hidden md:table-cell text-slate-600 dark:text-slate-400 font-medium whitespace-nowrap">
                          <span className="inline-flex items-center gap-1">
                            <Page className="h-3.5 w-3.5 text-slate-400" />
                            {prog.curricula_count ?? 0} {prog.curricula_count === 1 ? "Curriculum" : "Curricula"}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {prog.is_hidden ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                              <EyeClosed className="h-3 w-3" />
                              Hidden
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                              <Check className="h-3 w-3" />
                              Active
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Hide / Unhide Button */}
                            <button
                              type="button"
                              onClick={() => handleToggleHideProgram(prog)}
                              className={`p-1.5 rounded-lg border text-xs font-medium transition cursor-pointer flex items-center gap-1 ${
                                prog.is_hidden
                                  ? "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700"
                                  : "bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/40 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-800"
                              }`}
                              title={prog.is_hidden ? "Unhide program (make visible to faculty)" : "Hide program from faculty dropdowns"}
                            >
                              {prog.is_hidden ? (
                                <>
                                  <Eye className="h-4 w-4" />
                                  <span className="hidden sm:inline">Unhide</span>
                                </>
                              ) : (
                                <>
                                  <EyeClosed className="h-4 w-4" />
                                  <span className="hidden sm:inline">Hide</span>
                                </>
                              )}
                            </button>

                            {/* Delete Button */}
                            <button
                              type="button"
                              onClick={() =>
                                setDeleteTarget({
                                  type: "program",
                                  id: prog.id,
                                  title: prog.code,
                                })
                              }
                              className="p-1.5 rounded-lg border border-rose-300 dark:border-rose-800/60 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 text-xs font-medium transition cursor-pointer flex items-center gap-1"
                              title="Delete program"
                            >
                              <Trash className="h-4 w-4" />
                              <span className="hidden sm:inline">Delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            filteredCurricula.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                <AppIcon icon={Page} size="lg" className="mx-auto text-slate-400 mb-2" />
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">No Curricula Configured</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Create syllabus and requirement templates for specific academic programs.
                </p>
                <button
                  type="button"
                  onClick={() => setIsAddCurriculumOpen(true)}
                  className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#800000] text-white text-xs font-semibold hover:bg-[#680000] cursor-pointer"
                >
                  <AppIcon icon={Plus} size="xs" color="white" />
                  <span>Add Curriculum</span>
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-950/20">
                      <th className="py-3 px-4">Curriculum Code</th>
                      <th className="py-3 px-4">Program</th>
                      <th className="py-3 px-4">Curriculum Title</th>
                      <th className="py-3 px-4">Visibility</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs sm:text-sm">
                    {filteredCurricula.map((curr) => (
                      <tr
                        key={curr.id}
                        className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                          curr.is_hidden ? "opacity-60 bg-slate-50/30 dark:bg-slate-950/20" : ""
                        }`}
                      >
                        <td className="py-3.5 px-4 font-bold whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700">
                            {curr.code}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-[#800000] dark:text-amber-400 whitespace-nowrap">
                          {curr.program?.code || "General"}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-slate-100">
                          <div>
                            <p>{curr.name}</p>
                            {curr.description && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 font-normal mt-0.5">
                                {curr.description}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {curr.is_hidden ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                              <EyeClosed className="h-3 w-3" />
                              Hidden
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                              <Check className="h-3 w-3" />
                              Active
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleToggleHideCurriculum(curr)}
                              className={`p-1.5 rounded-lg border text-xs font-medium transition cursor-pointer flex items-center gap-1 ${
                                curr.is_hidden
                                  ? "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700"
                                  : "bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/40 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-800"
                              }`}
                              title={curr.is_hidden ? "Unhide curriculum" : "Hide curriculum"}
                            >
                              {curr.is_hidden ? (
                                <>
                                  <Eye className="h-4 w-4" />
                                  <span className="hidden sm:inline">Unhide</span>
                                </>
                              ) : (
                                <>
                                  <EyeClosed className="h-4 w-4" />
                                  <span className="hidden sm:inline">Hide</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                setDeleteTarget({
                                  type: "curriculum",
                                  id: curr.id,
                                  title: curr.code,
                                })
                              }
                              className="p-1.5 rounded-lg border border-rose-300 dark:border-rose-800/60 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 text-xs font-medium transition cursor-pointer flex items-center gap-1"
                              title="Delete curriculum"
                            >
                              <Trash className="h-4 w-4" />
                              <span className="hidden sm:inline">Delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      </div>

      {/* MODAL 1: Add Program */}
      {isAddProgramOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl p-6 text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[#800000]/10 text-[#800000] dark:bg-amber-400/20 dark:text-amber-300">
                  <AppIcon icon={GraduationCap} size="sm" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Add Academic Program</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Add a new degree program offered in PUP Bataan</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddProgramOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <AppIcon icon={Xmark} size="sm" />
              </button>
            </div>

            <form onSubmit={handleAddProgramSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  Program Code <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BSCS, BSIT, BSECE"
                  value={programCodeInput}
                  onChange={(e) => setProgramCodeInput(e.target.value.toUpperCase())}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold uppercase tracking-wider focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  Full Degree Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bachelor of Science in Computer Science"
                  value={programNameInput}
                  onChange={(e) => setProgramNameInput(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  Description / Department (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Brief notes or department details..."
                  value={programDescInput}
                  onChange={(e) => setProgramDescInput(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-amber-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddProgramOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !programCodeInput.trim() || !programNameInput.trim()}
                  className="px-4 py-2 rounded-xl bg-[#800000] hover:bg-[#680000] text-white text-xs font-bold disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {isSubmitting ? "Saving..." : "Save Program"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Add Curriculum */}
      {isAddCurriculumOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl p-6 text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[#800000]/10 text-[#800000] dark:bg-amber-400/20 dark:text-amber-300">
                  <AppIcon icon={Page} size="sm" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Add Curriculum Version</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Attach a curriculum framework to a degree program</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddCurriculumOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <AppIcon icon={Xmark} size="sm" />
              </button>
            </div>

            <form onSubmit={handleAddCurriculumSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  Academic Program <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={curriculumProgramId}
                  onChange={(e) => setCurriculumProgramId(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-amber-500 cursor-pointer"
                >
                  <option value="">-- Select a Degree Program --</option>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} - {p.name} {p.is_hidden ? "(Hidden)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  Curriculum Code / Version <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 2024-REV, 2021-CMO, OBE-2025"
                  value={curriculumCodeInput}
                  onChange={(e) => setCurriculumCodeInput(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  Curriculum Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BSIT 2024 Revised Curriculum (OBE)"
                  value={curriculumNameInput}
                  onChange={(e) => setCurriculumNameInput(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  Description / Remarks (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Approved under BOR Resolution No. 2024-08..."
                  value={curriculumDescInput}
                  onChange={(e) => setCurriculumDescInput(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-amber-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddCurriculumOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !curriculumProgramId || !curriculumCodeInput.trim() || !curriculumNameInput.trim()}
                  className="px-4 py-2 rounded-xl bg-[#800000] hover:bg-[#680000] text-white text-xs font-bold disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {isSubmitting ? "Saving..." : "Save Curriculum"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-rose-300 dark:border-rose-900/60 bg-white dark:bg-slate-900 shadow-2xl p-6 text-slate-900 dark:text-slate-100">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 shrink-0">
                <AppIcon icon={WarningCircle} size="md" color="inherit" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Delete {deleteTarget.type === "program" ? "Academic Program" : "Curriculum"}?
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                  Are you sure you want to delete{" "}
                  <strong className="text-rose-600 dark:text-rose-400 font-bold">{deleteTarget.title}</strong>?
                  {deleteTarget.type === "program"
                    ? " This will permanently remove this program code and any attached curricula records. You can also hide it instead to preserve historic compliance data."
                    : " This curriculum will be permanently removed from the system."}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {isSubmitting ? "Deleting..." : "Delete Forever"}
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
