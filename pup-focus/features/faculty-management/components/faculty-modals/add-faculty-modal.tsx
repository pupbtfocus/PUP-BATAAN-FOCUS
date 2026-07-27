"use client";

import type { UseFormReturn } from "react-hook-form";
import { Button } from "@/components/ui/button";
import type { FacultyAccountFormInput } from "@/features/faculty-management/schemas/faculty-account.schema";

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="mt-1 text-xs text-red-400">{message}</p>;
}

export interface AddFacultyPanelProps {
  form: UseFormReturn<FacultyAccountFormInput>;
  onAddFaculty: (input: FacultyAccountFormInput) => void;
  isCreating: boolean;
  createError: string | null;
  createSuccess: string | null;
  profileImageFile: File | null;
  onProfileImageChange: (file: File | null) => void;
  profileImageInputKey: number;
  wrapperClassName?: string;
  formClassName?: string;
}

export function AddFacultyPanel({
  form,
  onAddFaculty,
  isCreating,
  createError,
  createSuccess,
  profileImageFile,
  onProfileImageChange,
  profileImageInputKey,
  wrapperClassName,
  formClassName,
}: AddFacultyPanelProps) {
  return (
    <div className={wrapperClassName ?? "flex flex-col max-w-sm mx-auto"}>
      <form
        className={`mt-6 flex flex-1 w-full flex-col gap-3 rounded-xl border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950/50 p-6 shadow-lg ${formClassName ?? ""}`}
        onSubmit={form.handleSubmit(onAddFaculty)}
      >
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="text-sm text-slate-700 dark:text-slate-300" htmlFor="firstName">
              First Name
            </label>
            <input
              id="firstName"
              className="mt-1 w-full rounded-md border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950 px-3 py-2 text-sm outline-none focus:ring focus:ring-amber-300/30"
              {...form.register("firstName")}
            />
            <FieldError message={form.formState.errors.firstName?.message} />
          </div>

          <div>
            <label className="text-sm text-slate-700 dark:text-slate-300" htmlFor="middleName">
              Middle Name
            </label>
            <input
              id="middleName"
              className="mt-1 w-full rounded-md border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950 px-3 py-2 text-sm outline-none focus:ring focus:ring-amber-300/30"
              {...form.register("middleName")}
            />
            <FieldError message={form.formState.errors.middleName?.message} />
          </div>

          <div>
            <label className="text-sm text-slate-700 dark:text-slate-300" htmlFor="lastName">
              Last Name
            </label>
            <input
              id="lastName"
              className="mt-1 w-full rounded-md border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950 px-3 py-2 text-sm outline-none focus:ring focus:ring-amber-300/30"
              {...form.register("lastName")}
            />
            <FieldError message={form.formState.errors.lastName?.message} />
          </div>
        </div>

        <div>
          <label className="text-sm text-slate-700 dark:text-slate-300" htmlFor="profileImage">
            Profile Image
          </label>
          <input
            key={profileImageInputKey}
            id="profileImage"
            type="file"
            accept="image/*"
            className="mt-1 w-full rounded-md border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950 px-3 py-2 text-sm outline-none file:mr-3 file:rounded-md file:border-0 file:bg-amber-400 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-slate-950 focus:ring focus:ring-amber-300/30"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              onProfileImageChange(file);
            }}
          />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Upload a square image for the faculty directory.
          </p>
          {profileImageFile ? (
            <div className="mt-2 flex items-center justify-between rounded-md border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950 px-3 py-2 text-xs text-slate-700 dark:text-slate-300">
              <span className="truncate">{profileImageFile.name}</span>
              <button
                type="button"
                className="ml-3 text-[#7a0000] dark:text-amber-300 hover:text-amber-200"
                onClick={() => onProfileImageChange(null)}
              >
                Remove
              </button>
            </div>
          ) : null}
        </div>

        <div>
          <label className="text-sm text-slate-700 dark:text-slate-300" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            className="mt-1 w-full rounded-md border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950 px-3 py-2 text-sm outline-none focus:ring focus:ring-amber-300/30"
            placeholder="faculty@pup.edu.ph"
            {...form.register("email")}
          />
          <FieldError message={form.formState.errors.email?.message} />
        </div>

        {createError ? (
          <p className="rounded-md border border-red-700 bg-red-950/20 px-3 py-2 text-sm text-red-300">
            {createError}
          </p>
        ) : null}

        {createSuccess ? (
          <p className="rounded-md border border-emerald-700 bg-emerald-950/20 px-3 py-2 text-sm text-emerald-300">
            {createSuccess}
          </p>
        ) : null}

        <Button className="mt-auto w-full" type="submit" disabled={isCreating}>
          {isCreating ? "Sending invite..." : "Create Faculty Account"}
        </Button>
      </form>
    </div>
  );
}

export interface AddFacultyModalProps extends AddFacultyPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddFacultyModal({
  isOpen,
  onClose,
  ...panelProps
}: AddFacultyModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-[rgba(255,215,0,0.18)] bg-[#4d0000]/95 p-6 shadow-2xl shadow-black/30 backdrop-blur">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-[#ffd700]">
              Faculty Management
            </p>
            <h3 className="mt-2 text-xl font-semibold text-[#fff8e7]">
              Add Faculty Account
            </h3>
          </div>

          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>

        <AddFacultyPanel {...panelProps} />
      </div>
    </div>
  );
}
