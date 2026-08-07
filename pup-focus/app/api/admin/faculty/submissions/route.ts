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

    // Get faculty profile ID. Accept either app_users.id or profile_id (frontend may pass profile id)
    const { data: appUserRow, error: appUserError } = await supabase
      .from("app_users")
      .select("profile_id")
      .or(`id.eq.${facultyId},profile_id.eq.${facultyId}`)
      .maybeSingle();

    if (appUserError || !appUserRow?.profile_id) {
      return NextResponse.json(
        {
          error: "Faculty profile not found",
          details: appUserError?.message || "No profile_id for this faculty",
        },
        { status: 404 },
      );
    }

    const facultyProfileId = appUserRow.profile_id;

    const requestedAcademicYear = url.searchParams.get("academicYear")?.trim();
    const requestedSemester = url.searchParams.get("semester")?.trim();

    let targetAcademicYear = requestedAcademicYear;
    let targetSemester = requestedSemester;

    const { data: activeTermRow } = await supabase
      .from("academic_terms")
      .select("academic_year, semester, created_at")
      .eq("status", "Current")
      .maybeSingle();

    if (!targetAcademicYear || !targetSemester) {
      if (activeTermRow) {
        targetAcademicYear = targetAcademicYear || activeTermRow.academic_year;
        targetSemester = targetSemester || activeTermRow.semester;
      }
    }

    targetAcademicYear = targetAcademicYear || "2026-2027";
    targetSemester = targetSemester || "2nd Semester";

    // Fetch target assignment IDs for this faculty & requested term
    const { data: targetAssignments } = await supabase
      .from("faculty_program_assignments")
      .select("id")
      .eq("faculty_profile_id", facultyProfileId)
      .eq("academic_year", targetAcademicYear)
      .ilike("term", `%${targetSemester}%`);

    const targetAssignmentIds = (targetAssignments || []).map((a) => a.id);

    // 1. Fetch submissions for this faculty profile and term
    let rawSubmissions: Array<{
      id: string;
      requirement_code: string;
      status: string | null;
      submitted_at?: string | null;
      created_at?: string | null;
      remarks?: string | null;
    }> = [];

    if (targetAssignmentIds.length > 0) {
      const { data: subData } = await supabase
        .from("submissions")
        .select("id, requirement_code, status, submitted_at, created_at, remarks, faculty_assignment_id")
        .eq("faculty_profile_id", facultyProfileId)
        .in("faculty_assignment_id", targetAssignmentIds)
        .order("submitted_at", { ascending: false });

      if (subData) {
        rawSubmissions = subData as typeof rawSubmissions;
      }
    } else {
      rawSubmissions = [];
    }

    const submissionIds = rawSubmissions.map((s) => s.id);
    const docVersionsMap = new Map<string, Array<any>>();
    const reviewDecisionsMap = new Map<string, Array<any>>();

    if (submissionIds.length > 0) {
      const { data: docVersions } = await supabase
        .from("document_versions")
        .select("id, submission_id, version_number, storage_path, mime_type, size_bytes, created_at")
        .in("submission_id", submissionIds)
        .order("version_number", { ascending: false });

      if (docVersions) {
        for (const doc of docVersions) {
          const list = docVersionsMap.get(doc.submission_id) || [];
          list.push(doc);
          docVersionsMap.set(doc.submission_id, list);
        }
      }

      const { data: reviews } = await supabase
        .from("review_decisions")
        .select("submission_id, decision, remarks, created_at")
        .in("submission_id", submissionIds)
        .order("created_at", { ascending: false });

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
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
