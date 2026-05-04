import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { logger } from "@/lib/observability/logger";
import { DEFAULT_REQUIREMENTS } from "@/config/compliance";
import type { RequirementCode } from "@/config/compliance";
import crypto from "crypto";

type SubmissionPayload = {
  academicYear: string;
  semester: string;
  requirementCode: string;
  remarks?: string;
};

export async function POST(request: NextRequest) {
  try {
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

    // Get form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Parse submission metadata
    const payload = {
      academicYear: formData.get("academicYear") as string,
      semester: formData.get("semester") as string,
      requirementCode: formData.get("requirementCode") as string,
      remarks: formData.get("remarks") as string,
    };

    // Validate inputs
    if (
      !payload.academicYear ||
      !payload.semester ||
      !payload.requirementCode
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    if (
      !DEFAULT_REQUIREMENTS.includes(payload.requirementCode as RequirementCode)
    ) {
      return NextResponse.json(
        { error: "Invalid requirement code" },
        { status: 400 },
      );
    }

    // Get faculty profile ID
    const supabase = getServiceRoleClient();
    const { data: appUser, error: appUserError } = await supabase
      .from("app_users")
      .select("profile_id")
      .eq("auth_user_id", user.id)
      .single();

    if (appUserError || !appUser) {
      logger.error("faculty_not_found", {
        authUserId: user.id,
        error: appUserError?.message,
      });
      return NextResponse.json(
        { error: "Faculty profile not found" },
        { status: 404 },
      );
    }

    // Get faculty's assigned curriculum, or use first available curriculum
    let curriculumId: string | null = null;

    const { data: assignment } = await supabase
      .from("faculty_program_assignments")
      .select("curriculum_id")
      .eq("faculty_profile_id", appUser.profile_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (assignment?.curriculum_id) {
      curriculumId = assignment.curriculum_id;
    } else {
      // Fallback: use first available curriculum
      const { data: curriculum, error: curriculumError } = await supabase
        .from("curricula")
        .select("id")
        .limit(1)
        .single();

      if (!curriculum) {
        logger.error("no_curriculum_available", {
          facultyId: appUser.profile_id,
        });
        return NextResponse.json(
          {
            error:
              "No curriculum found in the system. Please contact an administrator.",
          },
          { status: 400 },
        );
      }

      curriculumId = curriculum.id;
      logger.warn("faculty_using_fallback_curriculum", {
        facultyId: appUser.profile_id,
        curriculumId,
      });
    }

    // Create submission record
    const submissionId = crypto.randomUUID();
    const { data: submission, error: submissionError } = await supabase
      .from("submissions")
      .insert({
        id: submissionId,
        faculty_profile_id: appUser.profile_id,
        curriculum_id: curriculumId,
        requirement_code: payload.requirementCode,
        status: "uploaded",
        submitted_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (submissionError) {
      logger.error("submission_creation_failed", {
        facultyId: appUser.profile_id,
        error: submissionError.message,
      });
      return NextResponse.json(
        { error: "Failed to create submission record" },
        { status: 500 },
      );
    }

    // Prepare file for upload to Supabase Storage
    const fileName = file.name;
    const fileBuffer = await file.arrayBuffer();
    const storagePath = `faculty-submissions/${appUser.profile_id}/${submissionId}/${fileName}`;

    // Calculate SHA-256 checksum
    const hashBuffer = await crypto.subtle.digest("SHA-256", fileBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const checksumSha256 = hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Upload file to storage
    const { error: uploadError } = await supabase.storage
      .from("faculty-submissions")
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      logger.error("file_upload_failed", {
        submissionId,
        error: uploadError.message,
      });
      // Delete submission record if file upload fails
      await supabase.from("submissions").delete().eq("id", submissionId);
      return NextResponse.json(
        { error: "Failed to upload file" },
        { status: 500 },
      );
    }

    // Create document version record
    const { data: documentVersion, error: docVersionError } = await supabase
      .from("document_versions")
      .insert({
        submission_id: submissionId,
        version_number: 1,
        storage_path: storagePath,
        mime_type: file.type || "application/octet-stream",
        size_bytes: fileBuffer.byteLength,
        checksum_sha256: checksumSha256,
        created_by: user.id,
      })
      .select()
      .single();

    if (docVersionError) {
      logger.error("document_version_creation_failed", {
        submissionId,
        error: docVersionError.message,
      });
      return NextResponse.json(
        { error: "Failed to record document version" },
        { status: 500 },
      );
    }

    logger.info("submission_created_successfully", {
      submissionId,
      facultyId: appUser.profile_id,
      requirementCode: payload.requirementCode,
    });

    return NextResponse.json(
      {
        success: true,
        submissionId,
        versionNumber: documentVersion.version_number,
        fileName,
        academicYear: payload.academicYear,
        semester: payload.semester,
        requirementCode: payload.requirementCode,
      },
      { status: 201 },
    );
  } catch (error) {
    logger.error("submission_endpoint_error", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
