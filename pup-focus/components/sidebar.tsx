"use client";

import React, { useState, useEffect } from "react";
import { Activity, Archive, Calendar, ClipboardCheck, Clock, Group, Hourglass, NavArrowDown, NavArrowRight, Page, Settings, UserBadgeCheck, ViewGrid } from "iconoir-react";
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
    return "bg-slate-200 dark:bg-slate-700/50 text-slate-800 dark:text-slate-200 border border-slate-400 dark:border-slate-600";
  }
  if (role.includes("faculty")) {
    return "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700";
  }
  // Default: Admin
  return "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700";
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
  Icon,
  onClick,
}: {
  active: boolean;
  title: string;
  description?: string;
  Icon?: React.ComponentType<{ className?: string; strokeWidth?: number | string }>;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-xs transition-all cursor-pointer ${
        active
          ? "rounded-full bg-amber-500/15 text-amber-950 dark:bg-amber-500/20 dark:text-amber-300 font-semibold"
          : "rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800/50 font-medium"
      }`}
    >
      {Icon && (
        <Icon
          strokeWidth={2}
          className={
            active
              ? "h-4 w-4 text-amber-700 dark:text-amber-300 shrink-0"
              : "h-4 w-4 text-slate-500 dark:text-slate-400 shrink-0"
          }
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate">{title}</p>
        {description ? (
          <p
            className={`mt-0.5 text-[10px] font-normal truncate ${
              active
                ? "text-amber-800/80 dark:text-amber-300/80"
                : "text-slate-500 dark:text-slate-400"
            }`}
          >
            {description}
          </p>
        ) : null}
      </div>
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

  useEffect(() => {
    setHasAvatarError(false);
  }, [profileImageUrl]);

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

  const [isUserManagementOpen, setIsUserManagementOpen] = useState<boolean>(
    isUserManagementActive,
  );
  const [isAcademicCycleOpen, setIsAcademicCycleOpen] = useState<boolean>(
    isAcademicCycleActive,
  );

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
      <div className="my-1.5 rounded-xl bg-white dark:bg-slate-900/90 border border-slate-300 dark:border-slate-800 p-2.5 flex flex-col items-center shadow-xs shadow-slate-300/40 dark:shadow-none transition-colors">
        <button
          type="button"
          onClick={() => handleSelect("settings")}
          className="relative mb-2 cursor-pointer transition-transform hover:scale-105 group focus:outline-hidden"
          title="Manage Profile & Settings"
        >
          {profileImageUrl && !hasAvatarError ? (
            <img
              src={profileImageUrl}
              alt={adminName ?? "User"}
              className="w-12 h-12 rounded-full object-cover border-2 border-amber-500/40 bg-slate-100 dark:bg-slate-950 shadow-md ring-2 ring-white dark:ring-slate-900 group-hover:border-amber-500 transition-colors"
              onError={() => setHasAvatarError(true)}
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-amber-500/10 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 border border-amber-500/30 dark:border-amber-500/40 font-bold text-xs flex items-center justify-center shadow-xs ring-2 ring-white dark:ring-slate-900 group-hover:border-amber-500/60 transition-colors">
              {getSidebarInitials(adminName, isSuperAdmin ? "SA" : "AD")}
            </div>
          )}
          <span
            className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900"
            title="Active"
          />
        </button>

        <p className="mt-0.5 font-semibold text-slate-900 dark:text-slate-100 text-center text-xs sm:text-sm">
          {extractFirstName(adminName, roleTitle)}
        </p>

        <div className="my-1.5 h-px w-full bg-slate-300 dark:bg-slate-800" />

        <span
          className={`mt-0.5 inline-flex items-center justify-center px-2.5 py-0.5 text-[10px] uppercase tracking-[0.12em] font-semibold rounded-full border ${getRoleBadgeClasses(roleTitle)}`}
        >
          {roleTitle}
        </span>
      </div>

      <nav className="mt-1.5 space-y-1 flex-1 overflow-y-auto">
        {/* 1. Dashboard */}
        <SidebarButton
          active={isDashboardActive}
          title="Dashboard"
          Icon={ViewGrid}
          onClick={() => handleSelect("dashboard")}
        />

        {/* 2. User Management (Super Admin Dropdown) or Faculty Management (Standard Admin) */}
        {isSuperAdmin ? (
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => setIsUserManagementOpen((prev) => !prev)}
              className={`flex w-full items-center justify-between gap-2.5 px-4 py-2.5 text-left text-xs transition-all cursor-pointer ${
                isUserManagementActive
                  ? "rounded-full bg-amber-500/15 text-amber-950 dark:bg-amber-500/20 dark:text-amber-300 font-semibold"
                  : "rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800/50 font-medium"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Group
                  strokeWidth={2}
                  className={
                    isUserManagementActive
                      ? "h-4 w-4 text-amber-700 dark:text-amber-300 shrink-0"
                      : "h-4 w-4 text-slate-500 dark:text-slate-400 shrink-0"
                  }
                />
                <span className="truncate">User Management</span>
              </div>
              {isUserManagementOpen ? (
                <NavArrowDown strokeWidth={2} className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400 shrink-0 ml-1" />
              ) : (
                <NavArrowRight strokeWidth={2} className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400 shrink-0 ml-1" />
              )}
            </button>

            {/* Child Sub-items (Indented with left border indicator) */}
            {isUserManagementOpen && (
              <div className="ml-4 pl-2 border-l border-slate-300 dark:border-slate-800 flex flex-col gap-1 mt-1">
                <button
                  type="button"
                  onClick={() => handleSelect("accounts")}
                  className={`flex w-full items-center gap-2 px-3.5 py-2 text-xs transition-all cursor-pointer ${
                    isAccountsActive
                      ? "rounded-full bg-amber-500/15 text-amber-950 dark:bg-amber-500/20 dark:text-amber-300 font-semibold"
                      : "rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800/50 font-medium"
                  }`}
                >
                  <UserBadgeCheck
                    strokeWidth={2}
                    className={
                      isAccountsActive
                        ? "h-3.5 w-3.5 text-amber-700 dark:text-amber-300 shrink-0"
                        : "h-3.5 w-3.5 text-slate-500 dark:text-slate-400 shrink-0"
                    }
                  />
                  <span>Admin Management</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelect("faculty")}
                  className={`flex w-full items-center gap-2 px-3.5 py-2 text-xs transition-all cursor-pointer ${
                    isFacultyActive
                      ? "rounded-full bg-amber-500/15 text-amber-950 dark:bg-amber-500/20 dark:text-amber-300 font-semibold"
                      : "rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800/50 font-medium"
                  }`}
                >
                  <Group
                    strokeWidth={2}
                    className={
                      isFacultyActive
                        ? "h-3.5 w-3.5 text-amber-700 dark:text-amber-300 shrink-0"
                        : "h-3.5 w-3.5 text-slate-500 dark:text-slate-400 shrink-0"
                    }
                  />
                  <span>Faculty Management</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <SidebarButton
            active={isFacultyActive}
            title="Faculty Management"
            Icon={Group}
            onClick={() => handleSelect("facultyManagement")}
          />
        )}

        {/* 3. Requirements Verification (Admin Module) */}
        <SidebarButton
          active={isVerificationActive}
          title="Requirements Verification"
          Icon={ClipboardCheck}
          onClick={() =>
            handleSelect(isSuperAdmin ? "verification" : "requirements")
          }
        />

        {/* 4. Collapsible Parent Item: Academic Cycle Management */}
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => setIsAcademicCycleOpen((prev) => !prev)}
            className={`flex w-full items-center justify-between gap-2.5 px-4 py-2.5 text-left text-xs transition-all cursor-pointer ${
              isAcademicCycleActive
                ? "rounded-full bg-amber-500/15 text-amber-950 dark:bg-amber-500/20 dark:text-amber-300 font-semibold"
                : "rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800/50 font-medium"
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Calendar
                strokeWidth={2}
                className={
                  isAcademicCycleActive
                    ? "h-4 w-4 text-amber-700 dark:text-amber-300 shrink-0"
                    : "h-4 w-4 text-slate-500 dark:text-slate-400 shrink-0"
                }
              />
              <span className="truncate">Academic Cycle</span>
            </div>
            {isAcademicCycleOpen ? (
              <NavArrowDown strokeWidth={2} className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400 shrink-0 ml-1" />
            ) : (
              <NavArrowRight strokeWidth={2} className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400 shrink-0 ml-1" />
            )}
          </button>

          {/* Child Sub-items (Indented with left border indicator) */}
          {isAcademicCycleOpen && (
            <div className="ml-4 pl-2 border-l border-slate-300 dark:border-slate-800 flex flex-col gap-1 mt-1">
              <button
                type="button"
                onClick={() =>
                  handleSelect(isSuperAdmin ? "terms" : "academicTerms")
                }
                className={`flex w-full items-center gap-2 px-3.5 py-2 text-xs transition-all cursor-pointer ${
                  isTermsActive
                    ? "rounded-full bg-amber-500/15 text-amber-950 dark:bg-amber-500/20 dark:text-amber-300 font-semibold"
                    : "rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800/50 font-medium"
                }`}
              >
                <Clock
                  strokeWidth={2}
                  className={
                    isTermsActive
                      ? "h-3.5 w-3.5 text-amber-700 dark:text-amber-300 shrink-0"
                      : "h-3.5 w-3.5 text-slate-500 dark:text-slate-400 shrink-0"
                  }
                />
                <span>Academic Terms</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  handleSelect(isSuperAdmin ? "window" : "submissionWindow")
                }
                className={`flex w-full items-center gap-2 px-3.5 py-2 text-xs transition-all cursor-pointer ${
                  isWindowActive
                    ? "rounded-full bg-amber-500/15 text-amber-950 dark:bg-amber-500/20 dark:text-amber-300 font-semibold"
                    : "rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800/50 font-medium"
                }`}
              >
                <Hourglass
                  strokeWidth={2}
                  className={
                    isWindowActive
                      ? "h-3.5 w-3.5 text-amber-700 dark:text-amber-300 shrink-0"
                      : "h-3.5 w-3.5 text-slate-500 dark:text-slate-400 shrink-0"
                  }
                />
                <span>Submission Window</span>
              </button>
              {isSuperAdmin && (
                <>
                  <button
                    type="button"
                    onClick={() => handleSelect("templates")}
                    className={`flex w-full items-center gap-2 px-3.5 py-2 text-xs transition-all cursor-pointer ${
                      isTemplatesActive
                        ? "rounded-full bg-amber-500/15 text-amber-950 dark:bg-amber-500/20 dark:text-amber-300 font-semibold"
                        : "rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800/50 font-medium"
                    }`}
                  >
                    <Page
                      strokeWidth={2}
                      className={
                        isTemplatesActive
                          ? "h-3.5 w-3.5 text-amber-700 dark:text-amber-300 shrink-0"
                          : "h-3.5 w-3.5 text-slate-500 dark:text-slate-400 shrink-0"
                      }
                    />
                    <span>Requirement Templates</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelect("backups")}
                    className={`flex w-full items-center gap-2 px-3.5 py-2 text-xs transition-all cursor-pointer ${
                      isBackupsActive
                        ? "rounded-full bg-amber-500/15 text-amber-950 dark:bg-amber-500/20 dark:text-amber-300 font-semibold"
                        : "rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800/50 font-medium"
                    }`}
                  >
                    <Archive
                      strokeWidth={2}
                      className={
                        isBackupsActive
                          ? "h-3.5 w-3.5 text-amber-700 dark:text-amber-300 shrink-0"
                          : "h-3.5 w-3.5 text-slate-500 dark:text-slate-400 shrink-0"
                      }
                    />
                    <span>Backups & Archive</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* 5. Audit Trail & System Logs (Admin Module) */}
        {isSuperAdmin && (
          <SidebarButton
            active={isAuditActive}
            title="Audit Trail"
            Icon={Activity}
            onClick={() => handleSelect("audit")}
          />
        )}

        {/* 6. Settings */}
        <SidebarButton
          active={isSettingsActive}
          title="Settings"
          Icon={Settings}
          onClick={() => handleSelect("settings")}
        />
      </nav>
    </div>
  );
}

export function Sidebar(props: SidebarProps) {
  return (
    <aside className="hidden md:flex md:flex-col fixed left-0 top-14 h-[calc(100vh-3.5rem)] w-56 overflow-y-auto rounded-none border-r border-l-0 border-slate-300 dark:border-slate-800 bg-[#F6F8FC] dark:bg-slate-950 p-2.5 shadow-sm z-30 transition-colors duration-200">
      <SidebarContent {...props} />
    </aside>
  );
}

export default Sidebar;
