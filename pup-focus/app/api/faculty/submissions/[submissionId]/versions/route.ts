import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { logger } from "@/lib/observability/logger";

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
  requirement_code: string;
  status: string | null;
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

    // Verify submission belongs to authenticated faculty
    const { data: submission, error: submissionError } = await supabase
      .from("submissions")
      .select(
        `
        id,
        requirement_code,
        status,
        review_decisions(
          decision,
          remarks,
          created_at
        )
      `,
      )
      .eq("id", submissionId)
      .eq("faculty_profile_id", appUser.profile_id)
      .maybeSingle();

    if (submissionError || !submission) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 },
      );
    }

    const typedSubmission = submission as unknown as SubmissionRow;

    // Fetch all document versions for the submission
    const { data: versions, error: versionsError } = await supabase
      .from("document_versions")
      .select(
        "id, version_number, storage_path, mime_type, size_bytes, checksum_sha256, created_at",
      )
      .eq("submission_id", submissionId)
      .order("version_number", { ascending: false });

    if (versionsError) {
      logger.error("document_versions_fetch_failed", {
        submissionId,
        error: versionsError.message,
      });
      return NextResponse.json(
        { error: "Failed to load document versions" },
        { status: 500 },
      );
    }

    const typedVersions = (versions ?? []) as DocumentVersionRow[];

    // Generate signed download URLs for each version
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

    // Get latest review decision for submission context
    const reviews = (typedSubmission.review_decisions ?? [])
      .filter((r) => !!r.created_at)
      .sort((a, b) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bTime - aTime;
      });

    const latestReview = reviews[0];

    return NextResponse.json({
      versions: versionDetails,
      submission: {
        id: typedSubmission.id,
        requirementCode: typedSubmission.requirement_code,
        status: typedSubmission.status ?? "uploaded",
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
