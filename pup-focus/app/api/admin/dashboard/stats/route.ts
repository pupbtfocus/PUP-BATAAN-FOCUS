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
import { buildFacultyFullName } from "@/lib/faculty-profile";

export async function GET(request: NextRequest) {
  try {
    const sessionClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();

    let requesterRole =
      (user?.user_metadata?.role as string | undefined) ??
      (user?.app_metadata?.role as string | undefined);

    let isAllowed =
      requesterRole === ROLE.ADMIN ||
      requesterRole === ROLE.SUPER_ADMIN ||
      (Boolean(requesterRole) && String(requesterRole).toLowerCase().includes("admin"));

    const supabase = getServiceRoleClient();

    if (!isAllowed) {
      const { data: dbUserRoles } = await supabase
        .from("user_roles")
        .select("roles(code)")
        .eq("profile_id", user?.id);

      const dbRoles = (dbUserRoles ?? []).map((r: any) => r.roles?.code);
      if (dbRoles.includes(ROLE.ADMIN) || dbRoles.includes(ROLE.SUPER_ADMIN)) {
        isAllowed = true;
      }

      if (!isAllowed && user?.id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, user_roles(roles(code))")
          .eq("user_id", user.id)
          .maybeSingle();

        const pRoles = ((profile?.user_roles as any[]) ?? []).map((r: any) => r.roles?.code);
        if (pRoles.includes(ROLE.ADMIN) || pRoles.includes(ROLE.SUPER_ADMIN)) {
          isAllowed = true;
        }
      }

      if (!isAllowed && user?.email) {
        const { data: adminRecord } = await supabase
          .from("admins")
          .select("id")
          .eq("email", user.email.toLowerCase())
          .maybeSingle();
        if (adminRecord) {
          isAllowed = true;
        }
      }
    }

    if (!user || !isAllowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 1. Current active academic term & faculty data
    const { data: currentTermRow } = await supabase
      .from("academic_terms")
      .select("academic_year, semester, status")
      .eq("status", "Current")
      .maybeSingle();

    const currentAcademicYear = currentTermRow?.academic_year || "2026-2027";
    const currentSemester = currentTermRow?.semester || "1st Semester";

    // 2. Fetch faculty profiles & auth users
    const { data: facultyRole } = await supabase
      .from("roles")
      .select("id")
      .eq("code", "faculty")
      .maybeSingle();

    const [
      { data: userRoles },
      { data: authUsersData },
      { data: allAssignments },
      { data: allProfiles },
    ] = await Promise.all([
      facultyRole?.id
        ? supabase
            .from("user_roles")
            .select("profile_id")
            .eq("role_id", facultyRole.id)
            .limit(1000)
        : Promise.resolve({ data: [] }),
      supabase.auth.admin.listUsers({ perPage: 1000 }),
      supabase
        .from("faculty_program_assignments")
        .select("faculty_profile_id"),
      supabase
        .from("profiles")
        .select("id, user_id, full_name, email"),
    ]);

    const profileById = new Map<string, any>();
    const profileByUserId = new Map<string, any>();
    const profileByEmail = new Map<string, any>();
    for (const p of allProfiles ?? []) {
      if (p.id) profileById.set(p.id, p);
      if (p.user_id) profileByUserId.set(p.user_id, p);
      if (p.email) profileByEmail.set(p.email.toLowerCase(), p);
    }

    const facultyProfileIdSet = new Set<string>();

    for (const ur of userRoles ?? []) {
      if (ur.profile_id) facultyProfileIdSet.add(ur.profile_id);
    }

    for (const u of authUsersData?.users ?? []) {
      const metaRole = (
        u.user_metadata?.role ||
        u.app_metadata?.role ||
        ""
      ).toLowerCase().trim();
      if (metaRole === "faculty" || metaRole === "faculty_member") {
        const prof =
          profileByUserId.get(u.id) ||
          (u.email ? profileByEmail.get(u.email.toLowerCase()) : null);
        if (prof?.id) {
          facultyProfileIdSet.add(prof.id);
        }
      }
    }

    for (const a of allAssignments ?? []) {
      if (a.faculty_profile_id) {
        facultyProfileIdSet.add(a.faculty_profile_id);
      }
    }

    const facultyProfiles: Array<{
      id: string;
      user_id: string | null;
      full_name: string | null;
      email: string | null;
    }> = Array.from(facultyProfileIdSet)
      .map((id) => profileById.get(id))
      .filter(Boolean);

    const authUsersById = new Map<string, any>();
    const authUsersByEmail = new Map<string, any>();
    for (const u of authUsersData?.users ?? []) {
      if (u.id) authUsersById.set(u.id, u);
      if (u.email) authUsersByEmail.set(u.email.toLowerCase(), u);
    }

    interface ResolvedFaculty {
      id: string;
      fullName: string;
      email: string;
      isActive: boolean;
    }

    const facultyProfileMap = new Map<string, ResolvedFaculty>();

    for (const profile of facultyProfiles) {
      const authUser =
        (profile.user_id ? authUsersById.get(profile.user_id) : null) ??
        (profile.id ? authUsersById.get(profile.id) : null) ??
        (profile.email ? authUsersByEmail.get(profile.email.toLowerCase()) : null) ??
        null;
      const metadata = (authUser?.user_metadata ?? {}) as Record<string, unknown>;
      const firstName =
        typeof metadata.first_name === "string" ? metadata.first_name.trim() : "";
      const middleName =
        typeof metadata.middle_name === "string" ? metadata.middle_name.trim() : "";
      const lastName =
        typeof metadata.last_name === "string" ? metadata.last_name.trim() : "";

      const fullName =
        buildFacultyFullName({ firstName, middleName, lastName }) ||
        profile.full_name ||
        profile.email ||
        "Faculty Member";

      const isActive = (metadata.is_active as boolean | undefined) ?? true;

      facultyProfileMap.set(profile.id, {
        id: profile.id,
        fullName,
        email: profile.email || "",
        isActive,
      });
    }

    const totalFaculty = facultyProfileMap.size;
    const activeFaculty = Array.from(facultyProfileMap.values()).filter(
      (f) => f.isActive,
    ).length;

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
          facultyName: faculty?.fullName || faculty?.email || "Faculty Member",
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
        facultyName: faculty?.fullName || faculty?.email || "Faculty Member",
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
