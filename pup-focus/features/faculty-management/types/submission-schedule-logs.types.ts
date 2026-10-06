export type SubmissionScheduleLogEntry = {
  id: string;
  action_type:
    | "SCHEDULE_UPDATE"
    | "SCHEDULE_CLOSE"
    | "EXTENSION"
    | "FACULTY_ONBOARDING"
    | "FACULTY_OVERRIDE";
  action_label: string;
  created_at: string;
  extended_by?: string | null;
  extended_by_name: string;
  actor_name: string;
  academic_year?: string | null;
  semester?: string | null;
  start_date?: string | null;
  start_time?: string | null;
  old_end_date?: string | null;
  old_end_time?: string | null;
  new_end_date: string;
  new_end_time: string;
  scope: "global" | "program" | "faculty";
  scope_target?: string | null;
  reason: string;
  reason_details?: string | null;
  extension_preset?: string | null;
  notified_faculty: boolean;
};
