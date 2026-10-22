"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Bell,
  Check,
  CheckCircle,
  DoubleCheck,
  Download,
  Eye,
  Hourglass,
  InfoCircle,
  NavArrowLeft,
  NavArrowRight,
  Notes,
  OpenNewWindow,
  Page,
  SystemRestart,
  Trash,
  WarningCircle,
  WarningTriangle,
  Xmark,
  XmarkCircle,
} from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";
import { cn } from "@/utils/cn";
import { REQUIREMENT_CODE, REQUIREMENT_LABEL, type RequirementCode } from "@/config/compliance";
import type { AppNotification } from "@/features/notifications/services/notification.service";
import { useRealtimeSync } from "@/lib/realtime";

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

function getNotificationTypeCategory(notification: AppNotification): {
  category: "APPROVED" | "REVISION_REQUESTED" | "REJECTED" | "DEADLINE_ALERT" | "INFO";
  label: string;
  Icon: typeof CheckCircle;
  colorClasses: string;
  badgeBg: string;
  bannerBg: string;
  heroIconClasses: string;
  heroBadgeBg: string;
  glowColor: string;
} {
  const typeUpper = (notification.type ?? "").toUpperCase();
  const titleLower = (notification.title ?? "").toLowerCase();
  const messageLower = (notification.message ?? "").toLowerCase();

  if (
    typeUpper.includes("DEADLINE") ||
    typeUpper === "DEADLINE_ALERT" ||
    titleLower.includes("deadline") ||
    messageLower.includes("deadline")
  ) {
    return {
      category: "DEADLINE_ALERT",
      label: "Deadline Alert",
      Icon: Hourglass,
      colorClasses: "bg-amber-500 text-amber-950 border border-amber-600 shadow-xs",
      badgeBg: "bg-amber-500 text-amber-950 border border-amber-600 font-bold shadow-2xs",
      bannerBg: "bg-amber-500 text-amber-950 border border-amber-600",
      heroIconClasses: "bg-white text-amber-900 shadow-sm border border-amber-600/30",
      heroBadgeBg: "bg-white text-amber-900 font-bold shadow-2xs border border-amber-600/30",
      glowColor: "ring-amber-500/30",
    };
  }

  if (
    typeUpper.includes("APPROV") ||
    typeUpper.includes("VALIDAT") ||
    titleLower.includes("approved") ||
    titleLower.includes("validated")
  ) {
    return {
      category: "APPROVED",
      label: "Submission Approved",
      Icon: CheckCircle,
      colorClasses: "bg-[#0b5336] text-white border border-[#08412a] shadow-xs",
      badgeBg: "bg-[#0b5336] text-white border border-[#08412a] font-bold shadow-2xs",
      bannerBg: "bg-[#0b5336] text-white border border-[#08412a]",
      heroIconClasses: "bg-white text-[#0b5336] shadow-sm",
      heroBadgeBg: "bg-white text-[#0b5336] font-black shadow-2xs",
      glowColor: "ring-emerald-500/30",
    };
  }

  if (
    typeUpper.includes("REVISION") ||
    titleLower.includes("revision") ||
    messageLower.includes("revision")
  ) {
    return {
      category: "REVISION_REQUESTED",
      label: "Revision Requested",
      Icon: WarningTriangle,
      colorClasses: "bg-[#780000] text-white border border-[#5e0000] shadow-xs",
      badgeBg: "bg-[#780000] text-white border border-[#5e0000] font-bold shadow-2xs",
      bannerBg: "bg-[#780000] text-white border border-[#5e0000]",
      heroIconClasses: "bg-white text-[#780000] shadow-sm",
      heroBadgeBg: "bg-white text-[#780000] font-black shadow-2xs",
      glowColor: "ring-amber-500/30",
    };
  }

  if (
    typeUpper.includes("REJECT") ||
    titleLower.includes("rejected") ||
    messageLower.includes("rejected")
  ) {
    return {
      category: "REJECTED",
      label: "Submission Rejected",
      Icon: XmarkCircle,
      colorClasses: "bg-[#990000] text-white border border-[#780000] shadow-xs",
      badgeBg: "bg-[#990000] text-white border border-[#780000] font-bold shadow-2xs",
      bannerBg: "bg-[#990000] text-white border border-[#780000]",
      heroIconClasses: "bg-white text-[#990000] shadow-sm",
      heroBadgeBg: "bg-white text-[#990000] font-black shadow-2xs",
      glowColor: "ring-rose-500/30",
    };
  }

  return {
    category: "INFO",
    label: "System Notice",
    Icon: InfoCircle,
    colorClasses: "bg-slate-700 text-white border border-slate-600 shadow-xs",
    badgeBg: "bg-slate-700 text-white border border-slate-600 font-bold shadow-2xs",
    bannerBg: "bg-slate-800 text-white border border-slate-700",
    heroIconClasses: "bg-white/20 text-white shadow-sm border border-white/30",
    heroBadgeBg: "bg-white/25 text-white font-black shadow-2xs",
    glowColor: "ring-slate-500/30",
  };
}

function getNotificationFileInfo(notification: AppNotification): {
  submissionId: string | null;
  fileUrl: string | null;
  fileName: string | null;
} {
  const metadata = notification.metadata || {};
  const submissionId =
    metadata.submissionId ||
    metadata.submission_id ||
    metadata.submission?.id ||
    (notification.type?.toLowerCase().includes("submission") ? metadata.id : null) ||
    null;

  let fileUrl: string | null = null;
  if (submissionId) {
    fileUrl = `/api/faculty/submissions/view?submissionId=${encodeURIComponent(submissionId)}`;
  } else if (metadata.fileUrl || metadata.file_url) {
    fileUrl = metadata.fileUrl || metadata.file_url;
  } else if (metadata.storagePath || metadata.storage_path) {
    fileUrl = `/api/storage/download?path=${encodeURIComponent(metadata.storagePath || metadata.storage_path)}`;
  }

  const fileName =
    metadata.fileName ||
    metadata.file_name ||
    metadata.originalName ||
    metadata.original_name ||
    (fileUrl ? fileUrl.split("/").pop()?.split("?")[0] : null) ||
    null;

  return {
    submissionId: submissionId ? String(submissionId) : null,
    fileUrl,
    fileName,
  };
}

function extractRequirementCode(notification: AppNotification): RequirementCode | null {
  const metadata = notification.metadata || {};
  const candidate = metadata.requirementCode || metadata.requirement_code;
  if (candidate && Object.values(REQUIREMENT_CODE).includes(candidate as RequirementCode)) {
    return candidate as RequirementCode;
  }

  const textToScan = `${notification.title} ${notification.message}`.toLowerCase();
  for (const [code, label] of Object.entries(REQUIREMENT_LABEL)) {
    if (
      textToScan.includes(code.toLowerCase()) ||
      textToScan.includes(label.toLowerCase())
    ) {
      return code as RequirementCode;
    }
  }

  if (textToScan.includes("syllabus") || textToScan.includes("course guide")) {
    return REQUIREMENT_CODE.ENHANCED_SYLLABUS;
  }
  if (textToScan.includes("grade") || textToScan.includes("gradesheet") || textToScan.includes("sheet")) {
    return REQUIREMENT_CODE.GRADE_SHEET;
  }
  if (textToScan.includes("orientation")) {
    return REQUIREMENT_CODE.CLASS_ORIENTATION;
  }
  if (textToScan.includes("midterm")) {
    return REQUIREMENT_CODE.MIDTERM_PACKAGE;
  }
  if (textToScan.includes("final") || textToScan.includes("finals")) {
    return REQUIREMENT_CODE.FINAL_PACKAGE;
  }
  if (textToScan.includes("class record") || textToScan.includes("record")) {
    return REQUIREMENT_CODE.CLASS_RECORDS;
  }

  return null;
}

function isReviewerSubmissionAlert(notif: AppNotification): boolean {
  const type = (notif.type ?? "").toUpperCase().trim();
  const title = (notif.title ?? "").toLowerCase().trim();
  const message = (notif.message ?? "").toLowerCase().trim();
  const recipientRole = String(notif.metadata?.recipient_role ?? "").toLowerCase();

  if (recipientRole === "admin" || recipientRole === "super_admin") {
    return true;
  }

  if (
    type === "NEW_SUBMISSION" ||
    type === "SUBMISSION_CREATED" ||
    type === "FACULTY_SUBMITTED" ||
    type === "SUBMISSION_UPLOADED" ||
    type === "SUBMISSION_RESUBMITTED" ||
    type === "NEW_SUBMISSION_ALERT"
  ) {
    return true;
  }

  if (
    title.includes("submission from") ||
    title.includes("resubmission from") ||
    title.startsWith("new submission") ||
    title.startsWith("resubmission")
  ) {
    return true;
  }

  if (message.startsWith("uploaded ") || message.startsWith("resubmitted ")) {
    return true;
  }

  return false;
}

export function NotificationDrawer() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<"all" | "unread">("all");
  const [selectedNotification, setSelectedNotification] = useState<AppNotification | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent background page body scrolling when drawer is open
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
      const response = await fetch(`/api/faculty/notifications?_t=${Date.now()}`, {
        cache: "no-store",
      });
      if (!response.ok) return;

      const data = await response.json();
      if (data.notifications && Array.isArray(data.notifications)) {
        const cleanList = (data.notifications as AppNotification[]).filter(
          (n) => !isReviewerSubmissionAlert(n)
        );
        setNotifications(cleanList);
        setUnreadCount(cleanList.filter((n: AppNotification) => !n.isRead).length);
      }
    } catch {
      // Ignore network errors on polling
    }
  }, []);

  useEffect(() => {
    void fetchNotifications();
    const interval = setInterval(() => {
      void fetchNotifications();
    }, 25000);

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
      const response = await fetch("/api/faculty/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });

      if (response.ok) {
        setToastMessage("All notifications marked as read");
        setTimeout(() => setToastMessage(null), 3000);
      } else {
        await fetchNotifications();
      }
    } catch {
      await fetchNotifications();
    } finally {
      setIsMarkingAll(false);
    }
  };

  const handleClearAll = async () => {
    if (notifications.length === 0 || isClearingAll) return;

    setIsClearingAll(true);
    const prevNotifications = [...notifications];
    const prevUnread = unreadCount;

    setNotifications([]);
    setUnreadCount(0);
    setSelectedNotification(null);

    try {
      const response = await fetch("/api/faculty/notifications", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        setToastMessage("All notifications cleared");
        setTimeout(() => setToastMessage(null), 3000);
      } else {
        setNotifications(prevNotifications);
        setUnreadCount(prevUnread);
      }
    } catch {
      setNotifications(prevNotifications);
      setUnreadCount(prevUnread);
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
      await fetch("/api/faculty/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId, isRead: nextState }),
      });
    } catch {
      // Optimistic update retained
    }
  };

  // Open notification detail view inside drawer
  const handleOpenNotificationDetail = async (notification: AppNotification) => {
    setSelectedNotification(notification);

    if (!notification.isRead) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      try {
        await fetch("/api/faculty/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notificationId: notification.id }),
        });
      } catch {
        // Optimistic update retained
      }
    }
  };

  // Direct navigation to requirement/target in the system with full back-button support
  const handleNavigateToTarget = (notification: AppNotification) => {
    const reqCode = extractRequirementCode(notification);
    const targetElementId = reqCode ? `requirement-${reqCode}` : null;
    setIsOpen(false);
    setSelectedNotification(null);

    if (reqCode) {
      try {
        const url = new URL(window.location.href);
        url.pathname = "/faculty/dashboard";
        url.searchParams.set("view", "status");
        url.searchParams.set("highlight", reqCode);
        if (targetElementId) url.hash = targetElementId;
        window.history.pushState({ fromNotification: true, reqCode }, "", url.toString());
      } catch {
        // fallback
      }

      window.dispatchEvent(
        new CustomEvent("pup-focus-select-view", {
          detail: { view: "status", highlight: reqCode },
        })
      );

      setTimeout(() => {
        const element = targetElementId ? document.getElementById(targetElementId) : null;
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
          element.classList.add("ring-4", "ring-amber-400", "bg-amber-500/15", "transition-all", "duration-500");
          setTimeout(() => {
            element.classList.remove("ring-4", "ring-amber-400", "bg-amber-500/15", "transition-all", "duration-500");
          }, 4000);
        } else {
          router.push(`/faculty/dashboard?view=status&highlight=${reqCode}#${targetElementId}`);
        }
      }, 300);
    } else if (
      notification.type === "deadline_alert" ||
      (notification.type ?? "").toLowerCase().includes("deadline") ||
      (notification.title ?? "").toLowerCase().includes("deadline")
    ) {
      try {
        const url = new URL(window.location.href);
        url.pathname = "/faculty/dashboard";
        url.searchParams.set("view", "status");
        window.history.pushState({ fromNotification: true }, "", url.toString());
      } catch {
        // fallback
      }

      window.dispatchEvent(
        new CustomEvent("pup-focus-select-view", {
          detail: { view: "status" },
        })
      );

      const targetElement =
        document.getElementById("requirements-section") ||
        document.getElementById("compliance-requirements");
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        router.push("/faculty/dashboard?view=status#requirements");
      }
    } else {
      try {
        const url = new URL(window.location.href);
        url.pathname = "/faculty/dashboard";
        url.searchParams.set("view", "status");
        window.history.pushState({ fromNotification: true }, "", url.toString());
      } catch {
        // fallback
      }

      router.push("/faculty/dashboard?view=status");
      window.dispatchEvent(
        new CustomEvent("pup-focus-select-view", {
          detail: { view: "status" },
        })
      );
    }
  };

  const filteredNotifications = useMemo(() => {
    if (filterTab === "unread") {
      return notifications.filter((n) => !n.isRead);
    }
    return notifications;
  }, [notifications, filterTab]);

  return (
    <>
      {/* Bell Icon Header Trigger */}
      <button
        type="button"
        onClick={handleOpenDrawer}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
        className="relative flex items-center justify-center shrink-0 p-1.5 sm:p-2 rounded-xl text-amber-950 bg-amber-500 hover:bg-amber-400 border border-amber-600/50 transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/40 cursor-pointer shadow-xs hover:shadow-sm active:scale-95"
      >
        <AppIcon icon={Bell} size="lg" color="inherit" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold text-white shadow-md ring-2 ring-white dark:ring-slate-900 animate-pulse">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Slide-out Portal Drawer */}
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

            {/* Slide-out Sheet Panel */}
            <div className="fixed inset-y-0 right-0 z-[100] flex h-full w-full sm:max-w-md md:max-w-lg flex-col p-0 bg-white text-slate-900 border-l border-slate-200 dark:bg-slate-950 dark:text-slate-100 dark:border-slate-800 shadow-2xl animate-in slide-in-from-right duration-250 overflow-x-hidden">
              
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
                  /* List Mode Header: Bell + Title + Unread Badge + Close */
                  <>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                        <AppIcon icon={Bell} size="md" color="inherit" />
                      </div>
                      <div className="flex items-center gap-2 min-w-0">
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
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      className="p-1.5 rounded-lg border border-[#5e0000] bg-[#780000] hover:bg-[#5e0000] text-white transition-colors shrink-0 cursor-pointer shadow-xs active:scale-95"
                      aria-label="Close notification drawer"
                    >
                      <AppIcon icon={Xmark} size="md" color="inherit" />
                    </button>
                  </>
                )}
              </div>

              {/* LIST MODE: TOOLBAR */}
              {!selectedNotification && (
                <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/70 text-xs shrink-0 overflow-x-hidden">
                  {/* Filter Tabs */}
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

                  {/* Bulk Actions */}
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

              {/* Toast Banner Feedback */}
              {toastMessage && (
                <div className="flex items-center justify-between gap-2 bg-[#0b5336] border-b border-[#08412a] px-4 py-2.5 text-xs text-white animate-in fade-in slide-in-from-top-1 duration-150 shrink-0 shadow-xs">
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
                        category,
                        label,
                        Icon,
                        bannerBg,
                        heroIconClasses,
                        heroBadgeBg,
                      } = getNotificationTypeCategory(selectedNotification);
                      const reqCode = extractRequirementCode(selectedNotification);
                      const reqLabel = reqCode ? REQUIREMENT_LABEL[reqCode] : null;
                      const fileInfo = getNotificationFileInfo(selectedNotification);
                      const reviewerName =
                        selectedNotification.metadata?.reviewerName ??
                        selectedNotification.metadata?.reviewer_name;
                      const remarks =
                        selectedNotification.metadata?.reviewerRemarks ??
                        selectedNotification.metadata?.reviewer_remarks ??
                        selectedNotification.metadata?.rejectionReason ??
                        selectedNotification.metadata?.rejection_reason ??
                        (selectedNotification.message.includes("Remarks:")
                          ? selectedNotification.message.split("Remarks:")[1]?.trim()
                          : null);
                      const cleanMessage =
                        remarks && selectedNotification.message.includes("Remarks:")
                          ? selectedNotification.message.split("Remarks:")[0].trim().replace(/\.$/, "") + "."
                          : selectedNotification.message;

                      const isApproved = category === "APPROVED";
                      const isRevision = category === "REVISION_REQUESTED" || category === "REJECTED";

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
                                  {label}
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

                          {/* Message Body */}
                          <div className="space-y-2">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                              Notification Details
                            </h4>
                            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-sm font-medium text-slate-800 dark:text-slate-100 leading-relaxed break-words shadow-2xs">
                              {cleanMessage}
                            </div>
                          </div>

                          {/* Reviewer Feedback / Remarks */}
                          {remarks && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                  <span className={cn(
                                    "p-1 rounded-md text-white shadow-2xs",
                                    isApproved ? "bg-[#0b5336]" : isRevision ? "bg-[#780000]" : "bg-amber-500 text-slate-950"
                                  )}>
                                    <AppIcon icon={Notes} size="xs" color="inherit" />
                                  </span>
                                  <span>{reviewerName ? `${reviewerName}'s Feedback` : "Reviewer Remarks"}</span>
                                </h4>
                                <span className={cn(
                                  "inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold text-white shadow-2xs",
                                  isApproved ? "bg-[#0b5336] border border-[#08412a]" : isRevision ? "bg-[#780000] border border-[#5e0000]" : "bg-amber-500 text-amber-950 border border-amber-600"
                                )}>
                                  Official Remarks
                                </span>
                              </div>
                              <div className={cn(
                                "rounded-xl border-2 p-4 text-sm font-semibold italic leading-relaxed break-words shadow-xs",
                                isApproved
                                  ? "border-[#0b5336] bg-emerald-50/50 dark:bg-[#0b5336]/15 text-slate-900 dark:text-slate-100"
                                  : isRevision
                                  ? "border-[#780000] bg-rose-50/50 dark:bg-[#780000]/15 text-slate-900 dark:text-slate-100"
                                  : "border-amber-600 bg-amber-50/50 dark:bg-amber-950/20 text-slate-900 dark:text-slate-100"
                              )}>
                                &ldquo;{remarks}&rdquo;
                              </div>
                            </div>
                          )}

                          {/* Attached File Preview / Download */}
                          {fileInfo.fileUrl && (
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
                                      {fileInfo.fileName || "Submitted Document"}
                                    </p>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                      Click to view or download file
                                    </p>
                                  </div>
                                </div>
                                <a
                                  href={fileInfo.fileUrl}
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
                            {/* Primary Action Button (Solid PUP Gold) */}
                            <button
                              type="button"
                              onClick={() => handleNavigateToTarget(selectedNotification)}
                              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black bg-amber-500 hover:bg-amber-400 text-amber-950 border-2 border-amber-600 transition-all shadow-md active:scale-[0.99] cursor-pointer"
                            >
                              <span>
                                {reqCode
                                  ? `Go to "${reqLabel || reqCode}" in Dashboard`
                                  : "View Requirement in Dashboard"}
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
                    {isLoading ? (
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
                          {filterTab === "unread" ? "No unread notifications" : "No notifications yet"}
                        </p>
                        <p className="text-xs text-slate-500 mt-1 max-w-[260px]">
                          {filterTab === "unread"
                            ? "You're all caught up! There are no unread notifications."
                            : "Updates on your document review status will appear here."}
                        </p>
                      </div>
                    ) : (
                      filteredNotifications.map((notification) => {
                        const { category, Icon, colorClasses, badgeBg } =
                          getNotificationTypeCategory(notification);
                        const reqCode = extractRequirementCode(notification);
                        const reqLabel = reqCode ? REQUIREMENT_LABEL[reqCode] : null;
                        const isDeadlineAlert =
                          category === "DEADLINE_ALERT" ||
                          notification.type === "deadline_alert";

                        const reviewerName =
                          notification.metadata?.reviewerName ??
                          notification.metadata?.reviewer_name;
                        const remarks =
                          notification.metadata?.reviewerRemarks ??
                          notification.metadata?.reviewer_remarks ??
                          notification.metadata?.rejectionReason ??
                          notification.metadata?.rejection_reason ??
                          (notification.message.includes("Remarks:")
                            ? notification.message.split("Remarks:")[1]?.trim()
                            : null);

                        const displayMessage =
                          remarks && notification.message.includes("Remarks:")
                            ? notification.message.split("Remarks:")[0].trim().replace(/\.$/, "") + "."
                            : notification.message;

                        const isUnread = !notification.isRead;

                        return (
                          <article
                            key={notification.id}
                            onClick={() => void handleOpenNotificationDetail(notification)}
                            className={cn(
                              "group relative flex items-start gap-3.5 px-4 sm:px-5 py-4 transition-all duration-150 cursor-pointer text-left overflow-x-hidden",
                              isUnread
                                ? "bg-amber-500/[0.04] hover:bg-amber-500/[0.08] dark:bg-amber-500/[0.06] dark:hover:bg-amber-500/[0.12] border-l-4 border-l-amber-500"
                                : "bg-white hover:bg-slate-50/90 dark:bg-slate-950 dark:hover:bg-slate-900/60 border-l-4 border-l-transparent"
                            )}
                          >
                            {/* Icon Avatar */}
                            <div className={cn("mt-0.5 p-2 rounded-xl border shrink-0 flex items-center justify-center shadow-xs", colorClasses)}>
                              <AppIcon icon={Icon} size="md" color="inherit" />
                            </div>

                            {/* Card Content */}
                            <div className="flex-1 min-w-0">
                              {/* Title + Time + Unread indicator */}
                              <div className="flex items-start justify-between gap-2">
                                <h4
                                  className={cn(
                                    "text-sm tracking-tight text-slate-900 dark:text-slate-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors leading-snug break-words",
                                    isUnread ? "font-extrabold" : "font-semibold"
                                  )}
                                >
                                  {notification.title}
                                </h4>
                                <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                                  <span className="text-[11px] text-slate-400 dark:text-slate-500 whitespace-nowrap">
                                    {formatRelativeTime(notification.createdAt)}
                                  </span>
                                  {isUnread && (
                                    <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0 shadow-xs ring-1 ring-amber-400/50" title="Unread" />
                                  )}
                                </div>
                              </div>

                              {/* Requirement / Deadline Badge */}
                              {(reqLabel || isDeadlineAlert) && (
                                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                  {isDeadlineAlert && (
                                    <span className="inline-flex items-center gap-1 rounded-md border border-amber-600 bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-amber-950 shadow-2xs">
                                      <AppIcon icon={Hourglass} size="xs" color="inherit" />
                                      Deadline Alert
                                    </span>
                                  )}
                                  {reqLabel && (
                                    <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold border shadow-2xs", badgeBg)}>
                                      {reqLabel}
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* Message snippet */}
                              <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2 break-words">
                                {displayMessage}
                              </p>

                              {/* Reviewer Remarks Quote Bubble if present */}
                              {remarks && (
                                <div className={cn(
                                  "mt-2 rounded-xl border-l-4 border-y border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 p-3 text-xs shadow-2xs",
                                  category === "APPROVED" ? "border-l-[#0b5336]" : category === "REVISION_REQUESTED" || category === "REJECTED" ? "border-l-[#780000]" : "border-l-amber-500"
                                )}>
                                  <div className={cn(
                                    "font-bold not-italic flex items-center gap-1.5 mb-1 text-xs",
                                    category === "APPROVED" ? "text-[#0b5336] dark:text-emerald-400" : category === "REVISION_REQUESTED" || category === "REJECTED" ? "text-[#780000] dark:text-rose-400" : "text-amber-700 dark:text-amber-400"
                                  )}>
                                    <span className={cn(
                                      "p-0.5 rounded text-white text-[10px]",
                                      category === "APPROVED" ? "bg-[#0b5336]" : category === "REVISION_REQUESTED" || category === "REJECTED" ? "bg-[#780000]" : "bg-amber-500 text-amber-950"
                                    )}>
                                      <AppIcon icon={Notes} size="xs" color="inherit" />
                                    </span>
                                    <span>{reviewerName ? `${reviewerName}:` : "Reviewer Remarks:"}</span>
                                  </div>
                                  <p className="font-semibold italic text-slate-800 dark:text-slate-200 line-clamp-2">
                                    &ldquo;{remarks}&rdquo;
                                  </p>
                                </div>
                              )}

                              {/* Item Footer Action Buttons */}
                              <div className="mt-3 flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-850">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleNavigateToTarget(notification);
                                  }}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-amber-950 border border-amber-600 shadow-xs transition-colors cursor-pointer active:scale-95"
                                  title="View requirement in dashboard"
                                >
                                  <span>View requirement</span>
                                  <AppIcon icon={NavArrowRight} size="xs" color="inherit" />
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void handleToggleSingleRead(notification.id, notification.isRead);
                                  }}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer active:scale-95 bg-[#0b5336] hover:bg-[#08412a] text-white border border-[#08412a]"
                                  title={isUnread ? "Mark as read" : "Mark as unread"}
                                >
                                  <AppIcon icon={DoubleCheck} size="xs" color="inherit" />
                                  <span>{isUnread ? "Mark read" : "Mark unread"}</span>
                                </button>
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

