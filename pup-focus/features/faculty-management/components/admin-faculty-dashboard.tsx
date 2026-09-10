"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import { BrandMark } from "@/components/shared/brand-mark";
import { Button } from "@/components/ui/button";
import { Sidebar, SidebarContent } from "@/components/sidebar";
import { CheckCircle, Clock, Group, Menu, NavArrowRight, Refresh, Xmark } from "iconoir-react";
import { LogoutButton } from "@/components/shared/logout-button";
import { SystemLoadingScreen } from "@/components/shared/system-loading-screen";
import {
  AdminNotificationDrawer,
  type AdminNotificationItem,
} from "@/features/notifications/components/admin-notification-drawer";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { extractFirstName } from "@/lib/faculty-profile";
import { AdminAcademicTerms } from "@/features/admin-management/components/admin-academic-terms";
import { AdminSettings } from "@/features/admin-management/components/admin-settings";
import { createClient } from "@/lib/supabase/client";
import {
  facultyAccountSchema,
  type FacultyAccountFormInput,
} from "@/features/faculty-management/schemas/faculty-account.schema";
import type {
  AdminSection,
  CreateFacultyResult,
  FacultyAccount,
  PendingFacultyAction,
} from "@/features/faculty-management/types/faculty-dashboard.types";
import { FacultyTable } from "./faculty-table";
import { AddFacultyModal } from "./faculty-modals/add-faculty-modal";
import { EditFacultyModal } from "./faculty-modals/edit-faculty-modal";
import { FacultyDetailsModal } from "./faculty-modals/faculty-details-modal";
import { DeleteFacultyModal } from "./faculty-modals/delete-faculty-modal";
import { InviteStatusModal } from "./faculty-modals/invite-status-modal";
import { SubmissionWindowPanel } from "./submission-window-panel";
import { RequirementsPanel } from "./requirements-verification-panel";

function normalizeAdminSection(raw?: string | null): AdminSection | null {
  if (!raw) return null;
  const val = raw.toLowerCase().trim();
  if (val === "dashboard") return "dashboard";
  if (
    val === "facultymanagement" ||
    val === "faculty-management" ||
    val === "faculty"
  )
    return "facultyManagement";
  if (
    val === "requirements" ||
    val === "requirements-verification"
  )
    return "requirements";
  if (
    val === "submissionwindow" ||
    val === "submission-window"
  )
    return "submissionWindow";
  if (
    val === "academicterms" ||
    val === "academic-terms"
  )
    return "academicTerms";
  if (
    val === "settings" ||
    val === "admin-settings"
  )
    return "settings";
  if (val === "details") return "details";
  return null;
}

export function AdminFacultyDashboard({
  adminName,
  adminEmail,
  initialTab,
}: {
  adminName?: string | null;
  adminEmail?: string | null;
  initialTab?: string | null;
}) {
  const searchParams = useSearchParams();

  // Initialize active tab from SSR-safe parameters (identical on server and client)
  const [activeSection, setActiveSection] = useState<AdminSection>(() => {
    const fromProp = normalizeAdminSection(initialTab);
    if (fromProp) return fromProp;

    const tabParam = searchParams?.get("tab") || searchParams?.get("section");
    const fromParams = normalizeAdminSection(tabParam);
    if (fromParams) return fromParams;

    return "facultyManagement";
  });

  const [currentAdminName, setCurrentAdminName] = useState<string>(
    adminName ?? "Admin",
  );

  useEffect(() => {
    if (adminName) {
      setCurrentAdminName(adminName);
    }
  }, [adminName]);

  const [facultyAccounts, setFacultyAccounts] = useState<FacultyAccount[]>([]);
  const [selectedFacultyId, setSelectedFacultyId] = useState<string | null>(
    null,
  );
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Restore stored tab if no URL param was provided, then mark mounted
  useEffect(() => {
    const tabParam = searchParams?.get("tab") || searchParams?.get("section");
    if (!tabParam) {
      try {
        const stored =
          localStorage.getItem("activeAdminTab") ||
          localStorage.getItem("activeAdminSection");
        const fromStorage = normalizeAdminSection(stored);
        if (fromStorage && fromStorage !== activeSection) {
          setActiveSection(fromStorage);
          const url = new URL(window.location.href);
          url.searchParams.set("tab", fromStorage);
          window.history.replaceState(null, "", url.toString());
        }
      } catch {}
    }
    setIsMounted(true);
  }, []);

  // Sync tab state when URL changes externally (e.g. browser back/forward buttons)
  useEffect(() => {
    const tabParam = searchParams?.get("tab") || searchParams?.get("section");
    const normalizedParam = normalizeAdminSection(tabParam);
    if (normalizedParam && normalizedParam !== activeSection) {
      setActiveSection(normalizedParam);
    }
  }, [searchParams, activeSection]);

  const handleSetActiveSection = (section: AdminSection) => {
    setActiveSection(section);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("activeAdminTab", section);
        localStorage.setItem("activeAdminSection", section);
        const url = new URL(window.location.href);
        url.searchParams.set("tab", section);
        window.history.replaceState(null, "", url.toString());
      } catch {}
    }
  };
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [addFacultyModalOpen, setAddFacultyModalOpen] = useState(false);
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [profileImageInputKey, setProfileImageInputKey] = useState(0);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteModalMessage, setInviteModalMessage] = useState("");
  const [inviteWasSent, setInviteWasSent] = useState(false);
  const [createdFacultyEmail, setCreatedFacultyEmail] = useState<string | null>(null);
  const [createdTempPassword, setCreatedTempPassword] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingFacultyIds, setLoadingFacultyIds] = useState<Set<string>>(
    new Set(),
  );
  const [deletingFacultyIds, setDeletingFacultyIds] = useState<Set<string>>(
    new Set(),
  );
  const [pendingFacultyAction, setPendingFacultyAction] =
    useState<PendingFacultyAction | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [detailsFacultyId, setDetailsFacultyId] = useState<string | null>(null);
  const [viewDetailsModalOpen, setViewDetailsModalOpen] = useState(false);
  const [viewDetailsFacultyId, setViewDetailsFacultyId] = useState<string | null>(
    null,
  );
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);
  const [facultyActionError, setFacultyActionError] = useState<string | null>(
    null,
  );
  const [verificationResetTrigger, setVerificationResetTrigger] = useState(0);
  const [adminAvatarUrl, setAdminAvatarUrl] = useState<string | null>(null);
  const [initialReviewFacultyId, setInitialReviewFacultyId] = useState<string | null>(null);
  const [initialHighlightRequirementCode, setInitialHighlightRequirementCode] = useState<string | null>(null);

  const handleNotificationNavigate = (notification: AdminNotificationItem) => {
    const reqCode = notification.requirementCode;
    let targetFacultyId = notification.facultyId;

    if (!targetFacultyId && notification.facultyName) {
      const matched = facultyAccounts.find(
        (f) =>
          f.fullName.toLowerCase().includes(notification.facultyName!.toLowerCase()) ||
          notification.facultyName!.toLowerCase().includes(f.fullName.toLowerCase()),
      );
      if (matched) {
        targetFacultyId = matched.id;
      }
    }

    if (notification.isSubmission || reqCode || targetFacultyId) {
      handleSetActiveSection("requirements");
      if (targetFacultyId) {
        setSelectedFacultyId(targetFacultyId);
        setInitialReviewFacultyId(targetFacultyId);
      }
      if (reqCode) {
        setInitialHighlightRequirementCode(reqCode);
      }
      return;
    }

    if (
      notification.type?.includes("FACULTY") ||
      notification.type?.includes("ACCOUNT") ||
      notification.title?.toLowerCase().includes("account")
    ) {
      handleSetActiveSection("facultyManagement");
      if (targetFacultyId) {
        setSelectedFacultyId(targetFacultyId);
      }
      return;
    }

    if (notification.type?.includes("WINDOW") || notification.title?.toLowerCase().includes("window")) {
      handleSetActiveSection("submissionWindow");
      return;
    }

    if (notification.type?.includes("TERM") || notification.title?.toLowerCase().includes("term")) {
      handleSetActiveSection("academicTerms");
      return;
    }

    handleSetActiveSection("requirements");
  };

  interface DashboardStats {
    verified: number;
    pending: number;
    rejected: number;
    revisions: number;
    totalFaculty: number;
    activeFaculty: number;
    currentAcademicYear: string;
    currentSemester: string;
  }

  interface PendingQueueItem {
    id: string;
    facultyId: string;
    facultyName: string;
    facultyEmail: string;
    requirementCode: string;
    requirementTitle: string;
    submittedAt: string;
    status: string;
    isRevision: boolean;
    facultyRemarks: string | null;
    fileCount: number;
  }

  interface RecentActivityItem {
    id: string;
    decision: "validated" | "rejected";
    requirementCode: string;
    requirementTitle: string;
    facultyName: string;
    facultyId: string;
    remarks: string | null;
    createdAt: string;
  }

  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [pendingQueue, setPendingQueue] = useState<PendingQueueItem[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivityItem[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  async function loadDashboardStats() {
    try {
      setIsLoadingStats(true);
      const res = await fetch(`/api/admin/dashboard/stats?_t=${Date.now()}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setDashboardStats(data.stats || null);
        setPendingQueue(data.pendingQueue || []);
        setRecentActivity(data.recentActivity || []);
      }
    } catch (err) {
      console.warn("Failed to load dashboard stats:", err);
    } finally {
      setIsLoadingStats(false);
    }
  }

  useEffect(() => {
    void loadFacultyFromDatabase();
    void loadDashboardStats();

    async function loadAdminAvatar() {
      try {
        const res = await fetch("/api/admin/profile");
        if (res.ok) {
          const data = await res.json();
          if (data.avatar_url || data.profileImageUrl) {
            setAdminAvatarUrl(data.avatar_url || data.profileImageUrl);
          }
          if (data.full_name || data.fullName) {
            setCurrentAdminName(data.full_name || data.fullName);
          }
        }
      } catch (e) {
        console.warn("Failed to load admin profile:", e);
      }
    }

    void loadAdminAvatar();
  }, []);

  useEffect(() => {
    if (activeSection === "dashboard") {
      void loadDashboardStats();
    }
  }, [activeSection, verificationResetTrigger]);

  async function loadFacultyFromDatabase() {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/admin/faculty/list?_t=${Date.now()}`, {
        cache: "no-store",
      });
      if (response.ok) {
        const data = await response.json();
        setFacultyAccounts(data.faculty || []);
      }
    } catch {
      // Error handled by UI state
    } finally {
      setIsLoading(false);
    }
  }

  async function refreshCurrentPanel() {
    await Promise.all([loadFacultyFromDatabase(), loadDashboardStats()]);
    setVerificationResetTrigger((prev) => prev + 1);
  }

  const form = useForm<FacultyAccountFormInput>({
    resolver: zodResolver(facultyAccountSchema),
    defaultValues: {
      firstName: "",
      middleName: "",
      lastName: "",
      email: "",
      programId: "",
    },
  });

  const selectedFaculty = useMemo(
    () =>
      facultyAccounts.find((faculty) => faculty.id === selectedFacultyId) ??
      null,
    [facultyAccounts, selectedFacultyId],
  );

  const pendingFaculty = useMemo(
    () =>
      pendingFacultyAction
        ? (facultyAccounts.find(
            (faculty) => faculty.id === pendingFacultyAction.facultyId,
          ) ?? null)
        : null,
    [facultyAccounts, pendingFacultyAction],
  );

  async function confirmPendingFacultyAction() {
    if (!pendingFacultyAction) {
      return;
    }

    const { kind, facultyId } = pendingFacultyAction;
    setPendingFacultyAction(null);

    if (kind === "delete") {
      await performDeleteFaculty(facultyId);
      return;
    }

    if (kind === "activate") {
      await performActivateFaculty(facultyId);
      return;
    }

    await performDeactivateFaculty(facultyId);
  }

  async function onAddFaculty(input: FacultyAccountFormInput) {
    setIsCreating(true);
    setCreateError(null);
    setCreateSuccess(null);

    try {
      const payload = new FormData();
      payload.append("firstName", input.firstName);
      payload.append("middleName", input.middleName);
      payload.append("lastName", input.lastName);
      payload.append("email", input.email);
      payload.append("programId", input.programId);

      if (profileImageFile) {
        payload.append("profileImage", profileImageFile);
      }

      const response = await fetch("/api/admin/faculty/create", {
        method: "POST",
        body: payload,
      });

      const data = (await response.json()) as CreateFacultyResult;

      if (!response.ok) {
        setCreateError(data.error ?? "Failed to send faculty invite");
        setIsCreating(false);
        return;
      }

      const invitedEmail = data.user?.email ?? input.email;
      setInviteWasSent(Boolean(data.sent));
      const inviteMessage = data.sent
        ? `Invitation email sent to ${invitedEmail}. Please ask them to check their email and click the verification link to activate their account.`
        : data.link
          ? `Invite link generated for ${invitedEmail}. Email delivery failed: ${data.sendError ?? "SMTP is not configured"}.\n\nInvite link:\n${data.link}`
          : `Invite could not be sent for ${invitedEmail}.`;

      setCreateSuccess(inviteMessage);
      setInviteModalMessage(inviteMessage);
      setInviteModalOpen(true);
      setAddFacultyModalOpen(false);
      form.reset({
        firstName: "",
        middleName: "",
        lastName: "",
        email: "",
        programId: "",
      });
      setProfileImageFile(null);
      setProfileImageInputKey((value) => value + 1);

      await loadFacultyFromDatabase();
    } catch {
      setCreateError("An error occurred while creating the faculty account");
    } finally {
      setIsCreating(false);
    }
  }

  function onDeleteFaculty(facultyId: string) {
    setPendingFacultyAction({ kind: "delete", facultyId });
  }

  async function performDeleteFaculty(facultyId: string) {
    setDeletingFacultyIds((prev) => new Set(prev).add(facultyId));
    setDeleteError(null);
    setDeleteSuccess(null);

    try {
      const response = await fetch("/api/admin/faculty/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facultyProfileId: facultyId }),
      });

      let data;
      try {
        data = await response.json();
      } catch {
        if (response.ok) {
          setFacultyAccounts((prev) =>
            prev.filter((faculty) => faculty.id !== facultyId),
          );
          if (selectedFacultyId === facultyId) {
            setSelectedFacultyId(null);
          }
          setDeleteSuccess("Faculty account deleted successfully");
          await loadFacultyFromDatabase();
        } else {
          setDeleteError(
            `Failed to delete faculty account (HTTP ${response.status})`,
          );
        }
        return;
      }

      if (response.ok) {
        setFacultyAccounts((prev) =>
          prev.filter((faculty) => faculty.id !== facultyId),
        );
        if (selectedFacultyId === facultyId) {
          setSelectedFacultyId(null);
        }
        setDeleteSuccess("Faculty account deleted successfully");
        await loadFacultyFromDatabase();
      } else {
        setDeleteError(data.error || "Failed to delete faculty account");
      }
    } catch (error) {
      setDeleteError(
        error instanceof Error
          ? error.message
          : "An error occurred while deleting the faculty account",
      );
    } finally {
      setDeletingFacultyIds((prev) => {
        const next = new Set(prev);
        next.delete(facultyId);
        return next;
      });
    }
  }

  function onDeactivateFaculty(facultyId: string) {
    setPendingFacultyAction({ kind: "deactivate", facultyId });
  }

  async function performDeactivateFaculty(facultyId: string) {
    setLoadingFacultyIds((prev) => new Set(prev).add(facultyId));
    setFacultyActionError(null);

    try {
      const response = await fetch("/api/admin/faculty/deactivate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facultyProfileId: facultyId }),
      });

      if (!response.ok) {
        let message = `Failed to deactivate faculty account (HTTP ${response.status})`;
        try {
          const errorData = await response.json();
          message = errorData.error || message;
        } catch {
          // Keep default message
        }
        setFacultyActionError(message);
        return;
      }

      setFacultyAccounts((prev) =>
        prev.map((faculty) =>
          faculty.id === facultyId ? { ...faculty, is_active: false } : faculty,
        ),
      );
      await loadFacultyFromDatabase();
      void loadDashboardStats();
    } catch (error) {
      setFacultyActionError(
        error instanceof Error
          ? error.message
          : "An error occurred while deactivating the faculty account",
      );
    } finally {
      setLoadingFacultyIds((prev) => {
        const next = new Set(prev);
        next.delete(facultyId);
        return next;
      });
    }
  }

  function onActivateFaculty(facultyId: string) {
    setPendingFacultyAction({ kind: "activate", facultyId });
  }

  async function performActivateFaculty(facultyId: string) {
    setLoadingFacultyIds((prev) => new Set(prev).add(facultyId));
    setFacultyActionError(null);

    try {
      const response = await fetch("/api/admin/faculty/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facultyProfileId: facultyId }),
      });

      if (!response.ok) {
        let message = `Failed to activate faculty account (HTTP ${response.status})`;
        try {
          const errorData = await response.json();
          message = errorData.error || message;
        } catch {
          // Keep default message
        }
        setFacultyActionError(message);
        return;
      }

      setFacultyAccounts((prev) =>
        prev.map((faculty) =>
          faculty.id === facultyId ? { ...faculty, is_active: true } : faculty,
        ),
      );
      await loadFacultyFromDatabase();
      void loadDashboardStats();
    } catch (error) {
      setFacultyActionError(
        error instanceof Error
          ? error.message
          : "An error occurred while activating the faculty account",
      );
    } finally {
      setLoadingFacultyIds((prev) => {
        const next = new Set(prev);
        next.delete(facultyId);
        return next;
      });
    }
  }

  if (!isMounted) {
    return <SystemLoadingScreen />;
  }

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans transition-colors duration-200">
      {/* Consolidated Top Header (All Views) - Fixed 56px matching Faculty AppShell */}
      <header className="fixed inset-x-0 top-0 h-14 z-50 border-t-2 border-amber-600 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md flex items-center transition-colors duration-200">
        <div className="flex w-full items-center justify-between pl-4 pr-3 sm:pr-6">
          {/* Left: Mobile Menu Trigger & Title */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-1.5 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
              aria-label="Open Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <BrandMark
              size={32}
              className="shrink-0 rounded-full ring-2 ring-amber-500/40"
            />
            <span className="text-base sm:text-lg md:text-xl font-bold tracking-wide text-slate-900 dark:text-slate-100 whitespace-nowrap">
              PUP FOCUS
            </span>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <AdminNotificationDrawer onNavigateToTarget={handleNotificationNavigate} />
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Body Wrapper */}
      <div className="flex flex-1 h-screen pt-14 overflow-hidden relative">
        {/* Desktop Fixed Sidebar */}
        <aside className="hidden md:flex md:flex-col fixed left-0 top-14 h-[calc(100vh-3.5rem)] w-56 overflow-y-auto rounded-none bg-white text-slate-900 border-r border-slate-200 dark:bg-slate-950 dark:text-slate-100 dark:border-slate-800 p-2.5 shadow-sm transition-colors duration-200">
          <SidebarContent
            activeSection={activeSection}
            setActiveSection={handleSetActiveSection}
            adminName={currentAdminName || adminName}
            roleTitle="Admin"
            profileImageUrl={adminAvatarUrl}
          />
        </aside>

        {/* Mobile Navigation Drawer / Sheet */}
        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-sm md:hidden flex"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <aside
              className="relative flex flex-col h-full w-64 bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100 border-r border-slate-200 dark:border-slate-800 p-4 shadow-2xl overflow-y-auto transition-colors duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-2">
                <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Admin Menu
                </span>
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="rounded-lg border border-[#5e0000] bg-[#780000] hover:bg-[#5e0000] text-white p-1.5 transition-colors cursor-pointer shadow-2xs"
                  aria-label="Close navigation"
                >
                  <Xmark className="w-4 h-4" />
                </button>
              </div>
              <SidebarContent
                activeSection={activeSection}
                setActiveSection={handleSetActiveSection}
                adminName={currentAdminName || adminName}
                roleTitle="Admin"
                profileImageUrl={adminAvatarUrl}
                onNavigate={() => setIsMobileMenuOpen(false)}
              />
            </aside>
          </div>
        )}

        {/* Scrollable Main Content Area */}
        <div className="md:ml-56 flex min-h-full w-full md:w-[calc(100%-14rem)] flex-col">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-l border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-[#0b0f19] shadow-sm transition-colors duration-200">
            <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-100 dark:bg-[#0b0f19] text-slate-900 dark:text-slate-100 transition-colors duration-200">
              <div className="max-w-7xl mx-auto w-full">
                {activeSection === "dashboard" ? (
                  <article className="space-y-6">
                    {/* TIER 1: Welcome Banner with subtle campus artwork backdrop */}
                    <section className="relative overflow-hidden rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-7 shadow-sm shadow-slate-300/50 dark:shadow-none transition-colors">
                      {/* Subtle Campus Photo Backdrop Overlay */}
                      <div className="absolute inset-0 pointer-events-none opacity-[0.06] dark:opacity-[0.14] mix-blend-luminosity overflow-hidden">
                        <Image
                          src="/images/attachments/IMG_9402.jpeg"
                          alt="PUP Bataan campus backdrop"
                          fill
                          sizes="100vw"
                          className="object-cover object-center"
                          priority
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-white/90 via-white/50 to-white/90 dark:from-slate-950 dark:via-slate-900/60 dark:to-slate-950/90" />
                      </div>

                      <div className="relative z-10 space-y-1">
                        <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
                          Welcome back, {extractFirstName(currentAdminName || adminName, "Admin")}
                        </h1>
                        <p className="text-xs text-slate-600 dark:text-slate-400 font-normal">
                          Admin Dashboard • A.Y. {dashboardStats?.currentAcademicYear || "2026-2027"} • {dashboardStats?.currentSemester || "1st Semester"}
                        </p>
                      </div>
                    </section>

                    {/* TIER 2: 3-Column Stat Grid */}
                    <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                      {/* Card 1: Faculty Submissions Verified */}
                      <div className="rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm shadow-slate-300/50 dark:shadow-none p-5 space-y-3 transition-colors">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Submissions Verified</span>
                          <CheckCircle className="h-5 w-5 text-emerald-500" strokeWidth={2} />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                            {isLoadingStats ? "..." : `${dashboardStats?.verified ?? 0} Verified`}
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Faculty submissions reviewed and validated</p>
                        </div>
                      </div>

                      {/* Card 2: Pending Verification */}
                      <div className="rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm shadow-slate-300/50 dark:shadow-none p-5 space-y-3 transition-colors">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Pending Verification</span>
                          <Clock className="h-5 w-5 text-amber-500" strokeWidth={2} />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
                            <span>{isLoadingStats ? "..." : `${dashboardStats?.pending ?? 0} Pending`}</span>
                            {!isLoadingStats && dashboardStats && dashboardStats.revisions > 0 && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                {dashboardStats.revisions} revision{dashboardStats.revisions > 1 ? "s" : ""}
                              </span>
                            )}
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Submissions awaiting admin review</p>
                        </div>
                      </div>

                      {/* Card 3: Total Active Faculty */}
                      <div className="rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm shadow-slate-300/50 dark:shadow-none p-5 space-y-3 transition-colors">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Active Faculty</span>
                          <Group className="h-5 w-5 text-blue-500" strokeWidth={2} />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                            {isLoadingStats && facultyAccounts.length === 0
                              ? "..."
                              : `${dashboardStats && dashboardStats.totalFaculty > 0 ? dashboardStats.activeFaculty : facultyAccounts.filter((f) => f.is_active).length} Active`}
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            {dashboardStats && dashboardStats.totalFaculty > 0
                              ? dashboardStats.totalFaculty
                              : facultyAccounts.length} total faculty accounts
                          </p>
                        </div>
                      </div>
                    </section>

                    {/* TIER 3: 2-Column Main Body */}
                    <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                      {/* Left Column (2-Span) — Pending Verification Queue */}
                      <div className="lg:col-span-2 space-y-4">
                        <div className="rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm shadow-slate-300/50 dark:shadow-none p-5 sm:p-6 transition-colors">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-300 dark:border-slate-800">
                            <div>
                              <div className="flex items-center gap-2">
                                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 tracking-normal">
                                  Pending Submissions Verification Queue
                                </h2>
                                {pendingQueue.length > 0 && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950">
                                    {pendingQueue.length}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">Faculty submissions awaiting your review and validation.</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleSetActiveSection("requirements")}
                              className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium transition cursor-pointer"
                            >
                              <span>View all</span>
                              <NavArrowRight className="h-3 w-3" />
                            </button>
                          </div>

                          {pendingQueue.length === 0 ? (
                            <div className="py-8 text-center space-y-2">
                              <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto opacity-70" />
                              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">All submissions up to date</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">No pending submissions awaiting review.</p>
                            </div>
                          ) : (
                            <div className="divide-y divide-slate-100 dark:divide-slate-800">
                              {pendingQueue.slice(0, 5).map((item) => (
                                <div key={item.id} className="py-3.5 flex items-center justify-between gap-4">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                                        {item.facultyName}
                                      </span>
                                      {item.isRevision && (
                                        <span className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[10px] font-bold">
                                          Revision
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-slate-600 dark:text-slate-400 truncate mt-0.5">
                                      {item.requirementTitle}
                                    </p>
                                    <span className="text-[10px] text-slate-400 dark:text-slate-500">
                                      Submitted: {new Date(item.submittedAt).toLocaleDateString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (item.facultyId) {
                                        setSelectedFacultyId(item.facultyId);
                                        setInitialReviewFacultyId(item.facultyId);
                                      }
                                      if (item.requirementCode) {
                                        setInitialHighlightRequirementCode(item.requirementCode);
                                      }
                                      handleSetActiveSection("requirements");
                                    }}
                                    className="shrink-0 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                                  >
                                    Review
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right Column (1-Span) — Recent Activity */}
                      <div className="space-y-4">
                        <div className="rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm shadow-slate-300/50 dark:shadow-none p-5 transition-colors">
                          <div className="pb-3 border-b border-slate-300 dark:border-slate-800">
                            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 tracking-normal">Recent Admin Actions</h2>
                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">Latest reviews and validation activity.</p>
                          </div>
                          {recentActivity.length === 0 ? (
                            <div className="py-6 text-center">
                              <p className="text-xs text-slate-500 dark:text-slate-400">No recent activity to display.</p>
                            </div>
                          ) : (
                            <div className="divide-y divide-slate-100 dark:divide-slate-800">
                              {recentActivity.slice(0, 5).map((act) => (
                                <div key={act.id} className="py-3 space-y-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                                      {act.facultyName}
                                    </span>
                                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                      act.decision === "validated"
                                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                                        : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                                    }`}>
                                      {act.decision === "validated" ? "Validated" : "Revision Requested"}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                    {act.requirementTitle}
                                  </p>
                                  <span className="text-[10px] text-slate-400 dark:text-slate-500 block">
                                    {new Date(act.createdAt).toLocaleDateString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </section>
                  </article>
                ) : null}

                {activeSection === "facultyManagement" ? (
                  <article className="space-y-4 p-2 sm:p-4 md:p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-300 dark:border-slate-800 pb-4 mb-6">
                      <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                          Faculty Management
                        </h1>
                      </div>
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                          type="button"
                          onClick={() => {
                            setCreateError(null);
                            setCreateSuccess(null);
                            setAddFacultyModalOpen(true);
                          }}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-1 rounded-xl bg-amber-500 hover:bg-amber-400 px-4 py-2 text-xs font-semibold text-slate-950 shadow-sm active:scale-[0.98] transition cursor-pointer"
                        >
                          + Add Faculty
                        </button>
                        <button
                          type="button"
                          onClick={() => void refreshCurrentPanel()}
                          disabled={isLoading}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 px-3.5 py-2 sm:py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 transition disabled:opacity-50 cursor-pointer shadow-2xs"
                        >
                          <Refresh className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
                          <span>{isLoading ? "Refreshing..." : "Refresh"}</span>
                        </button>
                      </div>
                    </div>

                    <FacultyTable
                      facultyAccounts={facultyAccounts}
                      isLoading={isLoading}
                      onSelectFaculty={setSelectedFacultyId}
                      onDeleteFaculty={onDeleteFaculty}
                      onViewDetails={(facultyId) => {
                        setViewDetailsFacultyId(facultyId);
                        setViewDetailsModalOpen(true);
                      }}
                      onEditFaculty={(facultyId) => {
                        setDetailsFacultyId(facultyId);
                        setDetailsModalOpen(true);
                      }}
                      onActivate={onActivateFaculty}
                      onDeactivate={onDeactivateFaculty}
                      loadingFacultyIds={loadingFacultyIds}
                      deletingFacultyIds={deletingFacultyIds}
                      deleteError={deleteError}
                      deleteSuccess={deleteSuccess}
                      facultyActionError={facultyActionError}
                      onClearDeleteMessages={() => {
                        setDeleteError(null);
                        setDeleteSuccess(null);
                        setFacultyActionError(null);
                      }}
                    />
                  </article>
                ) : null}

                {activeSection === "requirements" ? (
                  <article className="p-4 md:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-300 dark:border-slate-800 pb-4 mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                          Requirements Verification
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => void refreshCurrentPanel()}
                        disabled={isLoading}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 transition disabled:opacity-50 cursor-pointer shadow-2xs"
                      >
                        <Refresh className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
                        <span>{isLoading ? "Refreshing..." : "Refresh"}</span>
                      </button>
                    </div>

                    <RequirementsPanel
                      facultyAccounts={facultyAccounts}
                      selectedFaculty={selectedFaculty}
                      onSelectFaculty={setSelectedFacultyId}
                      resetTrigger={verificationResetTrigger}
                      initialReviewFacultyId={initialReviewFacultyId}
                      initialRequirementCode={initialHighlightRequirementCode}
                    />
                  </article>
                ) : null}

                {activeSection === "submissionWindow" ? (
                  <article className="p-4 md:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-300 dark:border-slate-800 pb-4 mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                          Submission Window
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => void refreshCurrentPanel()}
                        disabled={isLoading}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 transition disabled:opacity-50 cursor-pointer shadow-2xs"
                      >
                        <Refresh className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
                        <span>{isLoading ? "Refreshing..." : "Refresh"}</span>
                      </button>
                    </div>

                    <SubmissionWindowPanel
                      isSuperAdmin={false}
                      onWindowChange={() =>
                        setVerificationResetTrigger((prev) => prev + 1)
                      }
                    />
                  </article>
                ) : null}

                {activeSection === "academicTerms" ? (
                  <article className="p-4 md:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-300 dark:border-slate-800 pb-4 mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                          Academic Term Management
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => void refreshCurrentPanel()}
                        disabled={isLoading}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 transition disabled:opacity-50 cursor-pointer shadow-2xs"
                      >
                        <Refresh className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
                        <span>{isLoading ? "Refreshing..." : "Refresh"}</span>
                      </button>
                    </div>

                    <AdminAcademicTerms adminName={(currentAdminName || adminName) ?? "Admin"} />
                  </article>
                ) : null}

                {activeSection === "settings" ? (
                  <article className="p-4 md:p-5">
                    <AdminSettings
                      adminName={(currentAdminName || adminName) ?? "Admin"}
                      adminEmail={adminEmail ?? null}
                      profileImageUrl={adminAvatarUrl}
                      onProfileUpdated={({ fullName, avatarUrl }) => {
                        if (fullName) setCurrentAdminName(fullName);
                        if (avatarUrl !== undefined) setAdminAvatarUrl(avatarUrl);
                      }}
                    />
                  </article>
                ) : null}
              </div>
            </main>
          </div>
        </div>
      </div>

      {viewDetailsModalOpen && viewDetailsFacultyId ? (
        <FacultyDetailsModal
          facultyId={viewDetailsFacultyId}
          facultyAccounts={facultyAccounts}
          isOpen={viewDetailsModalOpen}
          onClose={() => setViewDetailsModalOpen(false)}
          onEdit={(facultyId) => {
            setViewDetailsModalOpen(false);
            setDetailsFacultyId(facultyId);
            setDetailsModalOpen(true);
          }}
        />
      ) : null}

      {detailsModalOpen && detailsFacultyId ? (
        <EditFacultyModal
          facultyId={detailsFacultyId}
          facultyAccounts={facultyAccounts}
          onClose={() => setDetailsModalOpen(false)}
          onSave={refreshCurrentPanel}
        />
      ) : null}

      <DeleteFacultyModal
        pendingFacultyAction={pendingFacultyAction}
        pendingFaculty={pendingFaculty}
        onCancel={() => setPendingFacultyAction(null)}
        onConfirm={confirmPendingFacultyAction}
      />

      <InviteStatusModal
        isOpen={inviteModalOpen}
        inviteWasSent={inviteWasSent}
        inviteModalMessage={inviteModalMessage}
        email={createdFacultyEmail}
        tempPassword={createdTempPassword}
        onClose={() => {
          setInviteModalOpen(false);
          setCreatedFacultyEmail(null);
          setCreatedTempPassword(null);
        }}
      />

      <AddFacultyModal
        isOpen={addFacultyModalOpen}
        onClose={() => {
          setAddFacultyModalOpen(false);
          setCreateError(null);
          setCreateSuccess(null);
          setProfileImageFile(null);
          setProfileImageInputKey((value) => value + 1);
        }}
        form={form}
        onAddFaculty={onAddFaculty}
        isCreating={isCreating}
        createError={createError}
        createSuccess={createSuccess}
        profileImageFile={profileImageFile}
        onProfileImageChange={setProfileImageFile}
        profileImageInputKey={profileImageInputKey}
      />
    </div>
  );
}
