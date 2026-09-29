import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { ROLE } from "@/config/roles";
import {
  REQUIREMENT_LABEL,
  type RequirementCode,
} from "@/config/compliance";
import { normalizeSemester } from "@/features/submissions/services/submission-window.service";
import { buildFacultyFullName } from "@/lib/faculty-profile";

function isAdminRole(role: string | undefined) {
  return role === ROLE.ADMIN || role === ROLE.SUPER_ADMIN;
}

export type HistoricalSubmissionItem = {
  id: string;
  facultyId: string;
  facultyName: string;
  facultyEmail: string;
  programCode: string;
  programName: string;
  requirementCode: string;
  requirementTitle: string;
  status: string;
  submittedAt: string | null;
  dateValidated: string | null;
  adminRemarks: string | null;
  fileName: string | null;
  storagePath: string | null;
  downloadUrl: string | null;
  isReadOnly: boolean;
};

function normalizeAcademicYear(ay?: string | null): string {
  if (!ay) return "";
  return ay
    .toLowerCase()
    .trim()
    .replace(/^s\.?y\.?\s*/i, "")
    .replace(/^a\.?y\.?\s*/i, "")
    .replace(/\s+/g, "");
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

export async function GET(request: NextRequest) {
  try {
    const sessionClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();

    const requesterRole =
      (user?.user_metadata?.role as string | undefined) ??
      (user?.app_metadata?.role as string | undefined);

    if (!user || !isAdminRole(requesterRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(request.url);
    const academicYear = url.searchParams.get("academicYear")?.trim();
    const semesterParam = url.searchParams.get("semester")?.trim();
    const semester = semesterParam ? normalizeSemester(semesterParam) : undefined;
    const statusFilter = url.searchParams.get("status")?.trim().toLowerCase();
    const search = url.searchParams.get("search")?.trim().toLowerCase();

    const supabase = getServiceRoleClient();

    // 1. Fetch academic term info
    let termQuery = supabase
      .from("academic_terms")
      .select("academic_year, semester, status")
      .order("academic_year", { ascending: false });

    if (academicYear) {
      termQuery = termQuery.eq("academic_year", academicYear);
    }
    if (semester) {
      termQuery = termQuery.ilike("semester", `%${semester}%`);
    }

    const { data: matchedTerms, error: termError } = await termQuery;
    if (termError) {
      return NextResponse.json(
        { error: "Failed to load academic terms", details: termError.message },
        { status: 500 },
      );
    }

    // Determine target terms to query
    const targetTerms = matchedTerms && matchedTerms.length > 0 ? matchedTerms : [];
    if (targetTerms.length === 0 && academicYear && semester) {
      targetTerms.push({
        academic_year: academicYear,
        semester: semester,
        status: "Archived",
      });
    }

    const isCurrentActiveTerm = Boolean(
      (targetTerms || []).some((t) => t.status === "Current") ||
      (matchedTerms || []).some(
        (t) =>
          t.status === "Current" &&
          (!academicYear || t.academic_year === academicYear) &&
          (!semester || normalizeSemester(t.semester) === semester),
      ),
    );

    // 2. Fetch all program assignments and normalize matching
    const { data: rawAssignments, error: assignError } = await supabase
      .from("faculty_program_assignments")
      .select("id, faculty_profile_id, program_id, academic_year, term");

    if (assignError) {
      console.warn("Could not query faculty_program_assignments:", assignError.message);
    }

    const targetNormAY = academicYear ? normalizeAcademicYear(academicYear) : null;
    const targetNormSem = semester ? normalizeSemester(semester) : null;

    const assignmentList = (rawAssignments || []).filter((a: any) => {
      if (targetNormAY && normalizeAcademicYear(a.academic_year) !== targetNormAY) {
        return false;
      }
      if (targetNormSem && normalizeSemester(a.term) !== targetNormSem) {
        return false;
      }
      return true;
    });

    const assignmentMap = new Map<string, any>();
    const assignmentIds: string[] = [];
    const assignedProfileIds = new Set<string>();

    for (const a of assignmentList) {
      if (a.id) {
        assignmentMap.set(a.id, a);
        assignmentIds.push(a.id);
      }
      if (a.faculty_profile_id) {
        assignedProfileIds.add(a.faculty_profile_id);
      }
    }

    // 3. Fetch submissions strictly selecting valid columns on submissions table
    const rawSubmissions: any[] = [];

    // A. Direct submissions matching assignment IDs
    if (assignmentIds.length > 0) {
      const { data: subData, error: subError } = await supabase
        .from("submissions")
        .select(
          "id, faculty_profile_id, faculty_assignment_id, requirement_code, status, submitted_at, created_at, remarks, admin_remarks",
        )
        .in("faculty_assignment_id", assignmentIds)
        .order("submitted_at", { ascending: false });

      if (subError) {
        console.error("Failed to query direct submissions:", subError.message);
      }
      if (subData) {
        rawSubmissions.push(...subData);
      }
    }

    // B. Submissions from faculty assigned to this term where faculty_assignment_id is null
    if (assignedProfileIds.size > 0) {
      const { data: profileSubs, error: profileSubsError } = await supabase
        .from("submissions")
        .select(
          "id, faculty_profile_id, faculty_assignment_id, requirement_code, status, submitted_at, created_at, remarks, admin_remarks",
        )
        .in("faculty_profile_id", Array.from(assignedProfileIds))
        .is("faculty_assignment_id", null)
        .order("submitted_at", { ascending: false });

      if (profileSubsError) {
        console.error("Failed to query profile submissions:", profileSubsError.message);
      }
      if (profileSubs) {
        rawSubmissions.push(...profileSubs);
      }
    }

    // C. Fallback for unassigned submissions whose dates match the target term
    const { data: unassignedSubData, error: unassignedError } = await supabase
      .from("submissions")
      .select(
        "id, faculty_profile_id, faculty_assignment_id, requirement_code, status, submitted_at, created_at, remarks, admin_remarks",
      )
      .is("faculty_assignment_id", null)
      .order("submitted_at", { ascending: false });

    if (unassignedError) {
      console.error("Failed to query unassigned submissions:", unassignedError.message);
    }
    if (unassignedSubData) {
      for (const sub of unassignedSubData) {
        const inferred = toAcademicYearAndSemester(sub.submitted_at || sub.created_at);
        if (targetNormAY && normalizeAcademicYear(inferred.academicYear) !== targetNormAY) {
          continue;
        }
        if (targetNormSem && normalizeSemester(inferred.semester) !== targetNormSem) {
          continue;
        }
        rawSubmissions.push(sub);
      }
    }

    // Deduplicate submissions by id
    const seenSubmissionIds = new Set<string>();
    const submissions: any[] = [];
    for (const sub of rawSubmissions) {
      if (!seenSubmissionIds.has(sub.id)) {
        seenSubmissionIds.add(sub.id);
        submissions.push(sub);
      }
    }

    // 4. Fetch document_versions and review_decisions separately by submission IDs
    const submissionIds = submissions.map((s) => s.id);
    const docVersionsMap = new Map<string, any>();
    const reviewDecisionsMap = new Map<string, any[]>();

    if (submissionIds.length > 0) {
      const { data: docVersions } = await supabase
        .from("document_versions")
        .select("id, submission_id, version_number, storage_path, mime_type, file_name, created_at")
        .in("submission_id", submissionIds)
        .order("version_number", { ascending: false });

      if (docVersions) {
        for (const doc of docVersions) {
          if (!docVersionsMap.has(doc.submission_id)) {
            docVersionsMap.set(doc.submission_id, doc);
          }
        }
      }

      const { data: reviews } = await supabase
        .from("review_decisions")
        .select("id, submission_id, decision, remarks, created_at")
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

    // 5. Decoupled Profile and Program lookups
    const profileIdSet = new Set<string>();
    const programIdSet = new Set<string>();

    for (const a of assignmentList) {
      if (a.faculty_profile_id) profileIdSet.add(a.faculty_profile_id);
      if (a.program_id) programIdSet.add(a.program_id);
    }
    for (const sub of submissions) {
      if (sub.faculty_profile_id) profileIdSet.add(sub.faculty_profile_id);
    }

    const facultyMap = new Map<string, any>();
    if (profileIdSet.size > 0) {
      const { data: profileRows } = await supabase
        .from("profiles")
        .select("id, full_name, email, user_id")
        .in("id", Array.from(profileIdSet));

      if (profileRows) {
        for (const p of profileRows) {
          facultyMap.set(p.id, p);
        }
      }
    }

    const programMap = new Map<string, any>();
    if (programIdSet.size > 0) {
      const { data: programRows } = await supabase
        .from("programs")
        .select("id, code, name")
        .in("id", Array.from(programIdSet));

      if (programRows) {
        for (const pr of programRows) {
          programMap.set(pr.id, pr);
        }
      }
    }

    // 6. Map into HistoricalSubmissionItem list
    const items: HistoricalSubmissionItem[] = [];

    for (const sub of submissions) {
      const assignment = sub.faculty_assignment_id
        ? assignmentMap.get(sub.faculty_assignment_id)
        : null;
      const profile =
        facultyMap.get(sub.faculty_profile_id) ||
        (assignment?.faculty_profile_id
          ? facultyMap.get(assignment.faculty_profile_id)
          : null);
      const program = assignment?.program_id
        ? programMap.get(assignment.program_id)
        : null;

      const facultyName = profile ? buildFacultyFullName(profile) : "Faculty Member";
      const facultyEmail = profile?.email || "";
      const programCode = program?.code || "";
      const programName = program?.name || "";

      // Search filter
      if (search) {
        const matchesName = facultyName.toLowerCase().includes(search);
        const matchesEmail = facultyEmail.toLowerCase().includes(search);
        const matchesProg = programCode.toLowerCase().includes(search) || programName.toLowerCase().includes(search);
        const matchesReq = (sub.requirement_code || "").toLowerCase().includes(search);
        if (!matchesName && !matchesEmail && !matchesProg && !matchesReq) {
          continue;
        }
      }

      // Status filter
      const rawStatus = (sub.status || "").toLowerCase();
      if (statusFilter && statusFilter !== "all") {
        if (statusFilter === "validated" && rawStatus !== "validated" && rawStatus !== "approved") {
          continue;
        }
        if (statusFilter === "rejected" && rawStatus !== "rejected" && rawStatus !== "needs_revision") {
          continue;
        }
        if (
          statusFilter === "pending" &&
          rawStatus !== "pending" &&
          rawStatus !== "uploaded" &&
          rawStatus !== "submitted"
        ) {
          continue;
        }
      }

      // Review decisions
      const reviews = reviewDecisionsMap.get(sub.id) || [];
      const latestReview = reviews[0];
      const latestReviewWithRemarks = reviews.find((r: any) => r.remarks && r.remarks.trim() !== "");

      const adminRemarks =
        latestReviewWithRemarks?.remarks?.trim() ||
        latestReview?.remarks?.trim() ||
        sub.admin_remarks?.trim() ||
        null;

      const dateValidated =
        latestReview?.decision === "validated" || rawStatus === "validated" || rawStatus === "approved"
          ? (latestReview?.created_at || sub.submitted_at || sub.created_at)
          : null;

      // Document path / version
      const doc = docVersionsMap.get(sub.id);
      const storagePath = doc?.storage_path || null;
      const fileName = doc?.file_name || (storagePath ? storagePath.split("/").pop() : null);

      const downloadUrl = storagePath
        ? `/api/faculty/submissions/view?submissionId=${encodeURIComponent(sub.id)}&download=true`
        : null;

      const reqCode = (sub.requirement_code || "") as RequirementCode;
      const requirementTitle = REQUIREMENT_LABEL[reqCode] || sub.requirement_code || "Requirement";

      items.push({
        id: sub.id,
        facultyId: sub.faculty_profile_id,
        facultyName,
        facultyEmail,
        programCode,
        programName,
        requirementCode: sub.requirement_code,
        requirementTitle,
        status: sub.status || "submitted",
        submittedAt: sub.submitted_at || sub.created_at || null,
        dateValidated,
        adminRemarks,
        fileName,
        storagePath,
        downloadUrl,
        isReadOnly: !isCurrentActiveTerm,
      });
    }

    return NextResponse.json({
      terms: targetTerms,
      submissions: items,
      total: items.length,
      isReadOnly: !isCurrentActiveTerm,
      isCurrentTerm: isCurrentActiveTerm,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load historical submissions", details: String(error) },
      { status: 500 },
    );
  }
}
