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
  const [selectedOption, setSelectedOption] = useState<"grace_period" | "custom_deadlines" | "exempt" | "standard">("grace_period");
  const [gracePresetDays, setGracePresetDays] = useState<number>(7);
  const [customGraceDate, setCustomGraceDate] = useState<string>("");
  const [customPerScheduleDeadlines, setCustomPerScheduleDeadlines] = useState<Record<string, { date: string; time: string }>>({});
  const [hasAppliedOptions, setHasAppliedOptions] = useState(false);

  const hasPastDeadlines = Boolean(onboardingData?.hasPastDeadlines);

  useEffect(() => {
    if (onboardingData) {
      if (!onboardingData.hasPastDeadlines) {
        setSelectedOption("standard");
      } else if (selectedOption === "standard" && !hasAppliedOptions) {
        setSelectedOption("grace_period");
      }
    }
  }, [onboardingData]);

  useEffect(() => {
    if (isOpen) {
      setHasAppliedOptions(false);
      if (onboardingData && !onboardingData.hasPastDeadlines) {
        setSelectedOption("standard");
      }
    }
  }, [isOpen, onboardingData]);

  useEffect(() => {
    if (createSuccess) {
      setHasAppliedOptions(false);
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

  const areOptionsSatisfied = onboardingData?.hasPastDeadlines
    ? hasAppliedOptions
    : true;

  const canSubmit = areAllRequiredFieldsFilled && areOptionsSatisfied;

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

    async function checkOnboardingSchedules() {
      setIsLoadingOnboarding(true);
      try {
        const res = await fetch(`/api/admin/faculty/onboarding-check?_t=${Date.now()}`, {
          cache: "no-store",
          credentials: "include",
        });
        if (res.ok && isMounted) {
          const data = (await res.json()) as OnboardingCheckResult;
          setOnboardingData(data);
          if (!data.hasPastDeadlines) {
            setSelectedOption("standard");
          } else {
            setSelectedOption("grace_period");
          }

          // Precompute default 7-day grace date
          const d = new Date();
          d.setDate(d.getDate() + 7);
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const dd = String(d.getDate()).padStart(2, "0");
          const defaultDateStr = `${yyyy}-${mm}-${dd}`;
          setCustomGraceDate(defaultDateStr);

          // Initialize custom per-schedule map
          const initialMap: Record<string, { date: string; time: string }> = {};
          (data.schedules || []).forEach((sched) => {
            initialMap[sched.code] = { date: defaultDateStr, time: "23:59" };
          });
          setCustomPerScheduleDeadlines(initialMap);
        } else {
          // Fallback to checking /api/admin/submission-window directly
          const winRes = await fetch(`/api/admin/submission-window?_t=${Date.now()}`);
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
              setOnboardingData({
                hasPastDeadlines: true,
                hasPastSchedule: hasPastFallback,
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
              if (!hasPastFallback) {
                setSelectedOption("standard");
              } else {
                setSelectedOption("grace_period");
              }
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
  }, [controlledStep, isOpen]);

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
    // If past deadlines exist or submissions are closed
    if (onboardingData?.hasPastDeadlines && onboardingData.schedules.length > 0) {
      if (!hasAppliedOptions) {
        setPendingFormInput(values);
        setStep("onboarding");
        return;
      }

      // Compute onboarding payload from the applied options
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

      onAddFaculty(values, {
        onboardingOption: selectedOption,
        gracePeriodIso: gracePeriodIso || undefined,
        customDeadlines: selectedOption === "custom_deadlines" ? customDeadlinesFormatted : undefined,
      });
      return;
    }

    // Double-check live status in case schedule was recently closed or initial check was pending
    try {
      const res = await fetch(`/api/admin/faculty/onboarding-check?_t=${Date.now()}`, {
        cache: "no-store",
        credentials: "include",
      });
      if (res.ok) {
        const fresh = (await res.json()) as OnboardingCheckResult;
        if (fresh?.hasPastDeadlines && fresh.schedules?.length > 0) {
          setOnboardingData(fresh);
          setSelectedOption((prev) => (prev === "standard" ? "grace_period" : prev));
          setPendingFormInput(values);
          setStep("onboarding");
          return;
        }
      }
    } catch {
      // Proceed to direct add if check fails
    }

    onAddFaculty(values);
  };

  const handleApplyOptions = () => {
    setHasAppliedOptions(true);
    setStep("form");

    // Direct focus to input field for name (or email if name already provided)
    setTimeout(() => {
      const currentValues = form.getValues();
      if (!currentValues.firstName?.trim()) {
        firstNameInputRef.current?.focus();
      } else if (!currentValues.email?.trim()) {
        emailInputRef.current?.focus();
      } else {
        firstNameInputRef.current?.focus();
      }
    }, 60);
  };

  return (
    <div className={wrapperClassName ?? "flex flex-col w-full"}>
      {currentStep === "onboarding" && onboardingData ? (
        /* ================= ONBOARDING OPTIONS SCREEN ================= */
        <div className="flex flex-col gap-4">
          {/* Notice Banner - Solid Amber Background */}
          <div className="rounded-xl border-2 border-amber-500 dark:border-amber-500/70 bg-amber-400 dark:bg-[#2a1705] p-4 space-y-1.5 shadow-sm">
            <div className="flex items-center gap-2">
              <AppIcon icon={WarningTriangle} size="md" color="inherit" className="text-amber-950 dark:text-amber-300" />
              <span className="font-bold text-sm text-slate-950 dark:text-amber-100">
                Submissions Are Closed
              </span>
            </div>
            <p className="text-xs text-amber-950/90 dark:text-amber-200/90 leading-relaxed font-medium">
              Regular submissions for <span className="font-bold text-slate-950 dark:text-amber-100">{onboardingData.activeTerm?.academicYear} • {onboardingData.activeTerm?.semester}</span> have ended. Select how to handle the deadline for this new faculty member:
            </p>
            <div className="pt-1 flex items-center justify-start">
              <button
                type="button"
                onClick={() => onOpenScheduleLogs?.()}
                className="py-1.5 px-3 rounded-lg bg-white hover:bg-amber-50 text-slate-950 border border-amber-500/60 font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-[0.99]"
              >
                <AppIcon icon={ClockRotateRight} size="xs" color="inherit" />
                <span>View Submission Schedule Logs</span>
              </button>
            </div>
          </div>

          {/* Options Cards */}
          <div className="space-y-3">
            {/* Option A: Give Extra Time */}
            <div
              onClick={() => setSelectedOption("grace_period")}
              className={`rounded-xl border p-4 transition-all space-y-3 cursor-pointer ${
                selectedOption === "grace_period"
                  ? "border-2 border-amber-500 bg-white dark:bg-slate-900 ring-2 ring-amber-500/20"
                  : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:border-slate-300"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    checked={selectedOption === "grace_period"}
                    onChange={() => setSelectedOption("grace_period")}
                    className="mt-1 accent-amber-500 cursor-pointer"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                        Give Extra Time
                      </span>
                      <span className="text-[10px] uppercase font-bold bg-amber-500/20 text-amber-900 dark:text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/40">
                        Recommended
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                      Grant extra days to submit requirements starting today for this new faculty member.
                    </p>
                  </div>
                </div>
              </div>

              {selectedOption === "grace_period" && (
                <div className="pl-7 pt-1 space-y-2 border-t border-amber-200 dark:border-amber-900/40 mt-2">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                    Select extra days:
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    {[7, 14, 30].map((days) => (
                      <button
                        type="button"
                        key={days}
                        onClick={(e) => {
                          e.stopPropagation();
                          setGracePresetDays(days);
                          const d = new Date();
                          d.setDate(d.getDate() + days);
                          const yyyy = d.getFullYear();
                          const mm = String(d.getMonth() + 1).padStart(2, "0");
                          const dd = String(d.getDate()).padStart(2, "0");
                          setCustomGraceDate(`${yyyy}-${mm}-${dd}`);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                          gracePresetDays === days
                            ? "bg-amber-500 text-slate-950 font-bold shadow-xs"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                        }`}
                      >
                        +{days} Days
                      </button>
                    ))}
                    <div className="flex items-center gap-1.5 sm:ml-auto">
                      <span className="text-xs text-slate-500">Pick date:</span>
                      <input
                        type="date"
                        value={customGraceDate}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          setCustomGraceDate(e.target.value);
                          setGracePresetDays(0);
                        }}
                        className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                    Personal deadline: {customGraceDate || "7 days from today"} at 11:59 PM Manila time.
                  </p>
                </div>
              )}
            </div>

            {/* Option B: Follow Standard Schedule */}
            <div
              onClick={() => setSelectedOption("standard")}
              className={`rounded-xl border p-4 transition-all cursor-pointer ${
                selectedOption === "standard"
                  ? "border-2 border-amber-500 bg-white dark:bg-slate-900 ring-2 ring-amber-500/20"
                  : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:border-slate-300"
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  checked={selectedOption === "standard"}
                  onChange={() => setSelectedOption("standard")}
                  className="mt-1 accent-amber-500 cursor-pointer"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                      Follow Standard Schedule
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                    Apply the standard deadline for this new faculty member. Uploads remain locked until a new window or extension is granted.
                  </p>
                </div>
              </div>
            </div>

            {/* Option C: Mark as Not Required */}
            <div
              onClick={() => setSelectedOption("exempt")}
              className={`rounded-xl border p-4 transition-all cursor-pointer ${
                selectedOption === "exempt"
                  ? "border-2 border-amber-500 bg-white dark:bg-slate-900 ring-2 ring-amber-500/20"
                  : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:border-slate-300"
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  checked={selectedOption === "exempt"}
                  onChange={() => setSelectedOption("exempt")}
                  className="mt-1 accent-amber-500 cursor-pointer"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                      Mark as Not Required
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                    No submissions will be required for this new faculty member this term. This will not affect their compliance score.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <AlertPopup
            type="error"
            message={createError !== dismissedError ? createError : null}
            position="inline"
            onClose={() => setDismissedError(createError)}
          />

          <AlertPopup
            type="success"
            message={createSuccess !== dismissedSuccess ? createSuccess : null}
            position="inline"
            onClose={() => setDismissedSuccess(createSuccess)}
          />

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setStep("form")}
              className="px-5 py-2.5 rounded-xl border border-[#5e0000] bg-[#780000] hover:bg-[#5e0000] text-white text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-[0.98]"
            >
              ← Back
            </button>

            <button
              type="button"
              onClick={handleApplyOptions}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-6 py-2.5 rounded-xl text-xs shadow-md transition cursor-pointer active:scale-[0.98]"
            >
              Apply
            </button>
          </div>
        </div>
      ) : (
        /* ================= REGULAR FORM SCREEN ================= */
        <form
          className={`flex flex-1 w-full flex-col gap-4 ${formClassName ?? ""}`}
          onSubmit={form.handleSubmit(handleFormSubmit)}
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
                ref={(el) => {
                  form.register("firstName").ref(el);
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

          {/* Onboarding Policy Options Banner & Action Button */}
          {onboardingData?.hasPastDeadlines ? (
            <div className="rounded-xl border-2 border-amber-500 dark:border-amber-500/70 bg-amber-400 dark:bg-[#2a1705] p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AppIcon icon={WarningTriangle} size="sm" color="inherit" className="text-amber-950 dark:text-amber-300" />
                  <span className="font-bold text-xs text-slate-950 dark:text-amber-100">
                    Submissions are closed
                  </span>
                </div>
                <span
                  className={`text-[10px] uppercase font-black px-2.5 py-0.5 rounded-full border shadow-2xs ${
                    hasAppliedOptions
                      ? "bg-emerald-600 text-white border-emerald-700"
                      : "bg-white text-amber-950 border-amber-500/60"
                  }`}
                >
                  {hasAppliedOptions
                    ? selectedOption === "grace_period"
                      ? `Give Extra Time (+${gracePresetDays || 7}d)`
                      : selectedOption === "standard"
                      ? "Follow Standard Schedule"
                      : selectedOption === "exempt"
                      ? "Mark as Not Required"
                      : "Custom Deadlines"
                    : "Select Option First"}
                </span>
              </div>
              <p className="text-xs text-amber-950/90 dark:text-amber-200/90 leading-relaxed font-medium">
                {hasAppliedOptions
                  ? "Submission deadline option chosen and ready to apply."
                  : "Submissions are closed right now. Pick how to handle requirements for this faculty member before adding."}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenScheduleLogs?.()}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-white hover:bg-amber-50 text-slate-950 border border-amber-500/60 font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-[0.99]"
                >
                  <AppIcon icon={ClockRotateRight} size="xs" color="inherit" />
                  <span>Schedule Logs</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const values = form.getValues();
                    setPendingFormInput(values);
                    setStep("onboarding");
                  }}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-600/50 font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-[0.99]"
                >
                  <span>{hasAppliedOptions ? "Change Options →" : "Set Deadline Option →"}</span>
                </button>
              </div>
            </div>
          ) : onboardingData?.schedules && onboardingData.schedules.length > 0 ? (
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/20 p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Submission Window Open
                </span>
                <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-400">
                  Due: {onboardingData.globalDeadline?.endDate}
                </span>
              </div>
              <p className="text-[11px] text-emerald-800/90 dark:text-emerald-300/80">
                All {onboardingData.schedules.length} requirement templates will be automatically assigned to this faculty member.
              </p>
            </div>
          ) : null}

          <AlertPopup
            type="error"
            message={createError !== dismissedError ? createError : null}
            position="inline"
            onClose={() => setDismissedError(createError)}
          />

          <AlertPopup
            type="success"
            message={createSuccess !== dismissedSuccess ? createSuccess : null}
            position="inline"
            onClose={() => setDismissedSuccess(createSuccess)}
          />

          {areAllRequiredFieldsFilled && !areOptionsSatisfied ? (
            <button
              type="button"
              onClick={() => {
                const values = form.getValues();
                setPendingFormInput(values);
                setStep("onboarding");
              }}
              className="mt-2 w-full py-3 rounded-xl transition-all shadow-md text-sm tracking-wide font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer active:scale-[0.99] flex items-center justify-center gap-2"
            >
              <span>Set Submission Deadline →</span>
            </button>
          ) : (
            <button
              className={`mt-2 w-full py-3 rounded-xl transition-all shadow-md text-sm tracking-wide font-bold ${
                !canSubmit
                  ? "bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-300 dark:border-slate-700"
                  : "bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer active:scale-[0.99]"
              }`}
              type="submit"
              disabled={!canSubmit || isCreating || isLoadingPrograms || isLoadingOnboarding}
            >
              {isCreating
                ? "Creating Faculty Account..."
                : isLoadingOnboarding
                ? "Checking schedule..."
                : !areAllRequiredFieldsFilled
                ? "Fill All Required Fields"
                : "Create Faculty Account"}
            </button>
          )}
        </form>
      )}
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
        <div className="w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl text-slate-900 dark:text-slate-100 max-h-[92vh] overflow-y-auto">
          <ModalHeader
            icon={modalStep === "onboarding" ? Hourglass : UserPlus}
            title={modalStep === "onboarding" ? "Set Submission Deadline" : "Add Faculty Account"}
            subtitle={
              modalStep === "onboarding"
                ? "Choose a deadline option for this new faculty member."
                : "Create credentials and assign department permissions"
            }
            onClose={onClose}
            className="-mx-6 -mt-6 mb-6 rounded-t-2xl"
          >
            <button
              type="button"
              onClick={() => setScheduleLogsOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-amber-50 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-900 dark:text-slate-100 border border-amber-500/60 text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95"
              title="View Submission Schedule Logs"
            >
              <AppIcon icon={ClockRotateRight} size="xs" color="inherit" className="text-amber-600 dark:text-amber-400" />
              <span className="hidden sm:inline">Schedule Logs</span>
            </button>
          </ModalHeader>

          <AddFacultyPanel
            {...panelProps}
            isOpen={isOpen}
            step={modalStep}
            onStepChange={setModalStep}
            onOpenScheduleLogs={() => setScheduleLogsOpen(true)}
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
