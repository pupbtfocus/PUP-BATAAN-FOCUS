"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Bell, CheckCircle, DoubleCheck, Hourglass, InfoCircle, Notes, OpenNewWindow, SystemRestart, Trash, WarningCircle, WarningTriangle, Xmark, XmarkCircle } from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";
import { REQUIREMENT_LABEL, type RequirementCode } from "@/config/compliance";
import type { AppNotification } from "@/features/notifications/services/notification.service";

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

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateString;
  }
}

function getNotificationTypeCategory(notification: AppNotification): {
  category: "APPROVED" | "REVISION_REQUESTED" | "REJECTED" | "DEADLINE_ALERT" | "INFO";
  Icon: typeof CheckCircle;
  colorClasses: string;
  badgeBg: string;
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
      Icon: Hourglass,
      colorClasses: "text-white bg-amber-600 border-amber-600 shadow-xs",
      badgeBg: "bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
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
      Icon: CheckCircle,
      colorClasses: "text-white bg-emerald-600 border-emerald-600 shadow-xs",
      badgeBg: "bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
    };
  }

  if (
    typeUpper.includes("REVISION") ||
    titleLower.includes("revision") ||
    messageLower.includes("revision")
  ) {
    return {
      category: "REVISION_REQUESTED",
      Icon: WarningTriangle,
      colorClasses: "text-slate-950 bg-amber-500 border-amber-600 shadow-xs",
      badgeBg: "bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
    };
  }

  if (
    typeUpper.includes("REJECT") ||
    titleLower.includes("rejected") ||
    messageLower.includes("rejected")
  ) {
    return {
      category: "REJECTED",
      Icon: XmarkCircle,
      colorClasses: "text-white bg-rose-600 border-rose-600 shadow-xs",
      badgeBg: "bg-rose-100 text-rose-900 border border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800",
    };
  }

  return {
    category: "INFO",
    Icon: InfoCircle,
    colorClasses: "text-white bg-slate-700 border-slate-700 shadow-xs",
    badgeBg: "bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  };
}

function extractRequirementCode(notification: AppNotification): RequirementCode | null {
  if (notification.metadata?.requirementCode) {
    return notification.metadata.requirementCode as RequirementCode;
  }
  if (notification.metadata?.requirement_code) {
    return notification.metadata.requirement_code as RequirementCode;
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

  if (
    message.startsWith("uploaded ") ||
    message.startsWith("resubmitted ")
  ) {
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

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await fetch("/api/faculty/notifications");
      if (!response.ok) return;

      const data = await response.json();
      if (data.notifications && Array.isArray(data.notifications)) {
        const cleanList = (data.notifications as AppNotification[]).filter(
          (n) => !isReviewerSubmissionAlert(n)
        );
        setNotifications(cleanList);
        setUnreadCount(
          cleanList.filter((n: AppNotification) => !n.isRead).length,
        );
      }
    } catch {
      // Ignore network errors on polling
    }
  }, []);

  useEffect(() => {
    void fetchNotifications();
    const interval = setInterval(() => {
      void fetchNotifications();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const handleOpenDrawer = () => {
    setIsOpen(true);
    void fetchNotifications();
  };

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0 || isMarkingAll) return;

    setIsMarkingAll(true);
    // Optimistic UI update
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);

    try {
      const response = await fetch("/api/faculty/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });

      if (!response.ok) {
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

    // Instant optimistic update
    setNotifications([]);
    setUnreadCount(0);

    try {
      const response = await fetch("/api/notifications/clear-all", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        setToastMessage("All notifications cleared");
        setTimeout(() => {
          setToastMessage(null);
        }, 3000);
      } else {
        // Fallback retry using generic /api/faculty/notifications DELETE
        const fallback = await fetch("/api/faculty/notifications", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
        });

        if (fallback.ok) {
          setToastMessage("All notifications cleared");
          setTimeout(() => {
            setToastMessage(null);
          }, 3000);
        } else {
          setNotifications(prevNotifications);
          setUnreadCount(prevUnread);
        }
      }
    } catch {
      setNotifications(prevNotifications);
      setUnreadCount(prevUnread);
    } finally {
      setIsClearingAll(false);
    }
  };

  const handleNotificationClick = async (notification: AppNotification) => {
    if (!notification.isRead) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n)),
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

    const requirementCode = extractRequirementCode(notification);
    setIsOpen(false);

    if (requirementCode) {
      const targetElementId = `requirement-${requirementCode}`;
      const element = document.getElementById(targetElementId);

      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        element.classList.add("ring-2", "ring-amber-400", "bg-amber-500/10");
        setTimeout(() => {
          element.classList.remove("ring-2", "ring-amber-400", "bg-amber-500/10");
        }, 3500);
      } else {
        router.push(`/faculty/dashboard?view=status&highlight=${requirementCode}&requirement=${requirementCode}#${targetElementId}`);
      }
    } else if (
      notification.type === "deadline_alert" ||
      (notification.type ?? "").toLowerCase().includes("deadline") ||
      (notification.title ?? "").toLowerCase().includes("deadline")
    ) {
      const targetElement =
        document.getElementById("requirements-section") ||
        document.getElementById("compliance-requirements");
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        router.push("/faculty/dashboard?view=status#requirements");
      }
    }
  };

  const [filterTab, setFilterTab] = useState<"all" | "unread">("all");

  const filteredNotifications = useMemo(() => {
    if (filterTab === "unread") {
      return notifications.filter((n) => !n.isRead);
    }
    return notifications;
  }, [notifications, filterTab]);

  const handleMarkSingleAsRead = async (notificationId: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n)),
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      await fetch("/api/faculty/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId }),
      });
    } catch {
      // Optimistic update retained
    }
  };

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      {/* Bell Icon Button */}
      <button
        type="button"
        onClick={handleOpenDrawer}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
        className="relative flex items-center justify-center p-2 rounded-xl text-amber-100 hover:text-white bg-[#7a0000]/70 hover:bg-[#8d0000] hover:border-amber-400/50 border border-amber-500/30 transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/40 cursor-pointer shadow-2xs"
      >
        <AppIcon icon={Bell} size="lg" color="inherit" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold text-white shadow-md ring-2 ring-[#480000] animate-pulse">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Portal Drawer Container */}
      {isOpen &&
        mounted &&
        createPortal(
          <div className="fixed inset-0 z-[100] overflow-hidden">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
              onClick={() => setIsOpen(false)}
              aria-hidden="true"
            />

            {/* Slide-out Sheet Panel */}
            <div className="fixed inset-y-0 right-0 z-[100] flex h-full w-full sm:max-w-md md:max-w-lg flex-col p-0 bg-white text-slate-900 border-l border-slate-200 dark:bg-slate-950 dark:text-slate-100 dark:border-slate-800 shadow-2xl animate-in slide-in-from-right duration-200">
              {/* Header Top Bar */}
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 sm:px-5 py-3.5 shrink-0">
                {/* Left: Icon, Title & Unread Pill */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-xl bg-amber-500 text-slate-950 border border-amber-600/50 shadow-xs shrink-0 flex items-center justify-center">
                    <AppIcon icon={Bell} size="lg" color="inherit" />
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                      Notifications
                    </h3>
                    {unreadCount > 0 && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300 whitespace-nowrap">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                        {unreadCount} unread
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: Close Button in PUP Maroon */}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg border border-[#5e0000] bg-[#780000] hover:bg-[#5e0000] text-white transition-colors shrink-0 cursor-pointer shadow-xs"
                  aria-label="Close notifications"
                >
                  <AppIcon icon={Xmark} size="md" color="inherit" />
                </button>
              </div>

              {/* Sub-Header / Inbox Actions Toolbar */}
              <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/70 text-xs shrink-0">
                {/* Filter Tabs (Inbox Style) */}
                <div className="flex items-center gap-1 bg-slate-200/70 dark:bg-slate-800 p-0.5 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setFilterTab("all")}
                    className={cn(
                      "px-2.5 py-1 rounded-md font-semibold text-xs transition cursor-pointer",
                      filterTab === "all"
                        ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                    )}
                  >
                    All ({notifications.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterTab("unread")}
                    className={cn(
                      "px-2.5 py-1 rounded-md font-semibold text-xs transition cursor-pointer",
                      filterTab === "unread"
                        ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                    )}
                  >
                    Unread ({unreadCount})
                  </button>
                </div>

                {/* Actions Toolbar: Mark all read in Solid Gold, Clear in Solid Maroon */}
                <div className="flex items-center gap-1.5 sm:gap-2">
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllAsRead}
                      disabled={isMarkingAll || isClearingAll}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-600/50 transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
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
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
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

              {/* Toast Feedback Notification Banner */}
              {toastMessage && (
                <div className="flex items-center justify-between gap-2 bg-emerald-500/15 border-b border-emerald-500/30 px-4 py-2.5 text-xs text-emerald-800 dark:text-emerald-200 animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="flex items-center gap-2">
                    <AppIcon icon={CheckCircle} size="md" color="success" />
                    <span className="font-medium">{toastMessage}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setToastMessage(null)}
                    className="p-1 rounded-md border border-[#5e0000] bg-[#780000] hover:bg-[#5e0000] text-white transition-colors cursor-pointer shadow-xs"
                    aria-label="Dismiss toast"
                  >
                    <AppIcon icon={Xmark} size="sm" color="inherit" />
                  </button>
                </div>
              )}

              {/* Inbox List Body */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/70 bg-white dark:bg-slate-950">
                {isLoading ? (
                  <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
                    <AppIcon icon={SystemRestart} size="lg" color="active" className="animate-spin" />
                    <span className="text-xs">Loading notifications...</span>
                  </div>
                ) : filteredNotifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                    <div className="p-3.5 rounded-full bg-slate-100 dark:bg-slate-900 mb-3 text-slate-400">
                      <AppIcon icon={Bell} size="lg" color="muted" />
                    </div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
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

                    const isUnread = !notification.isRead;

                    return (
                      <article
                        key={notification.id}
                        onClick={() => handleNotificationClick(notification)}
                        className={cn(
                          "group relative flex items-start gap-3.5 px-4 sm:px-5 py-4 transition-all duration-150 cursor-pointer text-left",
                          isUnread
                            ? "bg-amber-500/[0.04] hover:bg-amber-500/[0.08] dark:bg-amber-500/[0.06] dark:hover:bg-amber-500/[0.12] border-l-4 border-l-amber-500"
                            : "bg-white hover:bg-slate-50/90 dark:bg-slate-950 dark:hover:bg-slate-900/60 border-l-4 border-l-transparent"
                        )}
                      >
                        {/* Category Icon / Avatar */}
                        <div className={cn("mt-0.5 p-2 rounded-xl border shrink-0 flex items-center justify-center shadow-2xs", colorClasses)}>
                          <AppIcon icon={Icon} size="md" color="inherit" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          {/* Subject line + Time + Unread indicator */}
                          <div className="flex items-start justify-between gap-2">
                            <h4
                              className={cn(
                                "text-sm tracking-tight text-slate-900 dark:text-slate-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors leading-snug",
                                isUnread ? "font-bold" : "font-semibold"
                              )}
                            >
                              {notification.title}
                            </h4>
                            <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                              <span className="text-[11px] text-slate-400 dark:text-slate-500 whitespace-nowrap">
                                {formatRelativeTime(notification.createdAt)}
                              </span>
                              {isUnread && (
                                <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0 shadow-xs" title="Unread" />
                              )}
                            </div>
                          </div>

                          {/* Requirement or Deadline Badge */}
                          {(reqLabel || isDeadlineAlert) && (
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              {isDeadlineAlert && (
                                <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                                  <AppIcon icon={Hourglass} size="xs" color="inherit" />
                                  Deadline Alert
                                </span>
                              )}
                              {reqLabel && (
                                <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium border", badgeBg)}>
                                  {reqLabel}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Message Body */}
                          <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                            {notification.message}
                          </p>

                          {/* Reviewer Remarks Quote Bubble if present */}
                          {remarks && (
                            <div className="mt-2.5 rounded-lg border border-slate-200/90 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 p-2.5 text-xs text-slate-700 dark:text-slate-300 italic">
                              <span className="font-bold not-italic text-[#0b5336] dark:text-emerald-400 flex items-center gap-1 mb-0.5">
                                <AppIcon icon={Notes} size="xs" color="success" />
                                <span>{reviewerName ? `${reviewerName}: ` : "Reviewer Remarks: "}</span>
                              </span>
                              &ldquo;{remarks}&rdquo;
                            </div>
                          )}

                          {/* Item Footer: Solid Action Buttons */}
                          <div className="mt-3 flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-850">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-600/40 shadow-xs transition-colors">
                              <span>
                                {reqCode
                                  ? "View requirement"
                                  : isDeadlineAlert
                                  ? "View deadlines"
                                  : "View in dashboard"}
                              </span>
                              <AppIcon icon={OpenNewWindow} size="xs" color="inherit" />
                            </span>

                            {isUnread && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleMarkSingleAsRead(notification.id);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-2xs transition-colors cursor-pointer"
                                title="Mark this notification as read"
                              >
                                <AppIcon icon={DoubleCheck} size="xs" color="inherit" />
                                <span>Mark read</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
