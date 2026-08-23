import { NextResponse, type NextRequest } from "next/server";
import { ROLE } from "@/config/roles";
import {
  FACULTY_PROFILE_IMAGE_BUCKET,
  buildFacultyFullName,
  parseFullNameFallback,
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

type FacultyProgramInfo = {
  id: string;
  code: string;
  name: string;
};

type FacultyAccountRecord = {
  profileId: string;
  firstName: string;
  middleName: string;
  lastName: string;
  fullName: string;
  email: string;
  profileImageUrl: string | null;
  program: FacultyProgramInfo | null;
};

async function loadFacultyAccount(
  authUserId: string,
): Promise<FacultyAccountRecord> {
  const supabase = getServiceRoleClient();

  let authUser: any = null;
  try {
    const { data: authUserResult } =
      await supabase.auth.admin.getUserById(authUserId);
    authUser = authUserResult?.user ?? null;
  } catch {
    // Continue with available data
  }

  let profile: any = null;
  try {
    const { data: profileResult } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("user_id", authUserId)
      .maybeSingle();
    profile = profileResult ?? null;
  } catch {
    // Continue with fallback profile
  }

  let program: FacultyProgramInfo | null = null;
  const profileId = profile?.id || authUserId;

  if (profile?.id) {
    try {
      const { data: assignmentRow } = await supabase
        .from("faculty_program_assignments")
        .select("program_id, programs(id, code, name)")
        .eq("faculty_profile_id", profile.id)
        .limit(1)
        .maybeSingle();

      if (assignmentRow?.programs) {
        const prog = Array.isArray(assignmentRow.programs)
          ? (assignmentRow.programs as any)[0]
          : (assignmentRow.programs as any);
        if (prog?.id && prog?.code && prog?.name) {
          program = {
            id: prog.id,
            code: prog.code,
            name: prog.name,
          };
        }
      }
    } catch {
      program = null;
    }
  }

  const authUserMetadata = (authUser?.user_metadata ?? {}) as Record<
    string,
    unknown
  >;
  const rawFullName =
    trimOrEmpty(profile?.full_name) ||
    trimOrEmpty(authUserMetadata.full_name) ||
    trimOrEmpty(authUserMetadata.name) ||
    trimOrEmpty(authUser?.email?.split("@")[0]) ||
    "Faculty";
  const parsedFallback = parseFullNameFallback(rawFullName);

  const firstName =
    trimOrEmpty(authUserMetadata.first_name) || parsedFallback.firstName;
  const middleName =
    trimOrEmpty(authUserMetadata.middle_name) || parsedFallback.middleName;
  const lastName =
    trimOrEmpty(authUserMetadata.last_name) || parsedFallback.lastName;
  const fullName =
    buildFacultyFullName({ firstName, middleName, lastName }) ||
    rawFullName;
  const email = trimOrEmpty(profile?.email) || trimOrEmpty(authUser?.email);
  const profileImagePath = trimOrNull(authUserMetadata.profile_image_path);
  const profileImageBucket =
    trimOrEmpty(authUserMetadata.profile_image_bucket) ||
    FACULTY_PROFILE_IMAGE_BUCKET;

  let profileImageUrl: string | null = null;
  if (profileImagePath) {
    try {
      const { data: signed, error: signedError } = await supabase.storage
        .from(profileImageBucket)
        .createSignedUrl(profileImagePath, 60 * 60);

      if (!signedError) {
        profileImageUrl = signed?.signedUrl ?? null;
      }
    } catch {
      profileImageUrl = null;
    }
  }

  return {
    profileId,
    firstName,
    middleName,
    lastName,
    fullName,
    email,
    profileImageUrl,
    program,
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

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("user_id", user.id)
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
    const previousProfileImagePath = trimOrNull(
      previousAuthUserMetadata.profile_image_path,
    );
    const previousProfileImageBucket =
      trimOrEmpty(previousAuthUserMetadata.profile_image_bucket) ||
      FACULTY_PROFILE_IMAGE_BUCKET;

    const updatedFullName = buildFacultyFullName({
      firstName,
      middleName,
      lastName,
    });

    const previousProfileName = profile.full_name;

    const updatedMetadata: Record<string, unknown> = {
      ...previousAuthUserMetadata,
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
      .update({
        full_name: updatedFullName,
        first_name: firstName,
        middle_name: middleName || null,
        last_name: lastName,
      })
      .eq("id", profile.id);

    if (profileUpdateError) {
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
        { error: profileUpdateError.message },
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
          profile_image_bucket: updatedMetadata.profile_image_bucket,
          profile_image_path: updatedMetadata.profile_image_path,
        },
      },
    );

    if (authUpdateError) {
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
