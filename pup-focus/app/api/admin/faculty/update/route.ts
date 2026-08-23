import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { ROLE } from "@/config/roles";
import { logAuditEvent } from "@/features/audit-logs/services/audit-log.service";
import { logger } from "@/lib/observability/logger";
import {
  FACULTY_PROFILE_IMAGE_BUCKET,
  buildFacultyFullName,
} from "@/lib/faculty-profile";

function trimOrEmpty(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function readRequestPayload(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    return {
      facultyProfileId: trimOrEmpty(
        formData.get("facultyProfileId") ||
          formData.get("faculty_profile_id") ||
          formData.get("id"),
      ),
      firstName: trimOrEmpty(
        formData.get("firstName") || formData.get("first_name"),
      ),
      middleName: trimOrEmpty(
        formData.get("middleName") || formData.get("middle_name"),
      ),
      lastName: trimOrEmpty(
        formData.get("lastName") || formData.get("last_name"),
      ),
      programId: trimOrEmpty(
        formData.get("programId") ||
          formData.get("program_id") ||
          formData.get("department_id"),
      ),
      profileImage:
        formData.get("profileImage") instanceof File
          ? (formData.get("profileImage") as File)
          : null,
    };
  }

  const body = (await request.json()) as Record<string, unknown>;

  return {
    facultyProfileId: trimOrEmpty(
      body.facultyProfileId || body.faculty_profile_id || body.id,
    ),
    firstName: trimOrEmpty(body.firstName || body.first_name),
    middleName: trimOrEmpty(body.middleName || body.middle_name),
    lastName: trimOrEmpty(body.lastName || body.last_name),
    programId: trimOrEmpty(
      body.programId || body.program_id || body.department_id,
    ),
    profileImage: null,
  };
}

export async function PATCH(request: NextRequest) {
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

    const {
      facultyProfileId,
      firstName,
      middleName,
      lastName,
      programId,
      profileImage,
    } = await readRequestPayload(request);

    if (!facultyProfileId) {
      return NextResponse.json(
        { error: "Faculty profile ID is required" },
        { status: 400 },
      );
    }

    if (!firstName || !lastName) {
      return NextResponse.json(
        { error: "First name and last name are required" },
        { status: 400 },
      );
    }

    const supabase = getServiceRoleClient();

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, user_id, email, full_name, department_id, user_roles(roles(code))")
      .eq("id", facultyProfileId)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Faculty profile not found" },
        { status: 404 },
      );
    }

    const authUserId = profile.user_id ?? null;
    const previousProfileName = profile.full_name;

    let authUserResult = null;
    if (authUserId) {
      const res = await supabase.auth.admin.getUserById(authUserId);
      authUserResult = res.data;
    }
    const previousAuthUserMetadata = (authUserResult?.user?.user_metadata ??
      {}) as Record<string, unknown>;

    const updatedFullName = buildFacultyFullName({
      firstName,
      middleName,
      lastName,
    });

    // Resolve programId if provided
    let resolvedProgramId: string | null = null;
    let resolvedProgramRecord: { id: string; code: string; name: string } | null =
      null;
    if (programId) {
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          programId,
        );
      if (isUuid) {
        const { data } = await supabase
          .from("programs")
          .select("id, code, name")
          .eq("id", programId)
          .maybeSingle();
        resolvedProgramRecord = data;
      }
      if (!resolvedProgramRecord) {
        const { data } = await supabase
          .from("programs")
          .select("id, code, name")
          .ilike("code", programId)
          .maybeSingle();
        resolvedProgramRecord = data;
      }
      if (resolvedProgramRecord) {
        resolvedProgramId = resolvedProgramRecord.id;
      }
    }

    const updatedMetadata: Record<string, unknown> = {
      ...previousAuthUserMetadata,
      first_name: firstName,
      middle_name: middleName || null,
      last_name: lastName,
      full_name: updatedFullName,
      ...(resolvedProgramId ? { program_id: resolvedProgramId } : {}),
    };

    let uploadedProfileImagePath = trimOrEmpty(
      previousAuthUserMetadata.profile_image_path,
    );
    let uploadedProfileImageBucket =
      trimOrEmpty(previousAuthUserMetadata.profile_image_bucket) ||
      FACULTY_PROFILE_IMAGE_BUCKET;

    if (profileImage) {
      if (!profileImage.type.startsWith("image/")) {
        return NextResponse.json(
          { error: "Profile picture must be an image file" },
          { status: 400 },
        );
      }

      if (profileImage.size > 5 * 1024 * 1024) {
        return NextResponse.json(
          { error: "Profile picture must be 5MB or smaller" },
          { status: 400 },
        );
      }

      const safeFileName = profileImage.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `faculty-profile-images/${profile.email}/${Date.now()}-${crypto.randomUUID()}-${safeFileName}`;
      const arrayBuffer = await profileImage.arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from(FACULTY_PROFILE_IMAGE_BUCKET)
        .upload(storagePath, arrayBuffer, {
          contentType: profileImage.type || "application/octet-stream",
          upsert: false,
        });

      if (uploadError) {
        return NextResponse.json(
          { error: `Failed to upload profile image: ${uploadError.message}` },
          { status: 400 },
        );
      }

      uploadedProfileImageBucket = FACULTY_PROFILE_IMAGE_BUCKET;
      uploadedProfileImagePath = storagePath;
      updatedMetadata.profile_image_bucket = uploadedProfileImageBucket;
      updatedMetadata.profile_image_path = uploadedProfileImagePath;
    }

    const profileUpdatePayload: Record<string, unknown> = {
      full_name: updatedFullName,
    };
    if (resolvedProgramId) {
      profileUpdatePayload.department_id = resolvedProgramId;
    }

    const { error: profileUpdateError } = await supabase
      .from("profiles")
      .update(profileUpdatePayload)
      .eq("id", profile.id);

    if (profileUpdateError) {
      if (
        uploadedProfileImagePath &&
        uploadedProfileImagePath !==
          trimOrEmpty(previousAuthUserMetadata.profile_image_path)
      ) {
        await supabase.storage
          .from(uploadedProfileImageBucket)
          .remove([uploadedProfileImagePath])
          .catch(() => null);
      }

      return NextResponse.json(
        { error: profileUpdateError.message },
        { status: 400 },
      );
    }

    if (resolvedProgramId) {
      try {
        const { data: activeTerm } = await supabase
          .from("academic_terms")
          .select("academic_year, semester")
          .eq("status", "Current")
          .maybeSingle();

        const academicYear = activeTerm?.academic_year || "2026-2027";
        const term = activeTerm?.semester || "1st Semester";

        await supabase.from("faculty_program_assignments").upsert(
          {
            faculty_profile_id: profile.id,
            program_id: resolvedProgramId,
            academic_year: academicYear,
            term,
          },
          { onConflict: "faculty_profile_id,program_id,academic_year,term" },
        );
      } catch (assignErr) {
        logger.error("faculty_update_program_assign_error", {
          facultyProfileId,
          error:
            assignErr instanceof Error
              ? assignErr.message
              : String(assignErr),
        });
      }
    }

    if (authUserId) {
      const { error: authUpdateError } =
        await supabase.auth.admin.updateUserById(authUserId, {
          user_metadata: {
            ...previousAuthUserMetadata,
            first_name: firstName,
            middle_name: middleName || null,
            last_name: lastName,
            full_name: updatedFullName,
            role: ROLE.FACULTY,
            profile_image_bucket: updatedMetadata.profile_image_bucket,
            profile_image_path: updatedMetadata.profile_image_path,
            ...(resolvedProgramId ? { program_id: resolvedProgramId } : {}),
          },
        });

      if (authUpdateError) {
        await supabase
          .from("profiles")
          .update({ full_name: previousProfileName })
          .eq("id", profile.id);

        if (
          uploadedProfileImagePath &&
          uploadedProfileImagePath !==
            trimOrEmpty(previousAuthUserMetadata.profile_image_path)
        ) {
          await supabase.storage
            .from(uploadedProfileImageBucket)
            .remove([uploadedProfileImagePath])
            .catch(() => null);
        }

        return NextResponse.json(
          { error: authUpdateError.message },
          { status: 400 },
        );
      }
    }

    if (
      uploadedProfileImagePath &&
      trimOrEmpty(previousAuthUserMetadata.profile_image_path) &&
      previousAuthUserMetadata.profile_image_path !== uploadedProfileImagePath
    ) {
      await supabase.storage
        .from(
          (previousAuthUserMetadata.profile_image_bucket as string) ||
            FACULTY_PROFILE_IMAGE_BUCKET,
        )
        .remove([trimOrEmpty(previousAuthUserMetadata.profile_image_path)])
        .catch(() => null);
    }

    // Audit log – fire-and-forget; never blocks the update response
    try {
      await logAuditEvent({
        actorId: user.id,
        action: "faculty.update",
        entityType: "faculty",
        entityId: facultyProfileId,
        metadata: {
          updated_full_name: updatedFullName,
          previous_full_name: previousProfileName,
        },
      });
    } catch (auditError) {
      logger.error("audit_log_faculty_update_failed", {
        facultyProfileId,
        error: auditError instanceof Error ? auditError.message : String(auditError),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update faculty account",
      },
      { status: 500 },
    );
  }
}
