"use client";

import React, { useState, useEffect } from "react";
import { Activity, Archive, Calendar, ClipboardCheck, Eye, Group, Hourglass, NavArrowDown, NavArrowRight, Page, Settings, UserBadgeCheck, ViewGrid } from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";
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
  return "bg-slate-200/70 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
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
      className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium transition-colors cursor-pointer rounded-lg ${
        active
          ? "bg-amber-400/20 text-white font-semibold border-l-2 border-amber-400 shadow-xs"
          : "text-amber-100/80 hover:bg-white/10 hover:text-white"
      }`}
    >
      {Icon && (
        <Icon
          strokeWidth={2}
          className={`h-5 w-5 shrink-0 ${
            active
              ? "text-amber-300 stroke-[2]"
              : "text-amber-200/70"
          }`}
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate">{title}</p>
        {description ? (
          <p
            className={`mt-0.5 text-xs font-normal truncate ${
              active
                ? "text-amber-200/90"
                : "text-amber-200/60"
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
  const isPreviewsActive =
    activeSection === "previews" ||
    activeSection === "preview" ||
    activeSection === "dev-preview";
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

  const isFaculty = Boolean(
    (roleTitle || "").toLowerCase().includes("faculty"),
  );

  return (
    <div className="flex flex-col h-full w-full">
      <div className={`my-1.5 bg-[#6b0000]/80 border border-amber-400/40 ${isFaculty ? "p-4 sm:p-5 rounded-2xl" : "p-4 rounded-xl"} text-center flex flex-col items-center transition-colors shadow-xs`}>
        <button
          type="button"
          onClick={() => handleSelect("settings")}
          className={`relative ${isFaculty ? "mb-2.5" : "mb-2"} cursor-pointer transition-transform hover:scale-105 group focus:outline-hidden`}
          title="Manage Profile & Settings"
        >
          {profileImageUrl && !hasAvatarError ? (
            <img
              src={profileImageUrl}
              alt={adminName ?? "User"}
              className={`${isFaculty ? "w-24 h-24" : "w-14 h-14"} rounded-full border-2 border-amber-400/70 shadow-md ring-2 ring-amber-400/30 group-hover:border-amber-400 transition-colors ${
                profileImageUrl.includes("pup-seal.png") || profileImageUrl.includes("pup-focus-emblem-logo.png")
                  ? "object-contain p-1 bg-slate-900"
                  : "object-cover bg-slate-100"
              }`}
              onError={() => setHasAvatarError(true)}
            />
          ) : isSuperAdmin ? (
            <img
              src="/icons/pup-seal.png"
              alt="PUP"
              className={`${isFaculty ? "w-24 h-24" : "w-14 h-14"} rounded-full object-contain p-1 bg-slate-900 shadow-md border-2 border-amber-400/60 ring-2 ring-amber-400/30 group-hover:border-amber-400 transition-colors`}
            />
          ) : (
            <div className={`${isFaculty ? "w-24 h-24 text-2xl font-bold" : "w-14 h-14 text-sm font-bold"} rounded-full bg-amber-500/20 text-amber-200 border-2 border-amber-400/40 flex items-center justify-center shadow-xs ring-2 ring-amber-400/30 group-hover:border-amber-400 transition-colors`}>
              {getSidebarInitials(adminName, "AD")}
            </div>
          )}
          <span
            className={`absolute ${isFaculty ? "bottom-1 right-1 w-4 h-4" : "bottom-0 right-0 w-3.5 h-3.5"} rounded-full bg-emerald-500 border-2 border-[#6b0000] ring-1 ring-emerald-400/40`}
            title="Active"
          />
        </button>

        <span className={`${isFaculty ? "text-sm sm:text-base font-semibold text-amber-200/90" : "text-xs font-medium text-amber-200/90"} tracking-wide`}>
          Welcome,
        </span>
        <p className={`mt-1 font-extrabold text-white text-center tracking-tight ${isFaculty ? "text-xl sm:text-2xl leading-snug break-words max-w-full px-1" : "text-sm sm:text-base"}`}>
          {extractFirstName(adminName, roleTitle)}
        </p>

        <div className={`${isFaculty ? "my-2.5" : "my-2"} h-px w-full bg-amber-400/50`} />

        <span
          className={`mt-0.5 inline-flex items-center justify-center bg-amber-400/15 text-amber-300 border border-amber-400/40 ${isFaculty ? "px-3.5 py-1 shadow-2xs" : "px-3 py-1"} text-xs font-bold uppercase tracking-wider rounded-full`}
        >
          {roleTitle}
        </span>
      </div>

      <div className="my-2 h-px w-full bg-amber-400/50" />

      <nav className="mt-1.5 space-y-1.5 flex-1">
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
              className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium transition-colors cursor-pointer rounded-lg ${
                isUserManagementActive
                  ? "bg-amber-400/20 text-white font-semibold border-l-2 border-amber-400 shadow-xs"
                  : "text-amber-100/80 hover:bg-white/10 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Group
                  strokeWidth={2}
                  className={`h-5 w-5 shrink-0 ${
                    isUserManagementActive
                      ? "text-amber-300 stroke-[2]"
                      : "text-amber-200/70"
                  }`}
                />
                <span className="truncate">User Management</span>
              </div>
              {isUserManagementOpen ? (
                <NavArrowDown
                  strokeWidth={2}
                  className={`h-4 w-4 shrink-0 transition-transform ${
                    isUserManagementActive ? "text-amber-300" : "text-amber-200/60"
                  }`}
                />
              ) : (
                <NavArrowRight
                  strokeWidth={2}
                  className={`h-4 w-4 shrink-0 transition-transform ${
                    isUserManagementActive ? "text-amber-300" : "text-amber-200/60"
                  }`}
                />
              )}
            </button>

            {/* Child Sub-items (Indented with left border indicator) */}
            {isUserManagementOpen && (
              <div className="ml-3 pl-2.5 border-l border-amber-400/40 flex flex-col gap-1 mt-1">
                <button
                  type="button"
                  onClick={() => handleSelect("accounts")}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors cursor-pointer rounded-md ${
                    isAccountsActive
                      ? "bg-amber-400/20 text-white font-semibold border-l-2 border-amber-400 shadow-xs"
                      : "text-amber-100/80 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <UserBadgeCheck
                    strokeWidth={2}
                    className={`h-4 w-4 shrink-0 ${
                      isAccountsActive ? "text-amber-300 stroke-[2]" : "text-amber-200/70"
                    }`}
                  />
                  <span>Admin Management</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelect("faculty")}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors cursor-pointer rounded-md ${
                    isFacultyActive
                      ? "bg-amber-400/20 text-white font-semibold border-l-2 border-amber-400 shadow-xs"
                      : "text-amber-100/80 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Group
                    strokeWidth={2}
                    className={`h-4 w-4 shrink-0 ${
                      isFacultyActive ? "text-amber-300 stroke-[2]" : "text-amber-200/70"
                    }`}
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
            className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium transition-colors cursor-pointer rounded-lg ${
              isAcademicCycleActive
                ? "bg-amber-400/20 text-white font-semibold border-l-2 border-amber-400 shadow-xs"
                : "text-amber-100/80 hover:bg-white/10 hover:text-white"
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <Calendar
                strokeWidth={2}
                className={`h-5 w-5 shrink-0 ${
                  isAcademicCycleActive
                    ? "text-amber-300 stroke-[2]"
                    : "text-amber-200/70"
                }`}
              />
              <span className="truncate">Academic Cycle</span>
            </div>
            {isAcademicCycleOpen ? (
              <NavArrowDown
                strokeWidth={2}
                className={`h-4 w-4 shrink-0 transition-transform ${
                  isAcademicCycleActive ? "text-amber-300" : "text-amber-200/60"
                }`}
              />
            ) : (
              <NavArrowRight
                strokeWidth={2}
                className={`h-4 w-4 shrink-0 transition-transform ${
                  isAcademicCycleActive ? "text-amber-300" : "text-amber-200/60"
                }`}
              />
            )}
          </button>

          {/* Child Sub-items (Indented with left border indicator) */}
          {isAcademicCycleOpen && (
            <div className="ml-3 pl-2.5 border-l border-amber-400/40 flex flex-col gap-1 mt-1">
              <button
                type="button"
                onClick={() =>
                  handleSelect(isSuperAdmin ? "terms" : "academicTerms")
                }
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors cursor-pointer rounded-md whitespace-nowrap ${
                  isTermsActive
                    ? "bg-amber-400/20 text-white font-semibold border-l-2 border-amber-400 shadow-xs"
                    : "text-amber-100/80 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Calendar
                  strokeWidth={2}
                  className={`h-4 w-4 shrink-0 ${
                    isTermsActive ? "text-amber-300 stroke-[2]" : "text-amber-200/70"
                  }`}
                />
                <span className="whitespace-nowrap">Academic Year & Semester</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  handleSelect(isSuperAdmin ? "window" : "submissionWindow")
                }
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors cursor-pointer rounded-md whitespace-nowrap ${
                  isWindowActive
                    ? "bg-amber-400/20 text-white font-semibold border-l-2 border-amber-400 shadow-xs"
                    : "text-amber-100/80 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Hourglass
                  strokeWidth={2}
                  className={`h-4 w-4 shrink-0 ${
                    isWindowActive ? "text-amber-300 stroke-[2]" : "text-amber-200/70"
                  }`}
                />
                <span className="whitespace-nowrap">Submission Schedule</span>
              </button>
              {isSuperAdmin && (
                <>
                  <button
                    type="button"
                    onClick={() => handleSelect("templates")}
                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors cursor-pointer rounded-md whitespace-nowrap ${
                      isTemplatesActive
                        ? "bg-amber-400/20 text-white font-semibold border-l-2 border-amber-400 shadow-xs"
                        : "text-amber-100/80 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <Page
                      strokeWidth={2}
                      className={`h-4 w-4 shrink-0 ${
                        isTemplatesActive ? "text-amber-300 stroke-[2]" : "text-amber-200/70"
                      }`}
                    />
                    <span className="whitespace-nowrap">Requirement Templates</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelect("backups")}
                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors cursor-pointer rounded-md whitespace-nowrap ${
                      isBackupsActive
                        ? "bg-amber-400/20 text-white font-semibold border-l-2 border-amber-400 shadow-xs"
                        : "text-amber-100/80 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <Archive
                      strokeWidth={2}
                      className={`h-4 w-4 shrink-0 ${
                        isBackupsActive ? "text-amber-300 stroke-[2]" : "text-amber-200/70"
                      }`}
                    />
                    <span className="whitespace-nowrap">Backups & Archive</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* 5. Audit Logs (Admin Module) */}
        {isSuperAdmin && (
          <SidebarButton
            active={isAuditActive}
            title="Audit Logs"
            Icon={Activity}
            onClick={() => handleSelect("audit")}
          />
        )}

        {/* 6. Developer Feature Previews (Super Admin) */}
        {isSuperAdmin && (
          <SidebarButton
            active={isPreviewsActive}
            title="Feature Previews"
            Icon={Eye}
            onClick={() => handleSelect("previews")}
          />
        )}

        {/* 7. Settings */}
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
    <aside className="hidden md:flex md:flex-col fixed left-0 top-14 h-[calc(100vh-3.5rem)] w-72 overflow-y-auto rounded-none bg-[#800000] text-amber-50 border-r-2 border-amber-400/60 p-3.5 shadow-md z-30 transition-colors duration-200">
      <SidebarContent {...props} />
    </aside>
  );
}

export default Sidebar;
