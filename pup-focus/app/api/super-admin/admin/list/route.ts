import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ROLE } from "@/config/roles";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { FACULTY_PROFILE_IMAGE_BUCKET } from "@/lib/faculty-profile";

function buildProfileName(
  metadata: Record<string, unknown> | null | undefined,
) {
  const firstName =
    typeof metadata?.first_name === "string" ? metadata.first_name.trim() : "";
  const middleName =
    typeof metadata?.middle_name === "string"
      ? metadata.middle_name.trim()
      : "";
  const lastName =
    typeof metadata?.last_name === "string" ? metadata.last_name.trim() : "";
  const fullName =
    typeof metadata?.full_name === "string" ? metadata.full_name.trim() : "";

  return {
    firstName: firstName || null,
    middleName: middleName || null,
    lastName: lastName || null,
    fullName: fullName || null,
  };
}

function buildProfileImageReference(
  metadata: Record<string, unknown> | null | undefined,
) {
  const bucket =
    typeof metadata?.profile_image_bucket === "string" &&
    metadata.profile_image_bucket.trim()
      ? metadata.profile_image_bucket.trim()
      : FACULTY_PROFILE_IMAGE_BUCKET;
  const path =
    typeof metadata?.profile_image_path === "string" &&
    metadata.profile_image_path.trim()
      ? metadata.profile_image_path.trim()
      : null;

  return { bucket, path };
}

export async function GET() {
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
    const supabase = getServiceRoleClient();
    const { data: admins, error: adminsError } = await supabase
      .from("admins")
      .select(
        "id, profile_id, full_name, email, department, permissions, is_active, created_at",
      )
      .order("created_at", { ascending: false });

    if (adminsError) {
      return NextResponse.json(
        {
          error: "Failed to load admin accounts",
          details: adminsError.message,
        },
        { status: 500 },
      );
    }

    const profileIds = (admins ?? [])
      .map((item) => item.profile_id)
      .filter((value): value is string => Boolean(value));

    if (profileIds.length === 0) {
      return NextResponse.json({ admins: [] });
    }

    const { data: appUsers, error: appUsersError } = await supabase
      .from("app_users")
      .select("profile_id, auth_user_id, role, metadata, created_at")
      .in("profile_id", profileIds);

    if (appUsersError) {
      return NextResponse.json(
        {
          error: "Failed to load admin accounts",
          details: appUsersError.message,
        },
        { status: 500 },
      );
    }

    const appUserByProfileId = new Map(
      (appUsers ?? []).map((item) => [item.profile_id, item]),
    );

    const metadataByProfileId = new Map<string, Record<string, unknown>>();

    await Promise.all(
      (appUsers ?? []).map(async (item) => {
        const authUserMetadata = item.auth_user_id
          ? ((await supabase.auth.admin.getUserById(item.auth_user_id)).data
              .user?.user_metadata ?? {})
          : {};

        metadataByProfileId.set(item.profile_id, {
          ...authUserMetadata,
          ...(item.metadata as Record<string, unknown> | null | undefined),
        });
      }),
    );

    const authUserByProfileId = new Map(
      (appUsers ?? []).map((item) => [item.profile_id, item.auth_user_id]),
    );

    const roleByProfileId = new Map(
      (appUsers ?? []).map((item) => [item.profile_id, item.role]),
    );

    const profileNameByProfileId = new Map(
      [...metadataByProfileId.entries()].map(([profileId, metadata]) => [
        profileId,
        buildProfileName(metadata),
      ]),
    );

    const imageReferenceByProfileId = new Map(
      [...metadataByProfileId.entries()].map(([profileId, metadata]) => [
        profileId,
        buildProfileImageReference(metadata),
      ]),
    );

    const profileImageUrlByProfileId = new Map<string, string | null>();

    await Promise.all(
      (appUsers ?? []).map(async (item) => {
        const imageReference = imageReferenceByProfileId.get(item.profile_id);

        if (!imageReference?.path) {
          profileImageUrlByProfileId.set(item.profile_id, null);
          return;
        }

        const { data: signedImage, error: signedImageError } =
          await supabase.storage
            .from(imageReference.bucket)
            .createSignedUrl(imageReference.path, 60 * 60 * 24);

        profileImageUrlByProfileId.set(
          item.profile_id,
          signedImageError ? null : (signedImage?.signedUrl ?? null),
        );
      }),
    );

    const enrichedAdmins = (admins ?? []).map((admin) => ({
      ...admin,
      auth_user_id: authUserByProfileId.get(admin.profile_id) ?? null,
      role: roleByProfileId.get(admin.profile_id) ?? ROLE.ADMIN,
      profile: profileNameByProfileId.get(admin.profile_id) ?? null,
      profileImageUrl: profileImageUrlByProfileId.get(admin.profile_id) ?? null,
    }));

    return NextResponse.json({ admins: enrichedAdmins });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load admin accounts", details: String(error) },
      { status: 500 },
    );
  }
}
