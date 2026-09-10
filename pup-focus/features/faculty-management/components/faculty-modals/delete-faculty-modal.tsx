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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl text-slate-900 dark:text-slate-100">
        <p className="text-xs uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400 font-semibold">
          {pendingFacultyAction.kind === "delete"
            ? "Confirm Delete"
            : pendingFacultyAction.kind === "activate"
              ? "Confirm Activate"
              : "Confirm Deactivate"}
        </p>
        <h3 className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">
          {pendingFacultyAction.kind === "delete"
            ? "Delete Faculty Account?"
            : pendingFacultyAction.kind === "activate"
              ? "Activate Faculty Account?"
              : "Deactivate Faculty Account?"}
        </h3>
        <p className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-300">
          {pendingFaculty ? (
            <>
              <span className="font-semibold text-slate-900 dark:text-white">
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
          <Button type="button" variant="maroon" onClick={onCancel} className="cursor-pointer">
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void onConfirm()}
            className={
              pendingFacultyAction.kind === "delete"
                ? "bg-[#780000] hover:bg-[#5e0000] text-white font-semibold cursor-pointer border-transparent shadow-xs"
                : pendingFacultyAction.kind === "activate"
                  ? "bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold cursor-pointer border-transparent shadow-xs"
                  : "bg-[#780000] hover:bg-[#5e0000] text-white font-semibold cursor-pointer border-transparent shadow-xs"
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
