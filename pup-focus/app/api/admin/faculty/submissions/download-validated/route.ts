import JSZip from "jszip";
import { NextResponse, type NextRequest } from "next/server";
import {
  DEFAULT_REQUIREMENTS,
  type RequirementCode,
  REQUIREMENT_LABEL,
} from "@/config/compliance";
import { ROLE } from "@/config/roles";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { logger } from "@/lib/observability/logger";

export const runtime = "nodejs";

type ReviewDecision = {
  decision: "validated" | "rejected";
  remarks?: string | null;
  created_at?: string | null;
};

type DocumentVersionRow = {
  id: string;
  storage_path: string;
  mime_type?: string | null;
  size_bytes?: number | null;
  created_at?: string | null;
  version_number?: number | null;
};

type SubmissionRow = {
  id: string;
  requirement_code: string;
  status: string | null;
  submitted_at?: string | null;
  created_at?: string | null;
  remarks?: string | null;
  document_versions?: DocumentVersionRow[] | null;
  review_decisions?: ReviewDecision[] | null;
};

function isMissingRemarksColumnError(
  error: { message?: string } | null,
): boolean {
  const message = (error?.message || "").toLowerCase();
  return message.includes("remarks") && message.includes("submissions");
}

function hasDocumentVersion(row: {
  document_versions?: Array<{ id: string }> | null;
}): boolean {
  return Array.isArray(row.document_versions)
    ? row.document_versions.length > 0
    : false;
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

function toHistoryStatus(
  submissionStatus: string | null,
  latestReview?: ReviewDecision,
): "Validated" | "Rejected" | "Pending" {
  if (
    latestReview?.decision === "validated" ||
    submissionStatus === "validated"
  ) {
    return "Validated";
  }

  if (
    latestReview?.decision === "rejected" ||
    submissionStatus === "rejected"
  ) {
    return "Rejected";
  }

  return "Pending";
}

function sanitizeFileName(value: string): string {
  return value
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function getFileExtension(storagePath: string): string {
  const fileName = storagePath.split("/").pop() ?? "";
  const match = fileName.match(/\.[^.]+$/);
  return match?.[0] ?? "";
}

function getLatestDocumentVersion(
  row: SubmissionRow,
): DocumentVersionRow | null {
  const versions = (row.document_versions || []).slice().sort((a, b) => {
    const versionDiff = (b.version_number ?? 0) - (a.version_number ?? 0);
    if (versionDiff !== 0) {
      return versionDiff;
    }

    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
    return bTime - aTime;
  });

  return versions[0] ?? null;
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

    if (
      !user ||
      (requesterRole !== ROLE.ADMIN && requesterRole !== ROLE.SUPER_ADMIN)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(request.url);
    const facultyId = url.searchParams.get("facultyId");
    const academicYear = url.searchParams.get("academicYear")?.trim() ?? "";
    const semester = url.searchParams.get("semester")?.trim() ?? "";

    if (!facultyId) {
      return NextResponse.json(
        { error: "facultyId is required" },
        { status: 400 },
      );
    }

    if (!academicYear || !semester) {
      return NextResponse.json(
        { error: "academicYear and semester are required" },
        { status: 400 },
      );
    }

    const supabase = getServiceRoleClient();

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

    const initialResult = await supabase
      .from("submissions")
      .select(
        `
        id,
        requirement_code,
        status,
        submitted_at,
        created_at,
        remarks,
        document_versions(
          id,
          version_number,
          storage_path,
          mime_type,
          size_bytes,
          created_at
        ),
        review_decisions(
          decision,
          remarks,
          created_at
        )
      `,
      )
      .eq("faculty_profile_id", facultyProfileId)
      .order("submitted_at", { ascending: false });

    let submissions = (initialResult.data as SubmissionRow[] | null) ?? null;
    let submissionsError = initialResult.error;

    if (submissionsError && isMissingRemarksColumnError(submissionsError)) {
      const fallbackResult = await supabase
        .from("submissions")
        .select(
          `
          id,
          requirement_code,
          status,
          submitted_at,
          created_at,
          document_versions(
            id,
            version_number,
            storage_path,
            mime_type,
            size_bytes,
            created_at
          ),
          review_decisions(
            decision,
            remarks,
            created_at
          )
        `,
        )
        .eq("faculty_profile_id", facultyProfileId)
        .order("submitted_at", { ascending: false });

      submissions = (fallbackResult.data as SubmissionRow[] | null) ?? null;
      submissionsError = fallbackResult.error;
    }

    if (submissionsError) {
      logger.error("validated_zip_fetch_failed", {
        facultyId: facultyProfileId,
        error: submissionsError.message,
      });
      return NextResponse.json(
        { error: "Failed to load submissions" },
        { status: 500 },
      );
    }

    const selectedFiles = new Map<
      RequirementCode,
      { submissionId: string; storagePath: string; fileName: string }
    >();

    for (const row of submissions || []) {
      if (
        !DEFAULT_REQUIREMENTS.includes(row.requirement_code as RequirementCode)
      ) {
        continue;
      }

      if (!hasDocumentVersion(row)) {
        continue;
      }

      const term = toAcademicYearAndSemester(
        row.submitted_at || row.created_at,
      );
      if (term.academicYear !== academicYear || term.semester !== semester) {
        continue;
      }

      const reviews = (row.review_decisions || [])
        .filter((review) => !!review.created_at)
        .sort((a, b) => {
          const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
          const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
          return bTime - aTime;
        });

      const latestReview = reviews[0];
      if (toHistoryStatus(row.status, latestReview) !== "Validated") {
        continue;
      }

      const latestDocument = getLatestDocumentVersion(row);
      if (!latestDocument?.storage_path) {
        continue;
      }

      const code = row.requirement_code as RequirementCode;
      if (selectedFiles.has(code)) {
        continue;
      }

      selectedFiles.set(code, {
        storagePath: latestDocument.storage_path,
        fileName: `${sanitizeFileName(REQUIREMENT_LABEL[code])}${getFileExtension(latestDocument.storage_path) || ""}`,
      });
    }

    if (selectedFiles.size === 0) {
      return NextResponse.json(
        { error: "No validated files found for the selected filter." },
        { status: 404 },
      );
    }

    const zip = new JSZip();

    for (const code of DEFAULT_REQUIREMENTS) {
      const fileEntry = selectedFiles.get(code);
      if (!fileEntry) {
        continue;
      }

      const { data: fileBlob, error: downloadError } = await supabase.storage
        .from("faculty-submissions")
        .download(fileEntry.storagePath);

      if (downloadError || !fileBlob) {
        return NextResponse.json(
          {
            error: `Failed to download ${REQUIREMENT_LABEL[code]}`,
            details: downloadError?.message,
          },
          { status: 500 },
        );
      }

      const fileBuffer = await fileBlob.arrayBuffer();
      const zipEntryName = `${sanitizeFileName(REQUIREMENT_LABEL[code])}/${fileEntry.fileName}`;
      zip.file(zipEntryName, Buffer.from(fileBuffer));
    }

    const archive = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
    });

    const archiveName = `validated-files-${sanitizeFileName(
      facultyProfileId,
    )}-${sanitizeFileName(academicYear)}-${sanitizeFileName(semester)}.zip`;

    return new NextResponse(archive, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${archiveName}"`,
      },
    });
  } catch (error) {
    logger.error("validated_zip_endpoint_error", {
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
