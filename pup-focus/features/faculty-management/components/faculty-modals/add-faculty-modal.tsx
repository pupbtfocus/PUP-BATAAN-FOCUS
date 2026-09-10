"use client";

import { useEffect, useState, useId } from "react";
import type { UseFormReturn } from "react-hook-form";
import { Xmark } from "iconoir-react";
import { createClient } from "@/lib/supabase/client";
import type { FacultyAccountFormInput } from "@/features/faculty-management/schemas/faculty-account.schema";

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="mt-1 text-xs font-medium text-red-400">{message}</p>;
}

export type ProgramOption = {
  id: string;
  code: string;
  name: string;
};

const DEFAULT_DEGREE_PROGRAMS = [
  { code: "BEED", name: "Bachelor of Elementary Education" },
  { code: "BSA", name: "Bachelor of Science in Accountancy" },
  { code: "BSMA", name: "Bachelor of Science in Management Accounting" },
  { code: "BSIE", name: "Bachelor of Science in Industrial Engineering" },
  { code: "BSIT", name: "Bachelor of Science in Information Technology" },
  { code: "BSBAHRM", name: "Bachelor of Science in Business Administration major in Human Resource Management" },
  { code: "BSEnt", name: "Bachelor of Science in Entrepreneurship" },
];

const DEFAULT_DIPLOMA_COURSES = [
  { code: "DIT", name: "Diploma in Information Technology" },
  { code: "DOMT-LOM", name: "Diploma in Office Management Technology major in Legal Office Management" },
];

const REDUNDANT_CODES = new Set(["BSBA", "BSE"]);

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
  const [degreePrograms, setDegreePrograms] = useState<ProgramOption[]>([]);
  const [diplomaCourses, setDiplomaCourses] = useState<ProgramOption[]>([]);
  const [isLoadingPrograms, setIsLoadingPrograms] = useState(true);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const photoInputId = useId();

  useEffect(() => {
    if (!profileImageFile) {
      setImagePreview(null);
      return;
    }

    const objectUrl = URL.createObjectURL(profileImageFile);
    setImagePreview(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [profileImageFile]);

  useEffect(() => {
    let isMounted = true;

    async function loadPrograms() {
      try {
        setIsLoadingPrograms(true);
        let rawPrograms: ProgramOption[] = [];

        try {
          const res = await fetch("/api/programs");
          if (res.ok) {
            const data = await res.json();
            rawPrograms = (data.programs ?? []) as ProgramOption[];
          }
        } catch {
          // Fallback to direct client
        }

        if (rawPrograms.length === 0) {
          const supabase = createClient();
          const { data: fetchedPrograms, error } = await supabase
            .from("programs")
            .select("id, code, name")
            .order("code", { ascending: true });

          if (error) {
            console.error(
              "Failed to fetch programs from Supabase:",
              error.message,
            );
          } else if (fetchedPrograms) {
            rawPrograms = fetchedPrograms as ProgramOption[];
          }
        }

        if (isMounted) {
          const filtered = rawPrograms.filter(
            (p: ProgramOption) => !REDUNDANT_CODES.has(p.code.toUpperCase()),
          );

          const degrees: ProgramOption[] = [];
          const diplomas: ProgramOption[] = [];

          if (filtered.length > 0) {
            filtered.forEach((p: ProgramOption) => {
              const codeUpper = p.code.toUpperCase();
              const nameUpper = p.name.toUpperCase();
              if (codeUpper.startsWith("D") || nameUpper.includes("DIPLOMA")) {
                diplomas.push(p);
              } else {
                degrees.push(p);
              }
            });
          } else {
            DEFAULT_DEGREE_PROGRAMS.forEach(
              (p: { code: string; name: string }) =>
                degrees.push({ id: p.code, ...p }),
            );
            DEFAULT_DIPLOMA_COURSES.forEach(
              (p: { code: string; name: string }) =>
                diplomas.push({ id: p.code, ...p }),
            );
          }

          setDegreePrograms(degrees);
          setDiplomaCourses(diplomas);
        }
      } catch (err) {
        console.error("Program fetch error:", err);
        if (isMounted) {
          setDegreePrograms(
            DEFAULT_DEGREE_PROGRAMS.map((p: { code: string; name: string }) => ({
              id: p.code,
              ...p,
            })),
          );
          setDiplomaCourses(
            DEFAULT_DIPLOMA_COURSES.map((p: { code: string; name: string }) => ({
              id: p.code,
              ...p,
            })),
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingPrograms(false);
        }
      }
    }

    void loadPrograms();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleImageChange = (file: File | null) => {
    onProfileImageChange(file);
  };

  return (
    <div className={wrapperClassName ?? "flex flex-col w-full"}>
      <form
        className={`flex flex-1 w-full flex-col gap-4 ${formClassName ?? ""}`}
        onSubmit={form.handleSubmit(onAddFaculty)}
      >
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 block" htmlFor="firstName">
              First Name <span className="text-red-500">*</span>
            </label>
            <input
              id="firstName"
              placeholder="e.g. Juan"
              className="mt-1.5 w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-slate-900 dark:focus:border-slate-100 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl px-4 py-2.5 text-sm outline-none transition-all focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-100/10"
              {...form.register("firstName")}
            />
            <FieldError message={form.formState.errors.firstName?.message} />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 block" htmlFor="middleName">
              Middle Name
            </label>
            <input
              id="middleName"
              placeholder="e.g. Santos"
              className="mt-1.5 w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-slate-900 dark:focus:border-slate-100 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl px-4 py-2.5 text-sm outline-none transition-all focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-100/10"
              {...form.register("middleName")}
            />
            <FieldError message={form.formState.errors.middleName?.message} />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 block" htmlFor="lastName">
              Last Name <span className="text-red-500">*</span>
            </label>
            <input
              id="lastName"
              placeholder="e.g. Dela Cruz"
              className="mt-1.5 w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-slate-900 dark:focus:border-slate-100 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl px-4 py-2.5 text-sm outline-none transition-all focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-100/10"
              {...form.register("lastName")}
            />
            <FieldError message={form.formState.errors.lastName?.message} />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 block" htmlFor="programId">
            Academic Program / Department <span className="text-red-500">*</span>
          </label>
          <select
            id="programId"
            className="mt-1.5 w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-xl px-4 py-2.5 focus:outline-none focus:border-slate-900 dark:focus:border-slate-100 text-sm outline-none transition-all focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-100/10 disabled:opacity-50"
            disabled={isLoadingPrograms || isCreating}
            {...form.register("programId")}
          >
            <option value="" className="bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400">
              {isLoadingPrograms ? "Loading programs..." : "-- Select Program / Department --"}
            </option>

            {degreePrograms.length > 0 && (
              <optgroup label="Degree Programs" className="bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold">
                {degreePrograms.map((p) => (
                  <option key={p.id} value={p.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-normal">
                    {p.code} — {p.name}
                  </option>
                ))}
              </optgroup>
            )}

            {diplomaCourses.length > 0 && (
              <optgroup label="Diploma Courses" className="bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold">
                {diplomaCourses.map((p) => (
                  <option key={p.id} value={p.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-normal">
                    {p.code} — {p.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          <FieldError message={form.formState.errors.programId?.message} />
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 block">
            Profile Photo
          </label>
          <div className="border-2 border-dashed border-slate-200 dark:border-slate-700/80 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-950/40 flex items-center gap-3">
            {imagePreview ? (
              <img
                src={imagePreview}
                alt="Preview"
                className="w-12 h-12 rounded-full object-cover border border-slate-300 dark:border-slate-700 shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center font-bold text-xs shrink-0">
                IMG
              </div>
            )}
            <div className="flex-1 min-w-0">
              <label
                htmlFor={photoInputId}
                className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer inline-block transition-all"
              >
                Choose Profile Photo
              </label>
              <input
                key={profileImageInputKey}
                id={photoInputId}
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  handleImageChange(file);
                }}
                className="hidden"
              />
              {profileImageFile ? (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">
                  {profileImageFile.name}
                </p>
              ) : null}
            </div>
            {profileImageFile ? (
              <button
                type="button"
                className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 rounded-lg transition-all shrink-0 cursor-pointer"
                onClick={() => handleImageChange(null)}
              >
                Remove
              </button>
            ) : null}
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 block" htmlFor="email">
            Email Address <span className="text-red-500">*</span>
          </label>
          <input
            id="email"
            type="email"
            className="mt-1.5 w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-slate-900 dark:focus:border-slate-100 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl px-4 py-2.5 text-sm outline-none transition-all focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-100/10"
            placeholder="faculty@pup.edu.ph"
            {...form.register("email")}
          />
          <FieldError message={form.formState.errors.email?.message} />
        </div>

        {createError ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300 px-4 py-3 text-sm">
            {createError}
          </p>
        ) : null}

        {createSuccess ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300 px-4 py-3 text-sm">
            {createSuccess}
          </p>
        ) : null}

        <button
          className="mt-2 w-full bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold py-3 rounded-xl transition-all shadow-md disabled:opacity-50 cursor-pointer text-sm tracking-wide"
          type="submit"
          disabled={isCreating || isLoadingPrograms}
        >
          {isCreating ? "Sending invite..." : "Create Faculty Account"}
        </button>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl text-slate-900 dark:text-slate-100">
        <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Add Faculty Account
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-all cursor-pointer"
            aria-label="Close modal"
          >
            <Xmark className="w-5 h-5" />
          </button>
        </div>

        <AddFacultyPanel {...panelProps} />
      </div>
    </div>
  );
}
