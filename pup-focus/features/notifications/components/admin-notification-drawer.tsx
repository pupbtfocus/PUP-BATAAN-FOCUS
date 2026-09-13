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
        className="relative flex items-center justify-center p-2 rounded-xl text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-800 shadow-2xs transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/40 cursor-pointer"
      >
        <AppIcon icon={Bell} size="lg" color="inherit" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-slate-950 shadow-sm ring-2 ring-white dark:ring-slate-950 animate-pulse">
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
              {/* Header Bar */}
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-md px-4 sm:px-5 py-3.5 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60 shadow-2xs shrink-0 flex items-center justify-center">
                    <AppIcon icon={Bell} size="lg" color="default" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                        Notifications
                      </h3>
                      {unreadCount > 0 && (
                        <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-400">
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
                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition cursor-pointer"
                    title="Refresh notifications"
                    aria-label="Refresh notifications"
                  >
                    <Refresh className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 rounded-lg border border-[#5e0000] bg-[#780000] hover:bg-[#5e0000] text-white transition-colors shrink-0 cursor-pointer shadow-xs"
                    aria-label="Close notifications"
                  >
                    <AppIcon icon={Xmark} size="md" color="inherit" />
                  </button>
                </div>
              </div>

              {/* Sub-Header: Filter Tabs & Quick Actions */}
              <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs shrink-0">
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-0.5 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setFilterTab("all")}
                    className={`px-2.5 py-1 rounded-lg font-semibold text-xs transition cursor-pointer ${
                      filterTab === "all"
                        ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-2xs"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                  >
                    All ({notifications.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterTab("submissions")}
                    className={`px-2.5 py-1 rounded-lg font-semibold text-xs transition cursor-pointer ${
                      filterTab === "submissions"
                        ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-2xs"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                  >
                    Submissions ({submissionCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterTab("unread")}
                    className={`px-2.5 py-1 rounded-lg font-semibold text-xs transition cursor-pointer ${
                      filterTab === "unread"
                        ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-2xs"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                  >
                    Unread ({unreadCount})
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllAsRead}
                      disabled={isMarkingAll || isClearingAll}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 transition cursor-pointer disabled:opacity-50"
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
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 transition cursor-pointer disabled:opacity-50"
                      title="Clear all notifications"
                    >
                      {isClearingAll ? (
                        <AppIcon icon={SystemRestart} size="xs" color="inherit" className="animate-spin" />
                      ) : (
                        <AppIcon icon={Trash} size="xs" color="inherit" />
                      )}
                      <span>Clear</span>
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

              {/* Notification Items List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
                {isLoading && notifications.length === 0 ? (
                  <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
                    <AppIcon icon={SystemRestart} size="lg" color="active" className="animate-spin" />
                    <span className="text-xs">Loading notifications...</span>
                  </div>
                ) : filteredNotifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500 dark:text-slate-400">
                    <div className="p-3 rounded-full bg-slate-100 dark:bg-slate-900 mb-3">
                      <AppIcon icon={Bell} size="lg" color="muted" />
                    </div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {filterTab === "unread"
                        ? "No unread notifications"
                        : filterTab === "submissions"
                        ? "No submission notifications"
                        : "No notifications yet"}
                    </p>
                    <p className="text-xs text-slate-500 mt-1 max-w-[240px]">
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
                        className={`group relative rounded-xl border p-3.5 transition-all duration-150 cursor-pointer text-left ${
                          isUnread
                            ? "bg-amber-500/5 dark:bg-slate-900/90 border-amber-500/30 hover:border-amber-500/60 ring-1 ring-amber-500/20 shadow-xs"
                            : "bg-white dark:bg-slate-900/40 border-slate-200 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-850 hover:border-slate-300 dark:hover:border-slate-700"
                        }`}
                      >
                        {/* Top: Category Tag + Time + Dot */}
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-1.5">
                            {notif.isExtensionRequest || notif.type === "EXTENSION_REQUEST" ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold">
                                <AppIcon icon={Hourglass} size="xs" color="inherit" />
                                Extension Request
                              </span>
                            ) : notif.isRevision ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-2 py-0.5 text-[10px] font-bold">
                                <AppIcon icon={WarningTriangle} size="xs" color="inherit" />
                                Resubmission
                              </span>
                            ) : notif.isSubmission ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 px-2 py-0.5 text-[10px] font-bold">
                                <AppIcon icon={Upload} size="xs" color="inherit" />
                                New Submission
                              </span>
                            ) : notif.type === "SUBMISSION_APPROVED" ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-bold">
                                <AppIcon icon={CheckCircle} size="xs" color="inherit" />
                                Validated
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-2 py-0.5 text-[10px] font-bold">
                                <AppIcon icon={InfoCircle} size="xs" color="inherit" />
                                Alert
                              </span>
                            )}

                            {reqLabel && (
                              <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-700 dark:text-slate-300 truncate max-w-[160px]">
                                {reqLabel}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] text-slate-400 dark:text-slate-500">
                              {formatRelativeTime(notif.createdAt)}
                            </span>
                            {isUnread && (
                              <span
                                className="h-2 w-2 rounded-full bg-amber-500 ring-2 ring-amber-500/20 shrink-0"
                                title="Unread"
                              />
                            )}
                          </div>
                        </div>

                        {/* Title & Faculty */}
                        <div className="space-y-0.5">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors leading-snug">
                            {notif.title}
                          </h4>
                          <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                            {notif.message}
                          </p>
                        </div>

                        {/* Action Callout */}
                        <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px]">
                          <span className="text-slate-400 dark:text-slate-500 text-[10px]">
                            {notif.facultyName ? `Faculty: ${notif.facultyName}` : "Click to view changes"}
                          </span>
                          <span className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400 group-hover:underline">
                            <span>Review submission</span>
                            <AppIcon icon={NavArrowRight} size="xs" color="inherit" />
                          </span>
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
