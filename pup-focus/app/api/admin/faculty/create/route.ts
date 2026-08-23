import { NextResponse, type NextRequest } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ROLE } from "@/config/roles";
import { isValidEmailAddress } from "@/lib/validation/email";
import { sendInviteEmail } from "@/lib/email/send-invite";
import { logAuditEvent } from "@/features/audit-logs/services/audit-log.service";
import { logger } from "@/lib/observability/logger";
import {
  FACULTY_PROFILE_IMAGE_BUCKET,
  buildFacultyFullName,
} from "@/lib/faculty-profile";

async function readRequestPayload(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();

    const readString = (field: string) => {
      const value = formData.get(field);
      return typeof value === "string" ? value : "";
    };

    return {
      firstName: readString("firstName"),
      middleName: readString("middleName"),
      lastName: readString("lastName"),
      email: readString("email"),
      programId: readString("programId") || readString("program_id"),
      profileImage:
        formData.get("profileImage") instanceof File
          ? (formData.get("profileImage") as File)
          : null,
    };
  }

  const body = (await request.json()) as {
    firstName?: string;
    middleName?: string;
    lastName?: string;
    email?: string;
    programId?: string;
    program_id?: string;
    fullName?: string;
  };

  const legacyNameParts =
    body.fullName?.trim().split(/\s+/).filter(Boolean) ?? [];
  const legacyFirstName = legacyNameParts[0] ?? "";
  const legacyLastName =
    legacyNameParts.length > 1
      ? legacyNameParts[legacyNameParts.length - 1]
      : "";
  const legacyMiddleName =
    legacyNameParts.length > 2 ? legacyNameParts.slice(1, -1).join(" ") : "";

  return {
    firstName: (body.firstName ?? legacyFirstName).trim(),
    middleName: (body.middleName ?? legacyMiddleName).trim(),
    lastName: (body.lastName ?? legacyLastName).trim(),
    email: body.email ?? "",
    programId: (body.programId ?? body.program_id ?? "").trim(),
    profileImage: null,
  };
}

export async function POST(request: NextRequest) {
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

    const { firstName, middleName, lastName, email, programId, profileImage } =
      await readRequestPayload(request);

    const fullName = buildFacultyFullName({
      firstName,
      middleName,
      lastName,
    });

    if (!firstName || !lastName || !email || !programId) {
      return NextResponse.json(
        { error: "Missing required fields (First name, Last name, Email, and Department/Program selection are required)." },
        { status: 400 },
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!isValidEmailAddress(normalizedEmail)) {
      return NextResponse.json(
        { error: "Please provide a real email address" },
        { status: 400 },
      );
    }

    const supabase = getServiceRoleClient();

    const DEFAULT_PROGRAM_NAME_MAP: Record<string, string> = {
      BEED: "Bachelor of Elementary Education",
      BSA: "Bachelor of Science in Accountancy",
      BSMA: "Bachelor of Science in Management Accounting",
      BSIE: "Bachelor of Science in Industrial Engineering",
      BSIT: "Bachelor of Science in Information Technology",
      BSBAHRM: "Bachelor of Science in Business Administration major in Human Resource Management",
      BSENT: "Bachelor of Science in Entrepreneurship",
      DIT: "Diploma in Information Technology",
      "DOMT-LOM": "Diploma in Office Management Technology major in Legal Office Management",
    };

    let programRecord: { id: string; code: string; name: string } | null = null;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(programId);

    if (isUuid) {
      const { data } = await supabase
        .from("programs")
        .select("id, code, name")
        .eq("id", programId)
        .maybeSingle();
      programRecord = data;
    }

    if (!programRecord) {
      const { data } = await supabase
        .from("programs")
        .select("id, code, name")
        .ilike("code", programId)
        .maybeSingle();
      programRecord = data;
    }

    if (!programRecord) {
      const upperCode = programId.toUpperCase();
      const programName = DEFAULT_PROGRAM_NAME_MAP[upperCode] || `Department ${programId}`;

      const { data: createdProgram } = await supabase
        .from("programs")
        .upsert(
          {
            code: programId,
            name: programName,
          },
          { onConflict: "code" }
        )
        .select("id, code, name")
        .maybeSingle();

      programRecord = createdProgram;
    }

    if (!programRecord) {
      return NextResponse.json(
        { error: "Selected academic program or department is invalid." },
        { status: 400 },
      );
    }

    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (existingProfile) {
      return NextResponse.json(
        {
          error: `Faculty account with email ${normalizedEmail} already exists`,
        },
        { status: 400 },
      );
    }



    const { data: authUsers, error: authUsersError } =
      await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });

    if (authUsersError) {
      return NextResponse.json(
        { error: authUsersError.message },
        { status: 400 },
      );
    }

    const existingAuthUser = authUsers.users.find(
      (item) => item.email?.trim().toLowerCase() === normalizedEmail,
    );

    if (existingAuthUser) {
      return NextResponse.json(
        {
          error: `Faculty account with email ${normalizedEmail} already exists`,
        },
        { status: 400 },
      );
    }

    const profileImageMetadata: {
      profile_image_bucket: string | null;
      profile_image_path: string | null;
    } = {
      profile_image_bucket: null,
      profile_image_path: null,
    };

    if (profileImage && profileImage.size > 0) {
      const safeFileName = profileImage.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `faculty-profile-images/${normalizedEmail}/${Date.now()}-${crypto.randomUUID()}-${safeFileName}`;
      const arrayBuffer = await profileImage.arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from(FACULTY_PROFILE_IMAGE_BUCKET)
        .upload(storagePath, arrayBuffer, {
          contentType: profileImage.type || "application/octet-stream",
          upsert: false,
        });

      if (uploadError) {
        return NextResponse.json(
          {
            error: `Failed to upload profile image: ${uploadError.message}`,
          },
          { status: 400 },
        );
      }

      profileImageMetadata.profile_image_bucket = FACULTY_PROFILE_IMAGE_BUCKET;
      profileImageMetadata.profile_image_path = storagePath;
    }

    const publicAppOrigin =
      process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
    const callbackUrl = new URL("/auth/confirm", publicAppOrigin);
    callbackUrl.searchParams.set("next", "/faculty/dashboard");

    const { data: genData, error: genError } =
      await supabase.auth.admin.generateLink({
        type: "invite",
        email: normalizedEmail,
        options: {
          data: {
            first_name: firstName.trim(),
            middle_name: middleName.trim() || null,
            last_name: lastName.trim(),
            full_name: fullName,
            program_id: programRecord.id,
            program_code: programRecord.code,
            profile_image_bucket: profileImageMetadata.profile_image_bucket,
            profile_image_path: profileImageMetadata.profile_image_path,
            role: ROLE.FACULTY,
            created_via: "admin_faculty_panel",
            created_by_admin_id: user.id,
          },
          redirectTo: callbackUrl.toString(),
        },
      });

    if (genError) {
      if (profileImageMetadata.profile_image_path) {
        await supabase.storage
          .from(FACULTY_PROFILE_IMAGE_BUCKET)
          .remove([profileImageMetadata.profile_image_path])
          .catch(() => null);
      }

      return NextResponse.json(
        {
          error: genError?.message ?? "Failed to generate faculty invite link",
        },
        { status: 400 },
      );
    }

    // Pre-create profile, user_roles, and program assignment in DB
    // so the faculty account appears immediately in the admin faculty list.
    const createdAuthUser = genData?.user;
    if (createdAuthUser) {
      try {
        const { data: newProfile, error: profileErr } = await supabase
          .from("profiles")
          .upsert(
            {
              user_id: createdAuthUser.id,
              full_name: fullName,
              email: normalizedEmail,
              department_id: programRecord.id,
            },
            { onConflict: "user_id" },
          )
          .select("id")
          .single();

        if (newProfile?.id) {
          // Insert user_roles so the faculty list API can discover this user
          const { data: facultyRoleRow } = await supabase
            .from("roles")
            .select("id")
            .eq("code", ROLE.FACULTY)
            .maybeSingle();

          if (facultyRoleRow?.id) {
            await supabase
              .from("user_roles")
              .upsert(
                {
                  profile_id: newProfile.id,
                  role_id: facultyRoleRow.id,
                },
                { onConflict: "profile_id,role_id" },
              );
          }



          // Insert program assignment
          const { data: activeTerm } = await supabase
            .from("academic_terms")
            .select("academic_year, semester")
            .eq("status", "Current")
            .maybeSingle();

          const academicYear = activeTerm?.academic_year || "2026-2027";
          const term = activeTerm?.semester || "1st Semester";

          await supabase.from("faculty_program_assignments").upsert(
            {
              faculty_profile_id: newProfile.id,
              program_id: programRecord.id,
              academic_year: academicYear,
              term: term,
            },
            { onConflict: "faculty_profile_id,program_id,academic_year,term" },
          );
        }
      } catch (assignError) {
        logger.error("faculty_preinsert_failed", {
          error: assignError instanceof Error ? assignError.message : String(assignError),
        });
      }
    }

    const actionLink = genData?.properties?.action_link ?? null;

    let sent = false;
    let sendError: string | null = null;

    if (actionLink) {
      try {
        await sendInviteEmail({
          to: normalizedEmail,
          link: actionLink,
          firstName: firstName.trim(),
          fullName,
          invitedRole: ROLE.FACULTY,
        });
        sent = true;
      } catch (e) {
        sendError =
          e instanceof Error ? e.message : String(e ?? "unknown error");
        console.error("Failed to send faculty invite email", {
          email: normalizedEmail,
          fullName,
          sendError,
        });
      }
    }

    // Audit log – fire-and-forget; never blocks the invite response
    try {
      await logAuditEvent({
        actorId: user.id,
        action: "faculty.create",
        entityType: "faculty",
        entityId: user.id,
        metadata: {
          target_email: normalizedEmail,
          target_full_name: fullName,
          program_id: programId,
          program_code: programRecord.code,
          program_name: programRecord.name,
          invite_sent: sent,
          send_error: sendError,
        },
      });
    } catch (auditError) {
      logger.error("audit_log_faculty_create_failed", {
        email: normalizedEmail,
        error: auditError instanceof Error ? auditError.message : String(auditError),
      });
    }

    return NextResponse.json({
      success: true,
      invited: true,
      sent,
      sendError,
      link: actionLink,
      user: {
        email: normalizedEmail,
        fullName,
        program: {
          id: programRecord.id,
          code: programRecord.code,
          name: programRecord.name,
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 },
    );
  }
}
