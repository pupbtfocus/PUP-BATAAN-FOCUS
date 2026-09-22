"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Bell,
  CheckCircle,
  DoubleCheck,
  Hourglass,
  InfoCircle,
  NavArrowRight,
  Page,
  Refresh,
  SystemRestart,
  Trash,
  Upload,
  WarningTriangle,
  Xmark,
  XmarkCircle,
} from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";
import { REQUIREMENT_LABEL, type RequirementCode } from "@/config/compliance";
import { cn } from "@/utils/cn";

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

export function AdminNotificationDrawer({
  onNavigateToTarget,
}: AdminNotificationDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<"all" | "submissions" | "unread">("all");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/notifications?_t=${Date.now()}`, {
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
    }
  }, []);

  useEffect(() => {
    void fetchNotifications();
    const interval = setInterval(() => {
      void fetchNotifications();
    }, 20000);

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
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);

    try {
      await fetch("/api/admin/notifications", {
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

    try {
      const res = await fetch("/api/admin/notifications", {
        method: "DELETE",
      });
      if (res.ok) {
        setToastMessage("Notifications cleared");
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

  const handleItemClick = async (notification: AdminNotificationItem) => {
    if (!notification.isRead) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      try {
        await fetch("/api/admin/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notificationId: notification.id }),
        });
      } catch {
        // Optimistic update retained
      }
    }

    setIsOpen(false);
    onNavigateToTarget?.(notification);
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
    [notifications],
  );

  return (
    <>
      {/* Header Trigger Button */}
      <button
        type="button"
        onClick={handleOpenDrawer}
        aria-label={`Admin Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
        className="relative flex items-center justify-center p-2 rounded-xl text-amber-100 hover:text-white bg-[#7a0000]/70 hover:bg-[#8d0000] hover:border-amber-400/50 border border-amber-500/30 transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/40 cursor-pointer shadow-2xs"
      >
        <AppIcon icon={Bell} size="lg" color="inherit" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold text-white shadow-md ring-2 ring-[#480000] animate-pulse">
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
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
              onClick={() => setIsOpen(false)}
              aria-hidden="true"
            />

            {/* Sheet Drawer */}
            <div className="fixed inset-y-0 right-0 z-[100] flex h-full w-full sm:max-w-md md:max-w-lg flex-col bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 shadow-2xl animate-in slide-in-from-right duration-250">
              {/* Header Top Bar */}
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 sm:px-5 py-3.5 shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <AppIcon icon={Bell} size="lg" className="text-amber-500 shrink-0" />
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                        Notifications
                      </h3>
                      {unreadCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300 whitespace-nowrap">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                          {unreadCount} unread
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Faculty submissions &amp; compliance updates
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2">
                  <button
                    type="button"
                    onClick={() => void fetchNotifications()}
                    disabled={isLoading}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
                    title="Refresh notifications"
                    aria-label="Refresh notifications"
                  >
                    <Refresh className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
                    aria-label="Close notifications"
                  >
                    <AppIcon icon={Xmark} size="md" color="inherit" />
                  </button>
                </div>
              </div>

              {/* Sub-Header / Inbox Actions Toolbar */}
              <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/70 text-xs shrink-0">
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
                    onClick={() => setFilterTab("submissions")}
                    className={cn(
                      "px-2.5 py-1 rounded-md font-semibold text-xs transition cursor-pointer",
                      filterTab === "submissions"
                        ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                    )}
                  >
                    Submissions ({submissionCount})
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

              {/* Toast Feedback */}
              {toastMessage && (
                <div className="flex items-center justify-between gap-2 bg-emerald-500/10 border-b border-emerald-500/20 px-4 py-2 text-xs text-emerald-700 dark:text-emerald-300 animate-in fade-in">
                  <div className="flex items-center gap-1.5">
                    <AppIcon icon={CheckCircle} size="sm" color="success" />
                    <span>{toastMessage}</span>
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

              {/* Notification Items List (Inbox Style) */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/70 bg-white dark:bg-slate-950">
                {isLoading && notifications.length === 0 ? (
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
                    const reqLabel =
                      notif.requirementLabel ||
                      (notif.requirementCode ? REQUIREMENT_LABEL[notif.requirementCode] : null);

                    return (
                      <article
                        key={notif.id}
                        onClick={() => void handleItemClick(notif)}
                        className={cn(
                          "group relative flex items-start gap-3.5 px-4 sm:px-5 py-4 transition-all duration-150 cursor-pointer text-left",
                          isUnread
                            ? "bg-amber-500/[0.04] hover:bg-amber-500/[0.08] dark:bg-amber-500/[0.06] dark:hover:bg-amber-500/[0.12] border-l-4 border-l-amber-500"
                            : "bg-white hover:bg-slate-50/90 dark:bg-slate-950 dark:hover:bg-slate-900/60 border-l-4 border-l-transparent"
                        )}
                      >
                        {/* Icon Avatar */}
                        <div
                          className={cn(
                            "mt-0.5 p-2 rounded-xl border shrink-0 flex items-center justify-center shadow-2xs",
                            notif.isExtensionRequest || notif.type === "EXTENSION_REQUEST"
                              ? "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-800"
                              : notif.isRevision
                              ? "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-800"
                              : notif.isSubmission
                              ? "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-400 dark:border-blue-800"
                              : notif.type === "SUBMISSION_APPROVED"
                              ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800"
                              : "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                          )}
                        >
                          <AppIcon
                            icon={
                              notif.isExtensionRequest || notif.type === "EXTENSION_REQUEST"
                                ? Hourglass
                                : notif.isRevision
                                ? WarningTriangle
                                : notif.isSubmission
                                ? Upload
                                : notif.type === "SUBMISSION_APPROVED"
                                ? CheckCircle
                                : InfoCircle
                            }
                            size="md"
                            color="inherit"
                          />
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
                              {notif.title}
                            </h4>
                            <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                              <span className="text-[11px] text-slate-400 dark:text-slate-500 whitespace-nowrap">
                                {formatRelativeTime(notif.createdAt)}
                              </span>
                              {isUnread && (
                                <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0 shadow-xs" title="Unread" />
                              )}
                            </div>
                          </div>

                          {/* Requirement / Type Badges */}
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            {notif.isExtensionRequest || notif.type === "EXTENSION_REQUEST" ? (
                              <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                                <AppIcon icon={Hourglass} size="xs" color="inherit" />
                                Extension Request
                              </span>
                            ) : notif.isRevision ? (
                              <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                                <AppIcon icon={WarningTriangle} size="xs" color="inherit" />
                                Resubmission
                              </span>
                            ) : notif.isSubmission ? (
                              <span className="inline-flex items-center gap-1 rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-400">
                                <AppIcon icon={Upload} size="xs" color="inherit" />
                                New Submission
                              </span>
                            ) : notif.type === "SUBMISSION_APPROVED" ? (
                              <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                <AppIcon icon={CheckCircle} size="xs" color="inherit" />
                                Validated
                              </span>
                            ) : null}

                            {reqLabel && (
                              <span className="rounded-md border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/70 px-2 py-0.5 text-[10px] font-medium text-slate-700 dark:text-slate-300 truncate max-w-[200px]">
                                {reqLabel}
                              </span>
                            )}
                          </div>

                          {/* Message Body */}
                          <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                            {notif.message}
                          </p>

                          {/* Footer / Actions */}
                          <div className="mt-3 flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                            <span className="text-[11px] text-slate-400 dark:text-slate-500">
                              {notif.facultyName ? `Faculty: ${notif.facultyName}` : "Click to view changes"}
                            </span>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-600/40 shadow-xs transition-colors">
                              <span>Review submission</span>
                              <AppIcon icon={NavArrowRight} size="xs" color="inherit" />
                            </span>
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
