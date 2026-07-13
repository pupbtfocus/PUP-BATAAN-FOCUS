import { NextResponse, type NextRequest } from "next/server";
import { ROLE } from "@/config/roles";
import {
  FACULTY_PROFILE_IMAGE_BUCKET,
  buildFacultyFullName,
} from "@/lib/faculty-profile";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

function trimOrEmpty(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function trimOrNull(value: unknown) {
  const trimmed = trimOrEmpty(value);
  return trimmed || null;
}

type FacultyAccountRecord = {
  profileId: string;
  firstName: string;
  middleName: string;
  lastName: string;
  fullName: string;
  email: string;
  profileImageUrl: string | null;
};

async function loadFacultyAccount(
  authUserId: string,
): Promise<FacultyAccountRecord> {
  const supabase = getServiceRoleClient();

  const { data: authUserResult, error: authUserError } =
    await supabase.auth.admin.getUserById(authUserId);

  if (authUserError) {
    throw new Error(authUserError.message);
  }

  const { data: appUser, error: appUserError } = await supabase
    .from("app_users")
    .select("profile_id, email, full_name, metadata")
    .eq("auth_user_id", authUserId)
    .eq("role", ROLE.FACULTY)
    .maybeSingle();

  if (appUserError || !appUser?.profile_id) {
    throw new Error("Faculty account not found");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("id", appUser.profile_id)
    .maybeSingle();

  if (profileError || !profile) {
    throw new Error("Faculty profile not found");
  }

  const authUserMetadata = (authUserResult.user?.user_metadata ?? {}) as Record<
    string,
    unknown
  >;
  const metadata = (appUser.metadata ?? {}) as Record<string, unknown>;
  const mergedMetadata = {
    ...authUserMetadata,
    ...metadata,
  };
  const firstName = trimOrEmpty(mergedMetadata.first_name);
  const middleName = trimOrEmpty(mergedMetadata.middle_name);
  const lastName = trimOrEmpty(mergedMetadata.last_name);
  const fullName =
    buildFacultyFullName({ firstName, middleName, lastName }) ||
    trimOrEmpty(profile.full_name) ||
    trimOrEmpty(appUser.full_name) ||
    "Faculty";
  const email = trimOrEmpty(profile.email) || trimOrEmpty(appUser.email);
  const profileImagePath = trimOrNull(mergedMetadata.profile_image_path);
  const profileImageBucket =
    trimOrEmpty(mergedMetadata.profile_image_bucket) ||
    FACULTY_PROFILE_IMAGE_BUCKET;

  let profileImageUrl: string | null = null;
  if (profileImagePath) {
    const { data: signed, error: signedError } = await supabase.storage
      .from(profileImageBucket)
      .createSignedUrl(profileImagePath, 60 * 60);

    if (!signedError) {
      profileImageUrl = signed?.signedUrl ?? null;
    }
  }

  return {
    profileId: profile.id,
    firstName,
    middleName,
    lastName,
    fullName,
    email,
    profileImageUrl,
  };
}

export async function GET() {
  try {
    const sessionClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();

    const requesterRole =
      (user?.user_metadata?.role as string | undefined) ??
      (user?.app_metadata?.role as string | undefined);

    if (!user || requesterRole !== ROLE.FACULTY) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const account = await loadFacultyAccount(user.id);
    return NextResponse.json(account);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load faculty account",
      },
      { status: 400 },
    );
  }
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

    if (!user || requesterRole !== ROLE.FACULTY) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const contentType = request.headers.get("content-type") ?? "";
    let firstName = "";
    let middleName = "";
    let lastName = "";
    let profileImage: File | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      firstName = trimOrEmpty(formData.get("firstName"));
      middleName = trimOrEmpty(formData.get("middleName"));
      lastName = trimOrEmpty(formData.get("lastName"));
      const imageValue = formData.get("profileImage");
      profileImage = imageValue instanceof File ? imageValue : null;
    } else {
      const payload = (await request.json()) as {
        firstName?: string;
        middleName?: string;
        lastName?: string;
      };

      firstName = trimOrEmpty(payload.firstName);
      middleName = trimOrEmpty(payload.middleName);
      lastName = trimOrEmpty(payload.lastName);
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
      .select("id, profile_id, full_name, email, metadata")
      .eq("auth_user_id", user.id)
      .eq("role", ROLE.FACULTY)
      .maybeSingle();

    if (appUserError || !appUser?.profile_id) {
      return NextResponse.json(
        { error: "Faculty account not found" },
        { status: 404 },
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", appUser.profile_id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Faculty profile not found" },
        { status: 404 },
      );
    }

    const authUserResult = await supabase.auth.admin.getUserById(user.id);
    const previousAuthUserMetadata = (authUserResult.data.user?.user_metadata ??
      {}) as Record<string, unknown>;
    const previousAppUserMetadata = (appUser.metadata ?? {}) as Record<
      string,
      unknown
    >;
    const previousMergedMetadata = {
      ...previousAuthUserMetadata,
      ...previousAppUserMetadata,
    };
    const previousProfileImagePath = trimOrNull(
      previousMergedMetadata.profile_image_path,
    );
    const previousProfileImageBucket =
      trimOrEmpty(previousMergedMetadata.profile_image_bucket) ||
      FACULTY_PROFILE_IMAGE_BUCKET;

    const updatedFullName = buildFacultyFullName({
      firstName,
      middleName,
      lastName,
    });

    const previousProfileName = profile.full_name;
    const previousAppUserName = appUser.full_name ?? null;

    const updatedMetadata = {
      ...previousAppUserMetadata,
      first_name: firstName,
      middle_name: middleName || null,
      last_name: lastName,
      full_name: updatedFullName,
    };

    let uploadedProfileImagePath = previousProfileImagePath;
    let uploadedProfileImageBucket = previousProfileImageBucket;

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
        uploadedProfileImagePath !== previousProfileImagePath
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

    const { error: authUpdateError } = await supabase.auth.admin.updateUserById(
      user.id,
      {
        user_metadata: {
          ...(user.user_metadata ?? {}),
          first_name: firstName,
          middle_name: middleName || null,
          last_name: lastName,
          full_name: updatedFullName,
          role: ROLE.FACULTY,
        },
      },
    );

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
        uploadedProfileImagePath !== previousProfileImagePath
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

    if (
      uploadedProfileImagePath &&
      previousProfileImagePath &&
      previousProfileImagePath !== uploadedProfileImagePath
    ) {
      await supabase.storage
        .from(previousProfileImageBucket)
        .remove([previousProfileImagePath])
        .catch(() => null);
    }

    const account = await loadFacultyAccount(user.id);
    return NextResponse.json(account);
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
