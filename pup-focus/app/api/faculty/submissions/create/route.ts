import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { logger } from "@/lib/observability/logger";
import { logAuditEvent } from "@/features/audit-logs/services/audit-log.service";
import { DEFAULT_REQUIREMENTS, REQUIREMENT_LABEL } from "@/config/compliance";
import type { RequirementCode } from "@/config/compliance";
import { createNotification } from "@/features/notifications/services/notification.service";
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

function isMissingFacultyAssignmentIdError(
  error: { message?: string } | null,
): boolean {
  const message = (error?.message || "").toLowerCase();
  return (
    message.includes("faculty_assignment_id") &&
    (message.includes("submissions") ||
      message.includes("schema cache") ||
      message.includes("does not exist") ||
      message.includes("column"))
  );
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
    const requirementCodeInput =
      (formData.get("requirementCode") as string) ||
      (formData.get("requirement_type") as string) ||
      "";

    const payload = {
      academicYear: formData.get("academicYear") as string,
      semester: formData.get("semester") as string,
      requirementCode: requirementCodeInput,
      remarks:
        (formData.get("remarks") as string) ||
        (formData.get("notes") as string) ||
        "",
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
      .select("profile_id, full_name")
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

    // Backend Guard Against Duplicate Submissions
    // Check if an existing submission for this requirement_code & faculty_profile_id is already uploaded, pending, or validated.
    const { data: existingSubmissions } = await supabase
      .from("submissions")
      .select("id, status")
      .eq("faculty_profile_id", appUser.profile_id)
      .eq("requirement_code", payload.requirementCode)
      .order("submitted_at", { ascending: false });

    if (existingSubmissions && existingSubmissions.length > 0) {
      const latestSub = existingSubmissions[0];
      const { data: decisions } = await supabase
        .from("review_decisions")
        .select("decision")
        .eq("submission_id", latestSub.id)
        .order("created_at", { ascending: false })
        .limit(1);

      const latestDecision = decisions?.[0]?.decision;
      const isRejected =
        latestSub.status === "rejected" || latestDecision === "rejected";

      if (
        !isRejected &&
        (latestSub.status === "uploaded" ||
          latestSub.status === "pending" ||
          latestSub.status === "submitted" ||
          latestSub.status === "validated" ||
          latestDecision === "validated")
      ) {
        return NextResponse.json(
          {
            error:
              "This requirement has already been submitted and is currently pending or validated.",
          },
          { status: 400 },
        );
      }
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
        // Do not bind submissions to an older assignment from a different term.
        facultyAssignmentId = null;
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

    if (
      submissionError &&
      (isMissingRemarksColumnError(submissionError) ||
        isMissingFacultyAssignmentIdError(submissionError))
    ) {
      const fallbackPayload: Record<string, any> = {
        id: submissionId,
        faculty_profile_id: appUser.profile_id,
        curriculum_id: curriculumId,
        requirement_code: payload.requirementCode,
        status: "uploaded",
        submitted_at: submissionPayload.submitted_at,
      };

      if (!isMissingRemarksColumnError(submissionError) && trimmedRemarks) {
        fallbackPayload.remarks = trimmedRemarks;
      }

      if (
        !isMissingFacultyAssignmentIdError(submissionError) &&
        facultyAssignmentId
      ) {
        fallbackPayload.faculty_assignment_id = facultyAssignmentId;
      }

      ({ data: submission, error: submissionError } = await supabase
        .from("submissions")
        .insert(fallbackPayload)
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

    // Non-critical background tasks: notifications and audit logging (executed asynchronously so endpoint returns fast)
    void (async () => {
      try {
        const { data: facultyProfile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", appUser.profile_id)
          .maybeSingle();

        const facultyName =
          facultyProfile?.full_name || appUser.full_name || "Faculty Member";
        const reqCode = payload.requirementCode as RequirementCode;
        const reqLabel = REQUIREMENT_LABEL[reqCode] || payload.requirementCode;

        const reviewerSet = new Set<string>();

        const { data: reviewerAppUsers } = await supabase
          .from("app_users")
          .select("auth_user_id")
          .in("role", ["program_head", "admin", "super_admin"]);

        if (reviewerAppUsers) {
          for (const r of reviewerAppUsers) {
            if (r.auth_user_id) reviewerSet.add(r.auth_user_id);
          }
        }

        const { data: reviewerProfiles } = await supabase
          .from("profiles")
          .select("user_id")
          .in("role", ["program_head", "admin", "super_admin"]);

        if (reviewerProfiles) {
          for (const p of reviewerProfiles) {
            if (p.user_id) reviewerSet.add(p.user_id);
          }
        }

        const uniqueAuthUserIds = Array.from(reviewerSet);

        for (const reviewerAuthUserId of uniqueAuthUserIds) {
          if (reviewerAuthUserId === user.id) continue;

          await createNotification({
            userId: reviewerAuthUserId,
            type: "submission_uploaded",
            title: `New Submission from ${facultyName}`,
            message: `Uploaded ${reqLabel} for ${payload.academicYear} ${payload.semester}.`,
            metadata: {
              submission_id: submissionId,
              submissionId,
              faculty_profile_id: appUser.profile_id,
              facultyName,
              requirement_code: payload.requirementCode,
              requirementCode: payload.requirementCode,
            },
          });
        }
      } catch (notifErr) {
        logger.error("notification_creation_failed_on_upload", {
          submissionId,
          error: notifErr instanceof Error ? notifErr.message : String(notifErr),
        });
      }

      try {
        await logAuditEvent({
          actorId: user.id,
          action: "submission.upload",
          entityType: "submission",
          entityId: submissionId,
          metadata: {
            requirement_code: payload.requirementCode,
            file_name: fileName,
            academic_year: payload.academicYear,
            semester: payload.semester,
            faculty_profile_id: appUser.profile_id,
            document_version_id: documentVersion.id,
          },
        });
      } catch (auditError) {
        logger.error("audit_log_submission_upload_failed", {
          submissionId,
          error: auditError instanceof Error ? auditError.message : String(auditError),
        });
      }
    })();

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
