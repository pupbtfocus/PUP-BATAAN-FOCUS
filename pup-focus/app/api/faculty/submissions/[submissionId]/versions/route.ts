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
  file_url?: string | null;
  file_name?: string | null;
  mime_type?: string | null;
  size_bytes?: number | null;
  file_size?: number | null;
  checksum_sha256?: string | null;
  notes?: string | null;
  remarks?: string | null;
  review_decisions?: ReviewDecision[] | null;
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

    // Authenticate faculty user
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
    const { data: appUser, error: appUserError } = await supabase
      .from("app_users")
      .select("profile_id")
      .eq("auth_user_id", user.id)
      .single();

    if (appUserError || !appUser?.profile_id) {
      logger.error("faculty_not_found", {
        authUserId: user.id,
        error: appUserError?.message,
      });
      return NextResponse.json(
        { error: "Faculty profile not found" },
        { status: 404 },
      );
    }

    // 1. Flexible Submission Lookup
    // Query main submission record using .maybeSingle()
    let { data: rawSubmission } = await supabase
      .from("submissions")
      .select("*")
      .eq("id", submissionId)
      .maybeSingle();

    // Fallback lookup if not found by ID: match requirement_type or requirement_code for the logged-in user
    if (!rawSubmission) {
      const { data: fallbackByProfile } = await supabase
        .from("submissions")
        .select("*")
        .eq("faculty_profile_id", appUser.profile_id)
        .or(`requirement_type.eq.${submissionId},requirement_code.eq.${submissionId}`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fallbackByProfile) {
        rawSubmission = fallbackByProfile;
      } else {
        const { data: fallbackByFacultyId } = await supabase
          .from("submissions")
          .select("*")
          .eq("faculty_id", appUser.profile_id)
          .or(`requirement_type.eq.${submissionId},requirement_code.eq.${submissionId}`)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        rawSubmission = fallbackByFacultyId ?? null;
      }
    }

    // If still no submission is found, return 200 OK with empty versions array instead of 404
    if (!rawSubmission) {
      return NextResponse.json({
        success: true,
        versions: [],
        submission: null,
        message: "No previous versions found",
      });
    }

    const submission = rawSubmission as unknown as SubmissionRow;
    const targetSubmissionId = submission.id;

    // 2. Fetch version rows from document_versions table matching submission_id = targetSubmissionId
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

    // Fetch review decisions separately
    let reviewDecisions: ReviewDecision[] = [];
    try {
      const { data: reviewsData } = await supabase
        .from("review_decisions")
        .select("decision, remarks, created_at")
        .eq("submission_id", targetSubmissionId)
        .order("created_at", { ascending: false });

      if (reviewsData) {
        reviewDecisions = reviewsData as ReviewDecision[];
      }
    } catch (reviewErr) {
      logger.error("review_decisions_fetch_exception", {
        submissionId: targetSubmissionId,
        error: reviewErr instanceof Error ? reviewErr.message : String(reviewErr),
      });
    }

    const latestReview = reviewDecisions.length > 0 ? reviewDecisions[0] : null;
    const reqCode =
      submission.requirement_code ||
      submission.requirement_type ||
      submissionId;

    // 3. Fallback Initial Version (v1) if document_versions is EMPTY
    if (typedVersions.length === 0) {
      const path =
        submission.storage_path ||
        submission.file_path ||
        submission.file_url ||
        "";

      let downloadUrl = "";
      if (path) {
        if (path.startsWith("http://") || path.startsWith("https://")) {
          downloadUrl = path;
        } else {
          const { data: signed } = await supabase.storage
            .from("faculty-submissions")
            .createSignedUrl(path, 60 * 60);
          downloadUrl = signed?.signedUrl ?? "";
        }
      }

      const fileName =
        submission.file_name ||
        (path ? extractFileName(path) : "") ||
        "Uploaded Document";
      const sizeBytes = submission.size_bytes || submission.file_size || 0;
      const createdAt =
        submission.created_at ||
        submission.submitted_at ||
        new Date().toISOString();

      const initialVersion = {
        id: submission.id,
        versionNumber: 1,
        storagePath: path,
        fileName,
        mimeType: submission.mime_type ?? "application/octet-stream",
        sizeBytes,
        sizeFormatted: formatFileSize(sizeBytes),
        checksumSha256: submission.checksum_sha256 ?? "",
        createdAt,
        downloadUrl,
      };

      return NextResponse.json({
        success: true,
        versions: [initialVersion],
        submission: {
          id: submission.id,
          requirementCode: reqCode,
          status: submission.status ?? "uploaded",
          feedback: latestReview?.remarks ?? undefined,
          reviewedAt: latestReview?.created_at
            ? new Date(latestReview.created_at).toISOString().split("T")[0]
            : undefined,
        },
        message: "No document_versions found; returned initial Version 1 from submission record.",
      });
    }

    // 4. Multiple Versions Exist in document_versions table
    const versionDetails = await Promise.all(
      typedVersions.map(async (version) => {
        let downloadUrl = "";

        if (version.storage_path) {
          const { data: signed } = await supabase.storage
            .from("faculty-submissions")
            .createSignedUrl(version.storage_path, 60 * 60); // 1-hour expiry

          downloadUrl = signed?.signedUrl ?? "";
        }

        return {
          id: version.id,
          versionNumber: version.version_number,
          storagePath: version.storage_path,
          fileName: extractFileName(version.storage_path),
          mimeType: version.mime_type ?? "application/octet-stream",
          sizeBytes: version.size_bytes ?? 0,
          sizeFormatted: formatFileSize(version.size_bytes),
          checksumSha256: version.checksum_sha256 ?? "",
          createdAt: version.created_at ?? new Date().toISOString(),
          downloadUrl,
        };
      }),
    );

    return NextResponse.json({
      success: true,
      versions: versionDetails,
      submission: {
        id: submission.id,
        requirementCode: reqCode,
        status: submission.status ?? "uploaded",
        feedback: latestReview?.remarks ?? undefined,
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
