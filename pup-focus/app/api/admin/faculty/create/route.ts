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
import {
  buildGraceDueAtIso,
  buildOriginRemarks,
  isValidManilaIso,
  resolveOnboardingContext,
  type OnboardingContext,
  type SubmissionOrigin,
} from "@/features/submissions/services/submission-window.service";

async function readRequestPayload(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();

    const readString = (field: string) => {
      const value = formData.get(field);
      return typeof value === "string" ? value : "";
    };

    const rawPayload: Record<string, any> = {};
    formData.forEach((value, key) => {
      if (value instanceof File) {
        rawPayload[key] = `[File: ${value.name}, ${value.size} bytes]`;
      } else {
        rawPayload[key] = value;
      }
    });

    return {
      rawBody: rawPayload,
      firstName: readString("firstName"),
      middleName: readString("middleName"),
      lastName: readString("lastName"),
      email: readString("email"),
      programId: readString("programId") || readString("program_id"),
      profileImage:
        formData.get("profileImage") instanceof File
          ? (formData.get("profileImage") as File)
          : null,
      onboardingOption: readString("onboardingOption") || readString("deadlineOption") || null,
      gracePeriodIso: readString("gracePeriodIso") || readString("due_at") || null,
      customDeadlines: (() => {
        const raw = readString("customDeadlines");
        if (!raw) return null;
        try {
          return JSON.parse(raw);
        } catch {
          return null;
        }
      })(),
    };
  }

  const body = ((await request.json().catch(() => ({}))) || {}) as {
    firstName?: string;
    middleName?: string;
    lastName?: string;
    email?: string;
    programId?: string;
    program_id?: string;
    fullName?: string;
    onboardingOption?: string;
    deadlineOption?: string;
    gracePeriodIso?: string;
    due_at?: string;
    customDeadlines?: Record<string, string>;
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
    rawBody: body,
    firstName: (body.firstName ?? legacyFirstName).trim(),
    middleName: (body.middleName ?? legacyMiddleName).trim(),
    lastName: (body.lastName ?? legacyLastName).trim(),
    email: body.email ?? "",
    programId: (body.programId ?? body.program_id ?? "").trim(),
    profileImage: null,
    onboardingOption: body.onboardingOption || body.deadlineOption || null,
    gracePeriodIso: body.gracePeriodIso || body.due_at || null,
    customDeadlines: body.customDeadlines || null,
  };
}

type SubmissionPlan = {
  status: "pending" | "exempted";
  origin: SubmissionOrigin;
  dueAt: string | null;
  detail: string;
};

const DEFAULT_GRACE_DAYS = 7;

/**
 * Decides how one requirement row is initialized for a brand-new faculty member.
 * - Window open: regular pending row due at the active window end (STANDARD).
 * - Window closed: honors the selected onboarding option (Give Extra Time, Follow Standard Schedule, Mark as Not Required).
 */
function buildSubmissionPlan(params: {
  ctx: OnboardingContext;
  requirementCode: string;
  option: string | null;
  gracePeriodIso: string | null;
  customDeadlines: Record<string, string> | null;
}): SubmissionPlan {
  const { ctx, requirementCode, option, gracePeriodIso, customDeadlines } = params;

  const nowMs = Date.now();
  let graceDueAt: string;
  if (gracePeriodIso) {
    const rawIso = gracePeriodIso.includes("T") ? gracePeriodIso : `${gracePeriodIso}T23:59:59+08:00`;
    const parsed = new Date(rawIso).getTime();
    graceDueAt = !Number.isNaN(parsed) && parsed > nowMs ? rawIso : buildGraceDueAtIso(DEFAULT_GRACE_DAYS);
  } else {
    graceDueAt = buildGraceDueAtIso(DEFAULT_GRACE_DAYS);
  }

  const opt = (option || "").toLowerCase().trim();

  // If specific onboarding options are explicitly provided, honor them
  if (opt === "exempt") {
    return {
      status: "exempted",
      origin: "EXEMPTED",
      dueAt: null,
      detail: "Marked as not required during new faculty setup",
    };
  }

  if (
    opt === "grace_period" ||
    opt === "extra_time" ||
    opt === "give_extra_time" ||
    opt === "option_a" ||
    opt === "give extra time" ||
    opt.includes("extra") ||
    opt.includes("grace") ||
    (!ctx.isWindowActive && gracePeriodIso)
  ) {
    const calculatedDueAt = graceDueAt || buildGraceDueAtIso(DEFAULT_GRACE_DAYS);
    return {
      status: "pending",
      origin: "NEW_FACULTY_GRACE",
      dueAt: calculatedDueAt,
      detail: `Extra time granted until ${calculatedDueAt}`,
    };
  }

  if (option === "custom_deadlines") {
    const custom = customDeadlines?.[requirementCode];
    const dueAt =
      isValidManilaIso(custom) && new Date(custom).getTime() > nowMs
        ? custom
        : graceDueAt;
    return {
      status: "pending",
      origin: "NEW_FACULTY_CUSTOM",
      dueAt,
      detail: `Custom deadline until ${dueAt}`,
    };
  }

  // If the submission window is OPEN/Upcoming and no special override was chosen
  if (ctx.isWindowActive) {
    return {
      status: "pending",
      origin: "STANDARD",
      dueAt: ctx.deadline.iso,
      detail: `Regular submission window until ${ctx.deadline.endDate} at ${ctx.deadline.endTime}`,
    };
  }

  // Window is CLOSED and standard schedule selected (or default)
  if (!ctx.hasAnyScheduleHistory) {
    return {
      status: "pending",
      origin: "NEW_FACULTY_STANDARD",
      dueAt: null,
      detail: "Pending first submission window schedule",
    };
  }

  return {
    status: "pending",
    origin: "NEW_FACULTY_STANDARD",
    dueAt: ctx.deadline.iso,
    detail: `Follows standard schedule (closed since ${ctx.deadline.endDate})`,
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

    const body = await readRequestPayload(request);
    console.log(
      "[FACULTY CREATE INPUT BODY]",
      JSON.stringify(body.rawBody ?? body, null, 2),
    );

    const {
      firstName,
      middleName,
      lastName,
      email,
      programId,
      profileImage,
      onboardingOption,
      gracePeriodIso,
      customDeadlines,
    } = body;

    const fullName = buildFacultyFullName({
      firstName,
      middleName,
      lastName,
    });

    if (!firstName || !lastName || !email || !programId) {
      const missingFields: string[] = [];
      if (!firstName) missingFields.push("firstName");
      if (!lastName) missingFields.push("lastName");
      if (!email) missingFields.push("email");
      if (!programId) missingFields.push("programId / department");

      const validationErrorDetails = {
        missingFields,
        received: {
          firstName: firstName || null,
          lastName: lastName || null,
          email: email || null,
          programId: programId || null,
        },
        message:
          "Missing required fields (First name, Last name, Email, and Department/Program selection are required).",
      };
      console.error("[FACULTY CREATE 400 ERROR]", validationErrorDetails);
      return NextResponse.json(
        { error: "Validation failed", details: validationErrorDetails },
        { status: 400 },
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!isValidEmailAddress(normalizedEmail)) {
      const validationErrorDetails = {
        field: "email",
        value: email,
        normalizedEmail,
        message: "Please provide a real email address",
      };
      console.error("[FACULTY CREATE 400 ERROR]", validationErrorDetails);
      return NextResponse.json(
        { error: "Validation failed", details: validationErrorDetails },
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
      const validationErrorDetails = {
        field: "programId",
        value: programId,
        message: "Selected academic program or department is invalid.",
      };
      console.error("[FACULTY CREATE 400 ERROR]", validationErrorDetails);
      return NextResponse.json(
        { error: "Validation failed", details: validationErrorDetails },
        { status: 400 },
      );
    }

    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (existingProfile) {
      const validationErrorDetails = {
        field: "email",
        value: normalizedEmail,
        message: `Faculty account with email ${normalizedEmail} already exists in profiles`,
      };
      console.error("[FACULTY CREATE 400 ERROR]", validationErrorDetails);
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationErrorDetails,
        },
        { status: 400 },
      );
    }

    const { data: authUsers, error: authUsersError } =
      await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });

    if (authUsersError) {
      const validationErrorDetails = {
        step: "listUsers",
        message: authUsersError.message,
      };
      console.error("[FACULTY CREATE 400 ERROR]", validationErrorDetails);
      return NextResponse.json(
        { error: "Validation failed", details: validationErrorDetails },
        { status: 400 },
      );
    }

    const existingAuthUser = authUsers.users.find(
      (item) => item.email?.trim().toLowerCase() === normalizedEmail,
    );

    if (existingAuthUser) {
      const validationErrorDetails = {
        field: "email",
        value: normalizedEmail,
        message: `Faculty account with email ${normalizedEmail} already exists in auth`,
      };
      console.error("[FACULTY CREATE 400 ERROR]", validationErrorDetails);
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationErrorDetails,
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
        const validationErrorDetails = {
          field: "profileImage",
          message: `Failed to upload profile image: ${uploadError.message}`,
        };
        console.error("[FACULTY CREATE 400 ERROR]", validationErrorDetails);
        return NextResponse.json(
          {
            error: "Validation failed",
            details: validationErrorDetails,
          },
          { status: 400 },
        );
      }

      profileImageMetadata.profile_image_bucket = FACULTY_PROFILE_IMAGE_BUCKET;
      profileImageMetadata.profile_image_path = storagePath;
    }

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      (request.url ? new URL(request.url).origin : "https://pupfocus.cjaayy.dev");
    const callbackUrl = `${siteUrl.replace(/\/$/, "")}/auth/confirm?email=${encodeURIComponent(normalizedEmail)}`;

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
          redirectTo: callbackUrl,
        },
      });

    if (genError) {
      if (profileImageMetadata.profile_image_path) {
        await supabase.storage
          .from(FACULTY_PROFILE_IMAGE_BUCKET)
          .remove([profileImageMetadata.profile_image_path])
          .catch(() => null);
      }

      const validationErrorDetails = {
        field: "generateLink",
        message: genError?.message ?? "Failed to generate faculty invite link",
      };
      console.error("[FACULTY CREATE 400 ERROR]", validationErrorDetails);
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationErrorDetails,
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

          // Resolve the active term + window state once so the assignment and
          // every submission row use identical, consistent values.
          const ctx = await resolveOnboardingContext(supabase);
          const academicYear = ctx.term.academicYear;
          const term = ctx.term.semester;

          const normalizedOpt = (onboardingOption || "").toLowerCase().trim();
          const isGracePeriodOption =
            normalizedOpt === "grace_period" ||
            normalizedOpt === "extra_time" ||
            normalizedOpt === "give_extra_time" ||
            normalizedOpt === "option_a" ||
            normalizedOpt.includes("extra") ||
            normalizedOpt.includes("grace");

          const computedDueAt =
            gracePeriodIso ||
            new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

          // Persist assignment and onboarding grace period deadline
          const assignmentPayload: Record<string, any> = {
            faculty_profile_id: newProfile.id,
            program_id: programRecord.id,
            academic_year: academicYear,
            term: term,
          };

          if (isGracePeriodOption) {
            assignmentPayload.due_at = computedDueAt;
            assignmentPayload.grace_period_until = computedDueAt;
            assignmentPayload.remarks = `[origin:NEW_FACULTY_GRACE] Extra time granted until ${computedDueAt}`;
          }

          let { error: assignErr } = await supabase
            .from("faculty_program_assignments")
            .upsert(assignmentPayload, {
              onConflict: "faculty_profile_id,program_id,academic_year,term",
            });

          if (assignErr) {
            await supabase
              .from("faculty_program_assignments")
              .upsert(
                {
                  faculty_profile_id: newProfile.id,
                  program_id: programRecord.id,
                  academic_year: academicYear,
                  term: term,
                },
                { onConflict: "faculty_profile_id,program_id,academic_year,term" },
              );
          }

          // Persist approved personal deadline so submission window evaluation services recognize active grace period without dummy submission rows
          if (isGracePeriodOption && createdAuthUser?.id) {
            try {
              await supabase.from("extension_requests").insert({
                faculty_user_id: createdAuthUser.id,
                status: "approved",
                approved_extension_date: computedDueAt,
                requested_extension_date: computedDueAt,
                academic_year: academicYear,
                semester: term,
                reason: "Onboarding Grace Period (Option A)",
              });
            } catch {}
          }
        }
      } catch (assignError) {
        console.error("[FACULTY PREINSERT ERROR]", assignError);
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

    // Audit log – fire-and-forget; never blocks the response
    try {
      await logAuditEvent({
        actorId: user.id,
        action: "faculty.create",
        entityType: "faculty",
        entityId: createdAuthUser?.id || user.id,
        metadata: {
          target_email: normalizedEmail,
          target_full_name: fullName,
          program_id: programId,
          program_code: programRecord.code,
          program_name: programRecord.name,
          invite_sent: sent,
          send_error: sendError,
          onboarding_option: onboardingOption || "default",
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
        id: createdAuthUser?.id,
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
