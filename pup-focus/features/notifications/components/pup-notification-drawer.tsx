"use client";

import React from "react";
import { Icon } from "@iconify/react";
import { cn } from "@/utils/cn";

/* ────────────────────────────────────────────────────────────────────────────
 * PUP FOCUS — Notifications Drawer
 * Theme: PUP Maroon (#800000) + Amber Gold (#FFB800 / amber-500)
 * Icons: @iconify/react · Solar line-duotone
 * ──────────────────────────────────────────────────────────────────────────── */

export type NotificationFilter = "all" | "submissions" | "unread";

export interface PUPNotification {
  id: string;
  title: string;
  message: string;
  category: string;
  documentTitle?: string | null;
  facultyName?: string | null;
  createdAt: string;
  isRead: boolean;
}

export interface PUPNotificationDrawerProps {
  open: boolean;
  onClose: () => void;
  notifications: PUPNotification[];
  filter: NotificationFilter;
  onFilterChange: (filter: NotificationFilter) => void;
  onRefresh?: () => void;
  onReview?: (notification: PUPNotification) => void;
  onToggleRead?: (notification: PUPNotification) => void;
  onMarkAllRead?: () => void;
  onClearAll?: () => void;
  isLoading?: boolean;
}

function formatRelativeTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "Just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

export function PUPNotificationDrawer({
  open,
  onClose,
  notifications,
  filter,
  onFilterChange,
  onRefresh,
  onReview,
  onToggleRead,
  onMarkAllRead,
  onClearAll,
  isLoading = false,
}: PUPNotificationDrawerProps) {
  if (!open) return null;

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const submissionCount = notifications.length;

  const visibleNotifications = notifications.filter((notification) => {
    if (filter === "unread") return !notification.isRead;
    if (filter === "submissions") return notification.category === "Faculty Submission";
    return true;
  });

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close notifications"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
      />

      {/* Drawer */}
      <aside className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        {/* ── Header ─────────────────────────────────────────────── */}
        <header className="shrink-0 border-b-4 border-amber-500 bg-[#800000] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-rose-100">
                <Icon icon="solar:bell-line-duotone" className="h-5 w-5" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-extrabold tracking-tight text-white">
                    Notifications
                  </h2>
                  {unreadCount > 0 && (
                    <span className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[11px] font-bold text-rose-100">
                      {unreadCount} unread
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-rose-100/80">
                  Faculty submissions &amp; compliance alerts
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onRefresh}
                disabled={isLoading}
                title="Refresh notifications"
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500 text-slate-950 transition hover:bg-amber-600 disabled:opacity-50"
              >
                <Icon
                  icon="solar:refresh-circle-line-duotone"
                  className={cn("h-5 w-5", isLoading && "animate-spin")}
                />
              </button>
              <button
                type="button"
                onClick={onClose}
                title="Close notifications"
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500 text-slate-950 transition hover:bg-amber-600"
              >
                <Icon icon="solar:close-circle-line-duotone" className="h-5 w-5" />
              </button>
            </div>
          </div>
        </header>

        {/* ── Filter & Controls ──────────────────────────────────── */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 bg-slate-50/70 px-5 py-3">
          <div className="flex items-center gap-1.5">
            {(
              [
                { key: "all", label: `All (${notifications.length})` },
                { key: "submissions", label: `Submissions (${submissionCount})` },
                { key: "unread", label: `Unread (${unreadCount})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => onFilterChange(tab.key)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs transition",
                  filter === tab.key
                    ? "bg-amber-500 font-bold text-slate-950 shadow-sm"
                    : "font-medium text-slate-600 hover:text-slate-900",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllRead}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-slate-950 shadow-sm transition hover:bg-amber-600"
              >
                <Icon icon="solar:check-circle-line-duotone" className="h-4 w-4" />
                Mark all read
              </button>
            )}
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={onClearAll}
                title="Clear all notifications"
                aria-label="Clear all notifications"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#800000] text-white transition hover:bg-[#5e0000]"
              >
                <Icon icon="solar:trash-bin-trash-line-duotone" className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* ── List ───────────────────────────────────────────────── */}
        <div className="flex-1 divide-y divide-slate-100 overflow-y-auto">
          {isLoading && visibleNotifications.length === 0 ? (
            <div className="flex h-64 items-center justify-center gap-2 text-slate-400">
              <Icon icon="solar:refresh-circle-line-duotone" className="h-5 w-5 animate-spin" />
              <span className="text-sm font-medium">Loading notifications…</span>
            </div>
          ) : visibleNotifications.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-3 px-6 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                <Icon icon="solar:bell-line-duotone" className="h-6 w-6" />
              </span>
              <p className="text-sm font-bold text-slate-800">No notifications</p>
              <p className="text-xs text-slate-500">
                When faculty upload requirements, alerts will appear here.
              </p>
            </div>
          ) : (
            visibleNotifications.map((notification) => {
              const isUnread = !notification.isRead;

              return (
                <article
                  key={notification.id}
                  className={cn(
                    "flex items-start gap-3.5 border-l-4 px-5 py-4 transition",
                    isUnread
                      ? "border-l-transparent bg-white hover:bg-slate-50"
                      : "border-l-transparent bg-white hover:bg-slate-50",
                  )}
                >
                  {/* Icon badge */}
                  <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-500">
                    <Icon icon="solar:upload-minimalistic-line-duotone" className="h-5 w-5" />
                  </span>

                  <div className="min-w-0 flex-1">
                    {/* Title + time */}
                    <div className="flex items-start justify-between gap-3">
                      <h3
                        className={cn(
                          "text-sm leading-snug text-slate-900",
                          isUnread ? "font-extrabold" : "font-semibold",
                        )}
                      >
                        {notification.title}
                      </h3>
                      <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
                        <span className="whitespace-nowrap text-[11px] text-slate-400">
                          {formatRelativeTime(notification.createdAt)}
                        </span>
                        {isUnread && (
                          <span className="h-2 w-2 rounded-full bg-slate-400" title="Unread" />
                        )}
                      </div>
                    </div>

                    {/* Category + document tags */}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-bold text-slate-600">
                        {notification.category}
                      </span>
                      {notification.documentTitle && (
                        <span className="max-w-[240px] truncate rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-bold text-slate-600">
                          {notification.documentTitle}
                        </span>
                      )}
                    </div>

                    {/* Message */}
                    <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-600">
                      {notification.message}
                    </p>

                    {/* Footer */}
                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
                      <div className="flex min-w-0 items-center gap-1.5 text-slate-500">
                        <Icon icon="solar:user-rounded-line-duotone" className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate text-xs font-medium">
                          {notification.facultyName ?? "System Update"}
                        </span>
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5">
                        {onReview && (
                          <button
                            type="button"
                            onClick={() => onReview(notification)}
                            className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-slate-950 shadow-sm transition hover:bg-amber-600"
                          >
                            Review
                            <Icon icon="solar:alt-arrow-right-linear" className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {onToggleRead && (
                          <button
                            type="button"
                            onClick={() => onToggleRead(notification)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#800000] px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-[#5e0000]"
                          >
                            <Icon icon="solar:check-circle-line-duotone" className="h-3.5 w-3.5" />
                            {isUnread ? "Mark as read" : "Mark as unread"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </aside>
    </div>
  );
}

export default PUPNotificationDrawer;
