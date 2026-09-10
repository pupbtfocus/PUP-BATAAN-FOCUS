export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { ROLE } from "@/config/roles";
import {
  DEFAULT_REQUIREMENTS,
  REQUIREMENT_LABEL,
  type RequirementCode,
} from "@/config/compliance";

export async function GET(request: NextRequest) {
  try {
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

    const supabase = getServiceRoleClient();

    // 1. Current active academic term
    const { data: currentTermRow } = await supabase
      .from("academic_terms")
      .select("academic_year, semester, status")
      .eq("status", "Current")
      .maybeSingle();

    const currentAcademicYear = currentTermRow?.academic_year || "2026-2027";
    const currentSemester = currentTermRow?.semester || "1st Semester";

    // 2. Fetch faculty profiles
    const { data: facultyRole } = await supabase
      .from("roles")
      .select("id")
      .eq("code", "faculty")
      .maybeSingle();

    let facultyProfiles: Array<{
      id: string;
      full_name: string | null;
      email: string | null;
      is_active: boolean | null;
    }> = [];

    if (facultyRole?.id) {
      const { data: userRoles } = await supabase
        .from("user_roles")
        .select("profile_id")
        .eq("role_id", facultyRole.id);

      const profileIds = Array.from(
        new Set(
          (userRoles ?? [])
            .map((r) => r.profile_id)
            .filter((val): val is string => Boolean(val)),
        ),
      );

      if (profileIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email, is_active")
          .in("id", profileIds);

        facultyProfiles = profiles || [];
      }
    }

    const facultyProfileMap = new Map<
      string,
      { id: string; full_name: string | null; email: string | null; is_active: boolean | null }
    >();
    facultyProfiles.forEach((p) => facultyProfileMap.set(p.id, p));

    const totalFaculty = facultyProfiles.length;
    const activeFaculty = facultyProfiles.filter((f) => f.is_active !== false).length;

    // 3. Fetch submissions with document versions and review decisions
    const { data: rawSubmissions, error: subError } = await supabase
      .from("submissions")
      .select(`
        id,
        faculty_profile_id,
        requirement_code,
        status,
        submitted_at,
        created_at,
        remarks,
        admin_remarks,
        document_versions ( id, storage_path, version_number, created_at ),
        review_decisions ( id, decision, remarks, created_at )
      `)
      .order("submitted_at", { ascending: false });

    if (subError) {
      console.error("[ADMIN_DASHBOARD_STATS] Error fetching submissions:", subError);
      return NextResponse.json(
        { error: "Failed to load submission stats", details: subError.message },
        { status: 500 },
      );
    }

    const submissions = rawSubmissions || [];

    // Helper functions for status categorization
    const isPendingStatus = (s: string | null) => {
      const lower = (s || "").toLowerCase();
      return (
        lower === "uploaded" ||
        lower === "pending" ||
        lower === "submitted" ||
        lower === "under_review" ||
        lower === "pending_review"
      );
    };

    const isValidatedStatus = (s: string | null) => {
      const lower = (s || "").toLowerCase();
      return lower === "validated" || lower === "approved";
    };

    const isRejectedStatus = (s: string | null) => {
      const lower = (s || "").toLowerCase();
      return lower === "rejected" || lower === "needs_revision";
    };

    let verifiedCount = 0;
    let pendingCount = 0;
    let rejectedCount = 0;
    let revisionsCount = 0;

    const pendingQueue: Array<{
      id: string;
      facultyId: string;
      facultyName: string;
      facultyEmail: string;
      requirementCode: string;
      requirementTitle: string;
      submittedAt: string;
      status: string;
      isRevision: boolean;
      facultyRemarks: string | null;
      fileCount: number;
    }> = [];

    for (const sub of submissions) {
      const sStatus = sub.status;
      const isRev =
        (sub.document_versions && sub.document_versions.length > 1) ||
        (sub.review_decisions &&
          sub.review_decisions.some((d) => d.decision === "rejected"));

      if (isValidatedStatus(sStatus)) {
        verifiedCount++;
      } else if (isPendingStatus(sStatus)) {
        pendingCount++;
        if (isRev) {
          revisionsCount++;
        }

        const faculty = facultyProfileMap.get(sub.faculty_profile_id);
        const reqCode = sub.requirement_code as RequirementCode;
        const reqTitle = REQUIREMENT_LABEL[reqCode] || sub.requirement_code || "Requirement";

        pendingQueue.push({
          id: sub.id,
          facultyId: sub.faculty_profile_id,
          facultyName: faculty?.full_name || faculty?.email || "Faculty Member",
          facultyEmail: faculty?.email || "",
          requirementCode: sub.requirement_code,
          requirementTitle: reqTitle,
          submittedAt: sub.submitted_at || sub.created_at || new Date().toISOString(),
          status: "Pending Review",
          isRevision: Boolean(isRev),
          facultyRemarks: sub.remarks || null,
          fileCount: sub.document_versions?.length || 1,
        });
      } else if (isRejectedStatus(sStatus)) {
        rejectedCount++;
      }
    }

    // 4. Fetch recent admin review actions (activity feed)
    const { data: recentDecisions } = await supabase
      .from("review_decisions")
      .select("id, decision, remarks, created_at, submission_id, reviewer_profile_id")
      .order("created_at", { ascending: false })
      .limit(10);

    const submissionMap = new Map<string, (typeof submissions)[number]>();
    submissions.forEach((s) => submissionMap.set(s.id, s));

    const recentActivity = (recentDecisions || []).map((rev) => {
      const sub = submissionMap.get(rev.submission_id);
      const faculty = sub ? facultyProfileMap.get(sub.faculty_profile_id) : null;
      const reqCode = (sub?.requirement_code || "") as RequirementCode;
      const reqTitle = REQUIREMENT_LABEL[reqCode] || sub?.requirement_code || "Requirement";

      return {
        id: rev.id,
        decision: rev.decision as "validated" | "rejected",
        requirementCode: sub?.requirement_code || "",
        requirementTitle: reqTitle,
        facultyName: faculty?.full_name || faculty?.email || "Faculty Member",
        facultyId: sub?.faculty_profile_id || "",
        remarks: rev.remarks || null,
        createdAt: rev.created_at,
      };
    });

    return NextResponse.json({
      stats: {
        verified: verifiedCount,
        pending: pendingCount,
        rejected: rejectedCount,
        revisions: revisionsCount,
        totalFaculty,
        activeFaculty,
        currentAcademicYear,
        currentSemester,
      },
      pendingQueue,
      recentActivity,
    });
  } catch (error) {
    console.error("[ADMIN_DASHBOARD_STATS_ERROR]", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 },
    );
  }
}
