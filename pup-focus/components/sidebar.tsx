"use client";

import React, { useState, useEffect } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { extractFirstName } from "@/lib/faculty-profile";

export interface SidebarProps {
  activeSection: string;
  setActiveSection: (section: any) => void;
  adminName?: string | null;
  roleTitle?: string;
  isSuperAdmin?: boolean;
  profileImageUrl?: string | null;
  onNavigate?: () => void;
}

function getRoleBadgeClasses(roleTitle?: string): string {
  const role = (roleTitle || "").toLowerCase().trim();
  if (role.includes("super")) {
    return "bg-purple-100 dark:bg-purple-900/40 text-purple-900 dark:text-purple-300 border border-solid border-[#000000] dark:border-purple-500/30";
  }
  if (role.includes("faculty")) {
    return "bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-solid border-[#000000] dark:border-slate-700";
  }
  // Default: Admin
  return "bg-amber-100 dark:bg-amber-900/40 text-amber-950 dark:text-amber-300 border border-solid border-[#000000] dark:border-amber-500/30";
}

function getSidebarInitials(name?: string | null, fallback = "AD"): string {
  if (!name || !name.trim()) return fallback;
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return parts[0].slice(0, 2).toUpperCase() || fallback;
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
      className={`w-full text-left px-3 py-2 text-xs transition cursor-pointer ${
        active
          ? "border-l-4 border-amber-500 bg-amber-500/10 text-amber-900 dark:border-amber-400 dark:bg-amber-500/15 dark:text-amber-400 font-semibold rounded-r-lg"
          : "rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800/50 font-medium"
      }`}
    >
      <p className="text-xs">{title}</p>
      {description ? (
        <p className={`mt-0.5 text-[11px] font-normal ${active ? "text-amber-800/80 dark:text-amber-300/80" : "text-slate-500 dark:text-slate-400"}`}>
          {description}
        </p>
      ) : null}
    </button>
  );
}

export function SidebarContent({
  activeSection,
  setActiveSection,
  adminName = "Admin",
  roleTitle = "Admin",
  isSuperAdmin: isSuperAdminProp,
  profileImageUrl,
  onNavigate,
}: SidebarProps) {
  const [hasAvatarError, setHasAvatarError] = useState(false);

  const isSuperAdmin =
    isSuperAdminProp ??
    Boolean((roleTitle || "").toLowerCase().includes("super"));

  // Check active states supporting both short and legacy tokens
  const isDashboardActive = activeSection === "dashboard";
  const isAccountsActive =
    activeSection === "accounts" || activeSection === "admin-accounts";
  const isFacultyActive =
    activeSection === "faculty" || activeSection === "facultyManagement";
  const isVerificationActive =
    activeSection === "verification" ||
    activeSection === "requirements" ||
    activeSection === "requirements-verification";
  const isTermsActive =
    activeSection === "terms" || activeSection === "academicTerms";
  const isWindowActive =
    activeSection === "window" || activeSection === "submissionWindow";
  const isTemplatesActive =
    activeSection === "templates" ||
    activeSection === "requirementTemplates" ||
    activeSection === "requirement-templates";
  const isBackupsActive =
    activeSection === "backups" ||
    activeSection === "backupArchive" ||
    activeSection === "backup-archive" ||
    activeSection === "archives";
  const isAuditActive =
    activeSection === "audit" ||
    activeSection === "auditLogs" ||
    activeSection === "audit-logs";
  const isSettingsActive = activeSection === "settings";

  const isAcademicCycleActive =
    isTermsActive || isWindowActive || isTemplatesActive || isBackupsActive;
  const isUserManagementActive = isAccountsActive || isFacultyActive;

  const [isUserManagementOpen, setIsUserManagementOpen] =
    useState<boolean>(isUserManagementActive);
  const [isAcademicCycleOpen, setIsAcademicCycleOpen] =
    useState<boolean>(isAcademicCycleActive);

  // Automatically open accordions if currently active section matches either child view
  useEffect(() => {
    if (isUserManagementActive) {
      setIsUserManagementOpen(true);
    }
  }, [isUserManagementActive]);

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
      <div className="my-1.5 rounded-2xl bg-slate-200 dark:bg-slate-900 border-2 border-solid border-[#000000] dark:border dark:border-slate-800 p-2.5 flex flex-col items-center shadow-sm shadow-slate-200/60 dark:shadow-none transition-colors">
        <div className="relative mb-2">
          {profileImageUrl && !hasAvatarError ? (
            <img
              src={profileImageUrl}
              alt={adminName ?? "User"}
              className="w-12 h-12 rounded-full object-cover border-2 border-amber-500/40 bg-slate-100 dark:bg-slate-950 shadow-md ring-2 ring-white dark:ring-slate-950"
              onError={() => setHasAvatarError(true)}
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-solid border-[#000000] dark:border-slate-700 font-bold text-xs flex items-center justify-center shadow-sm">
              {getSidebarInitials(adminName, isSuperAdmin ? "SA" : "AD")}
            </div>
          )}
          <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" title="Active" />
        </div>

        <p className="font-semibold text-slate-900 dark:text-slate-100 text-center text-xs sm:text-sm">
          {extractFirstName(adminName, roleTitle)}
        </p>

        <div className="my-1.5 h-px w-full bg-[#000000] dark:bg-slate-800" />

        <span className={`mt-0.5 inline-flex items-center justify-center px-2.5 py-0.5 text-[10px] uppercase tracking-[0.12em] font-semibold rounded-full border ${getRoleBadgeClasses(roleTitle)}`}>
          {roleTitle}
        </span>
      </div>

      <nav className="mt-1.5 space-y-0.5 flex-1 overflow-y-auto">
        {/* 1. Dashboard */}
        <SidebarButton
          active={isDashboardActive}
          title="Dashboard"
          onClick={() => handleSelect("dashboard")}
        />

        {/* 2. User Management (Super Admin Dropdown) or Faculty Management (Standard Admin) */}
        {isSuperAdmin ? (
          <div className="space-y-0.5">
            <button
              type="button"
              onClick={() => setIsUserManagementOpen((prev) => !prev)}
              className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs transition cursor-pointer ${
                isUserManagementActive
                  ? "border-l-4 border-amber-500 bg-amber-500/10 text-amber-900 dark:border-amber-400 dark:bg-amber-500/15 dark:text-amber-400 font-semibold rounded-r-lg"
                  : "rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800/50 font-medium"
              }`}
            >
              <span className="text-xs font-medium">User Management</span>
              {isUserManagementOpen ? (
                <ChevronDown className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400 shrink-0 ml-1" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400 shrink-0 ml-1" />
              )}
            </button>

            {/* Child Sub-items (Indented with left border indicator) */}
            {isUserManagementOpen && (
              <div className="border-l border-[#000000] dark:border-slate-800 ml-3 pl-2 flex flex-col gap-0.5 mt-0.5">
                <button
                  type="button"
                  onClick={() => handleSelect("accounts")}
                  className={`w-full text-left px-2.5 py-1.5 text-xs rounded-md transition-all cursor-pointer ${
                    isAccountsActive
                      ? "bg-amber-500/15 text-amber-900 dark:bg-amber-500/20 dark:text-amber-300 font-semibold"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/40"
                  }`}
                >
                  Admin Management
                </button>
                <button
                  type="button"
                  onClick={() => handleSelect("faculty")}
                  className={`w-full text-left px-2.5 py-1.5 text-xs rounded-md transition-all cursor-pointer ${
                    isFacultyActive
                      ? "bg-amber-500/15 text-amber-900 dark:bg-amber-500/20 dark:text-amber-300 font-semibold"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/40"
                  }`}
                >
                  Faculty Management
                </button>
              </div>
            )}
          </div>
        ) : (
          <SidebarButton
            active={isFacultyActive}
            title="Faculty Management"
            onClick={() => handleSelect("facultyManagement")}
          />
        )}

        {/* 3. Requirements Verification (Admin Module) */}
        <SidebarButton
          active={isVerificationActive}
          title="Requirements Verification"
          onClick={() => handleSelect(isSuperAdmin ? "verification" : "requirements")}
        />

        {/* 4. Collapsible Parent Item: Academic Cycle Management */}
        <div className="space-y-0.5">
          <button
            type="button"
            onClick={() => setIsAcademicCycleOpen((prev) => !prev)}
            className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs transition cursor-pointer ${
              isAcademicCycleActive
                ? "border-l-4 border-amber-500 bg-amber-500/10 text-amber-900 dark:border-amber-400 dark:bg-amber-500/15 dark:text-amber-400 font-semibold rounded-r-lg"
                : "rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800/50 font-medium"
            }`}
          >
            <span className="text-xs font-medium">
              Academic Cycle Management
            </span>
            {isAcademicCycleOpen ? (
              <ChevronDown className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400 shrink-0 ml-1" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400 shrink-0 ml-1" />
            )}
          </button>

          {/* Child Sub-items (Indented with left border indicator) */}
          {isAcademicCycleOpen && (
            <div className="border-l border-[#000000] dark:border-slate-800 ml-3 pl-2 flex flex-col gap-0.5 mt-0.5">
              <button
                type="button"
                onClick={() => handleSelect(isSuperAdmin ? "terms" : "academicTerms")}
                className={`w-full text-left px-2.5 py-1.5 text-xs rounded-md transition-all cursor-pointer ${
                  isTermsActive
                    ? "bg-amber-500/15 text-amber-900 dark:bg-amber-500/20 dark:text-amber-300 font-semibold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/40"
                }`}
              >
                Academic Terms
              </button>
              <button
                type="button"
                onClick={() => handleSelect(isSuperAdmin ? "window" : "submissionWindow")}
                className={`w-full text-left px-2.5 py-1.5 text-xs rounded-md transition-all cursor-pointer ${
                  isWindowActive
                    ? "bg-amber-500/15 text-amber-900 dark:bg-amber-500/20 dark:text-amber-300 font-semibold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/40"
                }`}
              >
                Submission Window
              </button>
              <button
                type="button"
                onClick={() => handleSelect(isSuperAdmin ? "templates" : "requirementTemplates")}
                className={`w-full text-left px-2.5 py-1.5 text-xs rounded-md transition-all cursor-pointer ${
                  isTemplatesActive
                    ? "bg-amber-500/15 text-amber-900 dark:bg-amber-500/20 dark:text-amber-300 font-semibold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/40"
                }`}
              >
                Requirement Templates
              </button>
              <button
                type="button"
                onClick={() => handleSelect(isSuperAdmin ? "backups" : "backupArchive")}
                className={`w-full text-left px-2.5 py-1.5 text-xs rounded-md transition-all cursor-pointer ${
                  isBackupsActive
                    ? "bg-amber-500/15 text-amber-900 dark:bg-amber-500/20 dark:text-amber-300 font-semibold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/40"
                }`}
              >
                Backups & Archive
              </button>
            </div>
          )}
        </div>

        {/* 5. Audit Trail & System Logs (Admin Module) */}
        <SidebarButton
          active={isAuditActive}
          title="Audit Trail"
          onClick={() => handleSelect(isSuperAdmin ? "audit" : "auditLogs")}
        />

        {/* 6. Settings */}
        <SidebarButton
          active={isSettingsActive}
          title="Settings"
          onClick={() => handleSelect("settings")}
        />
      </nav>
    </div>
  );
}

export function Sidebar(props: SidebarProps) {
  return (
    <aside className="hidden md:flex fixed left-0 top-14 h-[calc(100vh-3.5rem)] w-56 flex-col overflow-y-auto rounded-none border-r border-l-0 border-[#000000] dark:border-slate-800 bg-white dark:bg-slate-950 p-2.5 shadow-sm z-30 transition-colors duration-200">
      <SidebarContent {...props} />
    </aside>
  );
}

export default Sidebar;
