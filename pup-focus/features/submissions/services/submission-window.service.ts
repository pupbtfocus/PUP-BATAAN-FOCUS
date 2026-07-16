import type { SupabaseClient } from "@supabase/supabase-js";

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
  isOpen: boolean;
  today: string;
  currentTime: string;
  startDate: string | null;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  academicYear: string | null;
  semester: SubmissionWindowSemester | null;
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
): Promise<SubmissionWindowConfig | null> {
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
    };
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
): SubmissionWindowState {
  if (!config) {
    return {
      isConfigured: false,
      isOpen: false,
      today,
      currentTime,
      startDate: null,
      endDate: null,
      startTime: null,
      endTime: null,
      academicYear: null,
      semester: null,
    };
  }

  const nowDateTime = `${today}T${currentTime}`;
  const startDateTime = `${config.startDate}T${normalizeTime24Hour(config.startTime)}`;
  const endDateTime = `${config.endDate}T${normalizeTime24Hour(config.endTime)}`;
  const isOpen = nowDateTime >= startDateTime && nowDateTime <= endDateTime;

  return {
    isConfigured: true,
    isOpen,
    today,
    currentTime,
    startDate: config.startDate,
    endDate: config.endDate,
    startTime: config.startTime,
    endTime: config.endTime,
    academicYear: config.academicYear ?? null,
    semester: config.semester ?? null,
  };
}
