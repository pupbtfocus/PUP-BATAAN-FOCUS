"use client";

import { useEffect, useState, useId, useRef } from "react";
import type { UseFormReturn } from "react-hook-form";
import {
  Calendar,
  CheckCircle,
  ClockRotateRight,
  EditPencil,
  Hourglass,
  UserPlus,
  WarningTriangle,
  Xmark,
} from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";
import { ModalHeader } from "@/components/ui/modal-header";
import { AlertPopup } from "@/components/ui/alert-popup";
import { createClient } from "@/lib/supabase/client";
import { DEFAULT_REQUIREMENTS, REQUIREMENT_LABEL } from "@/config/compliance";
import type { FacultyAccountFormInput } from "@/features/faculty-management/schemas/faculty-account.schema";
import { SubmissionScheduleLogsModal } from "@/features/faculty-management/components/submission-schedule-logs-modal";

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

export interface OnboardingScheduleItem {
  code: string;
  title: string;
  description?: string | null;
  globalDeadlineIso: string;
  globalDeadlineDate: string;
  globalDeadlineTime: string;
}

export interface OnboardingCheckResult {
  hasPastDeadlines: boolean;
  hasPastSchedule?: boolean;
  hasAnyScheduleHistory?: boolean;
  isWindowActive?: boolean;
  isWindowOpen?: boolean;
  windowStatus?: "Open" | "Upcoming" | "Closed";
  activeTerm?: { academicYear: string; semester: string } | null;
  globalDeadline?: { endDate: string; endTime?: string; iso: string } | null;
  schedules: OnboardingScheduleItem[];
  templates?: OnboardingScheduleItem[];
}

export interface OnboardingOptionsPayload {
  onboardingOption: "grace_period" | "custom_deadlines" | "exempt" | "standard";
  gracePeriodIso?: string;
  customDeadlines?: Record<string, string>;
}

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
  onAddFaculty: (input: FacultyAccountFormInput, onboardingPayload?: OnboardingOptionsPayload) => void;
  isCreating: boolean;
  createError: string | null;
  createSuccess: string | null;
  profileImageFile: File | null;
  onProfileImageChange: (file: File | null) => void;
  profileImageInputKey: number;
  wrapperClassName?: string;
  formClassName?: string;
  step?: "form" | "onboarding";
  onStepChange?: (step: "form" | "onboarding") => void;
  isOpen?: boolean;
  onOpenScheduleLogs?: () => void;
  onClose?: () => void;
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
  step: controlledStep,
  onStepChange,
  isOpen,
  onOpenScheduleLogs,
  onClose,
}: AddFacultyPanelProps) {
  const [degreePrograms, setDegreePrograms] = useState<ProgramOption[]>([]);
  const [diplomaCourses, setDiplomaCourses] = useState<ProgramOption[]>([]);
  const [isLoadingPrograms, setIsLoadingPrograms] = useState(true);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [dismissedError, setDismissedError] = useState<string | null>(null);
  const [dismissedSuccess, setDismissedSuccess] = useState<string | null>(null);
  const photoInputId = useId();

  const firstNameInputRef = useRef<HTMLInputElement | null>(null);
  const emailInputRef = useRef<HTMLInputElement | null>(null);

  // Onboarding workflow state
  const [internalStep, setInternalStep] = useState<"form" | "onboarding">("form");
  const currentStep = controlledStep ?? internalStep;
  const setStep = (s: "form" | "onboarding") => {
    setInternalStep(s);
    onStepChange?.(s);
  };

  const [onboardingData, setOnboardingData] = useState<OnboardingCheckResult | null>(null);
  const [isLoadingOnboarding, setIsLoadingOnboarding] = useState(true);
  const [pendingFormInput, setPendingFormInput] = useState<FacultyAccountFormInput | null>(null);
  const [selectedOption, setSelectedOption] = useState<"grace_period" | "custom_deadlines" | "standard">("grace_period");
  const [gracePresetDays, setGracePresetDays] = useState<number>(7);
  const [customGraceDate, setCustomGraceDate] = useState<string>("");
  const [customPerScheduleDeadlines, setCustomPerScheduleDeadlines] = useState<Record<string, { date: string; time: string }>>({});
  const [hasAppliedOptions, setHasAppliedOptions] = useState(false);
  const [hasUserSelectedOption, setHasUserSelectedOption] = useState(false);

  const hasPastDeadlines = Boolean(onboardingData?.hasPastDeadlines);
  const hasAnyScheduleHistory = Boolean(onboardingData?.hasAnyScheduleHistory);

  useEffect(() => {
    if (onboardingData && !hasAppliedOptions && !hasUserSelectedOption) {
      if (!onboardingData.hasAnyScheduleHistory) {
        setSelectedOption("standard");
      } else if (onboardingData.hasPastDeadlines) {
        setSelectedOption("grace_period");
      } else {
        setSelectedOption("standard");
      }
    }
  }, [onboardingData, hasAppliedOptions, hasUserSelectedOption]);

  useEffect(() => {
    if (!isOpen) {
      setHasAppliedOptions(false);
      setHasUserSelectedOption(false);
      setInternalStep("form");
      setPendingFormInput(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (createSuccess) {
      setHasAppliedOptions(false);
      setHasUserSelectedOption(false);
      setInternalStep("form");
      setPendingFormInput(null);
    }
  }, [createSuccess]);

  // Check completion of all required fields
  const watchedFirstName = form.watch("firstName");
  const watchedLastName = form.watch("lastName");
  const watchedProgramId = form.watch("programId");
  const watchedEmail = form.watch("email");

  const isEmailValid = Boolean(
    watchedEmail &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(watchedEmail.trim())
  );

  const areAllRequiredFieldsFilled = Boolean(
    watchedFirstName?.trim() &&
    watchedLastName?.trim() &&
    watchedProgramId?.trim() &&
    isEmailValid
  );

  const canSubmit = areAllRequiredFieldsFilled;

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

  // Check onboarding past deadlines for active term
  useEffect(() => {
    let isMounted = true;
    if (!isOpen) return;

    async function checkOnboardingSchedules() {
      setIsLoadingOnboarding(true);
      try {
        const res = await fetch(`/api/staff/faculty/onboarding-check?_t=${Date.now()}`, {
          cache: "no-store",
          credentials: "include",
        });
        if (res.ok && isMounted) {
          const data = (await res.json()) as OnboardingCheckResult;
          setOnboardingData(data);
          setSelectedOption((prev) => {
            if (hasAppliedOptions) return prev;
            if (!data.hasAnyScheduleHistory) {
              return "standard";
            } else if (data.hasPastDeadlines) {
              return "grace_period";
            } else {
              return "standard";
            }
          });

          // Precompute default 7-day grace date
          const d = new Date();
          d.setDate(d.getDate() + 7);
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const dd = String(d.getDate()).padStart(2, "0");
          const defaultDateStr = `${yyyy}-${mm}-${dd}`;
          setCustomGraceDate((prev) => prev || defaultDateStr);

          // Initialize custom per-schedule map
          const initialMap: Record<string, { date: string; time: string }> = {};
          (data.schedules || []).forEach((sched) => {
            initialMap[sched.code] = { date: defaultDateStr, time: "23:59" };
          });
          setCustomPerScheduleDeadlines(initialMap);
        } else {
          // Fallback to checking /api/staff/submission-window directly
          const winRes = await fetch(`/api/staff/submission-window?_t=${Date.now()}`);
          if (winRes.ok && isMounted) {
            const winData = await winRes.json();
            if (winData.status === "Closed" || !winData.isOpen) {
              const fallbackSchedules = DEFAULT_REQUIREMENTS.map((code) => ({
                code,
                title: REQUIREMENT_LABEL[code] || code,
                globalDeadlineDate: winData.endDate || new Date().toISOString().split("T")[0],
                globalDeadlineTime: winData.endTime || "11:59 PM",
                globalDeadlineIso: `${winData.endDate || new Date().toISOString().split("T")[0]}T23:59:59+08:00`,
              }));
              const hasPastFallback = Boolean(
                winData.endDate &&
                  new Date(
                    `${winData.endDate}T${winData.endTime || "23:59:59"}`,
                  ).getTime() < Date.now(),
              );
              const hasAnyHistory = Boolean(winData.endDate);
              setOnboardingData({
                hasPastDeadlines: true,
                hasPastSchedule: hasPastFallback,
                hasAnyScheduleHistory: hasAnyHistory,
                activeTerm: {
                  academicYear: winData.academicYear || "2026-2027",
                  semester: winData.semester || "1st Semester",
                },
                globalDeadline: {
                  endDate: winData.endDate || new Date().toISOString().split("T")[0],
                  endTime: winData.endTime || "11:59 PM",
                  iso: `${winData.endDate || new Date().toISOString().split("T")[0]}T23:59:59+08:00`,
                },
                schedules: fallbackSchedules,
              });
              setSelectedOption((prev) => {
                if (hasAppliedOptions) return prev;
                if (!hasAnyHistory) {
                  return "standard";
                } else if (hasPastFallback) {
                  return "grace_period";
                } else {
                  return "standard";
                }
              });
            }
          }
        }
      } catch {
        // Fallback
      } finally {
        if (isMounted) {
          setIsLoadingOnboarding(false);
        }
      }
    }

    void checkOnboardingSchedules();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

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
          const cleanedPrograms = rawPrograms.filter(
            (p) => !REDUNDANT_CODES.has(p.code),
          );

          setDegreePrograms(
            cleanedPrograms
              .filter((p) => !p.code.startsWith("D"))
              .map((p) => ({
                id: p.id,
                code: p.code,
                name:
                  DEFAULT_DEGREE_PROGRAMS.find((dp) => dp.code === p.code)?.name ??
                  p.name,
              })),
          );

          setDiplomaCourses(
            cleanedPrograms
              .filter((p) => p.code.startsWith("D"))
              .map((p) => ({
                id: p.id,
                code: p.code,
                name:
                  DEFAULT_DIPLOMA_COURSES.find((dp) => dp.code === p.code)?.name ??
                  p.name,
              })),
          );
        }
      } catch (err) {
        console.error("Error loading programs:", err);
        if (isMounted) {
          setDegreePrograms(
            DEFAULT_DEGREE_PROGRAMS.map((p) => ({
              id: p.code,
              code: p.code,
              name: p.name,
            })),
          );
          setDiplomaCourses(
            DEFAULT_DIPLOMA_COURSES.map((p) => ({
              id: p.code,
              code: p.code,
              name: p.name,
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

  const handleFormSubmit = async (values: FacultyAccountFormInput) => {
    onAddFaculty(values);
  };

  const handleApplyOptions = () => {
    setHasAppliedOptions(true);

    const currentValues = form.getValues();
    const isFormFullyComplete = Boolean(
      currentValues.firstName?.trim() &&
      currentValues.lastName?.trim() &&
      currentValues.programId?.trim() &&
      currentValues.email?.trim() &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(currentValues.email.trim())
    );

    // Only submit immediately if the user already submitted the form and all required fields (including programId) are present!
    if (pendingFormInput && isFormFullyComplete) {
      let gracePeriodIso = "";
      if (selectedOption === "grace_period") {
        let targetDate = customGraceDate;
        if (!targetDate) {
          const d = new Date();
          d.setDate(d.getDate() + (gracePresetDays || 7));
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const dd = String(d.getDate()).padStart(2, "0");
          targetDate = `${yyyy}-${mm}-${dd}`;
        }
        gracePeriodIso = `${targetDate}T23:59:59+08:00`;
      }

      const customDeadlinesFormatted: Record<string, string> = {};
      if (selectedOption === "custom_deadlines") {
        Object.entries(customPerScheduleDeadlines).forEach(([code, val]) => {
          if (val.date) {
            customDeadlinesFormatted[code] = `${val.date}T${val.time || "23:59"}:00+08:00`;
          }
        });
      }

      onAddFaculty(currentValues, {
        onboardingOption: selectedOption,
        gracePeriodIso: gracePeriodIso || undefined,
        customDeadlines: selectedOption === "custom_deadlines" ? customDeadlinesFormatted : undefined,
      });
      return;
    }

    setStep("form");

    // Direct focus to the first missing field
    setTimeout(() => {
      if (!currentValues.firstName?.trim()) {
        firstNameInputRef.current?.focus();
      } else if (!currentValues.programId?.trim()) {
        const progEl = document.getElementById("programId");
        progEl?.focus();
      } else if (!currentValues.email?.trim()) {
        emailInputRef.current?.focus();
      } else {
        firstNameInputRef.current?.focus();
      }
    }, 60);
  };

  const [nameAlert, setNameAlert] = useState<string | null>(null);

  const handleNameInput = (
    field: "firstName" | "middleName" | "lastName",
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const raw = e.target.value;
    if (/[^a-zA-Z\sñÑ]/.test(raw)) {
      setNameAlert("Cannot use numbers or special characters in name");
      form.setError(field, {
        type: "manual",
        message: "Cannot use numbers or special characters in name",
      });
    } else {
      if (nameAlert === "Cannot use numbers or special characters in name") {
        setNameAlert(null);
      }
      form.clearErrors(field);
    }
    const clean = raw.replace(/[^a-zA-Z\sñÑ]/g, "");
    e.target.value = clean;
    form.setValue(field, clean, { shouldValidate: true });
  };

  return (
    <div className={wrapperClassName ?? "flex flex-1 flex-col overflow-hidden min-h-0 w-full"}>
      <form
        className={`flex flex-1 flex-col overflow-hidden min-h-0 w-full ${formClassName ?? ""}`}
        onSubmit={form.handleSubmit(handleFormSubmit)}
      >
          {/* Scrollable Body Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            <AlertPopup
              type="warning"
              message={nameAlert}
              position="inline"
              autoCloseMs={3500}
              onClose={() => setNameAlert(null)}
            />
            <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 block" htmlFor="firstName">
                First Name <span className="text-red-500">*</span>
              </label>
              <input
                id="firstName"
                placeholder="e.g. Juan"
                className="mt-1.5 w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-slate-900 dark:focus:border-slate-100 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl px-4 py-2.5 text-sm outline-none transition-all focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-100/10"
                {...form.register("firstName", {
                  onChange: (e) => handleNameInput("firstName", e),
                })}
                ref={(el) => {
                  form.register("firstName", {
                    onChange: (e) => handleNameInput("firstName", e),
                  }).ref(el);
                  firstNameInputRef.current = el;
                }}
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
                {...form.register("middleName", {
                  onChange: (e) => handleNameInput("middleName", e),
                })}
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
                {...form.register("lastName", {
                  onChange: (e) => handleNameInput("lastName", e),
                })}
              />
              <FieldError message={form.formState.errors.lastName?.message} />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 block" htmlFor="programId">
              Department / Program <span className="text-red-500">*</span>
            </label>
            <select
              id="programId"
              className="mt-1.5 w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-slate-900 dark:focus:border-slate-100 text-slate-900 dark:text-slate-100 rounded-xl px-4 py-2.5 text-sm outline-none transition-all focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-100/10 cursor-pointer disabled:opacity-50"
              disabled={isLoadingPrograms}
              {...form.register("programId")}
            >
              <option value="">
                {isLoadingPrograms ? "Loading programs..." : "Select Department / Program"}
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
              ref={(el) => {
                form.register("email").ref(el);
                emailInputRef.current = el;
              }}
            />
            <FieldError message={form.formState.errors.email?.message} />
          </div>

            <button
              className={`py-2.5 px-6 rounded-xl transition-all shadow-md text-xs tracking-wide font-bold ${
                !canSubmit || isCreating || isLoadingPrograms
                  ? "bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-300 dark:border-slate-700"
                  : "bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer active:scale-[0.99]"
              }`}
              type="submit"
              disabled={!canSubmit || isCreating || isLoadingPrograms}
            >
              {isCreating
                ? "Creating Faculty Account..."
                : !areAllRequiredFieldsFilled
                ? "Fill All Required Fields"
                : "Create Faculty Account"}
            </button>
          </div>
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
  const [modalStep, setModalStep] = useState<"form" | "onboarding">("form");
  const [scheduleLogsOpen, setScheduleLogsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setModalStep("form");
      setScheduleLogsOpen(false);
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="w-full max-w-3xl sm:max-w-4xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl text-slate-900 dark:text-slate-100 max-h-[85vh] flex flex-col overflow-hidden">
          <ModalHeader
            icon={UserPlus}
            title="Add Faculty Account"
            subtitle="Create credentials and assign department permissions"
            onClose={onClose}
            className="rounded-t-2xl shrink-0"
          >
            <button
              type="button"
              onClick={() => setScheduleLogsOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 border border-amber-500 font-bold text-xs transition shadow-xs cursor-pointer active:scale-95"
              title="View Submission Schedule Logs"
            >
              <AppIcon icon={ClockRotateRight} size="xs" color="inherit" className="text-slate-950" />
              <span className="hidden sm:inline">Schedule Logs</span>
            </button>
          </ModalHeader>

          <AddFacultyPanel
            {...panelProps}
            isOpen={isOpen}
            step={modalStep}
            onStepChange={setModalStep}
            onOpenScheduleLogs={() => setScheduleLogsOpen(true)}
            onClose={onClose}
          />
        </div>
      </div>

      <SubmissionScheduleLogsModal
        isOpen={scheduleLogsOpen}
        onClose={() => setScheduleLogsOpen(false)}
      />
    </>
  );
}
