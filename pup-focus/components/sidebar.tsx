"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Activity, Archive, Calendar, ClipboardCheck, GraduationCap, Group, Hourglass, NavArrowDown, NavArrowRight, Page, Settings, SidebarCollapse, SidebarExpand, UserBadgeCheck, ViewGrid } from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";
import { BrandMark } from "@/components/shared/brand-mark";
import { SidebarProfileCard } from "@/components/shared/sidebar-profile-card";
import { extractFirstName } from "@/lib/faculty-profile";

export const SIDEBAR_COLLAPSED_STORAGE_KEY = "pup_focus_sidebar_collapsed";

export function useSidebarCollapsed(
  storageKey = SIDEBAR_COLLAPSED_STORAGE_KEY,
) {
  const [collapsed, setCollapsedState] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey) === "true";
      setCollapsedState(saved);
      document.documentElement.dataset.sidebarCollapsed = saved
        ? "true"
        : "false";
    } catch {
      // safe fallback when storage is unavailable
    }
    return () => {
      delete document.documentElement.dataset.sidebarCollapsed;
    };
  }, [storageKey]);

  const setCollapsed = useCallback(
    (next: boolean) => {
      setCollapsedState(next);
      try {
        window.localStorage.setItem(storageKey, String(next));
        document.documentElement.dataset.sidebarCollapsed = next
          ? "true"
          : "false";
      } catch {
        // safe fallback
      }
    },
    [storageKey],
  );

  const toggle = useCallback(() => {
    setCollapsedState((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(storageKey, String(next));
        document.documentElement.dataset.sidebarCollapsed = next
          ? "true"
          : "false";
      } catch {
        // safe fallback
      }
      return next;
    });
  }, [storageKey]);

  return { collapsed, setCollapsed, toggle };
}

export interface SidebarProps {
  activeSection: string;
  setActiveSection: (section: any) => void;
  adminName?: string | null;
  roleTitle?: string;
  isSuperAdmin?: boolean;
  profileImageUrl?: string | null;
  onNavigate?: () => void;
  showBrand?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onRequestExpand?: () => void;
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
  collapsed = false,
}: {
  active: boolean;
  title: string;
  description?: string;
  Icon?: React.ComponentType<{ className?: string; strokeWidth?: number | string }>;
  onClick: () => void;
  collapsed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={collapsed ? title : undefined}
      aria-label={collapsed ? title : undefined}
      className={`flex w-full items-center ${collapsed ? "justify-center px-0 py-3" : "gap-3 px-4 py-3 text-left"} text-sm font-medium transition-colors cursor-pointer rounded-lg ${
        active
          ? "bg-amber-500 text-slate-900 font-bold shadow-sm"
          : "text-amber-100/80 hover:bg-white/10 hover:text-white"
      }`}
    >
      {Icon && (
        <Icon
          strokeWidth={active ? 2.5 : 2}
          className={`h-5 w-5 shrink-0 ${
            active
              ? "text-slate-900"
              : "text-amber-200/70"
          }`}
        />
      )}
      {!collapsed && (
        <div className="min-w-0 flex-1">
          <p className="truncate">{title}</p>
          {description ? (
            <p
              className={`mt-0.5 text-xs font-normal truncate ${
                active
                  ? "text-slate-800"
                  : "text-amber-200/60"
              }`}
            >
              {description}
            </p>
          ) : null}
        </div>
      )}
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
  showBrand = true,
  collapsed = false,
  onToggleCollapse,
  onRequestExpand,
}: SidebarProps) {
  const isSuperAdmin =
    isSuperAdminProp ??
    Boolean(
      (roleTitle || "").toLowerCase().includes("super") ||
        (roleTitle || "").toLowerCase() === "admin",
    );
  const isStaff = (roleTitle || "").toLowerCase().includes("staff");

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
  const isProgramsActive = activeSection === "programs";
  const isAuditActive =
    activeSection === "audit" ||
    activeSection === "auditLogs" ||
    activeSection === "audit-logs" ||
    activeSection === "transaction-logs" ||
    activeSection === "transactionLogs";
  const isSettingsActive = activeSection === "settings";

  const isAcademicCycleActive =
    isTermsActive || isWindowActive || isTemplatesActive || isBackupsActive || isProgramsActive;
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

  const [openFlyout, setOpenFlyout] = useState<{
    key: "user" | "academic";
    top: number;
  } | null>(null);
  const userMgmtBtnRef = useRef<HTMLButtonElement>(null);
  const academicBtnRef = useRef<HTMLButtonElement>(null);
  const flyoutRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!collapsed) {
      setOpenFlyout(null);
    }
  }, [collapsed]);

  useEffect(() => {
    if (!openFlyout) return;
    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (
        flyoutRef.current?.contains(target) ||
        userMgmtBtnRef.current?.contains(target) ||
        academicBtnRef.current?.contains(target)
      ) {
        return;
      }
      setOpenFlyout(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenFlyout(null);
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openFlyout]);

  const toggleFlyout = (
    key: "user" | "academic",
    btn: HTMLButtonElement | null,
  ) => {
    setOpenFlyout((prev) => {
      if (prev?.key === key) return null;
      const rect = btn?.getBoundingClientRect();
      const estimatedHeight = key === "academic" ? 260 : 150;
      const maxTop =
        typeof window !== "undefined"
          ? Math.max(64, window.innerHeight - estimatedHeight - 16)
          : 300;
      const top = rect ? Math.min(Math.max(64, rect.top), maxTop) : 140;
      return { key, top };
    });
  };

  const handleSelect = (section: string) => {
    setOpenFlyout(null);
    setActiveSection(section);
    if (onNavigate) {
      onNavigate();
    }
  };

  const userManagementItems = [
    {
      key: "accounts",
      section: "accounts",
      label: "Admin & Staff Management",
      active: isAccountsActive,
      Icon: UserBadgeCheck,
      nowrap: false,
      title: undefined as string | undefined,
    },
    {
      key: "faculty",
      section: "faculty",
      label: "Faculty Management",
      active: isFacultyActive,
      Icon: Group,
      nowrap: false,
      title: undefined as string | undefined,
    },
  ];

  const academicCycleItems = [
    {
      key: "terms",
      section: isSuperAdmin ? "terms" : "academicTerms",
      label: "Academic Year & Semester",
      active: isTermsActive,
      Icon: Calendar,
      nowrap: true,
      title: undefined as string | undefined,
    },
    {
      key: "window",
      section: isSuperAdmin ? "window" : "submissionWindow",
      label: "Submission Schedule & Extension Requests",
      active: isWindowActive,
      Icon: Hourglass,
      nowrap: false,
      title: "Submission Schedule & Extension Requests",
    },
    {
      key: "templates",
      section: "templates",
      label: "Templates & Programs",
      active: isTemplatesActive || isProgramsActive,
      Icon: Page,
      nowrap: true,
      title: "Requirement Templates & Academic Programs",
    },
    ...(isSuperAdmin
      ? [
          {
            key: "backups",
            section: "backups",
            label: "Backups & Archive",
            active: isBackupsActive,
            Icon: Archive,
            nowrap: true,
            title: undefined as string | undefined,
          },
        ]
      : []),
  ];

  const renderSubItems = (
    items: typeof userManagementItems,
    variant: "inline" | "flyout",
  ) =>
    items.map(({ key, section, label, active, Icon, nowrap, title }) => (
      <button
        key={key}
        type="button"
        onClick={() => handleSelect(section)}
        title={title}
        className={`flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors cursor-pointer rounded-lg text-left ${
          variant === "inline" && nowrap ? "whitespace-nowrap" : ""
        } ${
          active
            ? "bg-amber-500 text-slate-900 font-bold shadow-sm"
            : "text-amber-100/85 hover:bg-white/10 hover:text-white"
        }`}
      >
        <Icon
          strokeWidth={active ? 2.5 : 2}
          className={`h-4 w-4 shrink-0 ${
            active ? "text-slate-900" : "text-amber-200/75"
          }`}
        />
        <span className={variant === "inline" && nowrap ? "whitespace-nowrap" : "leading-tight"}>
          {label}
        </span>
      </button>
    ));

  const activeFlyoutMeta =
    openFlyout?.key === "user"
      ? { title: "User Management", items: userManagementItems }
      : openFlyout?.key === "academic"
        ? { title: "Academic Cycle", items: academicCycleItems }
        : null;

  return (
    <div className="flex flex-col h-full w-full">
      {/* Brand Header */}
      {showBrand && (
        <div
          className={`flex ${
            collapsed
              ? "flex-col items-center gap-2 px-0 py-1 pb-3"
              : "items-center justify-between gap-2 px-1 py-1 pb-3"
          } mb-1 border-b border-white/10 shrink-0`}
        >
          <div className={`flex items-center ${collapsed ? "justify-center" : "gap-2.5 min-w-0"}`}>
            <BrandMark size={collapsed ? 32 : 38} className="shrink-0" />
            {!collapsed && (
              <div className="flex flex-col min-w-0">
                <span className="font-extrabold text-white text-lg tracking-tight whitespace-nowrap leading-tight">
                  <span className="text-amber-400">PUP</span> FOCUS
                </span>
                <span className="text-[10px] text-amber-200/80 font-medium tracking-wide truncate">
                  Bataan Campus
                </span>
              </div>
            )}
          </div>
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              title={collapsed ? "Expand side panel" : "Minimize side panel"}
              aria-label={collapsed ? "Expand side panel" : "Minimize side panel"}
              className="group inline-flex h-8 w-8 items-center justify-center rounded-lg border border-amber-300/50 bg-[#660000]/90 hover:bg-white/15 text-amber-300 hover:text-white transition-colors cursor-pointer shadow-2xs shrink-0"
            >
              {collapsed ? (
                <SidebarExpand strokeWidth={2.2} className="h-4 w-4 text-amber-300 group-hover:text-white transition-colors" />
              ) : (
                <SidebarCollapse strokeWidth={2.2} className="h-4 w-4 text-amber-300 group-hover:text-white transition-colors" />
              )}
            </button>
          )}
        </div>
      )}

      <div className="my-1.5">
        <SidebarProfileCard
          name={extractFirstName(adminName, roleTitle)}
          roleTitle={roleTitle}
          avatarUrl={profileImageUrl}
          fallbackAvatarSrc={isSuperAdmin ? "/icons/pup-seal.png" : undefined}
          initials={getSidebarInitials(adminName, "AD")}
          onClick={() => handleSelect("settings")}
          collapsed={collapsed}
        />
      </div>

      <div className="my-2.5 h-px w-full bg-white/10" />

      <nav className="mt-1.5 space-y-1.5 flex-1">
        {/* 1. Dashboard */}
        <SidebarButton
          active={isDashboardActive}
          title="Dashboard"
          Icon={ViewGrid}
          onClick={() => handleSelect("dashboard")}
          collapsed={collapsed}
        />

        {/* 2. User Management (Super Admin Dropdown) or Faculty Management (Standard Admin) */}
        {isSuperAdmin ? (
          <div className="space-y-1">
            <button
              ref={userMgmtBtnRef}
              type="button"
              onClick={() => {
                if (collapsed) {
                  toggleFlyout("user", userMgmtBtnRef.current);
                } else {
                  setIsUserManagementOpen((prev) => !prev);
                }
              }}
              title={collapsed ? "User Management" : undefined}
              aria-label={collapsed ? "User Management" : undefined}
              aria-expanded={collapsed ? openFlyout?.key === "user" : isUserManagementOpen}
              className={`relative flex w-full items-center ${
                collapsed ? "justify-center px-0 py-3" : "justify-between gap-3 px-4 py-3 text-left"
              } text-sm font-medium transition-colors cursor-pointer rounded-lg ${
                isUserManagementActive
                  ? collapsed
                    ? "bg-amber-500 text-slate-900 font-bold shadow-sm"
                    : "bg-white/10 text-amber-200 font-semibold"
                  : collapsed && openFlyout?.key === "user"
                    ? "bg-white/15 text-white ring-1 ring-amber-400/60"
                    : "text-amber-100/80 hover:bg-white/10 hover:text-white"
              }`}
            >
              <div className={`flex items-center ${collapsed ? "justify-center" : "gap-3 min-w-0"}`}>
                <Group
                  strokeWidth={collapsed && isUserManagementActive ? 2.5 : 2}
                  className={`h-5 w-5 shrink-0 ${
                    isUserManagementActive
                      ? collapsed
                        ? "text-slate-900"
                        : "text-amber-300 stroke-[2]"
                      : "text-amber-200/70"
                  }`}
                />
                {!collapsed && <span className="truncate">User Management</span>}
              </div>
              {collapsed ? (
                <NavArrowRight
                  strokeWidth={2.2}
                  className={`absolute right-1 top-1/2 -translate-y-1/2 h-3 w-3 ${
                    isUserManagementActive ? "text-slate-900/70" : "text-amber-200/60"
                  }`}
                />
              ) : isUserManagementOpen ? (
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
            {!collapsed && isUserManagementOpen && (
              <div className="ml-3 pl-2.5 border-l border-amber-400/30 flex flex-col gap-1 mt-1">
                {renderSubItems(userManagementItems, "inline")}
              </div>
            )}
          </div>
        ) : (
          <SidebarButton
            active={isFacultyActive}
            title="Faculty Management"
            Icon={Group}
            onClick={() => handleSelect("facultyManagement")}
            collapsed={collapsed}
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
          collapsed={collapsed}
        />

        {/* 4. Collapsible Parent Item: Academic Cycle Management */}
        {!isStaff && (
          <div className="space-y-1">
            <button
              ref={academicBtnRef}
              type="button"
              onClick={() => {
                if (collapsed) {
                  toggleFlyout("academic", academicBtnRef.current);
                } else {
                  setIsAcademicCycleOpen((prev) => !prev);
                }
              }}
              title={collapsed ? "Academic Cycle" : undefined}
              aria-label={collapsed ? "Academic Cycle" : undefined}
              aria-expanded={collapsed ? openFlyout?.key === "academic" : isAcademicCycleOpen}
              className={`relative flex w-full items-center ${
                collapsed ? "justify-center px-0 py-3" : "justify-between gap-3 px-4 py-3 text-left"
              } text-sm font-medium transition-colors cursor-pointer rounded-lg ${
                isAcademicCycleActive
                  ? collapsed
                    ? "bg-amber-500 text-slate-900 font-bold shadow-sm"
                    : "bg-white/10 text-amber-200 font-semibold"
                  : collapsed && openFlyout?.key === "academic"
                    ? "bg-white/15 text-white ring-1 ring-amber-400/60"
                    : "text-amber-100/80 hover:bg-white/10 hover:text-white"
              }`}
            >
              <div className={`flex items-center ${collapsed ? "justify-center" : "gap-3 min-w-0"}`}>
                <Calendar
                  strokeWidth={collapsed && isAcademicCycleActive ? 2.5 : 2}
                  className={`h-5 w-5 shrink-0 ${
                    isAcademicCycleActive
                      ? collapsed
                        ? "text-slate-900"
                        : "text-amber-300 stroke-[2]"
                      : "text-amber-200/70"
                  }`}
                />
                {!collapsed && <span className="truncate">Academic Cycle</span>}
              </div>
              {collapsed ? (
                <NavArrowRight
                  strokeWidth={2.2}
                  className={`absolute right-1 top-1/2 -translate-y-1/2 h-3 w-3 ${
                    isAcademicCycleActive ? "text-slate-900/70" : "text-amber-200/60"
                  }`}
                />
              ) : isAcademicCycleOpen ? (
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
            {!collapsed && isAcademicCycleOpen && (
              <div className="ml-3 pl-2.5 border-l border-amber-400/30 flex flex-col gap-1 mt-1">
                {renderSubItems(academicCycleItems, "inline")}
              </div>
            )}
          </div>
        )}

        {/* 5. Transaction Log (Admin Module) */}
        {isSuperAdmin && (
          <SidebarButton
            active={isAuditActive}
            title="Transaction Log"
            Icon={Activity}
            onClick={() => handleSelect("audit")}
            collapsed={collapsed}
          />
        )}

        {/* 6. Settings */}
        <SidebarButton
          active={isSettingsActive}
          title="Settings"
          Icon={Settings}
          onClick={() => handleSelect("settings")}
          collapsed={collapsed}
        />
      </nav>

      {/* Minimized mode floating flyout submenu (keeps rail collapsed) */}
      {collapsed && openFlyout && activeFlyoutMeta && (
        <div
          ref={flyoutRef}
          style={{ top: openFlyout.top }}
          className="fixed left-[5.25rem] z-[70] w-64 rounded-xl border-2 border-amber-400/50 bg-[#700000] p-2 text-amber-50 shadow-2xl"
        >
          <div className="px-2.5 py-1.5 mb-1 border-b border-white/10 text-[11px] font-bold uppercase tracking-wider text-amber-300">
            {activeFlyoutMeta.title}
          </div>
          <div className="flex flex-col gap-1">
            {renderSubItems(activeFlyoutMeta.items, "flyout")}
          </div>
        </div>
      )}
    </div>
  );
}

export function Sidebar(props: SidebarProps) {
  const { collapsed = false, onToggleCollapse } = props;
  return (
    <aside
      className={`hidden md:flex md:flex-col fixed left-0 top-[calc(3.5rem-4px)] h-[calc(100vh-3.5rem+4px)] ${
        collapsed ? "w-20" : "w-72"
      } rounded-none bg-[#800000] text-amber-50 border-r-4 border-amber-500 shadow-md z-30 transition-all duration-200`}
    >
      <div className="flex-1 overflow-y-auto overflow-x-hidden sidebar-scrollbar p-3.5 flex flex-col">
        {onToggleCollapse && (
          <div
            className={`flex items-center ${
              collapsed ? "justify-center" : "justify-between"
            } px-1 pb-2 mb-1 shrink-0`}
          >
            {!collapsed && (
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-200/70">
                Navigation
              </span>
            )}
            <button
              type="button"
              onClick={onToggleCollapse}
              title={collapsed ? "Expand side panel" : "Minimize side panel"}
              aria-label={collapsed ? "Expand side panel" : "Minimize side panel"}
              className="group inline-flex h-8 w-8 items-center justify-center rounded-lg border border-amber-300/50 bg-[#660000]/90 hover:bg-white/15 text-amber-300 hover:text-white transition-colors cursor-pointer shadow-2xs shrink-0"
            >
              {collapsed ? (
                <SidebarExpand strokeWidth={2.2} className="h-4 w-4 text-amber-300 group-hover:text-white transition-colors" />
              ) : (
                <SidebarCollapse strokeWidth={2.2} className="h-4 w-4 text-amber-300 group-hover:text-white transition-colors" />
              )}
            </button>
          </div>
        )}
        <SidebarContent {...props} showBrand={false} />
      </div>
    </aside>
  );
}

export default Sidebar;
