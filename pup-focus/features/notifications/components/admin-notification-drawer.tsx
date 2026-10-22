"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCircle,
  Database,
  DoubleCheck,
  Hourglass,
  InfoCircle,
  Mail,
  NavArrowLeft,
  NavArrowRight,
  Notes,
  OpenNewWindow,
  Page,
  Refresh,
  SystemRestart,
  Trash,
  Upload,
  User,
  WarningTriangle,
  Xmark,
  XmarkCircle,
} from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";
import { REQUIREMENT_LABEL, type RequirementCode } from "@/config/compliance";
import { cn } from "@/utils/cn";
import { useRealtimeSync } from "@/lib/realtime";

export interface AdminNotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  isSubmission: boolean;
  isRevision: boolean;
  facultyName: string | null;
  facultyId: string | null;
  facultyEmail?: string | null;
  facultyAvatarUrl?: string | null;
  facultyDepartment?: string | null;
  requirementCode: RequirementCode | null;
  requirementLabel: string | null;
  isExtensionRequest?: boolean;
  metadata?: Record<string, any> | null;
}

export interface AdminNotificationDrawerProps {
  onNavigateToTarget?: (notification: AdminNotificationItem) => void;
}

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString;

    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "Just now";
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;

    return date.toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateString;
  }
}

function formatFullDateTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString;
    return date.toLocaleString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return dateString;
  }
}

function parseExtensionPayload(
  message: string,
  metadata?: Record<string, any> | null
): {
  isExtension: boolean;
  reason?: string;
  preset?: string;
  date?: string;
  time?: string;
  academicYear?: string;
  semester?: string;
  requirementCodes?: string[];
  supportingDocUrl?: string | null;
  supportingDocName?: string | null;
} | null {
  let parsed: any = null;
  if (typeof message === "string" && message.trim().startsWith("{")) {
    try {
      parsed = JSON.parse(message);
    } catch {}
  }
  if (!parsed && metadata) {
    if (metadata.requested_preset || metadata.reason || metadata.academic_year) {
      parsed = metadata;
    }
  }

  if (parsed && (parsed.requested_preset || parsed.reason || parsed.requirement_codes)) {
    return {
      isExtension: true,
      reason: parsed.reason,
      preset: parsed.requested_preset,
      date: parsed.requested_date,
      time: parsed.requested_time,
      academicYear: parsed.academic_year,
      semester: parsed.semester,
      requirementCodes: Array.isArray(parsed.requirement_codes) ? parsed.requirement_codes : [],
      supportingDocUrl: parsed.supporting_document_url,
      supportingDocName: parsed.supporting_document_name,
    };
  }

  return null;
}

function getAdminNotificationBadge(notif: AdminNotificationItem): {
  categoryLabel: string;
  Icon: typeof Upload;
  colorClasses: string;
  badgeBg: string;
  bannerBg: string;
  heroIconClasses: string;
  heroBadgeBg: string;
} {
  const isDbCapacityAlert =
    notif.type === "DB_CAPACITY_ALERT" ||
    notif.type?.includes("DB_CAPACITY") ||
    notif.title?.toLowerCase().includes("database");

  if (isDbCapacityAlert) {
    return {
      categoryLabel: "Database & Storage Alert",
      Icon: Database,
      colorClasses: "bg-[#780000] text-amber-300 border border-amber-400 shadow-xs",
      badgeBg: "bg-[#780000] text-white border border-amber-400 font-bold shadow-2xs",
      bannerBg: "bg-[#780000] text-white border border-amber-500",
      heroIconClasses: "bg-white text-[#780000] shadow-sm border border-amber-400/50",
      heroBadgeBg: "bg-white text-[#780000] font-black shadow-2xs border border-amber-400/50",
    };
  }

  if (notif.isExtensionRequest || notif.type === "EXTENSION_REQUEST") {
    return {
      categoryLabel: "Extension Request",
      Icon: Hourglass,
      colorClasses: "bg-amber-500 text-amber-950 border border-amber-600 shadow-xs",
      badgeBg: "bg-amber-500 text-amber-950 border border-amber-600 font-bold shadow-2xs",
      bannerBg: "bg-amber-500 text-amber-950 border border-amber-600",
      heroIconClasses: "bg-white text-amber-800 shadow-sm border border-amber-600/30",
      heroBadgeBg: "bg-white text-amber-800 font-bold shadow-2xs border border-amber-600/30",
    };
  }

  if (notif.isRevision) {
    return {
      categoryLabel: "Resubmission",
      Icon: WarningTriangle,
      colorClasses: "bg-[#780000] text-white border border-[#5e0000] shadow-xs",
      badgeBg: "bg-[#780000] text-white border border-[#5e0000] font-bold shadow-2xs",
      bannerBg: "bg-[#780000] text-white border border-[#5e0000]",
      heroIconClasses: "bg-white text-[#780000] shadow-sm",
      heroBadgeBg: "bg-white text-[#780000] font-black shadow-2xs",
    };
  }

  if (notif.isSubmission) {
    return {
      categoryLabel: "Faculty Submission",
      Icon: Upload,
      colorClasses: "bg-[#0b5336] text-white border border-[#08412a] shadow-xs",
      badgeBg: "bg-[#0b5336] text-white border border-[#08412a] font-bold shadow-2xs",
      bannerBg: "bg-[#0b5336] text-white border border-[#08412a]",
      heroIconClasses: "bg-white text-[#0b5336] shadow-sm",
      heroBadgeBg: "bg-white text-[#0b5336] font-black shadow-2xs",
    };
  }

  if (notif.type === "SUBMISSION_APPROVED" || notif.title.toLowerCase().includes("approved")) {
    return {
      categoryLabel: "Validated Requirement",
      Icon: CheckCircle,
      colorClasses: "bg-[#0b5336] text-white border border-[#08412a] shadow-xs",
      badgeBg: "bg-[#0b5336] text-white border border-[#08412a] font-bold shadow-2xs",
      bannerBg: "bg-[#0b5336] text-white border border-[#08412a]",
      heroIconClasses: "bg-white text-[#0b5336] shadow-sm",
      heroBadgeBg: "bg-white text-[#0b5336] font-black shadow-2xs",
    };
  }

  return {
    categoryLabel: "System Update",
    Icon: InfoCircle,
    colorClasses: "bg-slate-700 text-white border border-slate-600 shadow-xs",
    badgeBg: "bg-slate-700 text-white border border-slate-600 font-bold shadow-2xs",
    bannerBg: "bg-slate-800 text-white border border-slate-700",
    heroIconClasses: "bg-white/20 text-white shadow-sm border border-white/30",
    heroBadgeBg: "bg-white/25 text-white font-black shadow-2xs",
  };
}

export function AdminNotificationDrawer({
  onNavigateToTarget,
}: AdminNotificationDrawerProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<"all" | "submissions" | "unread">("all");
  const [selectedNotification, setSelectedNotification] = useState<AdminNotificationItem | null>(null);
  const [mounted, setMounted] = useState(false);
  const [facultyAvatarMap, setFacultyAvatarMap] = useState<Map<string, string>>(new Map());
  const [failedAvatarIds, setFailedAvatarIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setMounted(true);
    async function loadFacultyAvatars() {
      try {
        const res = await fetch("/api/staff/faculty/list", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.faculty)) {
            const map = new Map<string, string>();
            for (const f of data.faculty) {
              const url = f.profileImageUrl || f.avatarUrl;
              if (url) {
                if (f.id) map.set(String(f.id).toLowerCase(), url);
                if (f.user_id) map.set(String(f.user_id).toLowerCase(), url);
                if (f.fullName) map.set(String(f.fullName).toLowerCase().trim(), url);
                if (f.email) map.set(String(f.email).toLowerCase().trim(), url);
              }
            }
            setFacultyAvatarMap(map);
          }
        }
      } catch {}
    }
    loadFacultyAvatars();
  }, []);

  // Prevent background body scrolling when drawer is open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  const fetchNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/staff/notifications?_t=${Date.now()}`, {
        cache: "no-store",
      });
      if (!response.ok) return;

      const data = await response.json();
      if (Array.isArray(data.notifications)) {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount ?? data.notifications.filter((n: any) => !n.isRead).length);
      }
    } catch (err) {
      console.warn("Failed to fetch admin notifications:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchNotifications();
    const interval = setInterval(() => {
      void fetchNotifications();
    }, 20000);

    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useRealtimeSync(() => {
    void fetchNotifications();
  });

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (selectedNotification) {
          setSelectedNotification(null);
        } else {
          setIsOpen(false);
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, selectedNotification]);

  const handleOpenDrawer = () => {
    setSelectedNotification(null);
    setIsOpen(true);
    void fetchNotifications();
  };

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0 || isMarkingAll) return;

    setIsMarkingAll(true);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);

    try {
      await fetch("/api/staff/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
      setToastMessage("All notifications marked as read");
      setTimeout(() => setToastMessage(null), 3000);
    } catch {
      await fetchNotifications();
    } finally {
      setIsMarkingAll(false);
    }
  };

  const handleClearAll = async () => {
    if (notifications.length === 0 || isClearingAll) return;

    setIsClearingAll(true);
    const prev = [...notifications];
    const prevCount = unreadCount;
    setNotifications([]);
    setUnreadCount(0);
    setSelectedNotification(null);

    try {
      const res = await fetch("/api/staff/notifications", {
        method: "DELETE",
      });
      if (res.ok) {
        setToastMessage("All notifications cleared");
        setTimeout(() => setToastMessage(null), 3000);
      } else {
        setNotifications(prev);
        setUnreadCount(prevCount);
      }
    } catch {
      setNotifications(prev);
      setUnreadCount(prevCount);
    } finally {
      setIsClearingAll(false);
    }
  };

  const handleToggleSingleRead = async (notificationId: string, currentReadState: boolean) => {
    const nextState = !currentReadState;
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, isRead: nextState } : n))
    );
    setUnreadCount((prev) => (nextState ? Math.max(0, prev - 1) : prev + 1));
    if (selectedNotification && selectedNotification.id === notificationId) {
      setSelectedNotification((prev) => (prev ? { ...prev, isRead: nextState } : null));
    }

    try {
      await fetch("/api/staff/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId, isRead: nextState }),
      });
    } catch {
      // Optimistic update retained
    }
  };

  // Open detail view inside drawer
  const handleOpenDetail = async (notification: AdminNotificationItem) => {
    setSelectedNotification(notification);

    if (!notification.isRead) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      try {
        await fetch("/api/staff/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notificationId: notification.id }),
        });
      } catch {
        // Optimistic update retained
      }
    }
  };

  // Direct target navigation with browser history support
  const handleNavigateDirect = (notification: AdminNotificationItem) => {
    setIsOpen(false);
    setSelectedNotification(null);

    if (onNavigateToTarget) {
      onNavigateToTarget(notification);
      return;
    }

    const isAdminPath =
      typeof window !== "undefined" &&
      (window.location.pathname.startsWith("/admin") ||
        window.location.pathname.includes("super-admin"));

    const targetFacultyId =
      notification.facultyId ||
      notification.metadata?.faculty_id ||
      notification.metadata?.faculty_profile_id;
    const reqCode =
      notification.requirementCode ||
      notification.metadata?.requirement_code ||
      notification.metadata?.requirementCode;

    if (isAdminPath) {
      let targetTab = "verification";
      if (
        notification.type?.includes("WINDOW") ||
        notification.title?.toLowerCase().includes("window")
      ) {
        targetTab = "window";
      } else if (
        notification.type?.includes("TERM") ||
        notification.title?.toLowerCase().includes("term")
      ) {
        targetTab = "terms";
      } else if (
        notification.type === "DB_CAPACITY_ALERT" ||
        notification.type?.includes("DB_CAPACITY") ||
        notification.title?.toLowerCase().includes("database")
      ) {
        targetTab = "backups";
      } else if (
        notification.type?.includes("FACULTY") ||
        notification.title?.toLowerCase().includes("faculty")
      ) {
        targetTab = "faculty";
      }

      try {
        const url = new URL(window.location.href);
        url.pathname = "/admin/dashboard";
        url.searchParams.set("tab", targetTab);
        if (targetFacultyId) url.searchParams.set("facultyId", targetFacultyId);
        if (reqCode) url.searchParams.set("reqCode", reqCode);
        window.history.pushState({ fromNotification: true, tab: targetTab, facultyId: targetFacultyId, reqCode }, "", url.toString());
      } catch {}

      window.dispatchEvent(
        new CustomEvent("pup-focus-admin-navigate", {
          detail: { tab: targetTab, facultyId: targetFacultyId, reqCode },
        })
      );

      const targetUrl = `/admin/dashboard?tab=${targetTab}${targetFacultyId ? `&facultyId=${encodeURIComponent(targetFacultyId)}` : ""}${reqCode ? `&reqCode=${encodeURIComponent(reqCode)}` : ""}`;
      router.push(targetUrl);
    } else {
      let targetSection = "requirements";
      if (
        notification.type?.includes("WINDOW") ||
        notification.title?.toLowerCase().includes("window")
      ) {
        targetSection = "submissionWindow";
      } else if (
        notification.type?.includes("TERM") ||
        notification.title?.toLowerCase().includes("term")
      ) {
        targetSection = "academicTerms";
      } else if (
        notification.type?.includes("FACULTY") ||
        notification.title?.toLowerCase().includes("faculty")
      ) {
        targetSection = "facultyManagement";
      }

      try {
        const url = new URL(window.location.href);
        url.pathname = "/staff/dashboard";
        url.searchParams.set("section", targetSection);
        if (targetFacultyId) url.searchParams.set("facultyId", targetFacultyId);
        if (reqCode) url.searchParams.set("reqCode", reqCode);
        window.history.pushState({ fromNotification: true, section: targetSection, facultyId: targetFacultyId, reqCode }, "", url.toString());
      } catch {}

      const targetUrl = `/staff/dashboard?section=${targetSection}${targetFacultyId ? `&facultyId=${encodeURIComponent(targetFacultyId)}` : ""}${reqCode ? `&reqCode=${encodeURIComponent(reqCode)}` : ""}`;
      router.push(targetUrl);
    }
  };

  const filteredNotifications = useMemo(() => {
    if (filterTab === "submissions") {
      return notifications.filter((n) => n.isSubmission);
    }
    if (filterTab === "unread") {
      return notifications.filter((n) => !n.isRead);
    }
    return notifications;
  }, [notifications, filterTab]);

  const submissionCount = useMemo(
    () => notifications.filter((n) => n.isSubmission).length,
    [notifications]
  );

  return (
    <>
      {/* Header Trigger Button */}
      <button
        type="button"
        onClick={handleOpenDrawer}
        aria-label={`Admin Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
        className="relative flex items-center justify-center shrink-0 p-1.5 sm:p-2 rounded-xl text-amber-950 bg-amber-500 hover:bg-amber-400 border border-amber-600/50 transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/40 cursor-pointer shadow-xs hover:shadow-sm active:scale-95"
      >
        <AppIcon icon={Bell} size="lg" color="inherit" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold text-white shadow-md ring-2 ring-white dark:ring-slate-900 animate-pulse">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Slide-out Sheet Panel Portal */}
      {isOpen &&
        mounted &&
        createPortal(
          <div className="fixed inset-0 z-[100] overflow-hidden">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
              onClick={() => {
                if (selectedNotification) {
                  setSelectedNotification(null);
                } else {
                  setIsOpen(false);
                }
              }}
              aria-hidden="true"
            />

            {/* Sheet Drawer */}
            <div className="fixed inset-y-0 right-0 z-[100] flex h-full w-full sm:max-w-lg md:max-w-xl flex-col bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 shadow-2xl animate-in slide-in-from-right duration-250 overflow-x-hidden">
              
              {/* TOP HEADER BAR */}
              <div className="flex items-center justify-between border-b border-amber-500/20 bg-gradient-to-r from-[#600000] via-[#4d0000] to-[#3a0000] text-white px-4 sm:px-5 py-3.5 shrink-0 shadow-xs">
                {selectedNotification ? (
                  /* Detail Mode Header: Back Button + Close */
                  <div className="flex items-center justify-between w-full gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedNotification(null)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-amber-100 hover:text-white bg-[#7a0000]/80 hover:bg-[#8d0000] border border-amber-500/30 transition-all cursor-pointer shadow-2xs active:scale-95"
                      aria-label="Back to notification list"
                    >
                      <AppIcon icon={NavArrowLeft} size="sm" color="inherit" />
                      <span>Back to notifications</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedNotification(null);
                        setIsOpen(false);
                      }}
                      className="p-1.5 rounded-lg border border-[#5e0000] bg-[#780000] hover:bg-[#5e0000] text-white transition-colors shrink-0 cursor-pointer shadow-xs active:scale-95"
                      aria-label="Close notification drawer"
                    >
                      <AppIcon icon={Xmark} size="md" color="inherit" />
                    </button>
                  </div>
                ) : (
                  /* List Mode Header: Bell + Title + Refresh + Close */
                  <>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                        <AppIcon icon={Bell} size="lg" color="inherit" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-extrabold text-white tracking-tight truncate">
                            Notifications
                          </h3>
                          {unreadCount > 0 && (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 border border-amber-500/40 px-2.5 py-0.5 text-xs font-bold text-amber-300 whitespace-nowrap shadow-xs">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                              {unreadCount} unread
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-amber-200/80 mt-0.5 truncate">
                          Faculty submissions &amp; compliance alerts
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => void fetchNotifications()}
                        disabled={isLoading}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-amber-500/30 bg-[#7a0000]/70 hover:bg-[#8d0000] text-amber-100 hover:text-white transition-all cursor-pointer disabled:opacity-50 shadow-2xs active:scale-95"
                        title="Refresh notifications"
                      >
                        <Refresh className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
                        <span className="hidden xs:inline">{isLoading ? "Refreshing..." : "Refresh"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsOpen(false)}
                        className="p-1.5 rounded-lg border border-[#5e0000] bg-[#780000] hover:bg-[#5e0000] text-white transition-colors shrink-0 cursor-pointer shadow-xs active:scale-95"
                        aria-label="Close notification drawer"
                      >
                        <AppIcon icon={Xmark} size="md" color="inherit" />
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* LIST MODE: TOOLBAR */}
              {!selectedNotification && (
                <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/70 text-xs shrink-0 overflow-x-hidden">
                  <div className="flex items-center gap-1 bg-slate-200/80 dark:bg-slate-800 p-0.5 rounded-lg shrink-0">
                    <button
                      type="button"
                      onClick={() => setFilterTab("all")}
                      className={cn(
                        "px-2.5 py-1 rounded-md font-semibold text-xs transition cursor-pointer whitespace-nowrap",
                        filterTab === "all"
                          ? "bg-white dark:bg-slate-900 text-slate-950 dark:text-slate-100 shadow-2xs font-bold"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                      )}
                    >
                      All ({notifications.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterTab("submissions")}
                      className={cn(
                        "px-2.5 py-1 rounded-md font-semibold text-xs transition cursor-pointer whitespace-nowrap",
                        filterTab === "submissions"
                          ? "bg-white dark:bg-slate-900 text-slate-950 dark:text-slate-100 shadow-2xs font-bold"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                      )}
                    >
                      Submissions ({submissionCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterTab("unread")}
                      className={cn(
                        "px-2.5 py-1 rounded-md font-semibold text-xs transition cursor-pointer whitespace-nowrap",
                        filterTab === "unread"
                          ? "bg-white dark:bg-slate-900 text-slate-950 dark:text-slate-100 shadow-2xs font-bold"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                      )}
                    >
                      Unread ({unreadCount})
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={handleMarkAllAsRead}
                        disabled={isMarkingAll || isClearingAll}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-400 text-amber-950 border border-amber-600/50 transition-colors shadow-xs disabled:opacity-50 cursor-pointer whitespace-nowrap"
                        title="Mark all notifications as read"
                      >
                        {isMarkingAll ? (
                          <AppIcon icon={SystemRestart} size="xs" color="inherit" className="animate-spin" />
                        ) : (
                          <AppIcon icon={DoubleCheck} size="xs" color="inherit" />
                        )}
                        <span>Mark all read</span>
                      </button>
                    )}

                    {notifications.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearAll}
                        disabled={isClearingAll || isMarkingAll}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] transition-colors shadow-xs disabled:opacity-50 cursor-pointer whitespace-nowrap"
                        title="Clear all notifications"
                      >
                        {isClearingAll ? (
                          <AppIcon icon={SystemRestart} size="xs" color="inherit" className="animate-spin" />
                        ) : (
                          <AppIcon icon={Trash} size="xs" color="inherit" />
                        )}
                        <span>Clear all</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Toast Feedback */}
              {toastMessage && (
                <div className="flex items-center justify-between gap-2 bg-[#0b5336] border-b border-[#08412a] px-4 py-2.5 text-xs text-white animate-in fade-in shrink-0 shadow-xs">
                  <div className="flex items-center gap-2">
                    <AppIcon icon={CheckCircle} size="md" color="inherit" />
                    <span className="font-bold">{toastMessage}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setToastMessage(null)}
                    className="p-1 rounded-md text-white/80 hover:text-white transition-colors cursor-pointer"
                    aria-label="Dismiss toast"
                  >
                    <AppIcon icon={Xmark} size="sm" color="inherit" />
                  </button>
                </div>
              )}

              {/* BODY CONTAINER */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden bg-white dark:bg-slate-950">
                {selectedNotification ? (
                  /* ================= DETAIL VIEW ================= */
                  <div className="p-5 sm:p-6 space-y-5 animate-in fade-in slide-in-from-right-2 duration-200">
                    {(() => {
                      const {
                        categoryLabel,
                        Icon,
                        colorClasses,
                        badgeBg,
                        bannerBg,
                        heroIconClasses,
                        heroBadgeBg,
                      } = getAdminNotificationBadge(selectedNotification);
                      const reqLabel =
                        selectedNotification.requirementLabel ||
                        (selectedNotification.requirementCode
                          ? REQUIREMENT_LABEL[selectedNotification.requirementCode]
                          : null);
                      const metadata = selectedNotification.metadata || {};
                      const remarks =
                        metadata.remarks ||
                        metadata.reviewerRemarks ||
                        metadata.reviewer_remarks ||
                        metadata.notes ||
                        metadata.reason;
                      const fileUrl =
                        metadata.fileUrl ||
                        metadata.file_url ||
                        (metadata.storagePath
                          ? `/api/storage/download?path=${encodeURIComponent(metadata.storagePath)}`
                          : null);
                      const fileName =
                        metadata.fileName ||
                        metadata.file_name ||
                        metadata.originalName ||
                        (fileUrl ? fileUrl.split("/").pop()?.split("?")[0] : null);

                      return (
                        <>
                          {/* Hero Solid Status Banner */}
                          <div className={cn("rounded-2xl p-4 sm:p-5 shadow-md space-y-3", bannerBg)}>
                            <div className="flex items-start gap-3">
                              <div className={cn("p-2.5 rounded-xl shrink-0 flex items-center justify-center shadow-sm", heroIconClasses)}>
                                <AppIcon icon={Icon} size="lg" color="inherit" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-black uppercase tracking-wider mb-1", heroBadgeBg)}>
                                  {categoryLabel}
                                </span>
                                <h2 className="text-base sm:text-lg font-black text-inherit leading-snug break-words">
                                  {selectedNotification.title}
                                </h2>
                                <p className="text-xs opacity-90 mt-1 font-medium">
                                  {formatRelativeTime(selectedNotification.createdAt)} &bull; {formatFullDateTime(selectedNotification.createdAt)}
                                </p>
                              </div>
                            </div>

                            {/* Requirement Tag */}
                            {reqLabel && (
                              <div className="pt-2.5 border-t border-current/20 flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold opacity-90">
                                  Requirement:
                                </span>
                                <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-white text-amber-900 border border-amber-600/30 shadow-2xs">
                                  {reqLabel}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Submitter Faculty Member Info */}
                          {selectedNotification.facultyName && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                                  <AppIcon icon={User} size="xs" color="inherit" />
                                  <span>Faculty Profile</span>
                                </h4>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50 shadow-2xs">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  Active Faculty
                                </span>
                              </div>

                              <div className="rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-xs hover:border-[#780000]/30 transition-all">
                                <div className="flex items-center gap-3">
                                  {/* Profile Photo / Avatar */}
                                  {(() => {
                                    const facultyNameKey = (selectedNotification.facultyName || "").toLowerCase().trim();
                                    const facultyIdKey = (selectedNotification.facultyId || metadata.faculty_user_id || metadata.facultyId || "").toLowerCase().trim();
                                    const facultyEmailKey = (selectedNotification.facultyEmail || metadata.faculty_email || "").toLowerCase().trim();

                                    const resolvedAvatarSrc =
                                      selectedNotification.facultyAvatarUrl ||
                                      metadata.avatar_url ||
                                      metadata.profile_image_url ||
                                      facultyAvatarMap.get(facultyNameKey) ||
                                      facultyAvatarMap.get(facultyIdKey) ||
                                      facultyAvatarMap.get(facultyEmailKey) ||
                                      null;

                                    const hasAvatar = Boolean(resolvedAvatarSrc && !failedAvatarIds.has(selectedNotification.id));

                                    return (
                                      <div className="relative shrink-0 h-10 w-10">
                                        {hasAvatar ? (
                                          <img
                                            src={resolvedAvatarSrc!}
                                            alt={selectedNotification.facultyName}
                                            className="h-10 w-10 rounded-full object-cover border-2 border-[#780000] shadow-sm bg-slate-100"
                                            onError={() => {
                                              setFailedAvatarIds((prev) => new Set(prev).add(selectedNotification.id));
                                            }}
                                          />
                                        ) : (
                                          <div className="h-10 w-10 rounded-full bg-[#780000] text-white border-2 border-[#5e0000] flex items-center justify-center font-bold text-xs shadow-sm">
                                            {selectedNotification.facultyName.slice(0, 2).toUpperCase()}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}

                                  {/* Details */}
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-2">
                                      <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-100 truncate">
                                        {selectedNotification.facultyName}
                                      </h3>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const targetFacultyId =
                                            selectedNotification.facultyId ||
                                            metadata.faculty_user_id ||
                                            metadata.facultyId;
                                          if (targetFacultyId) {
                                            router.push(`/staff/faculty?facultyId=${encodeURIComponent(targetFacultyId)}`);
                                          } else {
                                            router.push(`/staff/faculty`);
                                          }
                                        }}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] transition shadow-2xs active:scale-95 cursor-pointer shrink-0"
                                      >
                                        <span>View Profile</span>
                                        <AppIcon icon={NavArrowRight} size="xs" color="inherit" />
                                      </button>
                                    </div>

                                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-600 dark:text-slate-400">
                                      <span className="truncate">
                                        {selectedNotification.facultyDepartment || metadata.department || metadata.program || "Faculty of Instruction"}
                                      </span>
                                      {(selectedNotification.facultyEmail || metadata.faculty_email) && (
                                        <>
                                          <span className="text-slate-300 dark:text-slate-700">&bull;</span>
                                          <span className="truncate font-mono text-[10.5px]">
                                            {selectedNotification.facultyEmail || metadata.faculty_email}
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Extension Request Breakdown or Regular Details */}
                          {(() => {
                            const extPayload = parseExtensionPayload(selectedNotification.message, metadata);
                            if (extPayload) {
                              return (
                                <div className="space-y-1.5">
                                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                                    <AppIcon icon={Hourglass} size="xs" color="inherit" />
                                    <span>Extension Details</span>
                                  </h4>
                                  <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-3 space-y-2.5 shadow-2xs">
                                    {/* Reason */}
                                    <div className="rounded-lg bg-white dark:bg-slate-900 p-2.5 border border-amber-200 dark:border-amber-900/60 shadow-2xs">
                                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 dark:text-amber-300 block mb-0.5">
                                        Reason
                                      </span>
                                      <p className="text-xs font-semibold italic text-slate-900 dark:text-slate-100">
                                        &ldquo;{extPayload.reason || "No explanation provided."}&rdquo;
                                      </p>
                                    </div>

                                    {/* Metrics Grid: Duration & Term */}
                                    <div className="grid grid-cols-2 gap-2">
                                      <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/60 shadow-2xs">
                                        <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">
                                          Duration
                                        </span>
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-bold bg-amber-500 text-amber-950">
                                          <AppIcon icon={Hourglass} size="xs" color="inherit" />
                                          {extPayload.preset || "+3 Days"}
                                        </span>
                                        {extPayload.date && (
                                          <p className="text-[10px] text-slate-500 mt-0.5">
                                            Until {extPayload.date}
                                          </p>
                                        )}
                                      </div>

                                      <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/60 shadow-2xs">
                                        <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">
                                          Term
                                        </span>
                                        <p className="text-[11px] font-bold text-slate-900 dark:text-slate-100">
                                          {extPayload.semester || "1st Semester"}
                                        </p>
                                        <p className="text-[10px] text-slate-500">
                                          AY {extPayload.academicYear || "2026-2027"}
                                        </p>
                                      </div>
                                    </div>

                                    {/* Requested Requirements */}
                                    {extPayload.requirementCodes && extPayload.requirementCodes.length > 0 && (
                                      <div className="pt-2 border-t border-amber-200/70 dark:border-amber-900/40">
                                        <span className="text-[10px] font-bold text-slate-500 block mb-1">
                                          Covered Requirements ({extPayload.requirementCodes.length}):
                                        </span>
                                        <div className="flex flex-wrap gap-1">
                                          {extPayload.requirementCodes.map((code) => {
                                            const label = REQUIREMENT_LABEL[code as RequirementCode] || code;
                                            return (
                                              <span
                                                key={code}
                                                className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-amber-200 dark:border-amber-900/50"
                                              >
                                                {label}
                                              </span>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <div className="space-y-1.5">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                                  Notification Details
                                </h4>
                                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 text-xs font-medium text-slate-800 dark:text-slate-100 leading-relaxed break-words shadow-2xs">
                                  {selectedNotification.message}
                                </div>
                              </div>
                            );
                          })()}

                          {/* Remarks / Feedback - Hidden if already shown in extension details */}
                          {(() => {
                            const extPayload = parseExtensionPayload(selectedNotification.message, metadata);
                            const isDuplicate = Boolean(
                              extPayload && (remarks === extPayload.reason || remarks === metadata.reason)
                            );

                            if (!remarks || isDuplicate) return null;

                            return (
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                    <span className="p-1 rounded-md bg-amber-500 text-amber-950 shadow-2xs">
                                      <AppIcon icon={Notes} size="xs" color="inherit" />
                                    </span>
                                    <span>Submission Remarks / Notes</span>
                                  </h4>
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500 text-amber-950 border border-amber-600 shadow-2xs">
                                    Faculty Note
                                  </span>
                                </div>
                                <div className="rounded-xl border-2 border-amber-500 bg-amber-50/50 dark:bg-amber-950/20 p-3 text-xs font-semibold italic text-slate-900 dark:text-slate-100 leading-relaxed break-words shadow-xs">
                                  &ldquo;{remarks}&rdquo;
                                </div>
                              </div>
                            );
                          })()}

                          {/* Attached File Preview / Download */}
                          {fileUrl && (
                            <div className="space-y-2">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                                <AppIcon icon={Page} size="xs" color="inherit" />
                                <span>Attached Document</span>
                              </h4>
                              <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900 p-3.5 shadow-2xs">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="p-2 rounded-lg bg-[#780000] text-white border border-[#5e0000] shrink-0 shadow-2xs">
                                    <AppIcon icon={Page} size="md" color="inherit" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                                      {fileName || "Submitted Document"}
                                    </p>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                      Click to view or download file
                                    </p>
                                  </div>
                                </div>
                                <a
                                  href={fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] transition-colors shadow-xs shrink-0 cursor-pointer"
                                >
                                  <span>Open File</span>
                                  <AppIcon icon={OpenNewWindow} size="xs" color="inherit" />
                                </a>
                              </div>
                            </div>
                          )}

                          {/* ACTION BUTTONS FOOTER */}
                          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
                            {/* Primary Target Action (Solid PUP Gold) */}
                            <button
                              type="button"
                              onClick={() => handleNavigateDirect(selectedNotification)}
                              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black bg-amber-500 hover:bg-amber-400 text-amber-950 border-2 border-amber-600 transition-all shadow-md active:scale-[0.99] cursor-pointer"
                            >
                              <span>
                                {selectedNotification.isSubmission || selectedNotification.requirementCode
                                  ? `Review ${selectedNotification.facultyName ? `${selectedNotification.facultyName}'s ` : ""}Submission in Dashboard`
                                  : "Open Target in Dashboard"}
                              </span>
                              <AppIcon icon={NavArrowRight} size="sm" color="inherit" />
                            </button>

                            {/* Secondary Actions: Clean White Mark Read / Solid PUP Maroon Back */}
                            <div className="flex items-center gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() =>
                                  handleToggleSingleRead(
                                    selectedNotification.id,
                                    selectedNotification.isRead
                                  )
                                }
                                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold bg-[#0b5336] hover:bg-[#08412a] text-white border-2 border-[#08412a] transition cursor-pointer shadow-xs active:scale-95"
                              >
                                <AppIcon icon={DoubleCheck} size="xs" color="inherit" />
                                <span>
                                  {selectedNotification.isRead
                                    ? "Mark as unread"
                                    : "Mark as read"}
                                </span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setSelectedNotification(null)}
                                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] transition cursor-pointer shadow-xs active:scale-95"
                              >
                                <AppIcon icon={NavArrowLeft} size="xs" color="inherit" />
                                <span>Back to list</span>
                              </button>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                ) : (
                  /* ================= LIST VIEW ================= */
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
                    {isLoading && notifications.length === 0 ? (
                      <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
                        <AppIcon icon={SystemRestart} size="lg" color="active" className="animate-spin" />
                        <span className="text-xs">Loading notifications...</span>
                      </div>
                    ) : filteredNotifications.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                        <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-900 mb-3 text-slate-400">
                          <AppIcon icon={Bell} size="lg" color="muted" />
                        </div>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                          {filterTab === "unread"
                            ? "No unread notifications"
                            : filterTab === "submissions"
                            ? "No submission notifications"
                            : "No notifications yet"}
                        </p>
                        <p className="text-xs text-slate-500 mt-1 max-w-[260px]">
                          {filterTab === "unread"
                            ? "You are all caught up on faculty submissions!"
                            : "When faculty upload requirements, alerts will appear here."}
                        </p>
                      </div>
                    ) : (
                      filteredNotifications.map((notif) => {
                        const isUnread = !notif.isRead;
                        const notifBadge = getAdminNotificationBadge(notif);
                        const isDbCapacityAlert =
                          notif.type === "DB_CAPACITY_ALERT" ||
                          notif.type?.includes("DB_CAPACITY") ||
                          notif.title?.toLowerCase().includes("database");
                        const reqLabel =
                          notif.requirementLabel ||
                          (notif.requirementCode ? REQUIREMENT_LABEL[notif.requirementCode] : null);

                        const extData = parseExtensionPayload(notif.message, notif.metadata);
                        const snippetText = extData?.reason
                          ? `Requested ${extData.preset || "+3 Days"} extension: "${extData.reason}"`
                          : notif.message.trim().startsWith("{")
                          ? "Faculty submitted an extension request for compliance requirements."
                          : notif.message;

                        return (
                          <article
                            key={notif.id}
                            onClick={() => void handleOpenDetail(notif)}
                            className={cn(
                              "group relative flex items-start gap-3.5 px-4 sm:px-5 py-4 transition-all duration-150 cursor-pointer text-left overflow-x-hidden",
                              isUnread
                                ? "bg-amber-500/[0.04] hover:bg-amber-500/[0.08] dark:bg-amber-500/[0.06] dark:hover:bg-amber-500/[0.12] border-l-4 border-l-amber-500"
                                : "bg-white hover:bg-slate-50/90 dark:bg-slate-950 dark:hover:bg-slate-900/60 border-l-4 border-l-transparent"
                            )}
                          >
                            {/* Icon Avatar */}
                            <div className={cn("mt-0.5 p-2 rounded-xl border shrink-0 flex items-center justify-center shadow-xs", notifBadge.colorClasses)}>
                              <AppIcon icon={notifBadge.Icon} size="md" color="inherit" />
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              {/* Subject line + Time + Unread indicator */}
                              <div className="flex items-start justify-between gap-3">
                                <h4
                                  className={cn(
                                    "text-sm tracking-tight text-slate-900 dark:text-slate-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors leading-snug break-words",
                                    isUnread ? "font-extrabold" : "font-semibold"
                                  )}
                                >
                                  {notif.title}
                                </h4>
                                <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                                  <span className="text-[11px] text-slate-400 dark:text-slate-500 whitespace-nowrap">
                                    {formatRelativeTime(notif.createdAt)}
                                  </span>
                                  {isUnread && (
                                    <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0 shadow-xs ring-1 ring-amber-400/50" title="Unread" />
                                  )}
                                </div>
                              </div>

                              {/* Requirement / Type Badges */}
                              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border shadow-2xs", notifBadge.badgeBg)}>
                                  {notifBadge.categoryLabel}
                                </span>

                                {reqLabel && (
                                  <span className="rounded-md border border-amber-600 bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-amber-950 shadow-2xs truncate max-w-[240px]">
                                    {reqLabel}
                                  </span>
                                )}
                              </div>

                              {/* Message Body */}
                              <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed break-words">
                                {snippetText}
                              </p>

                              {/* Footer / Actions */}
                              <div className="mt-3 flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-850">
                                <div className="flex items-center gap-1.5 min-w-0 text-slate-500 dark:text-slate-400">
                                  <AppIcon icon={isDbCapacityAlert ? Database : User} size="xs" color="muted" className="shrink-0" />
                                  <span className="text-xs font-medium truncate">
                                    {isDbCapacityAlert
                                      ? "Storage Monitor"
                                      : notif.facultyName
                                      ? notif.facultyName
                                      : "System Update"}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleNavigateDirect(notif);
                                    }}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-amber-950 border border-amber-600 shadow-xs transition-colors cursor-pointer active:scale-95"
                                  >
                                    <span>{isDbCapacityAlert ? "Storage" : "Review"}</span>
                                    <AppIcon icon={NavArrowRight} size="xs" color="inherit" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void handleToggleSingleRead(notif.id, notif.isRead);
                                    }}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer active:scale-95 bg-[#0b5336] hover:bg-[#08412a] text-white border border-[#08412a]"
                                    title={isUnread ? "Mark as read" : "Mark as unread"}
                                  >
                                    <AppIcon icon={DoubleCheck} size="xs" color="inherit" />
                                    <span>{isUnread ? "Read" : "Unread"}</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </article>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

