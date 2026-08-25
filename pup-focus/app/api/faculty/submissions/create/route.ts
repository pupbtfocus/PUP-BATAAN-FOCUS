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

    const supabaseAdmin = getServiceRoleClient();

    // Validate if submissions are currently open.
    const submissionWindow = await getSubmissionWindow(supabaseAdmin);
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
    const { data: dbCurrentTerm } = await supabaseAdmin
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
      "2nd Semester",
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
    const { data: profile, error: profileError } = await supabaseAdmin
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

    // Program Assignment and Curriculum lookup
    let facultyAssignmentId: string | null = null;
    let programId: string | null = null;
    let curriculumId: string | null = null;

    const { data: assignments } = await supabaseAdmin
      .from("faculty_program_assignments")
      .select("id, program_id, curriculum_id")
      .eq("faculty_profile_id", profile.id)
      .eq("academic_year", payload.academicYear)
      .ilike("term", `%${payload.semester}%`);

    if (assignments && assignments.length > 0) {
      facultyAssignmentId = assignments[0].id;
      programId = assignments[0].program_id;
      curriculumId = assignments[0].curriculum_id;
    }

    if (!curriculumId) {
      const { data: latestAssignment } = await supabaseAdmin
        .from("faculty_program_assignments")
        .select("curriculum_id")
        .eq("faculty_profile_id", profile.id)
        .not("curriculum_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestAssignment?.curriculum_id) {
        curriculumId = latestAssignment.curriculum_id;
      } else {
        const { data: curriculum } = await supabaseAdmin
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
        const { data: firstProgram } = await supabaseAdmin
          .from("programs")
          .select("id")
          .limit(1)
          .maybeSingle();
        programId = firstProgram?.id ?? null;
      }

      if (!curriculumId) {
        const { data: firstCurriculum } = await supabaseAdmin
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
        await supabaseAdmin
          .from("faculty_program_assignments")
          .insert(insertPayload)
          .select("id")
          .maybeSingle();

      if (createdAssignment?.id) {
        facultyAssignmentId = createdAssignment.id;
      } else {
        const { data: retryAssignment } = await supabaseAdmin
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

    // Check for Existing Submission Record (Guarantee Single Row per Requirement)
    let existingSubmission: {
      id: string;
      status: string | null;
      requirement_code: string;
      curriculum_id?: string | null;
      faculty_assignment_id?: string | null;
      submitted_at?: string | null;
      created_at?: string | null;
      remarks?: string | null;
      notes?: string | null;
    } | null = null;

    const { data: allFacultySubmissions } = await supabaseAdmin
      .from("submissions")
      .select(
        "id, status, requirement_code, curriculum_id, faculty_assignment_id, submitted_at, created_at, remarks, notes",
      )
      .eq("faculty_profile_id", profile.id)
      .order("created_at", { ascending: false });

    if (allFacultySubmissions && allFacultySubmissions.length > 0) {
      // 1. Try to find match with exact assignment or curriculum
      const exactMatch = allFacultySubmissions.find((sub) => {
        const matchesCode =
          sub.requirement_code === payload.requirementCode ||
          matchRequirementCode(sub.requirement_code) === payload.requirementCode;

        const matchesAssignment =
          facultyAssignmentId && sub.faculty_assignment_id === facultyAssignmentId;

        const matchesCurriculum =
          curriculumId && sub.curriculum_id === curriculumId;

        return matchesCode && (matchesAssignment || matchesCurriculum);
      });

      if (exactMatch) {
        existingSubmission = exactMatch;
      } else {
        // 2. Fallback: match by requirement_code on this faculty profile
        const codeMatch = allFacultySubmissions.find((sub) => {
          return (
            sub.requirement_code === payload.requirementCode ||
            matchRequirementCode(sub.requirement_code) === payload.requirementCode
          );
        });

        if (codeMatch) {
          existingSubmission = codeMatch;
        }
      }
    }

    if (existingSubmission) {
      const { data: decisions } = await supabaseAdmin
        .from("review_decisions")
        .select("decision")
        .eq("submission_id", existingSubmission.id)
        .order("created_at", { ascending: false })
        .limit(1);

      const latestDecision = decisions?.[0]?.decision;
      const isRejected =
        existingSubmission.status === "rejected" ||
        existingSubmission.status === "returned" ||
        existingSubmission.status === "needs_revision" ||
        existingSubmission.status === "revision_required" ||
        latestDecision === "rejected";

      // If already validated, block duplicate
      if (
        !isRejected &&
        (existingSubmission.status === "validated" ||
          latestDecision === "validated")
      ) {
        return NextResponse.json(
          {
            error:
              "This requirement has already been validated for the current academic term.",
          },
          { status: 400 },
        );
      }
    }

    // Prepare File & Hash Checksum for document_versions table
    const fileName = file.name;
    const fileBuffer = await file.arrayBuffer();

    const hashBuffer = await crypto.subtle.digest("SHA-256", fileBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const checksumSha256 = hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const trimmedRemarks = payload.remarks?.trim();

    let targetSubmissionId: string;
    let documentVersion: { id: string; version_number: number; storage_path: string };

    if (existingSubmission) {
      // REUSE EXISTING SUBMISSION ROW - DO NOT INSERT DUPLICATE
      targetSubmissionId = existingSubmission.id;

      // 1. Query existing rows in document_versions for this submission
      const { data: existingVersions, error: fetchVerError } =
        await supabaseAdmin
          .from("document_versions")
          .select(
            "id, version_number, storage_path, mime_type, size_bytes, checksum_sha256, created_at",
          )
          .eq("submission_id", targetSubmissionId)
          .order("version_number", { ascending: true });

      if (fetchVerError) {
        console.error(
          "[CRITICAL] Failed to query existing document_versions:",
          fetchVerError,
        );
      }

      // 2. If document_versions has NO Version 1 row, archive previous file as Version 1
      const hasVersion1 =
        existingVersions &&
        existingVersions.some((v) => v.version_number === 1);

      if (!hasVersion1) {
        const oldStoragePath =
          (existingVersions && existingVersions[0]?.storage_path) ||
          `faculty-submissions/${profile.id}/${targetSubmissionId}/v1_${fileName}`;

        const oldCreatedAt =
          existingSubmission.submitted_at ||
          existingSubmission.created_at ||
          new Date().toISOString();

        const { error: v1InsertError } = await supabaseAdmin
          .from("document_versions")
          .insert({
            submission_id: targetSubmissionId,
            version_number: 1,
            storage_path: oldStoragePath,
            mime_type: "application/octet-stream",
            size_bytes: 0,
            checksum_sha256: "archived_v1_checksum",
            created_by: user.id,
            created_at: oldCreatedAt,
          });

        if (v1InsertError) {
          console.error(
            "[CRITICAL] Failed to insert Version 1 into document_versions:",
            v1InsertError,
          );
        } else {
          console.log("[DOCUMENT_VERSION_1_ARCHIVED]", {
            submissionId: targetSubmissionId,
            oldStoragePath,
          });
        }
      }

      // 3. Calculate Next Version Number (e.g. Version 2, 3, etc.)
      let nextVersionNumber = 2;
      if (existingVersions && existingVersions.length > 0) {
        const maxVersion = Math.max(
          ...existingVersions.map((v) => v.version_number || 1),
        );
        nextVersionNumber = Math.max(maxVersion + 1, 2);
      }

      const storagePath = `faculty-submissions/${profile.id}/${targetSubmissionId}/v${nextVersionNumber}_${fileName}`;

      // Upload new file to Supabase Storage
      const { error: uploadError } = await supabaseAdmin.storage
        .from("faculty-submissions")
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: true,
        });

      if (uploadError) {
        logger.error("file_resubmit_upload_failed", {
          submissionId: targetSubmissionId,
          error: uploadError.message,
        });
        return NextResponse.json(
          { error: "Failed to upload file to storage" },
          { status: 500 },
        );
      }

      // Insert NEW version record into document_versions using supabaseAdmin
      const { data: newDocVer, error: docVersionError } = await supabaseAdmin
        .from("document_versions")
        .insert({
          submission_id: targetSubmissionId,
          version_number: nextVersionNumber,
          storage_path: storagePath,
          mime_type: file.type || "application/octet-stream",
          size_bytes: fileBuffer.byteLength,
          checksum_sha256: checksumSha256,
          created_by: user.id,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (docVersionError) {
        console.error(
          "[CRITICAL] Failed to insert new document version into document_versions:",
          docVersionError,
        );
        logger.error("document_version_increment_failed", {
          submissionId: targetSubmissionId,
          error: docVersionError.message,
        });
        return NextResponse.json(
          { error: `Failed to record document version: ${docVersionError.message}` },
          { status: 500 },
        );
      }

      documentVersion = newDocVer;

      // 4. Update the existing submissions row (strictly preserving admin_remarks)
      const updatePayload: Record<string, any> = {
        status: "uploaded",
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (trimmedRemarks) {
        updatePayload.notes = trimmedRemarks;
      }

      if (curriculumId) updatePayload.curriculum_id = curriculumId;
      if (facultyAssignmentId)
        updatePayload.faculty_assignment_id = facultyAssignmentId;

      let { error: updateSubError } = await supabaseAdmin
        .from("submissions")
        .update(updatePayload)
        .eq("id", targetSubmissionId);

      if (updateSubError && updatePayload.notes) {
        delete updatePayload.notes;
        const retryRes = await supabaseAdmin
          .from("submissions")
          .update(updatePayload)
          .eq("id", targetSubmissionId);
        updateSubError = retryRes.error;
      }

      if (updateSubError && updatePayload.updated_at) {
        delete updatePayload.updated_at;
        const retryRes = await supabaseAdmin
          .from("submissions")
          .update(updatePayload)
          .eq("id", targetSubmissionId);
        updateSubError = retryRes.error;
      }

      if (updateSubError) {
        console.error(
          "[CRITICAL] Failed to update submissions table on resubmit:",
          updateSubError,
        );
      }
    } else {
      // BRAND NEW SUBMISSION - INSERT ONLY ONCE
      targetSubmissionId = crypto.randomUUID();

      const storagePath = `faculty-submissions/${profile.id}/${targetSubmissionId}/v1_${fileName}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from("faculty-submissions")
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: true,
        });

      if (uploadError) {
        logger.error("file_upload_failed", {
          submissionId: targetSubmissionId,
          error: uploadError.message,
        });
        return NextResponse.json(
          { error: "Failed to upload file to storage" },
          { status: 500 },
        );
      }

      const submissionPayload: Record<string, any> = {
        id: targetSubmissionId,
        faculty_profile_id: profile.id,
        curriculum_id: curriculumId,
        faculty_assignment_id: facultyAssignmentId ?? null,
        requirement_code: payload.requirementCode,
        status: "uploaded",
        submitted_at: new Date().toISOString(),
      };

      if (trimmedRemarks) {
        submissionPayload.notes = trimmedRemarks;
      }

      let { data: newSub, error: submissionError } = await supabaseAdmin
        .from("submissions")
        .insert(submissionPayload)
        .select()
        .single();

      if (submissionError) {
        const fallbackPayload: Record<string, any> = {
          id: targetSubmissionId,
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

        ({ data: newSub, error: submissionError } = await supabaseAdmin
          .from("submissions")
          .insert(fallbackPayload)
          .select()
          .single());
      }

      if (submissionError) {
        console.error(
          "[CRITICAL] Failed to create submission record in submissions table:",
          submissionError,
        );
        logger.error("submission_creation_failed", {
          facultyId: profile.id,
          error: submissionError.message,
        });
        return NextResponse.json(
          { error: "Failed to create submission record" },
          { status: 500 },
        );
      }

      const { data: newDocVer, error: docVersionError } = await supabaseAdmin
        .from("document_versions")
        .insert({
          submission_id: targetSubmissionId,
          version_number: 1,
          storage_path: storagePath,
          mime_type: file.type || "application/octet-stream",
          size_bytes: fileBuffer.byteLength,
          checksum_sha256: checksumSha256,
          created_by: user.id,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (docVersionError) {
        console.error(
          "[CRITICAL] Failed to record document version into document_versions:",
          docVersionError,
        );
        logger.error("document_version_creation_failed", {
          submissionId: targetSubmissionId,
          error: docVersionError.message,
        });
        return NextResponse.json(
          { error: `Failed to record document version: ${docVersionError.message}` },
          { status: 500 },
        );
      }

      documentVersion = newDocVer;
    }

    logger.info("submission_processed_successfully", {
      submissionId: targetSubmissionId,
      versionNumber: documentVersion.version_number,
      facultyId: profile.id,
      requirementCode: payload.requirementCode,
    });

    // Non-critical background tasks: notifications and audit logging (executed asynchronously so endpoint returns fast)
    void (async () => {
      try {
        const facultyName = profile.full_name || "Faculty Member";
        const reqCode = payload.requirementCode as RequirementCode;
        const reqLabel = REQUIREMENT_LABEL[reqCode] || payload.requirementCode;

        // 1. Get role IDs for 'admin' and 'super_admin'
        const { data: roles } = await supabaseAdmin
          .from("roles")
          .select("id, code")
          .in("code", ["admin", "super_admin"]);

        const roleIds = (roles || []).map((r) => r.id);

        // 2. Get profile IDs assigned to those roles
        const { data: userRoles } = await supabaseAdmin
          .from("user_roles")
          .select("profile_id")
          .in("role_id", roleIds);

        const profileIds = Array.from(
          new Set(
            (userRoles || []).map((ur) => ur.profile_id).filter(Boolean),
          ),
        );

        // 3. Get corresponding auth user_ids from profiles
        const { data: adminProfiles } = await supabaseAdmin
          .from("profiles")
          .select("id, user_id")
          .in("id", profileIds);

        const adminUserIds = Array.from(
          new Set(
            (adminProfiles || [])
              .map((p) => p.user_id)
              .filter(
                (id): id is string =>
                  Boolean(id) && id !== user.id && id !== profile.id,
              ),
          ),
        );

        let insertedCount = 0;

        for (const reviewerAuthUserId of adminUserIds) {
          if (reviewerAuthUserId === user.id) continue;

          try {
            const { data: authUserData } =
              await supabaseAdmin.auth.admin.getUserById(reviewerAuthUserId);
            const userMeta = authUserData?.user?.user_metadata || {};
            const isAlertEnabled =
              typeof userMeta.new_submission_alerts === "boolean"
                ? userMeta.new_submission_alerts
                : typeof userMeta.submission_alerts === "boolean"
                  ? userMeta.submission_alerts
                  : true;

            if (!isAlertEnabled) continue;
          } catch {
            // Default to sending notification
          }

          const isResubmit = documentVersion.version_number > 1;
          const notifTitle = isResubmit
            ? `Resubmission (v${documentVersion.version_number}) from ${facultyName}`
            : `New Submission from ${facultyName}`;
          const notifMessage = isResubmit
            ? `Resubmitted ${reqLabel} (Version ${documentVersion.version_number}) for ${payload.academicYear} ${payload.semester}.`
            : `Uploaded ${reqLabel} for ${payload.academicYear} ${payload.semester}.`;

          const created = await createNotification({
            userId: reviewerAuthUserId,
            type: "NEW_SUBMISSION",
            title: notifTitle,
            message: notifMessage,
            metadata: {
              submission_id: targetSubmissionId,
              submissionId: targetSubmissionId,
              version_number: documentVersion.version_number,
              faculty_profile_id: profile.id,
              facultyName,
              requirement_code: payload.requirementCode,
              requirementCode: payload.requirementCode,
              recipient_role: "admin",
            },
          });

          if (created) {
            insertedCount++;
          }
        }
      } catch (notifErr) {
        logger.error("notification_creation_failed_on_upload", {
          submissionId: targetSubmissionId,
          error:
            notifErr instanceof Error ? notifErr.message : String(notifErr),
        });
      }

      try {
        await logAuditEvent({
          actorId: user.id,
          action:
            documentVersion.version_number > 1
              ? "submission.resubmit"
              : "submission.upload",
          entityType: "submission",
          entityId: targetSubmissionId,
          metadata: {
            requirement_code: payload.requirementCode,
            file_name: fileName,
            version_number: documentVersion.version_number,
            academic_year: payload.academicYear,
            semester: payload.semester,
            faculty_profile_id: profile.id,
            document_version_id: documentVersion.id,
          },
        });
      } catch (auditError) {
        logger.error("audit_log_submission_upload_failed", {
          submissionId: targetSubmissionId,
          error:
            auditError instanceof Error
              ? auditError.message
              : String(auditError),
        });
      }
    })();

    return NextResponse.json(
      {
        success: true,
        submissionId: targetSubmissionId,
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
