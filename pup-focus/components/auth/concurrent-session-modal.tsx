"use client";

import React from "react";
import { LogOut, WarningTriangle } from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";
import { ModalHeader } from "@/components/ui/modal-header";

export interface ConcurrentSessionModalProps {
  /** Controls visibility of the modal. */
  isOpen: boolean;
  /** Disables action buttons and shows redirecting state. */
  isLoggingOut?: boolean;
  /** Handler for confirming logout and returning to the login page. */
  onConfirm: () => void;
  /** Optional close handler enabled only inside Dev Preview showcase mode. */
  onPreviewClose?: () => void;
}

/**
 * Shared single-active-session modal rendered on concurrent login detection and in Dev Preview.
 */
export function ConcurrentSessionModal({
  isOpen,
  isLoggingOut = false,
  onConfirm,
  onPreviewClose,
}: ConcurrentSessionModalProps) {
  if (!isOpen) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="concurrent-modal-title"
      aria-describedby="concurrent-modal-desc"
      className="fixed inset-0 z-[99999] h-dvh overflow-hidden overscroll-none flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150 select-none"
      onClick={() => {
        if (onPreviewClose && !isLoggingOut) onPreviewClose();
      }}
    >
      <div
        className="fixed inset-0 h-lvh bg-black/75 backdrop-blur-sm touch-none overscroll-none"
        aria-hidden="true"
      />
      <div
        className="relative z-10 w-full max-w-md max-h-[90dvh] overflow-y-auto overflow-x-hidden overscroll-contain rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 shadow-2xl text-slate-900 dark:text-slate-100 animate-in zoom-in-95 duration-150 text-left"
        onClick={(e) => e.stopPropagation()}
      >
        <ModalHeader
          icon={WarningTriangle}
          titleId="concurrent-modal-title"
          title="Signed In Elsewhere"
          subtitle="Single Active Session · 1 device at a time"
          onClose={onPreviewClose}
          closeDisabled={isLoggingOut}
          className="-mx-4 -mt-4 sm:-mx-6 sm:-mt-6 mb-4 rounded-t-2xl"
        />

        <div className="space-y-3.5 text-xs">
          {/* Primary Notice Banner */}
          <div className="rounded-xl border border-amber-600 bg-amber-500 p-3.5 text-slate-950 shadow-xs space-y-1">
            <p className="font-bold text-[13px]">
              Your session on this device has ended
            </p>
            <p id="concurrent-modal-desc" className="text-[11px] font-semibold leading-relaxed">
              This account was just accessed from another browser or device, so
              you were signed out here automatically.
            </p>
          </div>

          {/* Simple Step-by-Step Details */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3.5 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              What happened
            </p>
            <ul className="space-y-1.5 text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="font-bold text-[#780000] dark:text-amber-400">
                  •
                </span>
                <span>
                  <strong className="text-slate-900 dark:text-slate-100">
                    One session rule:
                  </strong>{" "}
                  Only 1 browser or device can stay logged into an account at a
                  time.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-[#780000] dark:text-amber-400">
                  •
                </span>
                <span>
                  <strong className="text-slate-900 dark:text-slate-100">
                    New login wins:
                  </strong>{" "}
                  The newer sign-in remains active while this older tab is
                  disconnected.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-[#780000] dark:text-amber-400">
                  •
                </span>
                <span>
                  <strong className="text-slate-900 dark:text-slate-100">
                    Didn&apos;t sign in?
                  </strong>{" "}
                  Go back to Login, sign in again, and update your password
                  right away.
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Actions */}
        <div
          className={`mt-5 flex items-center gap-2.5 ${
            onPreviewClose ? "justify-end" : ""
          }`}
        >
          {onPreviewClose ? (
            <button
              type="button"
              disabled={isLoggingOut}
              onClick={onPreviewClose}
              className="px-4 py-2.5 rounded-xl border border-amber-600 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition cursor-pointer shadow-xs disabled:opacity-50"
            >
              Close Preview
            </button>
          ) : null}
          <button
            type="button"
            autoFocus
            disabled={isLoggingOut}
            onClick={onConfirm}
            className={`${
              onPreviewClose ? "px-4" : "w-full"
            } inline-flex items-center justify-center gap-2 rounded-xl bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] py-2.5 px-4 text-xs font-bold shadow-xs transition active:scale-[0.98] cursor-pointer disabled:opacity-50`}
          >
            <AppIcon icon={LogOut} size="sm" color="white" />
            <span>
              {isLoggingOut ? "Returning to Login..." : "Return to Login"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
