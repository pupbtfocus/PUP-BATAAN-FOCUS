import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { logger } from "@/lib/observability/logger";
import { REQUIREMENT_CODE } from "@/config/compliance";
import type { RequirementCode } from "@/config/compliance";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type DocumentVersionRow = {
  id: string;
  submission_id?: string;
  version_number: number;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  checksum_sha256: string | null;
  created_by?: string | null;
  created_at: string | null;
};

type ReviewDecision = {
  decision: "validated" | "rejected";
  remarks?: string | null;
  created_at?: string | null;
};

type SubmissionRow = {
  id: string;
  faculty_profile_id?: string | null;
  faculty_assignment_id?: string | null;
  requirement_code?: string | null;
  requirement_type?: string | null;
  status: string | null;
  submitted_at?: string | null;
  created_at?: string | null;
  remarks?: string | null;
  admin_remarks?: string | null;
};

const SUBMISSION_COLUMNS =
  "id, faculty_profile_id, faculty_assignment_id, requirement_code, status, remarks, admin_remarks, submitted_at, created_at";

function matchRequirementCode(
  inputCode?: string | null,
  inputReqId?: string | null,
): RequirementCode | null {
  const candidates = [inputCode, inputReqId].filter(Boolean) as string[];
  for (const raw of candidates) {
    const s = raw.toLowerCase().trim().replace(/[-_\s]+/g, "");
    if (s.includes("gradesheet") || s.includes("grade"))
      return REQUIREMENT_CODE.GRADE_SHEET;
    if (s.includes("syllabus") || s.includes("enhancedsyllabus"))
      return REQUIREMENT_CODE.ENHANCED_SYLLABUS;
    if (s.includes("orientation") || s.includes("classorientation"))
      return REQUIREMENT_CODE.CLASS_ORIENTATION;
    if (s.includes("midterm") || s.includes("midtermpackage"))
      return REQUIREMENT_CODE.MIDTERM_PACKAGE;
    if (s.includes("final") || s.includes("finalpackage"))
      return REQUIREMENT_CODE.FINAL_PACKAGE;
    if (
      s.includes("classrecord") ||
      s.includes("records") ||
      s.includes("classrecords")
    )
      return REQUIREMENT_CODE.CLASS_RECORDS;
  }
  return null;
}

function extractFileName(storagePath: string): string {
  if (!storagePath) return "document";
  const parts = storagePath.split("/");
  let fileName = parts[parts.length - 1] ?? storagePath;
  if (/^v\d+_\d+_/i.test(fileName)) {
    return fileName.replace(/^v\d+_\d+_/i, "");
  }
  if (/^v\d+_/i.test(fileName)) {
    return fileName.replace(/^v\d+_/i, "");
  }
  return fileName;
}

function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes <= 0) return "Unknown size";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> },
) {
  try {
    const resolvedParams = await params;
    const submissionId = resolvedParams?.submissionId;

    if (!submissionId || submissionId === "undefined" || submissionId === "null") {
      return NextResponse.json(
        { error: "Invalid submission ID" },
        { status: 400 },
      );
    }

    // Authenticate user session
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

    // Direct Service Role Client Initialization
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Resolve authenticated faculty profile
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError || !profile?.id) {
      logger.error("faculty_not_found", {
        authUserId: user.id,
        error: profileError?.message,
      });
      return NextResponse.json(
        { error: "Faculty profile not found" },
        { status: 404 },
      );
    }

    // 1. Explicit Target Query & Error Logging
    let { data: targetSub, error: subErr } = await adminClient
      .from("submissions")
      .select(SUBMISSION_COLUMNS)
      .eq("id", submissionId)
      .maybeSingle();

    if (subErr) {
      console.error(
        "[VERSIONS_API_DEBUG] Target Submission Query Error:",
        subErr.message,
      );
    }

    let targetDocVersion: DocumentVersionRow | null = null;

    // 2. Fallback Global Requirements Search
    let realReqCode = targetSub?.requirement_code;
    let targetFacultyId = targetSub?.faculty_profile_id || profile.id;

    if (!realReqCode) {
      // Search all submissions table rows without ID filter to locate submissionId in-memory
      const { data: allSubs, error: allErr } = await adminClient
        .from("submissions")
        .select(SUBMISSION_COLUMNS);

      const foundInAll = (allSubs || []).find((s) => s.id === submissionId);
      if (foundInAll) {
        targetSub = foundInAll;
        realReqCode = foundInAll.requirement_code;
        targetFacultyId = foundInAll.faculty_profile_id || targetFacultyId;
      }
    }

    if (!realReqCode) {
      // Check document_versions table directly
      const { data: docVers } = await adminClient
        .from("document_versions")
        .select(
          "id, submission_id, version_number, storage_path, mime_type, size_bytes, checksum_sha256, created_by, created_at",
        )
        .or(`id.eq.${submissionId},submission_id.eq.${submissionId}`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (docVers) {
        targetDocVersion = docVers as DocumentVersionRow;

        if (docVers.submission_id) {
          const { data: parentSub } = await adminClient
            .from("submissions")
            .select(SUBMISSION_COLUMNS)
            .eq("id", docVers.submission_id)
            .maybeSingle();

          if (parentSub) {
            targetSub = parentSub;
            realReqCode = parentSub.requirement_code;
            targetFacultyId = parentSub.faculty_profile_id || targetFacultyId;
          }
        }

        if (!realReqCode && docVers.storage_path) {
          realReqCode = matchRequirementCode(docVers.storage_path);
        }
      }
    }

    if (!realReqCode) {
      realReqCode = matchRequirementCode(submissionId) || submissionId;
    }

    console.log(
      "[VERSIONS_API_DEBUG] Verified Real Requirement Code:",
      realReqCode,
    );

    // 3. Aggregate All Submission Rows for this Faculty & Requirement
    const facultyProfileIds = Array.from(
      new Set([targetFacultyId, profile.id, user.id].filter(Boolean)),
    );

    const { data: allFacultySubs } = await adminClient
      .from("submissions")
      .select(SUBMISSION_COLUMNS)
      .in("faculty_profile_id", facultyProfileIds as string[])
      .order("created_at", { ascending: true });

    const combinedUserSubs = allFacultySubs ? [...allFacultySubs] : [];

    if (targetSub?.faculty_assignment_id) {
      const { data: assignSubs } = await adminClient
        .from("submissions")
        .select(SUBMISSION_COLUMNS)
        .eq("faculty_assignment_id", targetSub.faculty_assignment_id)
        .order("created_at", { ascending: true });

      if (assignSubs && assignSubs.length > 0) {
        const existingIds = new Set(combinedUserSubs.map((s) => s.id));
        for (const s of assignSubs) {
          if (!existingIds.has(s.id)) {
            combinedUserSubs.push(s);
          }
        }
      }
    }

    const normalize = (s: string) =>
      (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

    const targetNorm = normalize(realReqCode);
    const targetMatchedCode = matchRequirementCode(realReqCode);

    // Filter combinedUserSubs to find ALL submissions sharing the same requirement code
    const relatedSubs = combinedUserSubs.filter((sub) => {
      const subNorm = normalize(sub.requirement_code || "");
      const matched = matchRequirementCode(sub.requirement_code);

      return (
        sub.id === submissionId ||
        sub.id === targetSub?.id ||
        sub.requirement_code === realReqCode ||
        subNorm === targetNorm ||
        (Boolean(targetNorm) &&
          Boolean(subNorm) &&
          (targetNorm.includes(subNorm) || subNorm.includes(targetNorm))) ||
        (Boolean(matched) &&
          Boolean(targetMatchedCode) &&
          matched === targetMatchedCode)
      );
    });

    const allSubmissionIds = Array.from(
      new Set(
        [
          submissionId,
          targetSub?.id,
          targetDocVersion?.submission_id,
          ...relatedSubs.map((s) => s.id),
        ].filter(Boolean) as string[],
      ),
    );

    console.log(
      "[VERSIONS_API_DEBUG] Total Aggregated Submission IDs:",
      allSubmissionIds.length,
    );
    console.log(
      "[VERSIONS_API_DEBUG] Aggregated Submission IDs List:",
      allSubmissionIds,
    );

    // 4. Query All document_versions for these Submission IDs
    const { data: docVersions, error: verErr } = await adminClient
      .from("document_versions")
      .select(
        "id, submission_id, version_number, storage_path, mime_type, size_bytes, checksum_sha256, created_by, created_at",
      )
      .in("submission_id", allSubmissionIds)
      .order("created_at", { ascending: true });

    if (verErr) {
      logger.error("document_versions_fetch_failed", {
        submissionIds: allSubmissionIds,
        error: verErr.message,
      });
    }

    const fetchedVersions = (docVersions || []) as DocumentVersionRow[];

    if (targetDocVersion && !fetchedVersions.some((v) => v.id === targetDocVersion!.id)) {
      fetchedVersions.push(targetDocVersion);
    }

    // 5. Legacy Fallback: Add any related submissions without document_versions entries
    const seenStoragePaths = new Set(fetchedVersions.map((v) => v.storage_path));
    const seenIds = new Set(fetchedVersions.map((v) => v.id));
    const aggregatedVersionRows: DocumentVersionRow[] = [...fetchedVersions];

    for (const sub of relatedSubs) {
      const hasVersion = fetchedVersions.some((v) => v.submission_id === sub.id);
      if (!hasVersion) {
        const fallbackPath = `faculty-submissions/${targetFacultyId}/${sub.id}/v1_${realReqCode}`;
        if (!seenStoragePaths.has(fallbackPath) && !seenIds.has(`${sub.id}-v1`)) {
          seenStoragePaths.add(fallbackPath);
          seenIds.add(`${sub.id}-v1`);
          aggregatedVersionRows.push({
            id: `${sub.id}-v1`,
            submission_id: sub.id,
            version_number: 1,
            storage_path: fallbackPath,
            mime_type: "application/octet-stream",
            size_bytes: 0,
            checksum_sha256: "",
            created_at:
              sub.submitted_at || sub.created_at || new Date().toISOString(),
          });
        }
      }
    }

    // If completely empty, generate a fallback Version 1
    if (aggregatedVersionRows.length === 0) {
      const fallbackId = targetSub?.id || submissionId;
      const initialPath = `faculty-submissions/${targetFacultyId}/${fallbackId}/v1_${realReqCode}`;
      const initialCreatedAt =
        targetSub?.submitted_at ||
        targetSub?.created_at ||
        new Date().toISOString();

      aggregatedVersionRows.push({
        id: `${fallbackId}-v1`,
        submission_id: fallbackId,
        version_number: 1,
        storage_path: initialPath,
        mime_type: "application/octet-stream",
        size_bytes: 0,
        checksum_sha256: "",
        created_at: initialCreatedAt,
      });
    }

    // 6. Sort chronologically ASCENDING
    aggregatedVersionRows.sort((a, b) => {
      const timeA = new Date(a.created_at || 0).getTime();
      const timeB = new Date(b.created_at || 0).getTime();
      return timeA - timeB;
    });

    const maxIndex = aggregatedVersionRows.length - 1;
    const finalSubmissionId = targetSub?.id || submissionId;

    // 7. Re-index sequentially (v1, v2, v3 ... vN)
    const reindexedVersions = aggregatedVersionRows.map((version, index) => {
      const versionNumber = index + 1;
      const fileName = extractFileName(version.storage_path);
      const sizeBytes = version.size_bytes ?? 0;
      const subIdForDownload = version.submission_id || finalSubmissionId;
      const downloadUrl = `/api/faculty/submissions/view?submissionId=${encodeURIComponent(subIdForDownload)}&versionId=${encodeURIComponent(version.id)}&download=true&filename=${encodeURIComponent(fileName)}`;
      const isCurrent = index === maxIndex;

      return {
        id: version.id,
        versionNumber,
        version_number: versionNumber,
        storagePath: version.storage_path,
        file_path: version.storage_path,
        fileName,
        file_name: fileName,
        mimeType: version.mime_type ?? "application/octet-stream",
        sizeBytes,
        size_bytes: sizeBytes,
        sizeFormatted: formatFileSize(sizeBytes),
        size_formatted: formatFileSize(sizeBytes),
        checksumSha256: version.checksum_sha256 ?? "",
        createdAt: version.created_at ?? new Date().toISOString(),
        created_at: version.created_at ?? new Date().toISOString(),
        status: targetSub?.status ?? "uploaded",
        remarks: null,
        downloadUrl,
        download_url: downloadUrl,
        isCurrent,
      };
    });

    // 8. Sort DESCENDING (Version N at top, Version 1 at bottom)
    reindexedVersions.sort((a, b) => b.versionNumber - a.versionNumber);

    console.log(
      "[VERSIONS_API_DEBUG] Successfully Aggregated Total Versions:",
      reindexedVersions.length,
    );

    // 9. Fetch latest reviewer decision across all matching submission IDs
    let latestReview: ReviewDecision | null = null;
    try {
      const { data: reviewsData } = await adminClient
        .from("review_decisions")
        .select("decision, remarks, created_at")
        .in("submission_id", allSubmissionIds)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (reviewsData) {
        latestReview = reviewsData as ReviewDecision;
      }
    } catch (reviewErr) {
      logger.error("review_decisions_fetch_exception", {
        submissionIds: allSubmissionIds,
        error:
          reviewErr instanceof Error ? reviewErr.message : String(reviewErr),
      });
    }

    const currentStatus = targetSub?.status ?? "uploaded";
    const feedback =
      latestReview?.remarks ??
      (targetSub as any)?.admin_remarks ??
      undefined;

    const facultyNotes =
      (targetSub?.remarks && targetSub.remarks !== feedback
        ? targetSub.remarks
        : undefined) ||
      undefined;

    return NextResponse.json({
      success: true,
      submissionId: finalSubmissionId,
      versions: reindexedVersions,
      submission: {
        id: finalSubmissionId,
        requirementCode: realReqCode,
        status: currentStatus,
        feedback,
        admin_remarks: feedback,
        notes: facultyNotes,
        faculty_notes: facultyNotes,
        reviewedAt: latestReview?.created_at
          ? new Date(latestReview.created_at).toISOString().split("T")[0]
          : undefined,
      },
    });
  } catch (error) {
    logger.error("versions_endpoint_error", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
