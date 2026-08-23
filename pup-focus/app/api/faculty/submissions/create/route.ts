import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { logger } from "@/lib/observability/logger";
import { logAuditEvent } from "@/features/audit-logs/services/audit-log.service";
import {
  DEFAULT_REQUIREMENTS,
  REQUIREMENT_CODE,
  REQUIREMENT_LABEL,
} from "@/config/compliance";
import type { RequirementCode } from "@/config/compliance";
import { createNotification } from "@/features/notifications/services/notification.service";
import {
  evaluateSubmissionWindow,
  format24HourTo12Hour,
  getSubmissionWindow,
  isValidAcademicYear,
  isValidSemester,
  normalizeSemester,
  normalizeTime24Hour,
} from "@/features/submissions/services/submission-window.service";
import crypto from "crypto";

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

function normalizeAcademicYear(value: string | null | undefined): string {
  if (!value) return "";
  return value.trim();
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

    // Query current active term directly from database
    const { data: dbCurrentTerm } = await supabase
      .from("academic_terms")
      .select("id, academic_year, semester")
      .eq("status", "Current")
      .maybeSingle();

    // Parse submission metadata
    const requirementCodeInput =
      (formData.get("requirementCode") as string) ||
      (formData.get("requirement_type") as string) ||
      "";

    const activeAcademicYear =
      (formData.get("academicYear") as string) ||
      submissionWindow?.academicYear ||
      dbCurrentTerm?.academic_year ||
      "2026-2027";

    const activeSemester = normalizeSemester(
      (formData.get("semester") as string) ||
      submissionWindow?.semester ||
      dbCurrentTerm?.semester ||
      "2nd Semester"
    );

    const payload = {
      academicYear: activeAcademicYear,
      semester: activeSemester,
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
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError || !profile || !profile.id) {
      logger.error("faculty_not_found", {
        authUserId: user.id,
        error: profileError?.message,
        profileId: profile?.id ?? null,
      });
      return NextResponse.json(
        { error: "Faculty profile not found" },
        { status: 404 },
      );
    }

    // Get faculty's assigned curriculum and assignment record for the selected term,
    // or create/bind the assignment record for the current active term.
    let curriculumId: string | null = null;
    let facultyAssignmentId: string | null = null;

    const { data: currentTermAssignment } = await supabase
      .from("faculty_program_assignments")
      .select("id, curriculum_id")
      .eq("faculty_profile_id", profile.id)
      .eq("academic_year", payload.academicYear)
      .ilike("term", `%${payload.semester}%`)
      .maybeSingle();

    if (currentTermAssignment?.id) {
      facultyAssignmentId = currentTermAssignment.id;
      curriculumId = currentTermAssignment.curriculum_id ?? null;
    }

    let programId: string | null = null;
    const { data: previousAssignment } = await supabase
      .from("faculty_program_assignments")
      .select("program_id, curriculum_id")
      .eq("faculty_profile_id", profile.id)
      .not("program_id", "is", null)
      .limit(1)
      .maybeSingle();

    if (previousAssignment?.program_id) {
      programId = previousAssignment.program_id;
      if (!curriculumId) curriculumId = previousAssignment.curriculum_id ?? null;
    } else {
      const { data: firstProgram } = await supabase
        .from("programs")
        .select("id")
        .limit(1)
        .maybeSingle();
      if (firstProgram?.id) {
        programId = firstProgram.id;
      }
    }

    if (!curriculumId) {
      const { data: latestAssignment } = await supabase
        .from("faculty_program_assignments")
        .select("curriculum_id")
        .eq("faculty_profile_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestAssignment?.curriculum_id) {
        curriculumId = latestAssignment.curriculum_id;
      } else {
        const { data: curriculum } = await supabase
          .from("curricula")
          .select("id")
          .limit(1)
          .maybeSingle();

        if (!curriculum) {
          logger.error("no_curriculum_available", {
            facultyId: profile.id,
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
      }
    }

    if (!facultyAssignmentId) {
      if (!programId) {
        const { data: firstProgram } = await supabase
          .from("programs")
          .select("id")
          .limit(1)
          .maybeSingle();
        programId = firstProgram?.id ?? null;
      }

      if (!curriculumId) {
        const { data: firstCurriculum } = await supabase
          .from("curricula")
          .select("id")
          .limit(1)
          .maybeSingle();
        curriculumId = firstCurriculum?.id ?? null;
      }

      const insertPayload: Record<string, any> = {
        faculty_profile_id: profile.id,
        academic_year: payload.academicYear,
        term: payload.semester,
      };
      if (programId) insertPayload.program_id = programId;
      if (curriculumId) insertPayload.curriculum_id = curriculumId;

      const { data: createdAssignment, error: createAssignmentError } =
        await supabase
          .from("faculty_program_assignments")
          .insert(insertPayload)
          .select("id")
          .maybeSingle();

      if (createdAssignment?.id) {
        facultyAssignmentId = createdAssignment.id;
      } else {
        const { data: retryAssignment } = await supabase
          .from("faculty_program_assignments")
          .select("id")
          .eq("faculty_profile_id", profile.id)
          .eq("academic_year", payload.academicYear)
          .ilike("term", `%${payload.semester}%`)
          .maybeSingle();

        if (retryAssignment?.id) {
          facultyAssignmentId = retryAssignment.id;
        } else if (createAssignmentError) {
          logger.warn("auto_create_faculty_assignment_failed", {
            facultyId: profile.id,
            academicYear: payload.academicYear,
            semester: payload.semester,
            error: createAssignmentError.message,
          });
        }
      }
    }

    // Backend Guard Against Duplicate Submissions
    // Check if an existing submission for this requirement_code & faculty_profile_id is already uploaded, pending, or validated FOR THIS SPECIFIC TERM ASSIGNMENT.
    if (facultyAssignmentId) {
      const { data: existingInCurrentTerm } = await supabase
        .from("submissions")
        .select("id, status, requirement_code, faculty_assignment_id")
        .eq("faculty_profile_id", profile.id)
        .eq("faculty_assignment_id", facultyAssignmentId);

      if (existingInCurrentTerm && existingInCurrentTerm.length > 0) {
        const activeTermSubmissions = existingInCurrentTerm.filter((sub) => {
          const matched = matchRequirementCode(
            sub.requirement_code,
            (sub as { requirement_id?: string }).requirement_id,
          );
          return (
            matched === payload.requirementCode ||
            sub.requirement_code === payload.requirementCode
          );
        });

        if (activeTermSubmissions.length > 0) {
          const latestSub = activeTermSubmissions[0];
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
                  "This requirement has already been submitted for the current academic term.",
              },
              { status: 400 },
            );
          }
        }
      }
    }

    // Create submission record
    const submissionId = crypto.randomUUID();
    const trimmedRemarks = payload.remarks?.trim();
    const submissionPayload: Record<string, any> = {
      id: submissionId,
      faculty_profile_id: profile.id,
      curriculum_id: curriculumId,
      faculty_assignment_id: facultyAssignmentId ?? null,
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

    if (submissionError) {
      const fallbackPayload: Record<string, any> = {
        id: submissionId,
        faculty_profile_id: profile.id,
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
        facultyId: profile.id,
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
    const storagePath = `faculty-submissions/${profile.id}/${submissionId}/${fileName}`;

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
      facultyId: profile.id,
      requirementCode: payload.requirementCode,
    });

    // Non-critical background tasks: notifications and audit logging (executed asynchronously so endpoint returns fast)
    void (async () => {
      try {
        const facultyName = profile.full_name || "Faculty Member";
        const reqCode = payload.requirementCode as RequirementCode;
        const reqLabel = REQUIREMENT_LABEL[reqCode] || payload.requirementCode;

        const reviewerSet = new Set<string>();

        const { data: reviewerRoles } = await supabase
          .from("user_roles")
          .select("profiles(user_id), roles(code)")
          .in("roles.code", ["admin", "super_admin"]);

        if (reviewerRoles) {
          for (const row of reviewerRoles) {
            const p = row.profiles as any;
            if (p?.user_id) reviewerSet.add(p.user_id);
          }
        }

        const uniqueAuthUserIds = Array.from(reviewerSet);

        for (const reviewerAuthUserId of uniqueAuthUserIds) {
          if (reviewerAuthUserId === user.id) continue;

          // Check if the administrator/reviewer has enabled new submission alerts (default to true if undefined)
          try {
            const { data: authUserData } = await supabase.auth.admin.getUserById(
              reviewerAuthUserId
            );
            const userMeta = authUserData?.user?.user_metadata || {};
            const isAlertEnabled =
              typeof userMeta.new_submission_alerts === "boolean"
                ? userMeta.new_submission_alerts
                : typeof userMeta.submission_alerts === "boolean"
                ? userMeta.submission_alerts
                : true;

            if (!isAlertEnabled) {
              continue;
            }
          } catch (prefErr) {
            // Default to sending notification if preference check fails
          }

          await createNotification({
            userId: reviewerAuthUserId,
            type: "submission_uploaded",
            title: `New Submission from ${facultyName}`,
            message: `Uploaded ${reqLabel} for ${payload.academicYear} ${payload.semester}.`,
            metadata: {
              submission_id: submissionId,
              submissionId,
              faculty_profile_id: profile.id,
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
            faculty_profile_id: profile.id,
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
