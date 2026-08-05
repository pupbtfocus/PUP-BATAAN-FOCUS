"use client";

import React, { useState, useEffect } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

export interface SidebarProps {
  activeSection: string;
  setActiveSection: (section: any) => void;
  adminName?: string | null;
  roleTitle?: string;
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
      className={`w-full rounded-xl border px-4 py-3 text-left transition ${
        active
          ? "border-amber-400 bg-amber-400/10 text-amber-300 font-semibold"
          : "border-slate-800 bg-[#070c18] hover:bg-[#0d152a] text-slate-300 hover:text-slate-100"
      }`}
    >
      <p className="text-xs font-semibold">{title}</p>
      {description ? (
        <p className="mt-1 text-[11px] text-slate-400">{description}</p>
      ) : null}
    </button>
  );
}

export function Sidebar({
  activeSection,
  setActiveSection,
  adminName = "Admin",
  roleTitle = "Admin",
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

  return (
    <aside className="fixed left-0 top-16 h-[calc(100vh-4rem)] w-72 overflow-y-auto rounded-r-2xl border border-l-0 border-slate-800 bg-slate-950 p-5 shadow-lg">
      <div className="my-6 rounded-xl bg-slate-900 border border-slate-800 p-4 flex flex-col items-center">
        <p className="mt-2 font-semibold text-white text-center">
          {adminName ?? "Admin"}
        </p>

        <div className="my-2 h-px w-full bg-slate-800" />

        <p className="mt-1 text-xs uppercase tracking-[0.12em] text-amber-400 text-center font-medium">
          {roleTitle}
        </p>
      </div>

      <nav className="mt-6 space-y-2">
        <SidebarButton
          active={activeSection === "dashboard"}
          title="Dashboard"
          onClick={() => setActiveSection("dashboard")}
        />
        <SidebarButton
          active={activeSection === "facultyManagement"}
          title="Faculty Management"
          onClick={() => setActiveSection("facultyManagement")}
        />
        <SidebarButton
          active={activeSection === "requirements"}
          title="Requirements Verification"
          onClick={() => setActiveSection("requirements")}
        />

        {/* Collapsible Parent Item: Academic Cycle Management */}
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => setIsAcademicCycleOpen((prev) => !prev)}
            className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 text-left transition bg-[#070c18] hover:bg-[#0d152a] ${
              isAcademicCycleActive
                ? "border-amber-500/40 text-amber-300"
                : "border-slate-800 text-slate-300 hover:text-slate-100"
            }`}
          >
            <span className="text-xs font-semibold">
              Academic Cycle Management
            </span>
            {isAcademicCycleOpen ? (
              <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
            )}
          </button>

          {/* Child Sub-items (Indented with left border indicator) */}
          {isAcademicCycleOpen && (
            <div className="border-l border-slate-800 ml-4 pl-3 flex flex-col gap-1.5 mt-2">
              <button
                type="button"
                onClick={() => setActiveSection("academicTerms")}
                className={`w-full text-left px-3 py-2 text-xs rounded-lg border transition-all ${
                  activeSection === "academicTerms"
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-400 font-semibold"
                    : "border-slate-800 bg-[#070c18] text-slate-400 hover:text-slate-200 hover:bg-[#0d152a] hover:border-slate-700"
                }`}
              >
                Academic Terms
              </button>
              <button
                type="button"
                onClick={() => setActiveSection("submissionWindow")}
                className={`w-full text-left px-3 py-2 text-xs rounded-lg border transition-all ${
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
          onClick={() => setActiveSection("settings")}
        />
      </nav>
    </aside>
  );
}

export default Sidebar;
