import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_REQUIREMENTS, REQUIREMENT_LABEL } from "@/config/compliance";

const SEMESTER_OPTIONS = ["1st Semester", "2nd Semester"] as const;

type SubmissionWindowRow = {
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  academic_year?: string | null;
  semester?: string | null;
};

type SubmissionWindowLegacyRow = {
  start_date: string;
  end_date: string;
};

export type SubmissionWindowSemester = (typeof SEMESTER_OPTIONS)[number];

export type SubmissionWindowConfig = {
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  academicYear?: string;
  semester?: SubmissionWindowSemester;
};

export type SubmissionWindowState = {
  isConfigured: boolean;
  status: "Upcoming" | "Open" | "Closed";
  isOpen: boolean;
  today: string;
  currentTime: string;
  startDate: string | null;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  academicYear: string | null;
  semester: SubmissionWindowSemester | null;
  startTimeLabel?: string | null;
  endTimeLabel?: string | null;
  currentTimeLabel?: string | null;
  isGracePeriod?: boolean;
  isPersonalDeadline?: boolean;
  badgeLabel?: string | null;
  effectiveDeadline?: string | null;
  formattedDueAt?: string | null;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_24H_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const TIME_12H_PATTERN = /^(0?[1-9]|1[0-2]):([0-5]\d)\s?(AM|PM)$/i;
const DEFAULT_START_TIME = "09:00:00";
const DEFAULT_END_TIME = "17:00:00";

export function isValidDateInput(value: string): boolean {
  return DATE_PATTERN.test(value);
}

export function isValid24HourTimeInput(value: string): boolean {
  return TIME_24H_PATTERN.test(value);
}

export function isValid12HourTimeInput(value: string): boolean {
  return TIME_12H_PATTERN.test(value.trim());
}

export function isMissingSubmissionWindowColumnsError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const possibleCode = (error as { code?: unknown }).code;
  const possibleMessage = (error as { message?: unknown }).message;
  const possibleDetails = (error as { details?: unknown }).details;
  const possibleHint = (error as { hint?: unknown }).hint;
  const code = typeof possibleCode === "string" ? possibleCode : "";
  const message =
    typeof possibleMessage === "string" ? possibleMessage.toLowerCase() : "";
  const details =
    typeof possibleDetails === "string" ? possibleDetails.toLowerCase() : "";
  const hint =
    typeof possibleHint === "string" ? possibleHint.toLowerCase() : "";
  const combinedText = `${message} ${details} ${hint}`;

  return (
    code === "42703" ||
    code === "PGRST204" ||
    combinedText.includes("start_time") ||
    combinedText.includes("end_time") ||
    combinedText.includes("academic_year") ||
    combinedText.includes("semester") ||
    combinedText.includes("schema cache")
  );
}

export function convert12HourTo24Hour(value: string): string {
  const normalized = value.trim().toUpperCase();
  const match = normalized.match(TIME_12H_PATTERN);
  if (!match) {
    return "";
  }

  const hourRaw = match[1];
  const minuteRaw = match[2];
  const period = match[3];
  let hour = Number(hourRaw);
  const minute = Number(minuteRaw);

  if (period === "AM") {
    if (hour === 12) {
      hour = 0;
    }
  } else if (hour !== 12) {
    hour += 12;
  }

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
}

export function format24HourTo12Hour(value: string): string {
  const normalized = normalizeTime24Hour(value);
  if (!normalized) {
    return value;
  }

  const [hourText, minuteText] = normalized.split(":");
  const hour = Number(hourText);
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;

  return `${hour12}:${minuteText} ${period}`;
}

export function normalizeTime24Hour(value: string): string {
  if (!isValid24HourTimeInput(value)) {
    return "";
  }

  const [hourText, minuteText] = value.split(":");
  return `${hourText}:${minuteText}:00`;
}

export function getTodayInManila(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
  }).format(new Date());
}

export function getCurrentTimeInManila(): string {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Manila",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return formatter.format(new Date());
}

export function isValidAcademicYear(value: string): boolean {
  const match = value.trim().match(/^([0-9]{4})-([0-9]{4})$/);
  if (!match) {
    return false;
  }

  const start = Number(match[1]);
  const end = Number(match[2]);
  return end === start + 1;
}

export function getCurrentYearInManila(): number {
  const yearText = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
  }).format(new Date());
  return Number(yearText);
}

export function buildAcademicYearOptions(): string[] {
  const currentYear = getCurrentYearInManila();
  const firstYear = 2026;
  const lastYear = Math.max(currentYear, firstYear);
  return Array.from({ length: lastYear - firstYear + 1 }, (_, index) => {
    const startYear = firstYear + index;
    return `${startYear}-${startYear + 1}`;
  });
}

export function isAllowedAcademicYear(value: string): boolean {
  if (!isValidAcademicYear(value)) {
    return false;
  }

  const match = value.trim().match(/^([0-9]{4})-([0-9]{4})$/);
  if (!match) {
    return false;
  }

  const startYear = Number(match[1]);
  const firstYear = 2026;
  const currentYear = getCurrentYearInManila();
  const lastYear = Math.max(currentYear, firstYear);

  return startYear >= firstYear && startYear <= lastYear;
}

export function normalizeSemester(
  value: string | null | undefined,
): SubmissionWindowSemester {
  if (!value) {
    return "1st Semester";
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "2nd semester" || normalized === "second semester") {
    return "2nd Semester";
  }

  return "1st Semester";
}

export function isValidSemester(value: string): boolean {
  return SEMESTER_OPTIONS.includes(value as SubmissionWindowSemester);
}

export function validateSubmissionWindow(
  startDate: string,
  endDate: string,
  startTime12h: string,
  endTime12h: string,
  academicYear?: string,
  semester?: string,
) {
  if (!isValidDateInput(startDate) || !isValidDateInput(endDate)) {
    return {
      isValid: false,
      error: "Dates must be in YYYY-MM-DD format.",
    };
  }

  if (
    !isValid12HourTimeInput(startTime12h) ||
    !isValid12HourTimeInput(endTime12h)
  ) {
    return {
      isValid: false,
      error: "Times must be in h:mm AM/PM format.",
    };
  }

  if (!academicYear || !isValidAcademicYear(academicYear)) {
    return {
      isValid: false,
      error: "Academic year must be in YYYY-YYYY format.",
    };
  }

  if (!semester || !isValidSemester(semester)) {
    return {
      isValid: false,
      error: "Semester must be either 1st Semester or 2nd Semester.",
    };
  }

  if (startDate > endDate) {
    return {
      isValid: false,
      error: "Start date cannot be later than end date.",
    };
  }

  const startTime = convert12HourTo24Hour(startTime12h);
  const endTime = convert12HourTo24Hour(endTime12h);
  const startDateTime = `${startDate}T${startTime}`;
  const endDateTime = `${endDate}T${endTime}`;

  if (startDateTime > endDateTime) {
    return {
      isValid: false,
      error: "Start date/time cannot be later than end date/time.",
    };
  }

  return { isValid: true as const };
}

export async function getSubmissionWindow(
  supabase: SupabaseClient,
  targetTerm?: { academicYear?: string | null; semester?: string | null } | null,
): Promise<SubmissionWindowConfig | null> {
  // If targetTerm is not explicitly provided, resolve the currently active academic term
  let resolvedTerm = targetTerm;
  if (!resolvedTerm || !resolvedTerm.academicYear || !resolvedTerm.semester) {
    try {
      const { data: termRows } = await supabase
        .from("academic_terms")
        .select("academic_year, semester, status")
        .order("academic_year", { ascending: false });

      if (Array.isArray(termRows) && termRows.length > 0) {
        const found = termRows.find(
          (t) => (t.status || "").trim().toLowerCase() === "current",
        );
        const currentTerm = found || termRows[0];
        if (currentTerm?.academic_year && currentTerm?.semester) {
          resolvedTerm = {
            academicYear: currentTerm.academic_year.trim(),
            semester: normalizeSemester(currentTerm.semester),
          };
        }
      }
    } catch {
      // In case academic_terms table is temporarily inaccessible
    }
  }

  const { data, error } = await supabase
    .from("submission_windows")
    .select(
      "start_date, end_date, start_time, end_time, academic_year, semester",
    )
    .eq("id", 1)
    .maybeSingle<SubmissionWindowRow>();

  if (error) {
    if (!isMissingSubmissionWindowColumnsError(error)) {
      return null;
    }

    const { data: timeData, error: timeError } = await supabase
      .from("submission_windows")
      .select("start_date, end_date, start_time, end_time")
      .eq("id", 1)
      .maybeSingle<SubmissionWindowRow>();

    if (!timeError && timeData) {
      if (
        !isValidDateInput(timeData.start_date) ||
        !isValidDateInput(timeData.end_date) ||
        !isValid24HourTimeInput(timeData.start_time) ||
        !isValid24HourTimeInput(timeData.end_time)
      ) {
        return null;
      }

      return {
        startDate: timeData.start_date,
        endDate: timeData.end_date,
        startTime: normalizeTime24Hour(timeData.start_time),
        endTime: normalizeTime24Hour(timeData.end_time),
        academicYear: resolvedTerm?.academicYear ?? undefined,
        semester: resolvedTerm?.semester
          ? normalizeSemester(resolvedTerm.semester)
          : undefined,
      };
    }

    const { data: legacyData, error: legacyError } = await supabase
      .from("submission_windows")
      .select("start_date, end_date")
      .eq("id", 1)
      .maybeSingle<SubmissionWindowLegacyRow>();

    if (legacyError || !legacyData) {
      return null;
    }

    if (
      !isValidDateInput(legacyData.start_date) ||
      !isValidDateInput(legacyData.end_date)
    ) {
      return null;
    }

    return {
      startDate: legacyData.start_date,
      endDate: legacyData.end_date,
      startTime: DEFAULT_START_TIME,
      endTime: DEFAULT_END_TIME,
      academicYear: resolvedTerm?.academicYear ?? undefined,
      semester: resolvedTerm?.semester
        ? normalizeSemester(resolvedTerm.semester)
        : undefined,
    };
  }

  // If a specific/active term is expected, enforce that the schedule strictly belongs to that term
  if (resolvedTerm?.academicYear && resolvedTerm?.semester) {
    const targetAY = resolvedTerm.academicYear.trim();
    const targetSem = normalizeSemester(resolvedTerm.semester);

    // If no window is configured in submission_windows (e.g. deleted/closed), return null
    if (!data) {
      return null;
    }

    const matchesActiveTerm =
      data.academic_year === targetAY &&
      normalizeSemester(data.semester) === targetSem;

    if (matchesActiveTerm) {
      if (
        !isValidDateInput(data.start_date) ||
        !isValidDateInput(data.end_date) ||
        !isValid24HourTimeInput(data.start_time) ||
        !isValid24HourTimeInput(data.end_time)
      ) {
        return null;
      }

      return {
        startDate: data.start_date,
        endDate: data.end_date,
        startTime: normalizeTime24Hour(data.start_time),
        endTime: normalizeTime24Hour(data.end_time),
        academicYear: data.academic_year ?? undefined,
        semester: normalizeSemester(data.semester),
      };
    }

    // If submission_windows id=1 belongs to a different term, check submission_window_terms
    try {
      const { data: termData, error: termError } = await supabase
        .from("submission_window_terms")
        .select("start_date, end_date, start_time, end_time, academic_year, semester")
        .eq("academic_year", targetAY)
        .eq("semester", targetSem)
        .maybeSingle();

      if (!termError && termData && termData.start_date && termData.end_date) {
        const startTime = termData.start_time || "09:00:00";
        const endTime = termData.end_time || "17:00:00";
        const startTime24 = isValid12HourTimeInput(startTime)
          ? convert12HourTo24Hour(startTime)
          : normalizeTime24Hour(startTime) || "09:00:00";
        const endTime24 = isValid12HourTimeInput(endTime)
          ? convert12HourTo24Hour(endTime)
          : normalizeTime24Hour(endTime) || "17:00:00";

        // Mirror this term's schedule to submission_windows id=1
        await supabase.from("submission_windows").upsert(
          {
            id: 1,
            start_date: termData.start_date,
            end_date: termData.end_date,
            start_time: startTime24,
            end_time: endTime24,
            academic_year: targetAY,
            semester: targetSem,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" },
        );

        return {
          startDate: termData.start_date,
          endDate: termData.end_date,
          startTime: startTime24,
          endTime: endTime24,
          academicYear: targetAY,
          semester: targetSem,
        };
      }
    } catch {
      // In case submission_window_terms query fails
    }

    // Active term has no schedule configured yet
    return null;
  }

  if (!data) {
    return null;
  }

  if (
    !isValidDateInput(data.start_date) ||
    !isValidDateInput(data.end_date) ||
    !isValid24HourTimeInput(data.start_time) ||
    !isValid24HourTimeInput(data.end_time)
  ) {
    return null;
  }

  return {
    startDate: data.start_date,
    endDate: data.end_date,
    startTime: normalizeTime24Hour(data.start_time),
    endTime: normalizeTime24Hour(data.end_time),
    academicYear:
      data.academic_year && isValidAcademicYear(data.academic_year)
        ? data.academic_year
        : undefined,
    semester:
      data.semester && isValidSemester(data.semester)
        ? normalizeSemester(data.semester)
        : undefined,
  };
}

export function evaluateSubmissionWindow(
  config: SubmissionWindowConfig | null,
  today = getTodayInManila(),
  currentTime = getCurrentTimeInManila(),
  activeTerm?: { academicYear?: string | null; semester?: string | null } | null,
): SubmissionWindowState {
  if (activeTerm?.academicYear && activeTerm?.semester && config) {
    const activeAY = activeTerm.academicYear.trim();
    const activeSem = normalizeSemester(activeTerm.semester);
    if (
      config.academicYear &&
      config.semester &&
      (config.academicYear.trim() !== activeAY ||
        normalizeSemester(config.semester) !== activeSem)
    ) {
      // Config does not belong to the active academic term
      return {
        isConfigured: false,
        status: "Closed",
        isOpen: false,
        today,
        currentTime,
        startDate: null,
        endDate: null,
        startTime: null,
        endTime: null,
        academicYear: activeAY,
        semester: activeSem,
      };
    }
  }

  if (!config) {
    return {
      isConfigured: false,
      status: "Closed",
      isOpen: false,
      today,
      currentTime,
      startDate: null,
      endDate: null,
      startTime: null,
      endTime: null,
      academicYear: activeTerm?.academicYear ?? null,
      semester: activeTerm?.semester ? normalizeSemester(activeTerm.semester) : null,
    };
  }

  const nowDateTime = `${today}T${currentTime}`;
  const startDateTime = `${config.startDate}T${normalizeTime24Hour(config.startTime)}`;
  const endDateTime = `${config.endDate}T${normalizeTime24Hour(config.endTime)}`;
  const isOpen = nowDateTime >= startDateTime && nowDateTime <= endDateTime;
  const status =
    nowDateTime < startDateTime ? "Upcoming" : isOpen ? "Open" : "Closed";

  return {
    isConfigured: true,
    status,
    isOpen,
    today,
    currentTime,
    startDate: config.startDate,
    endDate: config.endDate,
    startTime: config.startTime,
    endTime: config.endTime,
    academicYear: config.academicYear ?? activeTerm?.academicYear ?? null,
    semester: config.semester ?? (activeTerm?.semester ? normalizeSemester(activeTerm.semester) : null),
  };
}

// ---------------------------------------------------------------------------
// Submission origin classification
//
// `submissions` has no dedicated origin column, so the origin is stored as a
// structured tag at the start of `remarks`:  "[origin:NEW_FACULTY_GRACE] detail".
// Always read it through `parseSubmissionOrigin` instead of searching text.
// ---------------------------------------------------------------------------

export const SUBMISSION_ORIGINS = [
  "STANDARD",
  "NEW_FACULTY",
  "NEW_FACULTY_GRACE",
  "NEW_FACULTY_CUSTOM",
  "NEW_FACULTY_STANDARD",
  "EXEMPTED",
  "EXTENDED",
] as const;

export type SubmissionOrigin = (typeof SUBMISSION_ORIGINS)[number];

const ORIGIN_TAG_PATTERN = /^\[origin:([A-Z_]+)\]\s*/;

export function buildOriginRemarks(
  origin: SubmissionOrigin,
  detail?: string | null,
): string {
  const tag = `[origin:${origin}]`;
  return detail ? `${tag} ${detail}` : tag;
}

// Exact prefixes written by earlier versions of the app (before origin tags).
const LEGACY_REMARK_ORIGINS: ReadonlyArray<[string, SubmissionOrigin]> = [
  ["Initialized with 7-day onboarding grace period", "NEW_FACULTY_GRACE"],
  ["Initialized with custom onboarding deadline", "NEW_FACULTY_CUSTOM"],
  ["Exempted during new faculty onboarding", "EXEMPTED"],
  ["Standard registration (no personal schedule set)", "NEW_FACULTY_STANDARD"],
  ["Extension granted (", "EXTENDED"],
];

export function parseSubmissionOrigin(
  remarks: string | null | undefined,
): SubmissionOrigin | null {
  if (!remarks) {
    return null;
  }

  const match = remarks.match(ORIGIN_TAG_PATTERN);
  if (match) {
    const candidate = match[1] as SubmissionOrigin;
    return SUBMISSION_ORIGINS.includes(candidate) ? candidate : null;
  }

  const legacy = LEGACY_REMARK_ORIGINS.find(([prefix]) =>
    remarks.startsWith(prefix),
  );
  return legacy ? legacy[1] : null;
}

export function isGracePeriodOrigin(origin: SubmissionOrigin | null): boolean {
  return origin === "NEW_FACULTY_GRACE";
}

export function isExemptedOrigin(origin: SubmissionOrigin | null): boolean {
  return origin === "EXEMPTED";
}

export function isStandardOrigin(origin: SubmissionOrigin | null): boolean {
  return (
    origin === "STANDARD" ||
    origin === "NEW_FACULTY_STANDARD" ||
    origin === "NEW_FACULTY"
  );
}

export function isExtendedOrigin(origin: SubmissionOrigin | null): boolean {
  return origin === "EXTENDED";
}

/** Strips the origin tag so only the human-readable detail is shown in the UI. */
export function stripOriginTag(remarks: string | null | undefined): string {
  return (remarks ?? "").replace(ORIGIN_TAG_PATTERN, "").trim();
}

// ---------------------------------------------------------------------------
// Onboarding context (shared by faculty create + onboarding-check)
// ---------------------------------------------------------------------------

export type ActiveRequirementTemplate = {
  code: string;
  title: string;
  description?: string | null;
};

export type GlobalDeadline = {
  endDate: string;
  /** HH:MM:SS (24h) */
  endTime: string;
  /** ISO timestamp with Manila offset */
  iso: string;
};

export type OnboardingContext = {
  term: { academicYear: string; semester: SubmissionWindowSemester };
  windowState: SubmissionWindowState;
  /** True when the window is Open or Upcoming, i.e. submissions are not closed. */
  isWindowActive: boolean;
  deadline: GlobalDeadline;
  templates: ActiveRequirementTemplate[];
  /** True when any submission window schedule has ever been recorded for the active term. */
  hasAnyScheduleHistory: boolean;
};

export function toManilaIso(date: string, time24: string): string {
  return `${date}T${normalizeTime24Hour(time24) || "23:59:59"}+08:00`;
}

function toTime24(value: string | null | undefined): string {
  if (!value) {
    return "";
  }
  const trimmed = value.trim();
  return isValid12HourTimeInput(trimmed)
    ? convert12HourTo24Hour(trimmed)
    : normalizeTime24Hour(trimmed);
}

export function addDaysToDateString(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}

/** `today (Manila) + days`, expressed as 23:59:59 Manila time. */
export function buildGraceDueAtIso(days: number): string {
  return toManilaIso(addDaysToDateString(getTodayInManila(), days), "23:59:59");
}

export function isValidManilaIso(value: string | null | undefined): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(
      value,
    ) &&
    !Number.isNaN(new Date(value).getTime())
  );
}

export async function resolveActiveTerm(
  supabase: SupabaseClient,
): Promise<{ academicYear: string; semester: SubmissionWindowSemester }> {
  try {
    const { data: termRows } = await supabase
      .from("academic_terms")
      .select("academic_year, semester, status")
      .order("academic_year", { ascending: false });

    if (Array.isArray(termRows) && termRows.length > 0) {
      const found = termRows.find((t) => {
        const status = (t.status || "").trim().toLowerCase();
        return status === "current" || status === "active";
      });
      const row = found || termRows[0];
      if (row?.academic_year && row?.semester) {
        return {
          academicYear: row.academic_year.trim(),
          semester: normalizeSemester(row.semester),
        };
      }
    }
  } catch {
    // Fall through to default term
  }

  return { academicYear: "2026-2027", semester: "1st Semester" };
}

export async function getActiveRequirementTemplates(
  supabase: SupabaseClient,
): Promise<ActiveRequirementTemplate[]> {
  try {
    const { data: templates } = await supabase
      .from("requirement_templates")
      .select("code, title, description")
      .eq("is_active", true)
      .order("title", { ascending: true });

    if (Array.isArray(templates) && templates.length > 0) {
      return templates as ActiveRequirementTemplate[];
    }
  } catch {
    // Fall back to defaults
  }

  return DEFAULT_REQUIREMENTS.map((code) => ({
    code,
    title: REQUIREMENT_LABEL[code] || code,
    description: null,
  }));
}

/**
 * Resolves the deadline that applies to everyone for the active term. When
 * submissions are closed this is the *previous* schedule's end; if none was ever
 * recorded it falls back to the current moment.
 */
async function resolveGlobalDeadline(
  supabase: SupabaseClient,
  term: { academicYear: string; semester: string },
  config: SubmissionWindowConfig | null,
  state: SubmissionWindowState,
): Promise<{ deadline: GlobalDeadline; hasAnyScheduleHistory: boolean }> {
  let endDate: string | null = null;
  let endTime = "";
  let hasAnyScheduleHistory = false;

  if (state.status !== "Closed" && (config?.endDate || state.endDate)) {
    endDate = config?.endDate ?? state.endDate;
    endTime = toTime24(config?.endTime ?? state.endTime);
    hasAnyScheduleHistory = true;
  } else {
    try {
      const { data: termWin } = await supabase
        .from("submission_window_terms")
        .select("end_date, end_time")
        .eq("academic_year", term.academicYear)
        .eq("semester", term.semester)
        .maybeSingle();

      if (termWin?.end_date) {
        endDate = termWin.end_date;
        endTime = toTime24(termWin.end_time);
        hasAnyScheduleHistory = true;
      }
    } catch {
      // Table may not exist yet
    }

    if (!endDate) {
      try {
        const { data: globalWin } = await supabase
          .from("submission_windows")
          .select("end_date, end_time, academic_year, semester")
          .eq("id", 1)
          .maybeSingle();

        if (globalWin?.end_date) {
          const matchesTerm =
            !globalWin.academic_year ||
            (globalWin.academic_year === term.academicYear &&
              normalizeSemester(globalWin.semester) === normalizeSemester(term.semester));
          if (matchesTerm) {
            endDate = globalWin.end_date;
            endTime = toTime24(globalWin.end_time);
            hasAnyScheduleHistory = true;
          }
        }
      } catch {
        // Ignore
      }
    }

    if (!endDate && config?.endDate) {
      endDate = config.endDate;
      endTime = toTime24(config.endTime);
      hasAnyScheduleHistory = true;
    }
  }

  if (!endDate) {
    endDate = getTodayInManila();
    endTime = toTime24(getCurrentTimeInManila());
    hasAnyScheduleHistory = false;
  }

  const time24 = endTime || "23:59:59";
  return {
    deadline: { endDate, endTime: time24, iso: toManilaIso(endDate, time24) },
    hasAnyScheduleHistory,
  };
}

export async function resolveOnboardingContext(
  supabase: SupabaseClient,
): Promise<OnboardingContext> {
  const term = await resolveActiveTerm(supabase);
  const config = await getSubmissionWindow(supabase, term);
  const windowState = evaluateSubmissionWindow(
    config,
    undefined,
    undefined,
    term,
  );
  const [{ deadline, hasAnyScheduleHistory }, templates] = await Promise.all([
    resolveGlobalDeadline(supabase, term, config, windowState),
    getActiveRequirementTemplates(supabase),
  ]);

  return {
    term,
    windowState,
    isWindowActive: windowState.status !== "Closed",
    deadline,
    templates,
    hasAnyScheduleHistory,
  };
}

export type FacultyPersonalDeadline = {
  hasPersonalDeadline: boolean;
  effectiveDeadline: string;
  formattedDueAt: string;
  endDate: string;
};

export async function getFacultyPersonalDeadline(
  supabase: SupabaseClient,
  userId: string,
): Promise<FacultyPersonalDeadline | null> {
  try {
    let profileId: string | null = null;
    let authUserId: string | null = null;

    try {
      const { data: p1 } = await supabase
        .from("profiles")
        .select("id, user_id")
        .eq("user_id", userId)
        .maybeSingle();
      if (p1) {
        profileId = p1.id;
        authUserId = p1.user_id;
      }
    } catch {}

    if (!profileId) {
      try {
        const { data: p2 } = await supabase
          .from("profiles")
          .select("id, user_id")
          .eq("id", userId)
          .maybeSingle();
        if (p2) {
          profileId = p2.id;
          authUserId = p2.user_id;
        }
      } catch {}
    }

    const facultyIds = Array.from(
      new Set([userId, profileId, authUserId].filter((x): x is string => Boolean(x))),
    );

    let subs: any[] = [];

    // Query submissions where faculty_profile_id is in facultyIds
    try {
      const { data: profileSubs } = await supabase
        .from("submissions")
        .select("id, status, due_at, requirement_code, submitted_at, faculty_profile_id, remarks, created_at")
        .in("faculty_profile_id", facultyIds);

      if (profileSubs && profileSubs.length > 0) {
        subs.push(...profileSubs);
      }
    } catch {}

    // Also support faculty_id if column exists
    try {
      const anyClient = supabase as any;
      const { data: idSubs } = await anyClient
        .from("submissions")
        .select("id, status, due_at, requirement_code, submitted_at, remarks, created_at")
        .in("faculty_id", facultyIds);

      if (idSubs && idSubs.length > 0) {
        subs.push(...idSubs);
      }
    } catch {}

    // Deduplicate by submission id
    const seenSubIds = new Set<string>();
    subs = subs.filter((s) => {
      if (!s.id || seenSubIds.has(s.id)) return false;
      seenSubIds.add(s.id);
      return true;
    });

    const nowMs = Date.now();
    const futurePending: Array<{ dueIso: string; dueMs: number }> = [];

    if (subs.length > 0) {
      for (const s of subs) {
        const st = (s.status || "").toLowerCase().trim();
        if (st === "validated" || st === "approved" || st === "exempted") {
          continue;
        }

        let dueAtStr = s.due_at;

        // Self-heal: If due_at is null but remarks indicate grace period was granted
        if (!dueAtStr && s.remarks && (s.remarks.includes("NEW_FACULTY_GRACE") || s.remarks.includes("Extra time granted"))) {
          const match = s.remarks.match(/\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2})?/);
          if (match) {
            dueAtStr = match[0].includes("T") ? match[0] : `${match[0]}T23:59:59+08:00`;
          } else if (s.created_at) {
            const createdDate = new Date(s.created_at);
            createdDate.setDate(createdDate.getDate() + 7);
            dueAtStr = createdDate.toISOString();
          }
          if (dueAtStr && s.id) {
            void supabase.from("submissions").update({ due_at: dueAtStr }).eq("id", s.id);
          }
        }

        if (!dueAtStr) continue;

        let dueMs = new Date(dueAtStr).getTime();
        if (Number.isNaN(dueMs)) {
          const iso = dueAtStr.includes("T") ? dueAtStr : `${dueAtStr}T23:59:59+08:00`;
          dueMs = new Date(iso).getTime();
        }

        if (!Number.isNaN(dueMs) && dueMs > nowMs) {
          const iso = dueAtStr.includes("T") ? dueAtStr : `${dueAtStr}T23:59:59+08:00`;
          futurePending.push({ dueIso: iso, dueMs });
        }
      }
    }

    console.log("[DEBUG PERSONAL DEADLINE]", {
      userId,
      facultyIds,
      foundRows: subs.length,
      futurePendingCount: futurePending.length,
    });

    if (futurePending.length === 0) {
      try {
        const { data: extData } = await supabase
          .from("extension_requests")
          .select("approved_extension_date, requested_extension_date, status")
          .in("faculty_user_id", facultyIds)
          .eq("status", "approved");

        if (extData && extData.length > 0) {
          for (const ext of extData) {
            const extDate = ext.approved_extension_date || ext.requested_extension_date;
            if (!extDate) continue;
            let dueMs = new Date(extDate).getTime();
            if (Number.isNaN(dueMs)) {
              const iso = extDate.includes("T") ? extDate : `${extDate}T23:59:59+08:00`;
              dueMs = new Date(iso).getTime();
            }
            if (!Number.isNaN(dueMs) && dueMs > nowMs) {
              const iso = extDate.includes("T") ? extDate : `${extDate}T23:59:59+08:00`;
              futurePending.push({ dueIso: iso, dueMs });
            }
          }
        }
      } catch {}
    }

    if (futurePending.length === 0) {
      return null;
    }

    // Sort to prioritize the upcoming active pending deadline
    futurePending.sort((a, b) => a.dueMs - b.dueMs);
    const target = futurePending[0];
    const targetDate = new Date(target.dueMs);
    const datePart = target.dueIso.split("T")[0];

    const dateStr = targetDate.toLocaleDateString("en-PH", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "Asia/Manila",
    });
    const timeStr = targetDate.toLocaleTimeString("en-PH", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Manila",
    });

    const formattedDueAt = `${dateStr} at ${timeStr}`;

    return {
      hasPersonalDeadline: true,
      effectiveDeadline: target.dueIso,
      formattedDueAt,
      endDate: datePart,
    };
  } catch {
    return null;
  }
}

