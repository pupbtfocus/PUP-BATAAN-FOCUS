import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { logger } from "@/lib/observability/logger";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type DocumentVersionRow = {
  id: string;
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
  requirement_code?: string | null;
  requirement_type?: string | null;
  status: string | null;
  submitted_at?: string | null;
  created_at?: string | null;
  storage_path?: string | null;
  file_path?: string | null;
  file_name?: string | null;
  mime_type?: string | null;
  size_bytes?: number | null;
  file_size?: number | null;
  checksum_sha256?: string | null;
  notes?: string | null;
  remarks?: string | null;
  admin_remarks?: string | null;
};

function extractFileName(storagePath: string): string {
  const parts = storagePath.split("/");
  return parts[parts.length - 1] ?? storagePath;
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

    const supabase = getServiceRoleClient();

    // Resolve faculty profile
    const { data: profile, error: profileError } = await supabase
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

    const facultyIdList = Array.from(new Set([user.id, profile.id]));

    // 1. Flexible Submission Lookup: query by id = submissionId, requirement_code, or requirement_id
    let { data: rawSubmission } = await supabase
      .from("submissions")
      .select(
        "id, requirement_code, status, submitted_at, created_at, remarks, admin_remarks",
      )
      .eq("id", submissionId)
      .maybeSingle();

    // Fallback lookup if not found by direct ID: match user/profile + requirement identifier
    if (!rawSubmission) {
      const { data: byProfile } = await supabase
        .from("submissions")
        .select(
          "id, requirement_code, status, submitted_at, created_at, remarks, admin_remarks",
        )
        .in("faculty_profile_id", facultyIdList)
        .or(`requirement_code.eq.${submissionId},id.eq.${submissionId}`)
        .order("submitted_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (byProfile) {
        rawSubmission = byProfile;
      } else {
        const { data: byFallbackUser } = await supabase
          .from("submissions")
          .select(
            "id, requirement_code, status, submitted_at, created_at, remarks, admin_remarks",
          )
          .or(`user_id.in.(${facultyIdList.join(",")}),faculty_id.in.(${facultyIdList.join(",")})`)
          .or(`requirement_code.eq.${submissionId},id.eq.${submissionId}`)
          .order("submitted_at", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        rawSubmission = byFallbackUser ?? null;
      }
    }

    // If still no submission is found, return 200 OK with empty versions array
    if (!rawSubmission) {
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

    // 2. Fetch version rows from document_versions table
    const { data: versions, error: versionsError } = await supabase
      .from("document_versions")
      .select(
        "id, version_number, storage_path, mime_type, size_bytes, checksum_sha256, created_at",
      )
      .eq("submission_id", targetSubmissionId)
      .order("version_number", { ascending: false });

    if (versionsError) {
      logger.error("document_versions_fetch_failed", {
        submissionId: targetSubmissionId,
        error: versionsError.message,
      });
      return NextResponse.json(
        { error: "Failed to load document versions" },
        { status: 500 },
      );
    }

    const typedVersions = (versions ?? []) as DocumentVersionRow[];

    // 3. Fetch latest review decision
    let latestReview: ReviewDecision | null = null;
    try {
      const { data: reviewsData } = await supabase
        .from("review_decisions")
        .select("decision, remarks, created_at")
        .eq("submission_id", targetSubmissionId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (reviewsData) {
        latestReview = reviewsData as ReviewDecision;
      }
    } catch (reviewErr) {
      logger.error("review_decisions_fetch_exception", {
        submissionId: targetSubmissionId,
        error:
          reviewErr instanceof Error ? reviewErr.message : String(reviewErr),
      });
    }

    const reqCode =
      submission.requirement_code ||
      submission.requirement_type ||
      submissionId;

    // 4. Map existing document_versions rows
    const versionDetails = typedVersions.map((version) => {
      const fileName = extractFileName(version.storage_path);
      const sizeBytes = version.size_bytes ?? 0;
      const downloadUrl = `/api/faculty/submissions/view?submissionId=${encodeURIComponent(targetSubmissionId)}&versionId=${encodeURIComponent(version.id)}&download=true&filename=${encodeURIComponent(fileName)}`;

      return {
        id: version.id,
        versionNumber: version.version_number,
        version_number: version.version_number,
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
        remarks: submission.remarks ?? submission.admin_remarks ?? submission.notes ?? null,
        downloadUrl,
        download_url: downloadUrl,
      };
    });

    // 5. Fallback Logic: If document_versions is empty OR does not contain Version 1, construct Version 1 from submissions table
    const hasVersion1 = versionDetails.some(
      (v) => (v.versionNumber === 1 || v.version_number === 1),
    );

    if (!hasVersion1) {
      const initialPath =
        submission.storage_path ||
        submission.file_path ||
        "";
      const initialFileName =
        submission.file_name ||
        (initialPath ? extractFileName(initialPath) : "") ||
        `${reqCode || "submission"}_v1`;
      const initialSizeBytes =
        submission.size_bytes || submission.file_size || 0;
      const initialCreatedAt =
        submission.submitted_at ||
        submission.created_at ||
        new Date().toISOString();
      const initialDownloadUrl = `/api/faculty/submissions/view?submissionId=${encodeURIComponent(targetSubmissionId)}&download=true&filename=${encodeURIComponent(initialFileName)}`;

      const initialVersion = {
        id: `${submission.id}-v1`,
        versionNumber: 1,
        version_number: 1,
        storagePath: initialPath,
        file_path: initialPath,
        fileName: initialFileName,
        file_name: initialFileName,
        mimeType: submission.mime_type ?? "application/octet-stream",
        sizeBytes: initialSizeBytes,
        size_bytes: initialSizeBytes,
        sizeFormatted: formatFileSize(initialSizeBytes),
        size_formatted: formatFileSize(initialSizeBytes),
        checksumSha256: submission.checksum_sha256 ?? "",
        createdAt: initialCreatedAt,
        created_at: initialCreatedAt,
        status: submission.status ?? "uploaded",
        remarks: submission.remarks ?? submission.admin_remarks ?? submission.notes ?? null,
        downloadUrl: initialDownloadUrl,
        download_url: initialDownloadUrl,
      };

      versionDetails.push(initialVersion);
    }

    // 6. Sort all versions by version_number descending (e.g. Version 3 -> Version 2 -> Version 1)
    versionDetails.sort(
      (a, b) =>
        (b.versionNumber ?? b.version_number ?? 0) -
        (a.versionNumber ?? a.version_number ?? 0),
    );

    return NextResponse.json({
      success: true,
      submissionId: targetSubmissionId,
      versions: versionDetails,
      submission: {
        id: submission.id,
        requirementCode: reqCode,
        status: submission.status ?? "uploaded",
        feedback: latestReview?.remarks ?? submission.admin_remarks ?? undefined,
        admin_remarks: latestReview?.remarks ?? submission.admin_remarks ?? undefined,
        notes: (submission.notes || (!latestReview?.remarks && !submission.admin_remarks ? submission.remarks : undefined)) || undefined,
        faculty_notes: (submission.notes || (!latestReview?.remarks && !submission.admin_remarks ? submission.remarks : undefined)) || undefined,
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
