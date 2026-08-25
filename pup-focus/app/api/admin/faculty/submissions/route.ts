import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { ROLE } from "@/config/roles";

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
  notes?: string | null;
  admin_remarks?: string | null;
  document_versions?: Array<{
    id: string;
    storage_path: string;
    mime_type?: string | null;
    size_bytes?: number | null;
    created_at?: string | null;
  }> | null;
  review_decisions?: ReviewDecision[] | null;
};

function isMissingRemarksColumnError(
  error: { message?: string } | null,
): boolean {
  const message = (error?.message || "").toLowerCase();
  return message.includes("remarks") && message.includes("submissions");
}

export async function GET(request: NextRequest) {
  try {
    // Verify admin role
    const sessionClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();

    const requesterRole =
      (user?.user_metadata?.role as string | undefined) ??
      (user?.app_metadata?.role as string | undefined);

    if (
      !user ||
      (requesterRole !== ROLE.ADMIN && requesterRole !== ROLE.SUPER_ADMIN)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(request.url);
    const facultyId = url.searchParams.get("facultyId");

    if (!facultyId) {
      return NextResponse.json(
        { error: "facultyId is required" },
        { status: 400 },
      );
    }

    const supabase = getServiceRoleClient();

    // Get faculty profile ID. Accept either profiles.id or profiles.user_id
    const { data: profileRow, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .or(`id.eq.${facultyId},user_id.eq.${facultyId}`)
      .maybeSingle();

    if (profileError || !profileRow?.id) {
      console.error(
        "Faculty profile not found in /api/admin/faculty/submissions:",
        profileError || `No profile for facultyId: ${facultyId}`,
      );
      return NextResponse.json(
        {
          error: "Faculty profile not found",
          details: profileError?.message || "No profile for this faculty",
        },
        { status: 404 },
      );
    }

    const facultyProfileId = profileRow.id;

    const requestedAcademicYear = url.searchParams.get("academicYear")?.trim();
    const requestedSemester = url.searchParams.get("semester")?.trim();

    let targetAcademicYear = requestedAcademicYear;
    let targetSemester = requestedSemester;

    const { data: activeTermRow, error: termError } = await supabase
      .from("academic_terms")
      .select("academic_year, semester, created_at")
      .eq("status", "Current")
      .maybeSingle();

    if (termError) {
      console.error(
        "Failed to fetch active academic term in /api/admin/faculty/submissions:",
        termError,
      );
    }

    if (!targetAcademicYear || !targetSemester) {
      if (activeTermRow) {
        targetAcademicYear = targetAcademicYear || activeTermRow.academic_year;
        targetSemester = targetSemester || activeTermRow.semester;
      }
    }

    targetAcademicYear = targetAcademicYear || "2026-2027";
    targetSemester = targetSemester || "2nd Semester";

    // Fetch target assignment IDs for this faculty & requested term
    const { data: targetAssignments, error: targetAssignmentsError } = await supabase
      .from("faculty_program_assignments")
      .select("id")
      .eq("faculty_profile_id", facultyProfileId)
      .eq("academic_year", targetAcademicYear)
      .ilike("term", `%${targetSemester}%`);

    if (targetAssignmentsError) {
      console.error(
        "Failed to fetch target assignments in /api/admin/faculty/submissions:",
        targetAssignmentsError,
      );
    }

    const targetAssignmentIds = (targetAssignments || []).map((a) => a.id);

    // 1. Fetch submissions for this faculty profile and term
    let rawSubmissions: Array<{
      id: string;
      requirement_code: string;
      status: string | null;
      submitted_at?: string | null;
      created_at?: string | null;
      remarks?: string | null;
      notes?: string | null;
      admin_remarks?: string | null;
    }> = [];

    if (targetAssignmentIds.length > 0) {
      const primaryRes = await supabase
        .from("submissions")
        .select(
          "id, requirement_code, status, submitted_at, created_at, remarks, notes, admin_remarks, faculty_assignment_id",
        )
        .eq("faculty_profile_id", facultyProfileId)
        .in("faculty_assignment_id", targetAssignmentIds)
        .order("submitted_at", { ascending: false });

      let subData: any[] | null = primaryRes.data;
      let subError = primaryRes.error;

      if (subError) {
        const fallbackRes = await supabase
          .from("submissions")
          .select(
            "id, requirement_code, status, submitted_at, created_at, remarks, faculty_assignment_id",
          )
          .eq("faculty_profile_id", facultyProfileId)
          .in("faculty_assignment_id", targetAssignmentIds)
          .order("submitted_at", { ascending: false });

        subData = fallbackRes.data;
        subError = fallbackRes.error;
      }

      if (subError) {
        console.error(
          "Failed to fetch submissions in /api/admin/faculty/submissions:",
          subError,
        );
      }

      if (subData) {
        rawSubmissions = subData;
      }
    } else {
      rawSubmissions = [];
    }

    const submissionIds = rawSubmissions.map((s) => s.id);
    const docVersionsMap = new Map<string, Array<any>>();
    const reviewDecisionsMap = new Map<string, Array<any>>();

    if (submissionIds.length > 0) {
      const { data: docVersions, error: docVersionsError } = await supabase
        .from("document_versions")
        .select("id, submission_id, version_number, storage_path, mime_type, size_bytes, created_at")
        .in("submission_id", submissionIds)
        .order("version_number", { ascending: false });

      if (docVersionsError) {
        console.error(
          "Failed to fetch document_versions in /api/admin/faculty/submissions:",
          docVersionsError,
        );
      }

      if (docVersions) {
        for (const doc of docVersions) {
          const list = docVersionsMap.get(doc.submission_id) || [];
          list.push(doc);
          docVersionsMap.set(doc.submission_id, list);
        }
      }

      const { data: reviews, error: reviewsError } = await supabase
        .from("review_decisions")
        .select("submission_id, decision, remarks, created_at")
        .in("submission_id", submissionIds)
        .order("created_at", { ascending: false });

      if (reviewsError) {
        console.error(
          "Failed to fetch review_decisions in /api/admin/faculty/submissions:",
          reviewsError,
        );
      }

      if (reviews) {
        for (const rev of reviews) {
          const list = reviewDecisionsMap.get(rev.submission_id) || [];
          list.push(rev);
          reviewDecisionsMap.set(rev.submission_id, list);
        }
      }
    }

    const submissions: SubmissionRow[] = rawSubmissions.map((s) => ({
      ...s,
      document_versions: docVersionsMap.get(s.id) || [],
      review_decisions: reviewDecisionsMap.get(s.id) || [],
    }));

    return NextResponse.json({
      submissions,
      total: submissions.length,
    });
  } catch (error) {
    console.error("Unhandled error in /api/admin/faculty/submissions:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
