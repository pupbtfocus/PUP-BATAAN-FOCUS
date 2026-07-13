import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ROLE } from "@/config/roles";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { sendInviteEmail } from "@/lib/email/send-invite";
import { isValidEmailAddress } from "@/lib/validation/email";
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
      profileImage:
        formData.get("profileImage") instanceof File
          ? (formData.get("profileImage") as File)
          : null,
    };
  }

  const body = (await request.json()) as {
    firstName?: string;
    middleName?: string | null;
    lastName?: string;
    email?: string;
    profileImage?: never;
  };

  return {
    firstName: body.firstName ?? "",
    middleName: body.middleName ?? "",
    lastName: body.lastName ?? "",
    email: body.email ?? "",
    profileImage: null,
  };
}

export async function POST(request: NextRequest) {
  const sessionClient = await createServerSupabaseClient();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();

  const requesterRole =
    (user?.user_metadata?.role as string | undefined) ??
    (user?.app_metadata?.role as string | undefined);

  if (
    !user ||
    (requesterRole !== ROLE.SUPER_ADMIN && requesterRole !== ROLE.ADMIN)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { firstName, middleName, lastName, email, profileImage } =
      await readRequestPayload(request);

    const trimmedFirstName = firstName.trim();
    const trimmedMiddleName = middleName.trim();
    const trimmedLastName = lastName.trim();
    const fullName = buildFacultyFullName({
      firstName: trimmedFirstName,
      middleName: trimmedMiddleName,
      lastName: trimmedLastName,
    });
    const normalizedEmail = email.trim().toLowerCase();

    if (!trimmedFirstName || !trimmedLastName || !fullName || !email) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    if (!isValidEmailAddress(normalizedEmail)) {
      return NextResponse.json(
        { error: "Please provide a real email address" },
        { status: 400 },
      );
    }

    const supabase = getServiceRoleClient();

    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (existingProfile) {
      return NextResponse.json(
        { error: `Account with email ${normalizedEmail} already exists` },
        { status: 400 },
      );
    }

    const { data: existingAdmin } = await supabase
      .from("admins")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (existingAdmin) {
      return NextResponse.json(
        { error: `Account with email ${normalizedEmail} already exists` },
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
        { error: `Account with email ${normalizedEmail} already exists` },
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
      const storagePath = `admin-profile-images/${normalizedEmail}/${Date.now()}-${crypto.randomUUID()}-${safeFileName}`;
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

      profileImageMetadata.profile_image_bucket = FACULTY_PROFILE_IMAGE_BUCKET;
      profileImageMetadata.profile_image_path = storagePath;
    }

    const publicAppOrigin =
      process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
    const callbackUrl = new URL("/auth/confirm", publicAppOrigin);
    callbackUrl.searchParams.set("next", "/super-admin/dashboard");

    const { data: genData, error: genError } =
      await supabase.auth.admin.generateLink({
        type: "invite",
        email: normalizedEmail,
        options: {
          data: {
            first_name: trimmedFirstName,
            middle_name: trimmedMiddleName || null,
            last_name: trimmedLastName,
            full_name: fullName,
            profile_image_bucket: profileImageMetadata.profile_image_bucket,
            profile_image_path: profileImageMetadata.profile_image_path,
            role: ROLE.ADMIN,
            created_via: "super_admin_admin_panel",
            created_by_super_admin_id: user.id,
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
        { error: genError?.message ?? "Failed to generate admin invite link" },
        { status: 400 },
      );
    }

    const actionLink = genData?.properties?.action_link ?? null;

    let sent = false;
    let sendError: string | null = null;

    if (actionLink) {
      try {
        await sendInviteEmail({
          to: normalizedEmail,
          link: actionLink,
          fullName,
        });
        sent = true;
      } catch (e) {
        sendError =
          e instanceof Error ? e.message : String(e ?? "unknown error");
        console.error("Failed to send admin invite email", {
          email: normalizedEmail,
          fullName,
          sendError,
        });
      }
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
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 },
    );
  }
}
