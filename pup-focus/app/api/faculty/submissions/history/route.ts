export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import {
  DEFAULT_REQUIREMENTS,
  type RequirementCode,
} from "@/config/compliance";
import { logger } from "@/lib/observability/logger";

type HistoryStatus = "Pending" | "Validated" | "Rejected";

type HistorySubmission = {
  id: string;
  academicYear: string;
  semester: "1st Semester" | "2nd Semester";
  requirementCode: RequirementCode;
  status: HistoryStatus;
  submittedAt: string;
  note?: string;
  remarks?: string;
  reviewedAt?: string;
};

type ReviewDecision = {
  decision: "validated" | "rejected";
  remarks?: string | null;
  created_at?: string | null;
};

type SubmissionRow = {
  id: string;
  requirement_code: string;
  status: string | null;
  submitted_at?: string | null;
  created_at?: string | null;
  remarks?: string | null;
};

function toAcademicYearAndSemester(dateInput: string | null | undefined): {
  academicYear: string;
  semester: "1st Semester" | "2nd Semester";
} {
  const sourceDate = dateInput ? new Date(dateInput) : new Date();
  const date = Number.isNaN(sourceDate.getTime()) ? new Date() : sourceDate;

  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  const startsSchoolYear = month >= 6;

  return {
    academicYear: startsSchoolYear
      ? `${year}-${year + 1}`
      : `${year - 1}-${year}`,
    semester: startsSchoolYear ? "1st Semester" : "2nd Semester",
  };
}

function toHistoryStatus(
  submissionStatus: string | null,
  latestReview?: ReviewDecision,
): HistoryStatus {
  if (
    latestReview?.decision === "validated" ||
    submissionStatus === "validated"
  ) {
    return "Validated";
  }

  if (
    latestReview?.decision === "rejected" ||
    submissionStatus === "rejected"
  ) {
    return "Rejected";
  }

  return "Pending";
}

export async function GET() {
  try {
    // 1. Authenticate user
    const sessionClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized - not authenticated" },
        { status: 401 },
      );
    }

    const supabase = getServiceRoleClient();

    // 2. Resolve faculty profile_id
    const { data: appUser, error: appUserError } = await supabase
      .from("app_users")
      .select("profile_id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (appUserError || !appUser?.profile_id) {
      logger.warn("history_faculty_profile_missing", { authUserId: user.id });
      return NextResponse.json(
        {
          submissions: [],
          total: 0,
          message: "Faculty profile not found",
        },
        { status: 200 },
      );
    }

    const facultyProfileId = appUser.profile_id;

    // 3. Query all submission records for this faculty member (separate query without relational joins)
    let rawSubmissions: SubmissionRow[] = [];
    const { data: subData, error: subError } = await supabase
      .from("submissions")
      .select("id, requirement_code, status, submitted_at, created_at, remarks")
      .eq("faculty_profile_id", facultyProfileId)
      .order("created_at", { ascending: false });

    if (!subError && subData && subData.length > 0) {
      rawSubmissions = subData as SubmissionRow[];
    } else {
      // Fallback query matching user_id or created_by
      const { data: fallbackData } = await supabase
        .from("submissions")
        .select("id, requirement_code, status, submitted_at, created_at, remarks")
        .or(`user_id.eq.${facultyProfileId},created_by.eq.${user.id}`)
        .order("created_at", { ascending: false });
      if (fallbackData) {
        rawSubmissions = fallbackData as SubmissionRow[];
      }
    }

    const submissionIds = rawSubmissions.map((s) => s.id);

    // 4. Query matching review_decisions separately
    const reviewDecisionsMap = new Map<string, ReviewDecision[]>();
    if (submissionIds.length > 0) {
      const { data: decisions } = await supabase
        .from("review_decisions")
        .select("submission_id, decision, remarks, created_at")
        .in("submission_id", submissionIds)
        .order("created_at", { ascending: false });

      if (decisions) {
        for (const d of decisions) {
          const list = reviewDecisionsMap.get(d.submission_id) || [];
          list.push({
            decision: d.decision as "validated" | "rejected",
            remarks: d.remarks,
            created_at: d.created_at,
          });
          reviewDecisionsMap.set(d.submission_id, list);
        }
      }
    }

    // 5. Map and attach decisions to each submission item
    const history: HistorySubmission[] = [];
    for (const row of rawSubmissions) {
      if (!row || !row.requirement_code) continue;

      const reviews = reviewDecisionsMap.get(row.id) || [];
      const latestReview = reviews[0];
      const term = toAcademicYearAndSemester(row.submitted_at || row.created_at);

      history.push({
        id: row.id,
        academicYear: term.academicYear,
        semester: term.semester,
        requirementCode: row.requirement_code as RequirementCode,
        status: toHistoryStatus(row.status, latestReview),
        submittedAt:
          row.submitted_at || row.created_at || new Date().toISOString(),
        note: typeof row.remarks === "string" ? row.remarks : undefined,
        remarks: latestReview?.remarks || undefined,
        reviewedAt: latestReview?.created_at
          ? new Date(latestReview.created_at).toISOString().split("T")[0]
          : undefined,
      });
    }

    return NextResponse.json({
      submissions: history,
      total: history.length,
    });
  } catch (error) {
    logger.error("submission_history_endpoint_error", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      {
        submissions: [],
        total: 0,
        message: "Internal server error handled gracefully",
      },
      { status: 200 },
    );
  }
}
