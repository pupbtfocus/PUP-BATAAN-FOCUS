"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import { BrandMark } from "@/components/shared/brand-mark";
import { Button } from "@/components/ui/button";
import { Sidebar, SidebarContent, useSidebarCollapsed } from "@/components/sidebar";
import { Calendar, Check, CheckCircle, ClockRotateRight, Group, Hourglass, Menu, Minus, NavArrowRight, Page, Refresh, TaskList, Xmark } from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";
import { SubmissionStatusBadge } from "@/features/submissions/components/submission-status-badge";
import { LogoutButton } from "@/components/shared/logout-button";
import { SystemLoadingScreen } from "@/components/shared/system-loading-screen";
import { KpiCardSkeleton } from "@/components/ui/skeleton";
import { HighlightedSystemTitle } from "@/components/shared/highlighted-system-title";
import {
  AdminNotificationDrawer,
  type AdminNotificationItem,
} from "@/features/notifications/components/admin-notification-drawer";
import { extractFirstName } from "@/lib/faculty-profile";
import { StaffSettings as AdminSettings } from "@/features/admin-management/components/staff-settings";
import { createClient } from "@/lib/supabase/client";
import { emitRealtimeSync, useRealtimeSync } from "@/lib/realtime";
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
import { FacultyDetailsModal } from "./faculty-modals/faculty-details-modal";
import { InviteStatusModal } from "./faculty-modals/invite-status-modal";
import { RequirementsPanel } from "./requirements-verification-panel";
import { SuperAdminComplianceAnalytics } from "@/features/admin-management/components/super-admin-compliance-analytics";

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
    val === "requirements-verification" ||
    val === "verification"
  )
    return "requirements";
  if (
    val === "settings" ||
    val === "admin-settings"
  )
    return "settings";
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

    return "dashboard";
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
    () => {
      if (typeof window !== "undefined") {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get("facultyId") || sessionStorage.getItem("activeFacultyId") || null;
      }
      return null;
    },
  );
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Prevent background section scrolling & mobile scroll-chaining while mobile side panel is open
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    const prevBodyOverscroll = document.body.style.overscrollBehavior;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
      document.body.style.overscrollBehavior = prevBodyOverscroll;
    };
  }, [isMobileMenuOpen]);

  // Restore stored tab within current session if no URL param was provided, then mark mounted
  useEffect(() => {
    const tabParam = searchParams?.get("tab") || searchParams?.get("section");
    if (!tabParam) {
      try {
        localStorage.removeItem("activeAdminTab");
        localStorage.removeItem("activeAdminSection");
        const stored =
          sessionStorage.getItem("activeAdminTab") ||
          sessionStorage.getItem("activeAdminSection");
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
    if (!normalizedParam) return;

    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const urlParam = normalizeAdminSection(
        urlParams.get("tab") || urlParams.get("section"),
      );
      if (urlParam && urlParam !== normalizedParam) {
        return;
      }
    }

    setActiveSection((prev) => (prev === normalizedParam ? prev : normalizedParam));
  }, [searchParams]);

  // Browser back/forward popstate listener for accurate history back navigation
  useEffect(() => {
    function handlePopState() {
      try {
        const params = new URLSearchParams(window.location.search);
        const tabParam = params.get("tab") || params.get("section");
        const norm = normalizeAdminSection(tabParam);
        if (norm) {
          setActiveSection((prev) => (prev === norm ? prev : norm));
        }
        const fId = params.get("facultyId");
        setSelectedFacultyId(fId || null);
      } catch {}
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const handleSetActiveSection = (section: AdminSection) => {
    setActiveSection(section);
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem("activeAdminTab", section);
        sessionStorage.setItem("activeAdminSection", section);
        localStorage.removeItem("activeAdminTab");
        localStorage.removeItem("activeAdminSection");
        const url = new URL(window.location.href);
        url.searchParams.set("tab", section);
        window.history.pushState(null, "", url.toString());
      } catch {}
    }
  };

  const facultyStats = useMemo(() => {
    const total = facultyAccounts.length;
    const active = facultyAccounts.filter((f) => f.is_active).length;
    const activePct = total > 0 ? Math.round((active / total) * 100) : 0;

    const allKeys = new Set<string>();
    for (const f of facultyAccounts) {
      if (f.requirementStatus) {
        for (const k of Object.keys(f.requirementStatus)) allKeys.add(k);
      }
    }
    const reqCodes = Array.from(allKeys);
    const totalRequired = reqCodes.length;

    let completed = 0;
    let started = 0;
    let notStarted = 0;

    for (const f of facultyAccounts) {
      if (!f.is_active) continue;
      const statusMap = f.requirementStatus as Record<string, string | undefined> | undefined;
      let turnedIn = 0;
      let needsRevision = 0;
      for (const code of reqCodes) {
        const s = statusMap?.[code];
        if (s === "validated" || s === "uploaded") turnedIn += 1;
        else if (s === "rejected" || s === "needs_revision") needsRevision += 1;
      }
      if (needsRevision > 0) {
        started += 1;
      } else if (turnedIn === totalRequired && totalRequired > 0) {
        completed += 1;
      } else if (turnedIn > 0) {
        started += 1;
      } else {
        notStarted += 1;
      }
    }

    return {
      total,
      active,
      activePct,
      completed,
      inProgress: started,
      notStarted,
    };
  }, [facultyAccounts]);

  const handleSelectFaculty = useCallback((facultyId: string | null) => {
    setSelectedFacultyId((prev) => (prev === facultyId ? prev : facultyId));
    if (!facultyId) {
      setInitialReviewFacultyId(null);
      setInitialHighlightRequirementCode(null);
    }
    if (typeof window !== "undefined") {
      try {
        const url = new URL(window.location.href);
        if (facultyId) {
          if (url.searchParams.get("facultyId") !== facultyId) {
            url.searchParams.set("facultyId", facultyId);
            sessionStorage.setItem("activeFacultyId", facultyId);
            window.history.replaceState(null, "", url.toString());
          }
        } else {
          if (url.searchParams.has("facultyId")) {
            url.searchParams.delete("facultyId");
            sessionStorage.removeItem("activeFacultyId");
            window.history.replaceState(null, "", url.toString());
          }
        }
      } catch {}
    }
  }, []);
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
  const [registrationLogsModalOpen, setRegistrationLogsModalOpen] = useState(false);
  const [scheduleLogsModalOpen, setScheduleLogsModalOpen] = useState(false);
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
  const {
    collapsed: isSidebarCollapsed,
    toggle: toggleSidebarCollapsed,
    setCollapsed: setSidebarCollapsed,
  } = useSidebarCollapsed();

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
      handleSetActiveSection("requirements");
      return;
    }

    if (notification.type?.includes("TERM") || notification.title?.toLowerCase().includes("term")) {
      handleSetActiveSection("requirements");
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
  const [windowStatus, setWindowStatus] = useState<{
    isOpen?: boolean;
    isAlwaysOpen?: boolean;
    status?: string;
    startDate?: string | null;
    endDate?: string | null;
    startTimeLabel?: string | null;
    endTimeLabel?: string | null;
  } | null>(null);
  const [pendingQueue, setPendingQueue] = useState<PendingQueueItem[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivityItem[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  async function loadDashboardStats(options?: { silent?: boolean }) {
    try {
      if (!options?.silent) {
        setIsLoadingStats(true);
      }
      const [res, winRes] = await Promise.all([
        fetch(`/api/staff/dashboard/stats?_t=${Date.now()}`, { cache: "no-store" }),
        fetch(`/api/staff/submission-window?_t=${Date.now()}`, { cache: "no-store", credentials: "include" }),
      ]);
      if (res.ok) {
        const data = await res.json();
        setDashboardStats(data.stats || null);
        setPendingQueue(data.pendingQueue || []);
        setRecentActivity(data.recentActivity || []);
      }
      if (winRes.ok) {
        const winData = await winRes.json();
        const isAlwaysOpenWindow = Boolean(
          winData.endDate && (winData.endDate.startsWith("2099") || new Date(winData.endDate).getFullYear() >= 2099)
        );
        setWindowStatus({
          ...winData,
          isAlwaysOpen: isAlwaysOpenWindow,
        });
      }
    } catch (err) {
      console.warn("Failed to load dashboard stats:", err);
    } finally {
      if (!options?.silent) {
        setIsLoadingStats(false);
      }
    }
  }

  useEffect(() => {
    void loadFacultyFromDatabase();
    void loadDashboardStats();

    async function loadAdminAvatar() {
      try {
        const res = await fetch("/api/staff/profile");
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
      void loadDashboardStats({ silent: Boolean(dashboardStats) });
    } else if (activeSection === "facultyManagement" || activeSection === "requirements") {
      void loadFacultyFromDatabase({ silent: facultyAccounts.length > 0 });
    }
  }, [activeSection, verificationResetTrigger]);

  // Realtime sync across Faculty, Staff, and Admin
  useRealtimeSync(() => {
    void loadDashboardStats({ silent: true });
    void loadFacultyFromDatabase({ silent: true });
  });

  async function loadFacultyFromDatabase(options?: { silent?: boolean; isRetry?: boolean }) {
    try {
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) return;

      if (!options?.silent) {
        setIsLoading(true);
      }
      const response = await fetch(`/api/staff/faculty/list?_t=${Date.now()}`, {
        cache: "no-store",
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setFacultyAccounts(data.faculty || []);
      } else if ((response.status === 401 || response.status === 403) && !options?.isRetry) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        return await loadFacultyFromDatabase({ ...options, isRetry: true });
      } else {
        const errData = await response.json().catch(() => ({}));
        console.warn("Failed to fetch faculty list:", response.status, errData);
      }
    } catch (err) {
      console.warn("Error loading faculty accounts:", err);
    } finally {
      if (!options?.silent) {
        setIsLoading(false);
      }
    }
  }

  const [isRefreshing, setIsRefreshing] = useState(false);

  async function refreshCurrentPanel() {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await Promise.all([
        loadFacultyFromDatabase({ silent: true }),
        loadDashboardStats({ silent: true }),
      ]);
      emitRealtimeSync({ source: "manual-refresh", timestamp: Date.now() });
    } finally {
      setIsRefreshing(false);
    }
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

  async function onAddFaculty(
    input: FacultyAccountFormInput,
    onboardingPayload?: {
      onboardingOption: "grace_period" | "custom_deadlines" | "exempt" | "standard";
      gracePeriodIso?: string;
      customDeadlines?: Record<string, string>;
    },
  ) {
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

      if (onboardingPayload) {
        payload.append("onboardingOption", onboardingPayload.onboardingOption);
        if (onboardingPayload.gracePeriodIso) {
          payload.append("gracePeriodIso", onboardingPayload.gracePeriodIso);
        }
        if (onboardingPayload.customDeadlines) {
          payload.append("customDeadlines", JSON.stringify(onboardingPayload.customDeadlines));
        }
      }

      const response = await fetch("/api/staff/faculty/create", {
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

      await loadFacultyFromDatabase({ silent: true });
      void loadDashboardStats({ silent: true });
      emitRealtimeSync({ source: "faculty-created", timestamp: Date.now() });
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
      const response = await fetch("/api/staff/faculty/delete", {
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
          await loadFacultyFromDatabase({ silent: true });
          void loadDashboardStats({ silent: true });
          emitRealtimeSync({ source: "faculty-deleted", timestamp: Date.now() });
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
        await loadFacultyFromDatabase({ silent: true });
        void loadDashboardStats({ silent: true });
        emitRealtimeSync({ source: "faculty-deleted", timestamp: Date.now() });
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
      const response = await fetch("/api/staff/faculty/deactivate", {
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
      await loadFacultyFromDatabase({ silent: true });
      void loadDashboardStats({ silent: true });
      emitRealtimeSync({ source: "faculty-deactivated", timestamp: Date.now() });
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
      const response = await fetch("/api/staff/faculty/activate", {
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
      await loadFacultyFromDatabase({ silent: true });
      void loadDashboardStats({ silent: true });
      emitRealtimeSync({ source: "faculty-activated", timestamp: Date.now() });
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
    <div className="flex flex-col min-h-dvh md:h-screen w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 md:overflow-hidden font-sans transition-colors duration-200">
      <header
        className={`fixed inset-x-0 ${
          isSidebarCollapsed ? "md:left-[calc(5rem-4px)]" : "md:left-[calc(18rem-4px)]"
        } top-0 h-14 z-40 border-b-4 border-amber-500 bg-[#800000] text-white shadow-md flex items-center transition-all duration-200`}
      >
        <div className="relative flex w-full h-full items-center justify-between pl-4 pr-3 sm:pr-6">
          {/* Left: Mobile Menu Trigger & Title (Mobile only) */}
          <div className="flex md:hidden items-center gap-2 sm:gap-3 z-10">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="inline-flex items-center justify-center p-1.5 rounded-xl border border-amber-500/40 bg-[#680000] hover:bg-[#550000] text-amber-100 hover:text-white transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/40 cursor-pointer shadow-2xs"
              aria-label="Open Navigation Menu"
            >
              <AppIcon icon={Menu} size="lg" color="inherit" />
            </button>

            <BrandMark size={36} className="shrink-0" />
            <span className="text-base font-extrabold tracking-tight text-white whitespace-nowrap leading-tight">
              <span className="text-amber-400">PUP</span> FOCUS
            </span>
          </div>

          {/* Desktop Centered System Title */}
          <div className="hidden md:flex absolute inset-0 items-center justify-center pointer-events-none px-24">
            <span className="text-sm lg:text-base xl:text-[17px] font-semibold tracking-normal text-center truncate max-w-[65vw]">
              <HighlightedSystemTitle />
            </span>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 sm:gap-3 z-10 ml-auto shrink-0">
            <AdminNotificationDrawer onNavigateToTarget={handleNotificationNavigate} />
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Body Wrapper */}
      <div
        className={`flex flex-1 min-h-0 md:h-screen pt-14 md:overflow-hidden relative ${
          isSidebarCollapsed ? "md:pl-20" : "md:pl-72"
        } transition-all duration-200`}
      >
        {/* Desktop Fixed Sidebar */}
        <aside
          className={`hidden md:flex md:flex-col fixed left-0 top-0 h-screen ${
            isSidebarCollapsed ? "w-20" : "w-72"
          } rounded-none bg-[#800000] text-amber-50 shadow-md z-50 transition-all duration-200`}
        >
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-3.5 flex flex-col">
            <SidebarContent
              activeSection={activeSection}
              setActiveSection={handleSetActiveSection}
              adminName={currentAdminName || adminName}
              roleTitle="Staff"
              profileImageUrl={adminAvatarUrl}
              collapsed={isSidebarCollapsed}
              onToggleCollapse={toggleSidebarCollapsed}
              onRequestExpand={() => setSidebarCollapsed(false)}
            />
          </div>
          {/* Amber vertical border that starts at the top edge of the header's bottom border (y=52px) to form a seamless 90-degree corner */}
          <div className="absolute right-0 top-[calc(3.5rem-4px)] bottom-0 w-1 bg-amber-500 pointer-events-none" />
        </aside>

        {/* Mobile Navigation Drawer / Sheet */}
        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 h-dvh z-[60] md:hidden flex overflow-hidden overscroll-none"
          >
            <div
              className="fixed inset-0 h-lvh bg-slate-950/80 backdrop-blur-sm touch-none overscroll-none"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <aside
              className="relative z-10 flex flex-col h-dvh w-72 max-w-[85%] bg-[#800000] text-amber-50 border-r-4 border-amber-500 p-4 shadow-2xl overflow-y-auto overscroll-contain sidebar-scrollbar transition-colors duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-amber-400/50 mb-2">
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  <BrandMark size={38} className="shrink-0" />
                  <span className="text-lg font-black tracking-tight text-white leading-tight">
                    PUP FOCUS
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1.5 rounded-lg border border-[#5e0000] bg-[#780000] hover:bg-[#5e0000] text-white transition-colors cursor-pointer shadow-xs shrink-0"
                  aria-label="Close navigation"
                >
                  <AppIcon icon={Xmark} size="md" color="inherit" />
                </button>
              </div>
              <SidebarContent
                activeSection={activeSection}
                setActiveSection={handleSetActiveSection}
                adminName={currentAdminName || adminName}
                roleTitle="Staff"
                profileImageUrl={adminAvatarUrl}
                onNavigate={() => setIsMobileMenuOpen(false)}
                showBrand={false}
              />
            </aside>
          </div>
        )}

        {/* Scrollable Main Content Area */}
        <div className="flex min-h-full md:h-full min-w-0 w-full flex-col">
          <div className="flex min-h-0 flex-1 flex-col md:overflow-hidden border-l-0 bg-slate-50 dark:bg-slate-950 shadow-sm transition-colors duration-200">
            <main className="min-h-0 flex-1 overflow-y-auto overflow-x-clip p-3.5 sm:p-6 pb-8 sm:pb-6 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
              <div className="w-full">
                {activeSection === "dashboard" ? (
                  <article className="space-y-4 sm:space-y-6">
                    {/* Solid Amber Card Header matching Admin Dashboard */}
                    <div className="relative overflow-hidden rounded-2xl border-2 border-amber-500 bg-amber-400 p-4 sm:p-6 shadow-md shadow-amber-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 sm:gap-4 transition-colors">
                      <div className="min-w-0">
                        <h1 className="text-xl sm:text-3xl font-black text-slate-950 tracking-tight">
                          Dashboard
                        </h1>
                        <p className="mt-1 sm:mt-1.5 text-xs sm:text-base text-amber-950/90 font-medium leading-relaxed">
                          Here&apos;s how everyone is doing: track faculty submissions, review pending files, and monitor term compliance.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                        <button
                          type="button"
                          onClick={() => void refreshCurrentPanel()}
                          disabled={isRefreshing}
                          title="Refresh dashboard"
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 px-3.5 py-2 sm:py-1.5 text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer shadow-xs active:scale-[0.98]"
                        >
                          <Refresh
                            className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`}
                          />
                          <span>{isRefreshing ? "Refreshing..." : "Refresh"}</span>
                        </button>
                      </div>
                    </div>

                    {/* TIER 2: Stat Grid (3 Cards matching Admin Dashboard) */}
                    <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {/* Card 1: Faculty Members */}
                      {isLoading ? (
                        <KpiCardSkeleton />
                      ) : (
                      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs h-full flex flex-col justify-between space-y-3 transition-colors">
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                              Faculty Members
                            </span>
                            <Group className="h-5 w-5 text-slate-400 shrink-0" strokeWidth={2} />
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                              {facultyStats.active} Active
                            </h3>
                            <span className="inline-flex items-center rounded-full bg-[#0b5336] text-white border border-[#08412a] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap shrink-0">
                              {facultyStats.activePct}% Active
                            </span>
                          </div>

                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                            <div
                              className="h-full rounded-full bg-[#0b5336] transition-all duration-500"
                              style={{
                                width: `${facultyStats.total > 0 ? Math.min(100, Math.max(4, (facultyStats.active / facultyStats.total) * 100)) : 0}%`,
                              }}
                            />
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 mt-auto">
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate min-w-0">
                            {facultyStats.completed} finished • {facultyStats.inProgress} in progress
                          </p>
                          <button
                            type="button"
                            onClick={() => handleSetActiveSection("facultyManagement")}
                            className="inline-flex items-center gap-1 text-xs font-bold text-[#800000] dark:text-amber-400 hover:underline cursor-pointer shrink-0"
                          >
                            <span>View faculty</span>
                            <NavArrowRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      )}

                      {/* Card 2: Overall Progress */}
                      {isLoadingStats && !dashboardStats ? (
                        <KpiCardSkeleton />
                      ) : (() => {
                        const verified = dashboardStats?.verified ?? 0;
                        const pending = dashboardStats?.pending ?? 0;
                        const revisions = dashboardStats?.revisions ?? 0;
                        const totalSubmissions = verified + pending + revisions;
                        const approvedPct =
                          totalSubmissions > 0
                            ? Math.round((verified / totalSubmissions) * 100)
                            : 0;
                        const pendingPct =
                          totalSubmissions > 0
                            ? Math.round((pending / totalSubmissions) * 100)
                            : 0;

                        return (
                          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs h-full flex flex-col justify-between space-y-3 transition-colors">
                            <div className="space-y-2.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                  Submission Progress
                                </span>
                                <CheckCircle className="h-5 w-5 text-slate-400 shrink-0" strokeWidth={2} />
                              </div>

                              <div className="flex items-center justify-between gap-2">
                                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                                  {isLoadingStats ? "..." : `${verified} Approved`}
                                </h3>
                                <span className="inline-flex items-center rounded-full bg-[#0b5336] text-white border border-[#08412a] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap shrink-0">
                                  {approvedPct}% Verified
                                </span>
                              </div>

                              <div className="space-y-1">
                                <div className="flex items-center justify-between gap-2 text-[11px]">
                                  <span className="text-slate-600 dark:text-slate-400 truncate min-w-0">
                                    Approved Files
                                  </span>
                                  <span className="font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap shrink-0">
                                    {verified} / {totalSubmissions} ({approvedPct}%)
                                  </span>
                                </div>
                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                                  <div
                                    className="h-full rounded-full bg-[#0b5336] transition-all duration-500"
                                    style={{
                                      width: `${totalSubmissions > 0 ? Math.min(100, Math.max(verified > 0 ? 4 : 0, approvedPct)) : 0}%`,
                                    }}
                                  />
                                </div>
                              </div>

                              <div className="space-y-1">
                                <div className="flex items-center justify-between gap-2 text-[11px]">
                                  <span className="text-slate-600 dark:text-slate-400 truncate min-w-0">
                                    Waiting for Review
                                  </span>
                                  <span className="font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap shrink-0">
                                    {pending} / {totalSubmissions} ({pendingPct}%)
                                  </span>
                                </div>
                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                                  <div
                                    className="h-full rounded-full bg-amber-500 transition-all duration-500"
                                    style={{
                                      width: `${totalSubmissions > 0 ? Math.min(100, Math.max(pending > 0 ? 4 : 0, pendingPct)) : 0}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 mt-auto">
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate min-w-0">
                                {revisions > 0
                                  ? `${revisions} returned for revision`
                                  : `${pending} waiting in review queue`}
                              </p>
                              <button
                                type="button"
                                onClick={() => handleSetActiveSection("requirements")}
                                className="inline-flex items-center gap-1 text-xs font-bold text-[#800000] dark:text-amber-400 hover:underline cursor-pointer shrink-0"
                              >
                                <span>Verify files</span>
                                <NavArrowRight className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Card 3: Submission Window & Term */}
                      {isLoadingStats && !windowStatus ? (
                        <KpiCardSkeleton />
                      ) : (
                      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs h-full flex flex-col justify-between space-y-3 transition-colors">
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                              Submission Window
                            </span>
                            <Calendar className="h-5 w-5 text-slate-400 shrink-0" strokeWidth={2} />
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight truncate">
                              {!windowStatus
                                ? "Checking..."
                                : windowStatus.isAlwaysOpen
                                  ? "Always Open"
                                  : windowStatus.isOpen
                                    ? "Submission Open"
                                    : windowStatus.status === "Upcoming"
                                      ? "Opening Soon"
                                      : "Submission Closed"}
                            </h3>
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap shrink-0 border ${
                                !windowStatus
                                  ? "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                                  : windowStatus.isOpen || windowStatus.isAlwaysOpen
                                    ? "bg-[#0b5336] text-white border-[#08412a]"
                                    : windowStatus.status === "Upcoming"
                                      ? "bg-amber-500 text-amber-950 border-amber-600"
                                      : "bg-[#780000] text-white border-[#5e0000]"
                              }`}
                            >
                              {!windowStatus
                                ? "Syncing"
                                : windowStatus.isOpen || windowStatus.isAlwaysOpen
                                  ? "Open"
                                  : windowStatus.status === "Upcoming"
                                    ? "Scheduled"
                                    : "Closed"}
                            </span>
                          </div>

                          <p className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate">
                            {dashboardStats?.currentAcademicYear
                              ? `A.Y. ${dashboardStats.currentAcademicYear} • ${dashboardStats.currentSemester || "1st Semester"}`
                              : "No active academic term configured"}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {!windowStatus
                              ? "Loading submission schedule..."
                              : windowStatus.isAlwaysOpen
                                ? "No closing deadline set"
                                : windowStatus.status === "Upcoming" &&
                                    windowStatus.startDate &&
                                    windowStatus.startTimeLabel
                                  ? `Opens: ${windowStatus.startDate} at ${windowStatus.startTimeLabel}`
                                  : windowStatus.endDate && windowStatus.endTimeLabel
                                    ? `Deadline: ${windowStatus.endDate} at ${windowStatus.endTimeLabel}`
                                    : windowStatus.isOpen
                                      ? "Accepting faculty submissions"
                                      : "Submissions are currently closed"}
                          </p>
                        </div>

                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 mt-auto">
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate min-w-0">
                            {!windowStatus
                              ? "Checking portal status"
                              : windowStatus.isOpen || windowStatus.isAlwaysOpen
                                ? "Faculty can upload files now"
                                : windowStatus.status === "Upcoming"
                                  ? "Waiting for scheduled start"
                                  : "Faculty uploads are locked"}
                          </p>
                          <button
                            type="button"
                            onClick={() => handleSetActiveSection("requirements")}
                            className="inline-flex items-center gap-1 text-xs font-bold text-[#800000] dark:text-amber-400 hover:underline cursor-pointer shrink-0"
                          >
                            <span>Check queue</span>
                            <NavArrowRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      )}
                    </section>

                    {/* TIER 2.5: Term Submission Scale & Distribution matching Admin Dashboard */}
                    <SuperAdminComplianceAnalytics
                      facultyAccounts={facultyAccounts}
                      isLoadingFaculty={isLoading}
                      onInspectFaculty={(facultyId) => {
                        handleSelectFaculty(facultyId);
                        handleSetActiveSection("requirements");
                      }}
                      onNavigateSection={(sec) => {
                        if (sec === "faculty") {
                          handleSetActiveSection("facultyManagement");
                        } else {
                          handleSetActiveSection("requirements");
                        }
                      }}
                    />
                  </article>
                ) : null}

                {activeSection === "facultyManagement" ? (
                  <article className="space-y-4 sm:space-y-5">
                    {/* Solid Amber Card Header matching Admin */}
                    <div className="relative overflow-hidden rounded-2xl border-2 border-amber-500 bg-amber-400 p-4 sm:p-6 shadow-md shadow-amber-500/10 flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 sm:gap-4">
                      <div className="min-w-0">
                        <h1 className="text-xl sm:text-3xl font-black text-slate-950 tracking-tight">
                          Faculty Management
                        </h1>
                        <p className="mt-1 sm:mt-1.5 text-xs sm:text-base text-amber-950/90 font-medium leading-relaxed">
                          View, manage, and monitor faculty profiles, department assignments, and account statuses.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 sm:flex sm:items-center gap-2 w-full lg:w-auto shrink-0 flex-wrap">
                        <button
                          type="button"
                          onClick={() => {
                            setCreateError(null);
                            setCreateSuccess(null);
                            setAddFacultyModalOpen(true);
                          }}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] px-4 py-2 sm:py-1.5 text-xs font-bold shadow-sm active:scale-[0.98] transition cursor-pointer"
                        >
                          + Add Faculty
                        </button>

                        <button
                          type="button"
                          onClick={() => void refreshCurrentPanel()}
                          disabled={isRefreshing}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 px-3.5 py-2 sm:py-1.5 text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer shadow-xs active:scale-[0.98]"
                        >
                          <Refresh className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
                          <span>{isRefreshing ? "Refreshing..." : "Refresh"}</span>
                        </button>
                      </div>
                    </div>

                    <FacultyTable
                      facultyAccounts={facultyAccounts}
                      isLoading={isLoading}
                      onSelectFaculty={handleSelectFaculty}
                      onViewDetails={(facultyId) => {
                        setViewDetailsFacultyId(facultyId);
                        setViewDetailsModalOpen(true);
                      }}
                    />
                  </article>
                ) : null}

                {activeSection === "requirements" ? (
                  <article className="space-y-4 sm:space-y-5">
                    {/* Solid Amber Card Header matching Admin - only show when in faculty list */}
                    {!selectedFaculty ? (
                      <div className="relative overflow-hidden rounded-2xl border-2 border-amber-500 bg-amber-400 p-4 sm:p-6 shadow-md shadow-amber-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 sm:gap-4">
                        <div className="min-w-0">
                          <h1 className="text-xl sm:text-3xl font-black text-slate-950 tracking-tight">
                            Requirements Verification
                          </h1>
                          <p className="mt-1 sm:mt-1.5 text-xs sm:text-base text-amber-950/90 font-medium leading-relaxed">
                            Review, validate, or request revisions for submitted faculty compliance documents for this academic term.
                          </p>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                          <button
                            type="button"
                            onClick={() => void refreshCurrentPanel()}
                            disabled={isRefreshing}
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 px-3.5 py-2 sm:py-1.5 text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer shadow-xs active:scale-[0.98]"
                          >
                            <Refresh className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
                            <span>{isRefreshing ? "Refreshing..." : "Refresh"}</span>
                          </button>
                        </div>
                      </div>
                    ) : null}

                    <RequirementsPanel
                      facultyAccounts={facultyAccounts}
                      isLoadingFaculty={isLoading}
                      selectedFaculty={selectedFaculty}
                      onSelectFaculty={handleSelectFaculty}
                      resetTrigger={verificationResetTrigger}
                      initialReviewFacultyId={
                        initialReviewFacultyId || searchParams?.get("facultyId") || null
                      }
                      initialRequirementCode={
                        initialHighlightRequirementCode || searchParams?.get("reqCode") || null
                      }
                      initialAcademicYear={dashboardStats?.currentAcademicYear}
                      initialSemester={dashboardStats?.currentSemester as any}
                    />
                  </article>
                ) : null}

                {activeSection === "settings" ? (
                  <article className="space-y-4 sm:space-y-5">
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
        />
      ) : null}

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

export const StaffDashboard = AdminFacultyDashboard;
export default StaffDashboard;
