import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
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
  requirement_code?: string | null;
  requirement_type?: string | null;
  status: string | null;
  submitted_at?: string | null;
  created_at?: string | null;
  notes?: string | null;
  remarks?: string | null;
  admin_remarks?: string | null;
};

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
    const { submissionId } = await params;

    if (!submissionId) {
      return NextResponse.json(
        { error: "submissionId is required" },
        { status: 400 },
      );
    }

    // Authenticate user
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

    const supabaseAdmin = getServiceRoleClient();

    // Resolve faculty profile
    const { data: profile, error: profileError } = await supabaseAdmin
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

    const facultyProfileId = profile.id;
    const facultyIdList = Array.from(new Set([user.id, profile.id]));

    // 1. Flexible Root Submission Lookup: query by id = submissionId or requirement code
    let { data: rawSubmission } = await supabaseAdmin
      .from("submissions")
      .select(
        "id, faculty_profile_id, requirement_code, status, submitted_at, created_at, remarks, notes",
      )
      .eq("id", submissionId)
      .maybeSingle();

    if (!rawSubmission) {
      const { data: allProfileSubs } = await supabaseAdmin
        .from("submissions")
        .select(
          "id, faculty_profile_id, requirement_code, status, submitted_at, created_at, remarks, notes",
        )
        .in("faculty_profile_id", facultyIdList)
        .order("submitted_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });

      const matchedReq = matchRequirementCode(submissionId);
      const found = (allProfileSubs || []).find((s) => {
        return (
          s.id === submissionId ||
          s.requirement_code === submissionId ||
          (matchedReq && matchRequirementCode(s.requirement_code) === matchedReq)
        );
      });

      if (found) {
        rawSubmission = found;
      }
    }

    // If still no submission row is found, check if document_versions has records directly for submissionId
    if (!rawSubmission) {
      const { data: directDocVers } = await supabaseAdmin
        .from("document_versions")
        .select(
          "id, submission_id, version_number, storage_path, mime_type, size_bytes, checksum_sha256, created_at",
        )
        .eq("submission_id", submissionId)
        .order("created_at", { ascending: true });

      if (directDocVers && directDocVers.length > 0) {
        const reindexed = directDocVers.map((v, i) => {
          const vNum = i + 1;
          const fileName = extractFileName(v.storage_path);
          const sizeBytes = v.size_bytes ?? 0;
          const downloadUrl = `/api/faculty/submissions/view?submissionId=${encodeURIComponent(submissionId)}&versionId=${encodeURIComponent(v.id)}&download=true&filename=${encodeURIComponent(fileName)}`;
          return {
            id: v.id,
            versionNumber: vNum,
            version_number: vNum,
            storagePath: v.storage_path,
            file_path: v.storage_path,
            fileName,
            file_name: fileName,
            mimeType: v.mime_type ?? "application/octet-stream",
            sizeBytes,
            size_bytes: sizeBytes,
            sizeFormatted: formatFileSize(sizeBytes),
            size_formatted: formatFileSize(sizeBytes),
            checksumSha256: v.checksum_sha256 ?? "",
            createdAt: v.created_at ?? new Date().toISOString(),
            created_at: v.created_at ?? new Date().toISOString(),
            status: "uploaded",
            remarks: null,
            downloadUrl,
            download_url: downloadUrl,
          };
        });

        reindexed.sort((a, b) => b.versionNumber - a.versionNumber);

        return NextResponse.json({
          success: true,
          submissionId,
          versions: reindexed,
          submission: {
            id: submissionId,
            requirementCode: submissionId,
            status: "uploaded",
          },
        });
      }

      return NextResponse.json({
        success: true,
        submissionId,
        versions: [],
        submission: null,
        message: "No previous versions found",
      });
    }

    const submission = rawSubmission as unknown as SubmissionRow;
    const targetSubmissionId = submission.id;
    const targetReqCode =
      submission.requirement_code ||
      submission.requirement_type ||
      submissionId;

    // 2. Aggregate ALL Submission Records for this Faculty & Requirement
    const { data: allRelatedSubmissions } = await supabaseAdmin
      .from("submissions")
      .select(
        "id, faculty_profile_id, requirement_code, status, submitted_at, created_at, remarks, notes",
      )
      .eq("faculty_profile_id", facultyProfileId)
      .order("created_at", { ascending: true });

    const matchingSubmissions = (allRelatedSubmissions || []).filter((sub) => {
      const matched = matchRequirementCode(sub.requirement_code);
      return (
        sub.id === targetSubmissionId ||
        sub.id === submissionId ||
        sub.requirement_code === targetReqCode ||
        matched === targetReqCode ||
        matchRequirementCode(targetReqCode) === matched
      );
    });

    const allSubmissionIds = Array.from(
      new Set(
        [
          targetSubmissionId,
          submissionId,
          ...matchingSubmissions.map((s) => s.id),
        ].filter(Boolean),
      ),
    );

    // 3. Query document_versions across ALL matching submission IDs
    const { data: rawVersions, error: versionsError } = await supabaseAdmin
      .from("document_versions")
      .select(
        "id, submission_id, version_number, storage_path, mime_type, size_bytes, checksum_sha256, created_at",
      )
      .in("submission_id", allSubmissionIds)
      .order("created_at", { ascending: true });

    if (versionsError) {
      logger.error("document_versions_fetch_failed", {
        submissionIds: allSubmissionIds,
        error: versionsError.message,
      });
    }

    const fetchedVersions = (rawVersions || []) as DocumentVersionRow[];

    // 4. Legacy Fallback: check if any matching submission has no rows in document_versions
    const versionStoragePaths = new Set(
      fetchedVersions.map((v) => v.storage_path),
    );

    const aggregatedVersionRows: DocumentVersionRow[] = [...fetchedVersions];

    for (const sub of matchingSubmissions) {
      const hasVersionInDocVer = fetchedVersions.some(
        (v) => v.submission_id === sub.id,
      );

      if (!hasVersionInDocVer) {
        const fallbackPath = `faculty-submissions/${facultyProfileId}/${sub.id}/v1_${targetReqCode}`;
        if (!versionStoragePaths.has(fallbackPath)) {
          versionStoragePaths.add(fallbackPath);
          aggregatedVersionRows.push({
            id: `${sub.id}-v1`,
            submission_id: sub.id,
            version_number: 1,
            storage_path: fallbackPath,
            mime_type: "application/octet-stream",
            size_bytes: 0,
            checksum_sha256: "",
            created_at: sub.submitted_at || sub.created_at || new Date().toISOString(),
          });
        }
      }
    }

    // 5. Sort all aggregated versions chronologically (ascending)
    aggregatedVersionRows.sort((a, b) => {
      const timeA = new Date(a.created_at || 0).getTime();
      const timeB = new Date(b.created_at || 0).getTime();
      return timeA - timeB;
    });

    // 6. Deduplicate & Re-index sequentially (v1, v2, v3, ...)
    const reindexedVersions = aggregatedVersionRows.map((version, index) => {
      const versionNumber = index + 1;
      const fileName = extractFileName(version.storage_path);
      const sizeBytes = version.size_bytes ?? 0;
      const subIdForDownload = version.submission_id || targetSubmissionId;
      const downloadUrl = `/api/faculty/submissions/view?submissionId=${encodeURIComponent(subIdForDownload)}&versionId=${encodeURIComponent(version.id)}&download=true&filename=${encodeURIComponent(fileName)}`;

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
        status: submission.status ?? "uploaded",
        remarks: null,
        downloadUrl,
        download_url: downloadUrl,
      };
    });

    // If still empty, add default Version 1 from current submission
    if (reindexedVersions.length === 0) {
      const initialPath = `faculty-submissions/${facultyProfileId}/${targetSubmissionId}/v1_${targetReqCode}`;
      const initialFileName = `${targetReqCode}_v1`;
      const initialCreatedAt =
        submission.submitted_at ||
        submission.created_at ||
        new Date().toISOString();
      const initialDownloadUrl = `/api/faculty/submissions/view?submissionId=${encodeURIComponent(targetSubmissionId)}&download=true&filename=${encodeURIComponent(initialFileName)}`;

      reindexedVersions.push({
        id: `${targetSubmissionId}-v1`,
        versionNumber: 1,
        version_number: 1,
        storagePath: initialPath,
        file_path: initialPath,
        fileName: initialFileName,
        file_name: initialFileName,
        mimeType: "application/octet-stream",
        sizeBytes: 0,
        size_bytes: 0,
        sizeFormatted: formatFileSize(0),
        size_formatted: formatFileSize(0),
        checksumSha256: "",
        createdAt: initialCreatedAt,
        created_at: initialCreatedAt,
        status: submission.status ?? "uploaded",
        remarks: null,
        downloadUrl: initialDownloadUrl,
        download_url: initialDownloadUrl,
      });
    }

    // 7. Sort descending (e.g. Version N CURRENT at top, Version 1 at bottom)
    reindexedVersions.sort(
      (a, b) => b.versionNumber - a.versionNumber,
    );

    // 8. Fetch latest reviewer decision across all matching submission IDs
    let latestReview: ReviewDecision | null = null;
    try {
      const { data: reviewsData } = await supabaseAdmin
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

    return NextResponse.json({
      success: true,
      submissionId: targetSubmissionId,
      versions: reindexedVersions,
      submission: {
        id: submission.id,
        requirementCode: targetReqCode,
        status: submission.status ?? "uploaded",
        feedback: latestReview?.remarks ?? undefined,
        admin_remarks: latestReview?.remarks ?? undefined,
        notes: (submission.notes || (!latestReview?.remarks ? submission.remarks : undefined)) || undefined,
        faculty_notes: (submission.notes || (!latestReview?.remarks ? submission.remarks : undefined)) || undefined,
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
