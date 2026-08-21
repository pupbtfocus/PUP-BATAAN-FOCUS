"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  ExternalLink,
  X,
  Loader2,
  Clock,
  AlertCircle,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
  Icon: typeof CheckCircle2;
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
      Icon: Clock,
      colorClasses: "text-amber-400 border-amber-800/60 bg-amber-950/40",
      badgeBg: "bg-amber-500/20 text-amber-300 border-amber-500/30",
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
      Icon: CheckCircle2,
      colorClasses: "text-emerald-400 border-emerald-800/60 bg-emerald-950/40",
      badgeBg: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    };
  }

  if (
    typeUpper.includes("REVISION") ||
    titleLower.includes("revision") ||
    messageLower.includes("revision")
  ) {
    return {
      category: "REVISION_REQUESTED",
      Icon: AlertTriangle,
      colorClasses: "text-amber-400 border-amber-800/60 bg-amber-950/40",
      badgeBg: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    };
  }

  if (
    typeUpper.includes("REJECT") ||
    titleLower.includes("rejected") ||
    messageLower.includes("rejected")
  ) {
    return {
      category: "REJECTED",
      Icon: XCircle,
      colorClasses: "text-red-400 border-red-800/60 bg-red-950/40",
      badgeBg: "bg-red-500/20 text-red-300 border-red-500/30",
    };
  }

  return {
    category: "INFO",
    Icon: Info,
    colorClasses: "text-sky-400 border-sky-800/60 bg-sky-950/40",
    badgeBg: "bg-sky-500/20 text-sky-300 border-sky-500/30",
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
        setNotifications(data.notifications);
        setUnreadCount(
          typeof data.unreadCount === "number"
            ? data.unreadCount
            : data.notifications.filter((n: AppNotification) => !n.isRead).length,
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
        className="relative flex items-center justify-center p-2 rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 bg-slate-200/60 dark:bg-slate-900 border border-slate-400 dark:border-slate-800 transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/40"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white shadow-md animate-pulse">
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
            <div className="fixed inset-y-0 right-0 z-[100] flex h-full w-full sm:max-w-md flex-col p-0 bg-slate-900 border-l border-slate-800 shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-4 py-3 shrink-0">
                {/* Left Side: Title & Badge */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <Bell className="h-5 w-5 text-amber-400 shrink-0" />
                  <h3 className="text-base font-semibold text-slate-100 truncate">Notifications</h3>
                  {unreadCount > 0 && (
                    <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-400 whitespace-nowrap">
                      {unreadCount} unread
                    </span>
                  )}
                </div>

                {/* Right Side: Actions & Close */}
                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllAsRead}
                      disabled={isMarkingAll || isClearingAll}
                      className="inline-flex items-center gap-1 text-xs font-medium text-amber-400 hover:text-amber-300 whitespace-nowrap transition-colors disabled:opacity-50 cursor-pointer"
                      title="Mark all notifications as read"
                    >
                      {isMarkingAll ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckCheck className="h-3.5 w-3.5" />
                      )}
                      <span>Mark all read</span>
                    </button>
                  )}

                  {notifications.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearAll}
                      disabled={isClearingAll || isMarkingAll}
                      className="inline-flex items-center gap-1 text-xs font-medium text-red-400 hover:text-red-300 whitespace-nowrap transition-colors disabled:opacity-50 cursor-pointer"
                      title="Clear all notifications"
                    >
                      {isClearingAll ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      <span>Clear all</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="p-1 text-slate-400 hover:text-slate-200 transition-colors rounded-md cursor-pointer"
                    aria-label="Close notifications"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Toast Feedback Notification Banner */}
              {toastMessage && (
                <div className="flex items-center justify-between gap-2 bg-emerald-500/15 border-b border-emerald-500/30 px-4 py-2.5 text-xs text-emerald-200 animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span className="font-medium">{toastMessage}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setToastMessage(null)}
                    className="text-emerald-400 hover:text-emerald-200 p-0.5 rounded"
                    aria-label="Dismiss toast"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {/* List Body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12 text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin text-amber-400 mr-2" />
                    <span>Loading notifications...</span>
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
                    <Bell className="h-12 w-12 text-slate-600 mb-3 opacity-40" />
                    <p className="text-sm font-medium text-slate-300">No notifications yet</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Updates on your document review status will appear here.
                    </p>
                  </div>
                ) : (
                  notifications.map((notification) => {
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
                      notification.metadata?.remarks ??
                      (notification.message.includes("Remarks:")
                        ? notification.message.split("Remarks:")[1]?.trim()
                        : null);

                    return (
                      <article
                        key={notification.id}
                        onClick={() => handleNotificationClick(notification)}
                        className={`group relative rounded-xl border p-4 transition-all duration-200 cursor-pointer ${
                          !notification.isRead
                            ? "bg-slate-800/90 border-amber-500/40 shadow-sm ring-1 ring-amber-500/20"
                            : "bg-slate-950/50 border-slate-800 hover:bg-slate-800/50"
                        }`}
                      >
                        {/* Top Bar: Icon + Title + Unread indicator */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5">
                            <div className={`mt-0.5 rounded-lg border p-1.5 shrink-0 ${colorClasses}`}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <div>
                              <h3 className="text-sm font-semibold text-slate-100 group-hover:text-amber-300 transition-colors">
                                {notification.title}
                              </h3>
                              <span className="text-[11px] text-slate-400">
                                {formatRelativeTime(notification.createdAt)}
                              </span>
                            </div>
                          </div>

                          {!notification.isRead && (
                            <span
                              className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-sky-400 shadow-sm shadow-sky-400"
                              title="Unread"
                            />
                          )}
                        </div>

                        {/* Requirement or Deadline Alert badge */}
                        {(reqLabel || isDeadlineAlert) && (
                          <div className="mt-2 flex items-center gap-2">
                            {isDeadlineAlert && (
                              <span className="inline-flex items-center gap-1 rounded border border-amber-500/40 bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                                <Clock className="h-3 w-3" />
                                Deadline Alert
                              </span>
                            )}
                            {reqLabel && (
                              <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-medium ${badgeBg}`}>
                                {reqLabel}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Main Message */}
                        <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                          {notification.message}
                        </p>

                        {/* Reviewer remarks preview if provided */}
                        {remarks && (
                          <div className="mt-2.5 rounded-lg border border-slate-700/80 bg-slate-900/90 p-2.5 text-xs text-slate-300 italic">
                            <span className="font-semibold not-italic text-amber-300">
                              {reviewerName ? `${reviewerName}: ` : "Reviewer Remarks: "}
                            </span>
                            &ldquo;{remarks}&rdquo;
                          </div>
                        )}

                        {/* Navigation Link Hint */}
                        {(reqCode || isDeadlineAlert) && (
                          <div className="mt-3 flex items-center justify-end">
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 group-hover:underline">
                              {reqCode ? "View requirement" : "View pending requirements"}{" "}
                              <ExternalLink className="h-3 w-3" />
                            </span>
                          </div>
                        )}
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
