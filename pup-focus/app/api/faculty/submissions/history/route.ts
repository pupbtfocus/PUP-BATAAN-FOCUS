export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import {
  REQUIREMENT_CODE,
  type RequirementCode,
} from "@/config/compliance";
import { logger } from "@/lib/observability/logger";

type HistoryStatus = "Pending" | "Validated" | "Rejected";

type HistorySubmission = {
  id: string;
  academicYear: string;
  semester: "1st Semester" | "2nd Semester";
  requirementCode: RequirementCode | string;
  status: HistoryStatus;
  submittedAt: string;
  updatedAt?: string;
  dateValidated?: string;
  note?: string;
  remarks?: string;
  admin_remarks?: string;
  adminRemarks?: string;
  feedback?: string;
  fileName?: string;
  storagePath?: string;
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
  updated_at?: string | null;
  created_at?: string | null;
  remarks?: string | null;
  admin_remarks?: string | null;
  notes?: string | null;
  is_read?: boolean | null;
  viewed_at?: string | null;
  file_name?: string | null;
  storage_path?: string | null;
  file_path?: string | null;
  faculty_assignment_id?: string | null;
};

function normalizeRequirementCode(rawCode?: string | null): RequirementCode | string {
  if (!rawCode) return "document";
  const s = rawCode.toLowerCase().trim().replace(/[-_\s]+/g, "");
  if (s.includes("gradesheet") || s.includes("grade")) return REQUIREMENT_CODE.GRADE_SHEET;
  if (s.includes("syllabus") || s.includes("enhancedsyllabus")) return REQUIREMENT_CODE.ENHANCED_SYLLABUS;
  if (s.includes("orientation") || s.includes("classorientation")) return REQUIREMENT_CODE.CLASS_ORIENTATION;
  if (s.includes("midterm") || s.includes("midtermpackage")) return REQUIREMENT_CODE.MIDTERM_PACKAGE;
  if (s.includes("final") || s.includes("finalpackage")) return REQUIREMENT_CODE.FINAL_PACKAGE;
  if (s.includes("classrecord") || s.includes("records") || s.includes("classrecords")) return REQUIREMENT_CODE.CLASS_RECORDS;
  return rawCode;
}

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
  const norm = (submissionStatus || "").toLowerCase();
  if (
    latestReview?.decision === "validated" ||
    norm === "validated" ||
    norm === "approved" ||
    norm === "compliant"
  ) {
    return "Validated";
  }

  if (
    latestReview?.decision === "rejected" ||
    norm === "rejected" ||
    norm === "returned" ||
    norm === "needs_revision" ||
    norm === "revision_required"
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
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError || !profile?.id) {
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

    const facultyIds = Array.from(new Set([user.id, profile.id]));

    // 3. Query ONLY validated/approved submission records for this faculty member
    let rawSubmissions: SubmissionRow[] = [];
    try {
      const { data: subData, error: subError } = await supabase
        .from("submissions")
        .select(
          "id, requirement_code, status, remarks, admin_remarks, submitted_at, updated_at, created_at, is_read, viewed_at, faculty_assignment_id, storage_path, file_path",
        )
        .or(
          `faculty_profile_id.in.(${facultyIds.join(",")}),user_id.in.(${facultyIds.join(",")}),created_by.in.(${facultyIds.join(",")})`,
        )
        .in("status", ["validated", "approved"])
        .order("updated_at", { ascending: false });

      if (!subError && subData) {
        rawSubmissions = subData as SubmissionRow[];
      } else {
        const { data: fallbackData } = await supabase
          .from("submissions")
          .select(
            "id, requirement_code, status, remarks, admin_remarks, submitted_at, updated_at, created_at, faculty_assignment_id",
          )
          .in("faculty_profile_id", facultyIds)
          .in("status", ["validated", "approved"])
          .order("updated_at", { ascending: false });
        if (fallbackData) {
          rawSubmissions = fallbackData as SubmissionRow[];
        }
      }
    } catch (queryErr) {
      logger.error("history_submissions_query_failed", {
        error: queryErr instanceof Error ? queryErr.message : String(queryErr),
      });
    }

    // Program assignments term mapping
    const { data: assignments } = await supabase
      .from("faculty_program_assignments")
      .select("id, academic_year, term")
      .in("faculty_profile_id", facultyIds);

    const assignmentMap = new Map<
      string,
      { academicYear: string; semester: "1st Semester" | "2nd Semester" }
    >();
    if (assignments) {
      for (const a of assignments) {
        if (a.id) {
          assignmentMap.set(a.id, {
            academicYear: a.academic_year,
            semester: (a.term?.toLowerCase().includes("2nd")
              ? "2nd Semester"
              : "1st Semester") as "1st Semester" | "2nd Semester",
          });
        }
      }
    }

    const submissionIds = rawSubmissions.map((s) => s.id);

    // 4. Query matching review_decisions and document_versions
    const docVersionsMap = new Map<
      string,
      { storage_path?: string; mime_type?: string }
    >();
    const reviewDecisionsMap = new Map<string, ReviewDecision[]>();

    if (submissionIds.length > 0) {
      const { data: docVersions } = await supabase
        .from("document_versions")
        .select("submission_id, storage_path, mime_type")
        .in("submission_id", submissionIds)
        .order("version_number", { ascending: false });

      if (docVersions) {
        for (const doc of docVersions) {
          if (!docVersionsMap.has(doc.submission_id)) {
            docVersionsMap.set(doc.submission_id, {
              storage_path: doc.storage_path,
              mime_type: doc.mime_type,
            });
          }
        }
      }

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
            const dec = (v.decision || v.status || "validated").toLowerCase() as
              | "validated"
              | "rejected";
            list.push({
              decision: dec === "rejected" ? "rejected" : "validated",
              remarks: v.remarks,
              created_at: v.created_at,
            });
            reviewDecisionsMap.set(v.submission_id, list);
          }
        }
      } catch {
        // verification_history is optional
      }
    }

    // 5. Map and attach decisions to each submission item
    const history: HistorySubmission[] = [];
    for (const row of rawSubmissions) {
      if (!row || !row.requirement_code) continue;

      const normCode = normalizeRequirementCode(row.requirement_code);

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
        const subTime = new Date(
          row.submitted_at || row.created_at || "",
        ).getTime();
        const winStartFallback = new Date(
          "2026-08-05T00:00:00+08:00",
        ).getTime();
        if (!isNaN(subTime) && subTime >= winStartFallback) {
          term = { academicYear: "2026-2027", semester: "2nd Semester" };
        }
      }

      if (!term) {
        term = toAcademicYearAndSemester(row.submitted_at || row.created_at);
      }

      // Review feedback resolution from decisions or submission records
      const adminFeedback =
        latestReviewWithRemarks?.remarks?.trim() ||
        latestReview?.remarks?.trim() ||
        row.admin_remarks?.trim() ||
        (row.status === "validated" ||
        row.status === "approved" ||
        row.status === "rejected" ||
        row.status === "returned" ||
        row.status === "needs_revision"
          ? row.remarks?.trim()
          : undefined) ||
        undefined;

      const facultyNote =
        (row as { notes?: string }).notes?.trim() ||
        (typeof row.remarks === "string" && row.remarks.trim() ? row.remarks.trim() : undefined);

      const doc = docVersionsMap.get(row.id);
      const storagePath = doc?.storage_path || row.storage_path || row.file_path;
      const fileName = storagePath ? storagePath.split("/").pop() : undefined;

      const dateValidated =
        (latestReviewWithRemarks || latestReview)?.created_at ||
        row.updated_at ||
        row.submitted_at ||
        row.created_at ||
        new Date().toISOString();

      history.push({
        id: row.id,
        academicYear: term.academicYear,
        semester: term.semester,
        requirementCode: normCode,
        status: "Validated",
        submittedAt:
          row.submitted_at || row.created_at || new Date().toISOString(),
        updatedAt: row.updated_at || undefined,
        dateValidated: dateValidated,
        note: facultyNote,
        remarks: facultyNote || adminFeedback,
        admin_remarks: adminFeedback,
        adminRemarks: adminFeedback,
        feedback: adminFeedback,
        fileName: fileName || undefined,
        storagePath: storagePath || undefined,
        reviewedAt: (latestReviewWithRemarks || latestReview)?.created_at
          ? new Date((latestReviewWithRemarks || latestReview)!.created_at!)
              .toISOString()
              .split("T")[0]
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
