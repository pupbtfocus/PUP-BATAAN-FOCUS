import type { SupabaseClient } from "@supabase/supabase-js";

type SubmissionWindowRow = {
  start_date: string;
  end_date: string;
};

export type SubmissionWindowConfig = {
  startDate: string;
  endDate: string;
};

export type SubmissionWindowState = {
  isConfigured: boolean;
  isOpen: boolean;
  today: string;
  startDate: string | null;
  endDate: string | null;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateInput(value: string): boolean {
  return DATE_PATTERN.test(value);
}

export function getTodayInManila(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
  }).format(new Date());
}

export function validateSubmissionWindow(startDate: string, endDate: string) {
  if (!isValidDateInput(startDate) || !isValidDateInput(endDate)) {
    return {
      isValid: false,
      error: "Dates must be in YYYY-MM-DD format.",
    };
  }

  if (startDate > endDate) {
    return {
      isValid: false,
      error: "Start date cannot be later than end date.",
    };
  }

  return { isValid: true as const };
}

export async function getSubmissionWindow(
  supabase: SupabaseClient,
): Promise<SubmissionWindowConfig | null> {
  const { data } = await supabase
    .from("submission_windows")
    .select("start_date, end_date")
    .eq("id", 1)
    .maybeSingle<SubmissionWindowRow>();

  if (!data) {
    return null;
  }

  return {
    startDate: data.start_date,
    endDate: data.end_date,
  };
}

export function evaluateSubmissionWindow(
  config: SubmissionWindowConfig | null,
  today = getTodayInManila(),
): SubmissionWindowState {
  if (!config) {
    return {
      isConfigured: false,
      isOpen: true,
      today,
      startDate: null,
      endDate: null,
    };
  }

  const isOpen = today >= config.startDate && today <= config.endDate;

  return {
    isConfigured: true,
    isOpen,
    today,
    startDate: config.startDate,
    endDate: config.endDate,
  };
}
