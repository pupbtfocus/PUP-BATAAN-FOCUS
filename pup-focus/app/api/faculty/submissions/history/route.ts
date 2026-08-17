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
  admin_remarks?: string;
  adminRemarks?: string;
  feedback?: string;
  reviewedAt?: string;
  is_read?: boolean;
  isViewed?: boolean;
  viewed_at?: string;
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
  admin_remarks?: string | null;
  is_read?: boolean | null;
  viewed_at?: string | null;
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

    // 3. Query ALL historical submission records for this faculty member
    let rawSubmissions: (SubmissionRow & { faculty_assignment_id?: string | null })[] = [];
    const { data: subData, error: subError } = await supabase
      .from("submissions")
      .select("id, requirement_code, status, submitted_at, created_at, remarks, admin_remarks, is_read, viewed_at, faculty_assignment_id")
      .or(`faculty_profile_id.eq.${facultyProfileId},user_id.eq.${facultyProfileId},created_by.eq.${user.id}`)
      .order("created_at", { ascending: false });

    if (!subError && subData) {
      rawSubmissions = subData as (SubmissionRow & { faculty_assignment_id?: string | null })[];
    } else {
      const { data: fallbackData } = await supabase
        .from("submissions")
        .select("id, requirement_code, status, submitted_at, created_at, remarks, faculty_assignment_id")
        .eq("faculty_profile_id", facultyProfileId)
        .order("created_at", { ascending: false });
      if (fallbackData) {
        rawSubmissions = fallbackData as (SubmissionRow & { faculty_assignment_id?: string | null })[];
      }
    }

    const { data: assignments } = await supabase
      .from("faculty_program_assignments")
      .select("id, academic_year, term")
      .eq("faculty_profile_id", facultyProfileId);

    const assignmentMap = new Map<string, { academicYear: string; semester: "1st Semester" | "2nd Semester" }>();
    if (assignments) {
      for (const a of assignments) {
        if (a.id) {
          assignmentMap.set(a.id, {
            academicYear: a.academic_year,
            semester: (a.term?.toLowerCase().includes("2nd") ? "2nd Semester" : "1st Semester") as "1st Semester" | "2nd Semester",
          });
        }
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

      try {
        const { data: vHistory } = await supabase
          .from("verification_history")
          .select("submission_id, decision, status, remarks, created_at")
          .in("submission_id", submissionIds)
          .order("created_at", { ascending: false });

        if (vHistory) {
          for (const v of vHistory) {
            const list = reviewDecisionsMap.get(v.submission_id) || [];
            const dec = (v.decision || v.status || "validated").toLowerCase() as "validated" | "rejected";
            list.push({
              decision: dec === "rejected" ? "rejected" : "validated",
              remarks: v.remarks,
              created_at: v.created_at,
            });
            reviewDecisionsMap.set(v.submission_id, list);
          }
        }
      } catch {
        // verification_history optional
      }
    }

    // 5. Map and attach decisions to each submission item
    const history: HistorySubmission[] = [];
    for (const row of rawSubmissions) {
      if (!row || !row.requirement_code) continue;

      const reviews = reviewDecisionsMap.get(row.id) || [];
      const sortedReviews = [...reviews].sort((a, b) => {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return timeB - timeA;
      });
      const latestReviewWithRemarks = sortedReviews.find(
        (r) => r.remarks && r.remarks.trim() !== "",
      );
      const latestReview = sortedReviews[0];

      let term = assignmentMap.get(row.faculty_assignment_id || "");

      if (!term && (row.submitted_at || row.created_at)) {
        const subTime = new Date(row.submitted_at || row.created_at || "").getTime();
        const winStartFallback = new Date("2026-08-05T00:00:00+08:00").getTime();
        if (!isNaN(subTime) && subTime >= winStartFallback) {
          term = { academicYear: "2026-2027", semester: "2nd Semester" };
        }
      }

      if (!term) {
        term = toAcademicYearAndSemester(row.submitted_at || row.created_at);
      }

      // Faculty's own note attached during submission
      const facultyNote =
        typeof row.remarks === "string" && row.remarks.trim() ? row.remarks.trim() : undefined;

      // Admin's review remarks from the latest review_decisions entry with non-empty remarks or latest review
      const adminFeedback =
        latestReviewWithRemarks?.remarks?.trim() ||
        latestReview?.remarks?.trim() ||
        (row as { admin_remarks?: string }).admin_remarks?.trim() ||
        undefined;

      history.push({
        id: row.id,
        academicYear: term.academicYear,
        semester: term.semester,
        requirementCode: row.requirement_code as RequirementCode,
        status: toHistoryStatus(row.status, latestReview),
        submittedAt:
          row.submitted_at || row.created_at || new Date().toISOString(),
        note: facultyNote,
        remarks: adminFeedback,
        admin_remarks: adminFeedback,
        adminRemarks: adminFeedback,
        feedback: adminFeedback,
        reviewedAt: (latestReviewWithRemarks || latestReview)?.created_at
          ? new Date((latestReviewWithRemarks || latestReview)!.created_at!).toISOString().split("T")[0]
          : undefined,
        is_read: Boolean(row.is_read),
        isViewed: Boolean(row.is_read),
        viewed_at: row.viewed_at || undefined,
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
