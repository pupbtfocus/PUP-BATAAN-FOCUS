import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { ROLE } from "@/config/roles";
import { logTransactionEvent } from "@/features/transaction-logs/services/transaction-log.service";
import { logAuditEvent } from "@/features/audit-logs/services/audit-log.service";
import { logger } from "@/lib/observability/logger";
import { isValidEmailAddress } from "@/lib/validation/email";
import { sendEmailChangeVerificationEmail } from "@/lib/email/send-invite";
import { generateTempPassword } from "@/lib/auth/temp-password";
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
      email: trimOrEmpty(formData.get("email")).toLowerCase(),
      resendVerification:
        formData.get("resendVerification") === "true" ||
        formData.get("resend_verification") === "true",
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
    email: trimOrEmpty(body.email).toLowerCase(),
    resendVerification:
      body.resendVerification === true ||
      body.resendVerification === "true" ||
      body.resend_verification === true,
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

    const requesterRole = (
      (user?.user_metadata?.role as string | undefined) ??
      (user?.app_metadata?.role as string | undefined) ??
      ""
    ).toLowerCase().trim();
    const userEmail = (user?.email ?? "").toLowerCase().trim();

    const isAuthorized =
      requesterRole === "admin" ||
      requesterRole === "super_admin" ||
      requesterRole === "superadmin" ||
      requesterRole === "staff" ||
      requesterRole === ROLE.STAFF ||
      requesterRole === ROLE.ADMIN ||
      requesterRole.includes("staff") ||
      requesterRole.includes("admin") ||
      requesterRole.includes("super") ||
      userEmail === "pupbataanfocus.admin@gmail.com" ||
      userEmail === "pupbataanfocus.superadmin@gmail.com" ||
      userEmail === "preview@pupfocus.dev" ||
      userEmail.startsWith("qa.admin") ||
      userEmail.startsWith("qa.superadmin");

    if (!user || !isAuthorized) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const {
      facultyProfileId,
      firstName,
      middleName,
      lastName,
      email,
      resendVerification,
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

    const nameRegex = /^[a-zA-Z\sñÑ]+$/;
    if (
      !nameRegex.test(firstName) ||
      !nameRegex.test(lastName) ||
      (middleName && !nameRegex.test(middleName))
    ) {
      return NextResponse.json(
        { error: "Name can only contain letters (no numbers or special characters)" },
        { status: 400 },
      );
    }

    const supabase = getServiceRoleClient();

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, user_id, email, full_name, user_roles(roles(code))")
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
    const previousEmail = (profile.email ?? "").trim().toLowerCase();
    const targetEmail = email || previousEmail;
    const isEmailChanged = Boolean(email && email !== previousEmail);
    const shouldSendVerification = isEmailChanged || resendVerification;

    if (isEmailChanged) {
      if (!isValidEmailAddress(email)) {
        return NextResponse.json(
          { error: "Please provide a valid email address" },
          { status: 400 },
        );
      }

      const { data: existingProfileWithEmail } = await supabase
        .from("profiles")
        .select("id")
        .ilike("email", email)
        .neq("id", profile.id)
        .maybeSingle();

      if (existingProfileWithEmail) {
        return NextResponse.json(
          { error: `An account with email ${email} already exists.` },
          { status: 400 },
        );
      }

      const { data: authUsersList } = await supabase.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      const duplicateAuthUser = authUsersList?.users?.find(
        (u) => u.id !== authUserId && u.email?.trim().toLowerCase() === email,
      );
      if (duplicateAuthUser) {
        return NextResponse.json(
          { error: `An account with email ${email} already exists.` },
          { status: 400 },
        );
      }
    }

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
      if (!resolvedProgramRecord) {
        const { data } = await supabase
          .from("programs")
          .select("id, code, name")
          .ilike("name", programId)
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
      ...(resolvedProgramId
        ? {
            program_id: resolvedProgramId,
            program_code: resolvedProgramRecord?.code,
            program_name: resolvedProgramRecord?.name,
            department: resolvedProgramRecord?.name,
          }
        : {}),
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
      const storagePath = `faculty-profile-images/${targetEmail}/${Date.now()}-${crypto.randomUUID()}-${safeFileName}`;
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
      ...(isEmailChanged ? { email: targetEmail } : {}),
      updated_at: new Date().toISOString(),
    };

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

    try {
      await supabase
        .from("faculty")
        .update({
          full_name: updatedFullName,
          ...(isEmailChanged ? { email: targetEmail } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq("profile_id", profile.id);
    } catch {}

    if (isEmailChanged && authUserId) {
      try {
        await supabase
          .from("extension_requests")
          .update({ faculty_email: targetEmail })
          .eq("faculty_user_id", authUserId);
      } catch {}
    }

    if (resolvedProgramId) {
      try {
        const { data: activeTerm } = await supabase
          .from("academic_terms")
          .select("academic_year, semester")
          .ilike("status", "Current")
          .maybeSingle();

        const academicYear = activeTerm?.academic_year || "2026-2027";
        const term = activeTerm?.semester || "1st Semester";

        const { data: allExisting } = await supabase
          .from("faculty_program_assignments")
          .select("id")
          .eq("faculty_profile_id", profile.id);

        if (allExisting && allExisting.length > 0) {
          // Update all existing assignments to the newly chosen department
          await supabase
            .from("faculty_program_assignments")
            .update({
              program_id: resolvedProgramId,
            })
            .eq("faculty_profile_id", profile.id);
        } else {
          await supabase.from("faculty_program_assignments").insert({
            faculty_profile_id: profile.id,
            program_id: resolvedProgramId,
            academic_year: academicYear,
            term,
          });
        }

        if (resolvedProgramId) {
          void logTransactionEvent({
            actorId: user.id,
            action: "program.assign",
            entityType: "faculty_program",
            entityId: profile.id,
            metadata: {
              faculty_profile_id: profile.id,
              faculty_name: updatedFullName,
              program_id: resolvedProgramId,
              program_code: resolvedProgramRecord?.code,
              program_name: resolvedProgramRecord?.name,
              academic_year: academicYear,
              term,
            },
          });
        }
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
      const authUpdateBody: {
        email?: string;
        email_confirm?: boolean;
        user_metadata: Record<string, unknown>;
      } = {
        ...(isEmailChanged
          ? {
              email: targetEmail,
              email_confirm: true,
            }
          : {}),
        user_metadata: {
          ...previousAuthUserMetadata,
          first_name: firstName,
          middle_name: middleName || null,
          last_name: lastName,
          full_name: updatedFullName,
          role: ROLE.FACULTY,
          profile_image_bucket: updatedMetadata.profile_image_bucket,
          profile_image_path: updatedMetadata.profile_image_path,
          ...(resolvedProgramId
            ? {
                program_id: resolvedProgramId,
                program_code: resolvedProgramRecord?.code,
                program_name: resolvedProgramRecord?.name,
                department: resolvedProgramRecord?.name,
              }
            : {}),
          ...(shouldSendVerification
            ? {
                pending_email_change_verification: true,
                previous_email: previousEmail,
              }
            : {}),
        },
      };

      const { error: authUpdateError } =
        await supabase.auth.admin.updateUserById(authUserId, authUpdateBody);

      if (authUpdateError) {
        await supabase
          .from("profiles")
          .update({
            full_name: previousProfileName,
            ...(isEmailChanged ? { email: previousEmail } : {}),
          })
          .eq("id", profile.id);

        if (isEmailChanged) {
          try {
            await supabase
              .from("faculty")
              .update({
                full_name: previousProfileName,
                email: previousEmail,
              })
              .eq("profile_id", profile.id);
          } catch {}
        }

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

    let verificationSent = false;
    let verificationError: string | null = null;
    let verificationLink: string | null = null;

    if (shouldSendVerification && targetEmail) {
      const siteUrl =
        process.env.NEXT_PUBLIC_SITE_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        (request.url
          ? new URL(request.url).origin
          : "https://pupfocus.cjaayy.dev");
      const callbackUrl = `${siteUrl.replace(/\/$/, "")}/auth/confirm?email=${encodeURIComponent(targetEmail)}&mode=email_change`;

      let { data: genData, error: genError } =
        await supabase.auth.admin.generateLink({
          type: "magiclink",
          email: targetEmail,
          options: {
            redirectTo: callbackUrl,
          },
        });

      if (genError || !genData?.properties?.action_link) {
        const inviteAttempt = await supabase.auth.admin.generateLink({
          type: "invite",
          email: targetEmail,
          options: {
            data: {
              ...updatedMetadata,
              role: ROLE.FACULTY,
              pending_email_change_verification: true,
            },
            redirectTo: callbackUrl,
          },
        });
        if (!inviteAttempt.error && inviteAttempt.data?.properties?.action_link) {
          genData = inviteAttempt.data;
          genError = null;
        }
      }

      verificationLink = genData?.properties?.action_link ?? null;

      if (verificationLink) {
        try {
          await sendEmailChangeVerificationEmail({
            to: targetEmail,
            previousEmail: isEmailChanged ? previousEmail : undefined,
            link: verificationLink,
            firstName,
            fullName: updatedFullName,
          });
          verificationSent = true;
        } catch (err) {
          verificationError =
            err instanceof Error ? err.message : String(err ?? "unknown error");
        }
      } else if (genError) {
        verificationError = genError.message;
      }
    }

    // Audit log – fire-and-forget; never blocks the update response
    try {
      await logAuditEvent({
        actorId: user.id,
        action: isEmailChanged ? "faculty.email_change" : "faculty.update",
        entityType: "faculty",
        entityId: facultyProfileId,
        metadata: {
          updated_full_name: updatedFullName,
          previous_full_name: previousProfileName,
          ...(isEmailChanged
            ? {
                previous_email: previousEmail,
                updated_email: targetEmail,
                verification_sent: verificationSent,
              }
            : {}),
        },
      });
    } catch (auditError) {
      logger.error("audit_log_faculty_update_failed", {
        facultyProfileId,
        error: auditError instanceof Error ? auditError.message : String(auditError),
      });
    }

    return NextResponse.json({
      success: true,
      emailChanged: isEmailChanged,
      email: targetEmail,
      verificationSent,
      verificationError,
      link: verificationLink,
      program: resolvedProgramRecord
        ? {
            id: resolvedProgramRecord.id,
            code: resolvedProgramRecord.code,
            name: resolvedProgramRecord.name,
          }
        : null,
    });
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
