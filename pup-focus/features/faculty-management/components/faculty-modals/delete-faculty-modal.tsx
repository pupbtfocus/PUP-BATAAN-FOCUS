"use client";

import { Button } from "@/components/ui/button";
import type { FacultyAccount, PendingFacultyAction } from "@/features/faculty-management/types/faculty-dashboard.types";

export interface DeleteFacultyModalProps {
  pendingFacultyAction: PendingFacultyAction | null;
  pendingFaculty: FacultyAccount | null;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
}

export function DeleteFacultyModal({
  pendingFacultyAction,
  pendingFaculty,
  onCancel,
  onConfirm,
}: DeleteFacultyModalProps) {
  if (!pendingFacultyAction) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950/95 p-6 shadow-2xl shadow-black/40">
        <p className="text-xs uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
          {pendingFacultyAction.kind === "delete"
            ? "Confirm Delete"
            : pendingFacultyAction.kind === "activate"
              ? "Confirm Activate"
              : "Confirm Deactivate"}
        </p>
        <h3 className="mt-3 text-2xl font-semibold text-white">
          {pendingFacultyAction.kind === "delete"
            ? "Delete Faculty Account?"
            : pendingFacultyAction.kind === "activate"
              ? "Activate Faculty Account?"
              : "Deactivate Faculty Account?"}
        </h3>
        <p className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-300">
          {pendingFaculty ? (
            <>
              <span className="font-medium text-white">
                {pendingFaculty.fullName}
              </span>{" "}
              ({pendingFaculty.email}) will be affected.
            </>
          ) : null}
        </p>
        <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
          {pendingFacultyAction.kind === "delete"
            ? "This action cannot be undone."
            : pendingFacultyAction.kind === "activate"
              ? "The selected faculty member will be able to sign in again."
              : "The selected faculty member will no longer be able to sign in."}
        </p>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void onConfirm()}
            className={
              pendingFacultyAction.kind === "delete"
                ? "bg-red-600 text-white hover:bg-red-500"
                : pendingFacultyAction.kind === "activate"
                  ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                  : "bg-amber-500 text-slate-950 hover:bg-amber-400"
            }
          >
            {pendingFacultyAction.kind === "delete"
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
