import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { logger } from "@/lib/observability/logger";
import { DEFAULT_REQUIREMENTS } from "@/config/compliance";
import type { RequirementCode } from "@/config/compliance";
import {
  evaluateSubmissionWindow,
  format24HourTo12Hour,
  getSubmissionWindow,
  isValidAcademicYear,
  isValidSemester,
  normalizeSemester,
} from "@/features/submissions/services/submission-window.service";
import crypto from "crypto";

type SubmissionPayload = {
  academicYear: string;
  semester: string;
  requirementCode: string;
  remarks?: string;
};

function isMissingRemarksColumnError(
  error: { message?: string } | null,
): boolean {
  const message = (error?.message || "").toLowerCase();
  return message.includes("remarks") && message.includes("submissions");
}

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

    const supabase = getServiceRoleClient();

    // Validate if submissions are currently open.
    const submissionWindow = await getSubmissionWindow(supabase);
    const windowState = evaluateSubmissionWindow(submissionWindow);
    if (!windowState.isOpen) {
      const startTimeLabel = windowState.startTime
        ? format24HourTo12Hour(windowState.startTime)
        : "";
      const endTimeLabel = windowState.endTime
        ? format24HourTo12Hour(windowState.endTime)
        : "";

      return NextResponse.json(
        {
          error: windowState.isConfigured
            ? `Submission period is closed. Allowed schedule: ${windowState.startDate} ${startTimeLabel} to ${windowState.endDate} ${endTimeLabel}.`
            : "Submission period is not set by admin yet. Please wait for admin to set start and end dates.",
          window: windowState,
        },
        { status: 403 },
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

    if (!isValidAcademicYear(payload.academicYear)) {
      return NextResponse.json(
        { error: "Academic year must be in YYYY-YYYY format." },
        { status: 400 },
      );
    }

    payload.semester = normalizeSemester(payload.semester);
    if (!isValidSemester(payload.semester)) {
      return NextResponse.json(
        { error: "Semester must be either 1st Semester or 2nd Semester." },
        { status: 400 },
      );
    }

    if (
      submissionWindow?.academicYear &&
      submissionWindow?.semester &&
      (payload.academicYear !== submissionWindow.academicYear ||
        payload.semester !== submissionWindow.semester)
    ) {
      return NextResponse.json(
        {
          error:
            "Submission must match the currently active academic year and semester.",
        },
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
    const { data: appUser, error: appUserError } = await supabase
      .from("app_users")
      .select("profile_id")
      .eq("auth_user_id", user.id)
      .single();

    if (appUserError || !appUser || !appUser.profile_id) {
      logger.error("faculty_not_found", {
        authUserId: user.id,
        error: appUserError?.message,
        profileId: appUser?.profile_id ?? null,
      });
      return NextResponse.json(
        { error: "Faculty profile not found" },
        { status: 404 },
      );
    }

    // Get faculty's assigned curriculum and assignment record for the selected term,
    // or use the most recent assignment as a fallback.
    let curriculumId: string | null = null;
    let facultyAssignmentId: string | null = null;

    const { data: currentTermAssignment, error: currentTermAssignmentError } =
      await supabase
        .from("faculty_program_assignments")
        .select("id, curriculum_id")
        .eq("faculty_profile_id", appUser.profile_id)
        .eq("academic_year", payload.academicYear)
        .eq("term", payload.semester)
        .single();

    if (currentTermAssignmentError) {
      logger.warn("current_term_assignment_fetch_failed", {
        facultyId: appUser.profile_id,
        academicYear: payload.academicYear,
        semester: payload.semester,
        error: currentTermAssignmentError.message,
      });
    }

    if (currentTermAssignment?.curriculum_id) {
      curriculumId = currentTermAssignment.curriculum_id;
      facultyAssignmentId = currentTermAssignment.id ?? null;
    } else {
      if (currentTermAssignmentError) {
        logger.warn("current_term_assignment_fetch_failed", {
          facultyId: appUser.profile_id,
          academicYear: payload.academicYear,
          semester: payload.semester,
          error: currentTermAssignmentError.message,
        });
      } else {
        logger.warn("no_current_term_assignment_found", {
          facultyId: appUser.profile_id,
          academicYear: payload.academicYear,
          semester: payload.semester,
        });
      }

      const { data: latestAssignment, error: latestAssignmentError } =
        await supabase
          .from("faculty_program_assignments")
          .select("curriculum_id")
          .eq("faculty_profile_id", appUser.profile_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

      if (latestAssignment?.curriculum_id) {
        curriculumId = latestAssignment.curriculum_id;
      } else {
        if (latestAssignmentError) {
          logger.warn("latest_assignment_fetch_failed", {
            facultyId: appUser.profile_id,
            error: latestAssignmentError.message,
          });
        }

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
    }

    // Create submission record
    const submissionId = crypto.randomUUID();
    const trimmedRemarks = payload.remarks?.trim();
    const submissionPayload = {
      id: submissionId,
      faculty_profile_id: appUser.profile_id,
      curriculum_id: curriculumId,
      faculty_assignment_id: facultyAssignmentId ?? undefined,
      requirement_code: payload.requirementCode,
      status: "uploaded",
      submitted_at: new Date().toISOString(),
      ...(trimmedRemarks ? { remarks: trimmedRemarks } : {}),
    };

    let { data: submission, error: submissionError } = await supabase
      .from("submissions")
      .insert(submissionPayload)
      .select()
      .single();

    if (submissionError && isMissingRemarksColumnError(submissionError)) {
      ({ data: submission, error: submissionError } = await supabase
        .from("submissions")
        .insert({
          id: submissionId,
          faculty_profile_id: appUser.profile_id,
          curriculum_id: curriculumId,
          faculty_assignment_id: facultyAssignmentId ?? undefined,
          requirement_code: payload.requirementCode,
          status: "uploaded",
          submitted_at: submissionPayload.submitted_at,
        })
        .select()
        .single());
    }

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
