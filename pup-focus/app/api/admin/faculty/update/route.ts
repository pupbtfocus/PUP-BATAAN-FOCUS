import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { ROLE } from "@/config/roles";
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
      facultyProfileId: trimOrEmpty(formData.get("facultyProfileId")),
      firstName: trimOrEmpty(formData.get("firstName")),
      middleName: trimOrEmpty(formData.get("middleName")),
      lastName: trimOrEmpty(formData.get("lastName")),
      profileImage:
        formData.get("profileImage") instanceof File
          ? (formData.get("profileImage") as File)
          : null,
    };
  }

  const body = (await request.json()) as {
    facultyProfileId?: string;
    firstName?: string;
    middleName?: string;
    lastName?: string;
  };

  return {
    facultyProfileId: trimOrEmpty(body.facultyProfileId),
    firstName: trimOrEmpty(body.firstName),
    middleName: trimOrEmpty(body.middleName),
    lastName: trimOrEmpty(body.lastName),
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

    const { facultyProfileId, firstName, middleName, lastName, profileImage } =
      await readRequestPayload(request);

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

    const { data: appUser, error: appUserError } = await supabase
      .from("app_users")
      .select("id, auth_user_id, profile_id, full_name, metadata")
      .eq("profile_id", facultyProfileId)
      .eq("role", ROLE.FACULTY)
      .maybeSingle();

    if (appUserError || !appUser) {
      return NextResponse.json(
        { error: "Faculty account not found" },
        { status: 404 },
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .eq("id", facultyProfileId)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Faculty profile not found" },
        { status: 404 },
      );
    }

    const authUserId = appUser.auth_user_id ?? null;
    const previousProfileName = profile.full_name;
    const previousAppUserName = appUser.full_name ?? null;
    const previousAppUserMetadata = (appUser.metadata ?? {}) as Record<
      string,
      unknown
    >;

    const updatedFullName = buildFacultyFullName({
      firstName,
      middleName,
      lastName,
    });

    const updatedMetadata: Record<string, unknown> = {
      ...previousAppUserMetadata,
      first_name: firstName,
      middle_name: middleName || null,
      last_name: lastName,
      full_name: updatedFullName,
    };

    let uploadedProfileImagePath = trimOrEmpty(
      previousAppUserMetadata.profile_image_path,
    );
    let uploadedProfileImageBucket =
      trimOrEmpty(previousAppUserMetadata.profile_image_bucket) ||
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

    const { error: profileUpdateError } = await supabase
      .from("profiles")
      .update({ full_name: updatedFullName })
      .eq("id", profile.id);

    if (profileUpdateError) {
      return NextResponse.json(
        { error: profileUpdateError.message },
        { status: 400 },
      );
    }

    const { error: appUsersUpdateError } = await supabase
      .from("app_users")
      .update({ full_name: updatedFullName, metadata: updatedMetadata })
      .eq("profile_id", profile.id)
      .eq("role", ROLE.FACULTY);

    if (appUsersUpdateError) {
      await supabase
        .from("profiles")
        .update({ full_name: previousProfileName })
        .eq("id", profile.id);

      if (
        uploadedProfileImagePath &&
        uploadedProfileImagePath !==
          trimOrEmpty(previousAppUserMetadata.profile_image_path)
      ) {
        await supabase.storage
          .from(uploadedProfileImageBucket)
          .remove([uploadedProfileImagePath])
          .catch(() => null);
      }

      return NextResponse.json(
        { error: appUsersUpdateError.message },
        { status: 400 },
      );
    }

    if (authUserId) {
      const { error: authUpdateError } =
        await supabase.auth.admin.updateUserById(authUserId, {
          user_metadata: {
            ...(user.user_metadata ?? {}),
            first_name: firstName,
            middle_name: middleName || null,
            last_name: lastName,
            full_name: updatedFullName,
            role: ROLE.FACULTY,
          },
        });

      if (authUpdateError) {
        await supabase
          .from("profiles")
          .update({ full_name: previousProfileName })
          .eq("id", profile.id);
        await supabase
          .from("app_users")
          .update({
            full_name: previousAppUserName,
            metadata: previousAppUserMetadata,
          })
          .eq("profile_id", profile.id)
          .eq("role", ROLE.FACULTY);

        if (
          uploadedProfileImagePath &&
          uploadedProfileImagePath !==
            trimOrEmpty(previousAppUserMetadata.profile_image_path)
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
      trimOrEmpty(previousAppUserMetadata.profile_image_path) &&
      previousAppUserMetadata.profile_image_path !== uploadedProfileImagePath
    ) {
      await supabase.storage
        .from(
          (previousAppUserMetadata.profile_image_bucket as string) ||
            FACULTY_PROFILE_IMAGE_BUCKET,
        )
        .remove([trimOrEmpty(previousAppUserMetadata.profile_image_path)])
        .catch(() => null);
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
