"use client";

import { useState, useEffect } from "react";
import { Trash, UserBadgeCheck, UserXmark } from "iconoir-react";
import { Button } from "@/components/ui/button";
import { ModalHeader } from "@/components/ui/modal-header";
import type { FacultyAccount, PendingFacultyAction } from "@/features/faculty-management/types/faculty-dashboard.types";

export interface DeleteFacultyModalProps {
  pendingFacultyAction: PendingFacultyAction | null;
  pendingFaculty: FacultyAccount | null;
  isLoading?: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
}

export function DeleteFacultyModal({
  pendingFacultyAction,
  pendingFaculty,
  isLoading = false,
  onCancel,
  onConfirm,
}: DeleteFacultyModalProps) {
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    setConfirmText("");
  }, [pendingFacultyAction]);

  if (!pendingFacultyAction) {
    return null;
  }

  const isDeleteAction = pendingFacultyAction.kind === "delete";
  const isConfirmed = !isDeleteAction || confirmText.trim().toLowerCase() === "delete";

  const handleConfirm = () => {
    if (!isConfirmed || isLoading) return;
    void onConfirm();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl text-slate-900 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-150">
        <ModalHeader
          icon={
            pendingFacultyAction.kind === "delete"
              ? Trash
              : pendingFacultyAction.kind === "activate"
              ? UserBadgeCheck
              : UserXmark
          }
          title={
            pendingFacultyAction.kind === "delete"
              ? "Delete Faculty Account?"
              : pendingFacultyAction.kind === "activate"
              ? "Activate Faculty Account?"
              : "Deactivate Faculty Account?"
          }
          subtitle={
            pendingFacultyAction.kind === "delete"
              ? "Confirm Account Deletion"
              : pendingFacultyAction.kind === "activate"
              ? "Confirm Account Activation"
              : "Confirm Account Deactivation"
          }
          onClose={onCancel}
          closeDisabled={isLoading}
          className="-mx-6 -mt-6 mb-5 rounded-t-2xl"
        />

        <div className="space-y-3">
          {pendingFaculty ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-3.5">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {pendingFaculty.fullName}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {pendingFaculty.email}
                {pendingFaculty.program?.name || pendingFaculty.program?.code
                  ? ` • ${pendingFaculty.program?.name ?? pendingFaculty.program?.code}`
                  : ""}
              </p>
            </div>
          ) : null}

          {isDeleteAction ? (
            <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/80 dark:bg-red-950/30 p-3 text-xs leading-relaxed text-red-700 dark:text-red-300">
              <span className="font-semibold">Warning:</span> This action cannot be undone. All submissions, uploaded documents, review records, and system access for this faculty account will be permanently deleted.
            </div>
          ) : (
            <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">
              {pendingFacultyAction.kind === "activate"
                ? "The selected faculty member will be able to sign in again."
                : "The selected faculty member will no longer be able to sign in."}
            </p>
          )}

          {isDeleteAction && (
            <div className="mt-4 space-y-1.5">
              <label
                htmlFor="delete-faculty-confirm-input"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                To confirm deletion, please type <span className="font-bold text-red-600 dark:text-red-400 select-all">Delete</span> below:
              </label>
              <input
                id="delete-faculty-confirm-input"
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && isConfirmed && !isLoading) {
                    e.preventDefault();
                    handleConfirm();
                  }
                }}
                placeholder='Type "Delete" to confirm'
                autoFocus
                autoComplete="off"
                disabled={isLoading}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-600/30 transition-colors shadow-2xs disabled:opacity-50"
              />
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="maroon"
            onClick={onCancel}
            disabled={isLoading}
            className="cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!isConfirmed || isLoading}
            onClick={handleConfirm}
            className={
              pendingFacultyAction.kind === "delete"
                ? "bg-[#780000] hover:bg-[#5e0000] text-white font-semibold cursor-pointer border-transparent shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                : pendingFacultyAction.kind === "activate"
                  ? "bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold cursor-pointer border-transparent shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                  : "bg-[#780000] hover:bg-[#5e0000] text-white font-semibold cursor-pointer border-transparent shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
            }
          >
            {isLoading
              ? "Processing..."
              : pendingFacultyAction.kind === "delete"
                ? "Delete"
                : pendingFacultyAction.kind === "activate"
                  ? "Activate"
                  : "Deactivate"}
          </Button>
        </div>
      </div>
    </div>
  );
}
