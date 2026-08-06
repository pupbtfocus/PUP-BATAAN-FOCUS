"use client";

import { useEffect, useState, useId } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  facultyAccountSchema,
  type FacultyAccountFormInput,
} from "@/features/faculty-management/schemas/faculty-account.schema";
import type { CreateFacultyResult } from "@/features/faculty-management/types/faculty-dashboard.types";

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

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="mt-1 text-xs font-medium text-red-400">{message}</p>;
}

export interface CreateFacultyPanelProps {
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

export function CreateFacultyPanel({
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
}: CreateFacultyPanelProps) {
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
        const supabase = createClient();
        const { data: fetchedPrograms, error } = await supabase
          .from("programs")
          .select("id, code, name")
          .order("code", { ascending: true });

        if (error) {
          console.error("Failed to fetch programs from Supabase:", error.message);
        }

        if (isMounted) {
          const rawPrograms = (fetchedPrograms ?? []) as ProgramOption[];
          const filtered = rawPrograms.filter((p: ProgramOption) => !REDUNDANT_CODES.has(p.code.toUpperCase()));

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
            DEFAULT_DEGREE_PROGRAMS.forEach((p: { code: string; name: string }) => degrees.push({ id: p.code, ...p }));
            DEFAULT_DIPLOMA_COURSES.forEach((p: { code: string; name: string }) => diplomas.push({ id: p.code, ...p }));
          }

          setDegreePrograms(degrees);
          setDiplomaCourses(diplomas);
        }
      } catch (err) {
        console.error("Program fetch error:", err);
        if (isMounted) {
          setDegreePrograms(DEFAULT_DEGREE_PROGRAMS.map((p: { code: string; name: string }) => ({ id: p.code, ...p })));
          setDiplomaCourses(DEFAULT_DIPLOMA_COURSES.map((p: { code: string; name: string }) => ({ id: p.code, ...p })));
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
            <label className="text-xs font-semibold uppercase tracking-wider text-amber-200/90" htmlFor="firstName">
              First Name <span className="text-red-400">*</span>
            </label>
            <input
              id="firstName"
              placeholder="e.g. Juan"
              className="mt-1.5 w-full bg-[#1f0407]/80 border border-amber-500/30 focus:border-amber-500 text-slate-100 placeholder:text-slate-500 rounded-xl px-4 py-2.5 text-sm outline-none transition-all"
              {...form.register("firstName")}
            />
            <FieldError message={form.formState.errors.firstName?.message} />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-amber-200/90" htmlFor="middleName">
              Middle Name
            </label>
            <input
              id="middleName"
              placeholder="e.g. Santos"
              className="mt-1.5 w-full bg-[#1f0407]/80 border border-amber-500/30 focus:border-amber-500 text-slate-100 placeholder:text-slate-500 rounded-xl px-4 py-2.5 text-sm outline-none transition-all"
              {...form.register("middleName")}
            />
            <FieldError message={form.formState.errors.middleName?.message} />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-amber-200/90" htmlFor="lastName">
              Last Name <span className="text-red-400">*</span>
            </label>
            <input
              id="lastName"
              placeholder="e.g. Dela Cruz"
              className="mt-1.5 w-full bg-[#1f0407]/80 border border-amber-500/30 focus:border-amber-500 text-slate-100 placeholder:text-slate-500 rounded-xl px-4 py-2.5 text-sm outline-none transition-all"
              {...form.register("lastName")}
            />
            <FieldError message={form.formState.errors.lastName?.message} />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-amber-200/90" htmlFor="programId">
            Academic Program / Department <span className="text-red-400">*</span>
          </label>
          <select
            id="programId"
            className="mt-1.5 w-full bg-[#1f0407]/80 border border-amber-500/30 text-slate-100 rounded-xl px-4 py-2.5 focus:outline-none focus:border-amber-500 text-sm outline-none transition-all disabled:opacity-50"
            disabled={isLoadingPrograms || isCreating}
            {...form.register("programId")}
          >
            <option value="" className="bg-[#1f0407] text-slate-400">
              {isLoadingPrograms ? "Loading programs..." : "-- Select Program / Department --"}
            </option>

            {degreePrograms.length > 0 && (
              <optgroup label="Degree Programs" className="bg-[#1f0407] text-amber-300 font-bold">
                {degreePrograms.map((p) => (
                  <option key={p.id} value={p.id} className="bg-[#1f0407] text-slate-100 font-normal">
                    {p.code} — {p.name}
                  </option>
                ))}
              </optgroup>
            )}

            {diplomaCourses.length > 0 && (
              <optgroup label="Diploma Courses" className="bg-[#1f0407] text-amber-300 font-bold">
                {diplomaCourses.map((p) => (
                  <option key={p.id} value={p.id} className="bg-[#1f0407] text-slate-100 font-normal">
                    {p.code} — {p.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          <FieldError message={form.formState.errors.programId?.message} />
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-amber-200/90 mb-1.5 block">
            Profile Photo
          </label>
          <div className="flex items-center gap-4 p-3 bg-[#1f0407]/50 border border-dashed border-amber-500/30 rounded-xl">
            {imagePreview ? (
              <img
                src={imagePreview}
                alt="Preview"
                className="w-12 h-12 rounded-full object-cover border border-amber-500/50 shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold text-xs shrink-0">
                IMG
              </div>
            )}
            <div className="flex-1 min-w-0">
              <label
                htmlFor={photoInputId}
                className="cursor-pointer text-xs font-bold text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-3 py-1.5 rounded-lg inline-block transition-all"
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
                <p className="text-[11px] text-slate-400 mt-1 truncate">
                  {profileImageFile.name}
                </p>
              ) : null}
            </div>
            {profileImageFile ? (
              <button
                type="button"
                className="text-xs font-bold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 px-2.5 py-1.5 rounded-lg transition-all shrink-0"
                onClick={() => handleImageChange(null)}
              >
                Remove
              </button>
            ) : null}
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-amber-200/90" htmlFor="email">
            Email Address <span className="text-red-400">*</span>
          </label>
          <input
            id="email"
            type="email"
            className="mt-1.5 w-full bg-[#1f0407]/80 border border-amber-500/30 focus:border-amber-500 text-slate-100 placeholder:text-slate-500 rounded-xl px-4 py-2.5 text-sm outline-none transition-all"
            placeholder="faculty@pup.edu.ph"
            {...form.register("email")}
          />
          <FieldError message={form.formState.errors.email?.message} />
        </div>

        {createError ? (
          <p className="rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-300">
            {createError}
          </p>
        ) : null}

        {createSuccess ? (
          <p className="rounded-xl border border-emerald-500/40 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-300">
            {createSuccess}
          </p>
        ) : null}

        <button
          className="mt-2 w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-3 rounded-xl transition-all shadow-lg hover:shadow-amber-500/20 disabled:opacity-50 cursor-pointer text-sm tracking-wide"
          type="submit"
          disabled={isCreating || isLoadingPrograms}
        >
          {isCreating ? "Sending invite..." : "Create Faculty Account"}
        </button>
      </form>
    </div>
  );
}

export interface CreateFacultyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFacultyCreated?: () => void;
}

export function CreateFacultyModal({
  isOpen,
  onClose,
  onFacultyCreated,
}: CreateFacultyModalProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [profileImageInputKey, setProfileImageInputKey] = useState(0);

  const form = useForm<FacultyAccountFormInput>({
    resolver: zodResolver(facultyAccountSchema),
    defaultValues: {
      firstName: "",
      middleName: "",
      lastName: "",
      email: "",
      programId: "",
    },
  });

  if (!isOpen) {
    return null;
  }

  async function handleAddFaculty(input: FacultyAccountFormInput) {
    setIsCreating(true);
    setCreateError(null);
    setCreateSuccess(null);

    try {
      const payload = new FormData();
      payload.append("firstName", input.firstName);
      payload.append("middleName", input.middleName);
      payload.append("lastName", input.lastName);
      payload.append("email", input.email);
      payload.append("program_id", input.programId);
      payload.append("programId", input.programId);

      if (profileImageFile) {
        payload.append("profileImage", profileImageFile);
      }

      const response = await fetch("/api/super-admin/faculty/create", {
        method: "POST",
        body: payload,
      });

      const data = (await response.json()) as CreateFacultyResult;

      if (!response.ok) {
        setCreateError(data.error ?? "Failed to send faculty invite");
        setIsCreating(false);
        return;
      }

      const invitedEmail = data.user?.email ?? input.email;
      setCreateSuccess(`Faculty account created and invitation sent to ${invitedEmail}.`);
      form.reset({
        firstName: "",
        middleName: "",
        lastName: "",
        email: "",
        programId: "",
      });
      setProfileImageFile(null);
      setProfileImageInputKey((v) => v + 1);

      if (onFacultyCreated) {
        onFacultyCreated();
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-amber-500/30 bg-[#2a060a]/95 p-6 shadow-2xl shadow-black/60">
        <div className="flex items-center justify-between pb-4 mb-6 border-b border-amber-500/20">
          <h3 className="text-xl font-bold text-[#fff8e7] tracking-tight">
            Add Faculty Account
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-amber-400/80 hover:text-amber-300 hover:bg-amber-500/10 border border-transparent hover:border-amber-500/30 transition-all cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <CreateFacultyPanel
          createError={createError}
          createSuccess={createSuccess}
          form={form}
          isCreating={isCreating}
          onAddFaculty={handleAddFaculty}
          onProfileImageChange={setProfileImageFile}
          profileImageFile={profileImageFile}
          profileImageInputKey={profileImageInputKey}
        />
      </div>
    </div>
  );
}
