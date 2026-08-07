"use client";

import React, { useState, useEffect } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

export interface SidebarProps {
  activeSection: string;
  setActiveSection: (section: any) => void;
  adminName?: string | null;
  roleTitle?: string;
  onNavigate?: () => void;
}

export function SidebarButton({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean;
  title: string;
  description?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-lg border px-3 py-1.5 text-left transition ${
        active
          ? "border-amber-400 bg-amber-400/10 text-amber-300 font-semibold"
          : "border-slate-800 bg-[#070c18] hover:bg-[#0d152a] text-slate-300 hover:text-slate-100"
      }`}
    >
      <p className="text-xs font-semibold">{title}</p>
      {description ? (
        <p className="mt-0.5 text-[11px] text-slate-400">{description}</p>
      ) : null}
    </button>
  );
}

export function SidebarContent({
  activeSection,
  setActiveSection,
  adminName = "Admin",
  roleTitle = "Admin",
  onNavigate,
}: SidebarProps) {
  const isAcademicCycleActive =
    activeSection === "academicTerms" || activeSection === "submissionWindow";

  const [isAcademicCycleOpen, setIsAcademicCycleOpen] =
    useState<boolean>(isAcademicCycleActive);

  // Automatically open accordion if currently active section matches either child view
  useEffect(() => {
    if (isAcademicCycleActive) {
      setIsAcademicCycleOpen(true);
    }
  }, [isAcademicCycleActive]);

  const handleSelect = (section: string) => {
    setActiveSection(section);
    if (onNavigate) {
      onNavigate();
    }
  };

  return (
    <div className="flex flex-col h-full w-full">
      <div className="my-1.5 rounded-lg bg-slate-900 border border-slate-800 p-2 flex flex-col items-center">
        <p className="mt-0.5 font-semibold text-white text-center text-xs sm:text-sm">
          {adminName ?? "Admin"}
        </p>

        <div className="my-1.5 h-px w-full bg-slate-800" />

        <p className="mt-0 text-[10px] uppercase tracking-[0.12em] text-amber-400 text-center font-semibold">
          {roleTitle}
        </p>
      </div>

      <nav className="mt-1.5 space-y-1 flex-1 overflow-y-auto">
        <SidebarButton
          active={activeSection === "dashboard"}
          title="Dashboard"
          onClick={() => handleSelect("dashboard")}
        />
        <SidebarButton
          active={activeSection === "facultyManagement"}
          title="Faculty Management"
          onClick={() => handleSelect("facultyManagement")}
        />
        <SidebarButton
          active={activeSection === "requirements"}
          title="Requirements Verification"
          onClick={() => handleSelect("requirements")}
        />

        {/* Collapsible Parent Item: Academic Cycle Management */}
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => setIsAcademicCycleOpen((prev) => !prev)}
            className={`w-full flex items-center justify-between rounded-lg border px-3 py-1.5 text-left transition bg-[#070c18] hover:bg-[#0d152a] ${
              isAcademicCycleActive
                ? "border-amber-500/40 text-amber-300"
                : "border-slate-800 text-slate-300 hover:text-slate-100"
            }`}
          >
            <span className="text-xs font-semibold">
              Academic Cycle Management
            </span>
            {isAcademicCycleOpen ? (
              <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0 ml-1" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0 ml-1" />
            )}
          </button>

          {/* Child Sub-items (Indented with left border indicator) */}
          {isAcademicCycleOpen && (
            <div className="border-l border-slate-800 ml-2.5 pl-2 flex flex-col gap-1 mt-1">
              <button
                type="button"
                onClick={() => handleSelect("academicTerms")}
                className={`w-full text-left px-2.5 py-1 text-xs rounded-md border transition-all ${
                  activeSection === "academicTerms"
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-400 font-semibold"
                    : "border-slate-800 bg-[#070c18] text-slate-400 hover:text-slate-200 hover:bg-[#0d152a] hover:border-slate-700"
                }`}
              >
                Academic Terms
              </button>
              <button
                type="button"
                onClick={() => handleSelect("submissionWindow")}
                className={`w-full text-left px-2.5 py-1 text-xs rounded-md border transition-all ${
                  activeSection === "submissionWindow"
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-400 font-semibold"
                    : "border-slate-800 bg-[#070c18] text-slate-400 hover:text-slate-200 hover:bg-[#0d152a] hover:border-slate-700"
                }`}
              >
                Submission Window
              </button>
            </div>
          )}
        </div>

        <SidebarButton
          active={activeSection === "settings"}
          title="Settings"
          onClick={() => handleSelect("settings")}
        />
      </nav>
    </div>
  );
}

export function Sidebar(props: SidebarProps) {
  return (
    <aside className="hidden md:flex fixed left-0 top-16 h-[calc(100vh-4rem)] w-56 flex-col overflow-y-auto rounded-none border-r border-l-0 border-slate-800 bg-slate-950 p-2.5 shadow-lg z-30">
      <SidebarContent {...props} />
    </aside>
  );
}

export default Sidebar;
