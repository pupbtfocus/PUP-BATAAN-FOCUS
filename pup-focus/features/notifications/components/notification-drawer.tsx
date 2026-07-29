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
  category: "APPROVED" | "REVISION_REQUESTED" | "REJECTED" | "INFO";
  Icon: typeof CheckCircle2;
  colorClasses: string;
  badgeBg: string;
} {
  const typeUpper = (notification.type ?? "").toUpperCase();
  const titleLower = (notification.title ?? "").toLowerCase();
  const messageLower = (notification.message ?? "").toLowerCase();

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

  const textToScan = `${notification.title} ${notification.message}`;
  for (const code of Object.keys(REQUIREMENT_LABEL)) {
    if (textToScan.includes(code)) {
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
        element.classList.add("ring-2", "ring-amber-400");
        setTimeout(() => {
          element.classList.remove("ring-2", "ring-amber-400");
        }, 3000);
      } else {
        router.push(`/faculty/dashboard?requirement=${requirementCode}#${targetElementId}`);
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
        className="relative flex items-center justify-center rounded-md border border-[rgba(255,215,0,0.18)] bg-[#6d0000]/60 p-2 text-[#fff8e7] transition-colors hover:bg-[#850000] focus:outline-none focus:ring-2 focus:ring-[#ffd700]/50"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white shadow-md animate-pulse">
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
              <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-5 py-4 shrink-0">
                <div className="flex items-center gap-2.5">
                  <Bell className="h-5 w-5 text-amber-400" />
                  <h2 className="text-lg font-semibold text-slate-100">Notifications</h2>
                  {unreadCount > 0 && (
                    <span className="rounded-full border border-amber-500/30 bg-amber-500/20 px-2.5 py-0.5 text-xs font-medium text-amber-300">
                      {unreadCount} unread
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleMarkAllAsRead}
                      disabled={isMarkingAll}
                      className="inline-flex items-center gap-1.5 text-xs text-amber-300 hover:bg-slate-800 hover:text-amber-200"
                    >
                      {isMarkingAll ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckCheck className="h-3.5 w-3.5" />
                      )}
                      Mark all read
                    </Button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                    aria-label="Close notifications"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

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
                    const { Icon, colorClasses, badgeBg } =
                      getNotificationTypeCategory(notification);
                    const reqCode = extractRequirementCode(notification);
                    const reqLabel = reqCode ? REQUIREMENT_LABEL[reqCode] : null;
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

                        {/* Requirement badge if present */}
                        {reqLabel && (
                          <div className="mt-2 flex items-center gap-2">
                            <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-medium ${badgeBg}`}>
                              {reqLabel}
                            </span>
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
                        {reqCode && (
                          <div className="mt-3 flex items-center justify-end">
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 group-hover:underline">
                              View requirement <ExternalLink className="h-3 w-3" />
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
