import type { RequirementCode } from "@/config/compliance";

export type RequirementStatus = "not_submitted" | "uploaded" | "validated";
export type SemesterOption = "1st Semester" | "2nd Semester";

export type AdminSection =
  | "dashboard"
  | "facultyManagement"
  | "requirements"
  | "submissionWindow"
  | "academicTerms"
  | "details";

export type FacultyProgramInfo = {
  id: string;
  code: string;
  name: string;
};

export type FacultyAccount = {
  id: string;
  fullName: string;
  email: string;
  profileImageUrl: string | null;
  is_active: boolean;
  created_at: string;
  program?: FacultyProgramInfo | null;
  requirementStatus: Record<RequirementCode, RequirementStatus>;
};

export type PendingFacultyAction = {
  kind: "delete" | "deactivate" | "activate";
  facultyId: string;
};

export type CreateFacultyResult = {
  success?: boolean;
  error?: string;
  invited?: boolean;
  sent?: boolean;
  sendError?: string | null;
  link?: string | null;
  user?: {
    email: string;
    fullName: string;
  };
};

export type UsedTerm = {
  academicYear: string;
  semester: SemesterOption;
};

export type DatePartState = {
  year: string;
  month: string;
  day: string;
};

export type TimePartState = {
  hour: string;
  minute: string;
  period: "AM" | "PM" | "";
};

export type SubmissionWindowResponse = {
  isConfigured: boolean;
  status: "Upcoming" | "Open" | "Closed";
  isOpen: boolean;
  today: string;
  currentTime: string;
  startDate: string | null;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  academicYear?: string | null;
  semester?: SemesterOption | null;
  usedTerms?: UsedTerm[];
  startTimeLabel: string | null;
  endTimeLabel: string | null;
  currentTimeLabel: string;
};

export type ApiBody = {
  error?: string;
  details?: string;
};
