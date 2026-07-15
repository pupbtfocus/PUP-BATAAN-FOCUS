import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { DEFAULT_REQUIREMENTS } from "@/config/compliance";
import { ROLE } from "@/config/roles";
import {
  FACULTY_PROFILE_IMAGE_BUCKET,
  buildFacultyFullName,
} from "@/lib/faculty-profile";

type RequirementStatus = "not_submitted" | "uploaded" | "validated";

type SubmissionRow = {
  faculty_profile_id: string;
  requirement_code: string;
  status: string | null;
  submitted_at: string | null;
  document_versions?: Array<{ id: string }> | null;
};

function buildInitialRequirementStatus() {
  return DEFAULT_REQUIREMENTS.reduce(
    (acc, requirementCode) => {
      acc[requirementCode] = "not_submitted";
      return acc;
    },
    {} as Record<(typeof DEFAULT_REQUIREMENTS)[number], RequirementStatus>,
  );
}

function toRequirementStatus(rawStatus: string | null): RequirementStatus {
  const status = (rawStatus ?? "").toLowerCase();

  if (status === "validated" || status === "approved") {
    return "validated";
  }

  if (
    status === "uploaded" ||
    status === "submitted" ||
    status === "under_review" ||
    status === "pending_review" ||
    status === "pending"
  ) {
    return "uploaded";
  }

  return "not_submitted";
}

function hasDocumentVersion(submission: {
  document_versions?: Array<{ id: string }> | null;
}): boolean {
  return Array.isArray(submission.document_versions)
    ? submission.document_versions.length > 0
    : false;
}

export async function GET(request: NextRequest) {
  try {
    // detect debug mode and allow unauthenticated debug only on localhost
    const url = new URL(request.url);
    const debugMode = url.searchParams.get("debug") === "1";
    const host = url.hostname;
    const allowDebugUnauth =
      debugMode &&
      (host === "localhost" || host === "127.0.0.1" || host === "::1");

    let user: any = null;
    let requesterRole: string | undefined = undefined;

    if (!allowDebugUnauth) {
      const sessionClient = await createServerSupabaseClient();
      const {
        data: { user: sessionUser },
      } = await sessionClient.auth.getUser();

      user = sessionUser;
      requesterRole =
        (user?.user_metadata?.role as string | undefined) ??
        (user?.app_metadata?.role as string | undefined);

      if (
        !user ||
        (requesterRole !== ROLE.ADMIN && requesterRole !== ROLE.SUPER_ADMIN)
      ) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const supabase = getServiceRoleClient();

    const { data: facultyRole, error: roleError } = await supabase
      .from("roles")
      .select("id")
      .eq("code", "faculty")
      .maybeSingle();

    if (roleError) {
      return NextResponse.json(
        { error: "Failed to fetch faculty role", details: roleError.message },
        { status: 500 },
      );
    }

    if (!facultyRole?.id) {
      return NextResponse.json({ faculty: [] });
    }

    const { data: userRoles, error: userRolesError } = await supabase
      .from("user_roles")
      .select("profile_id")
      .eq("role_id", facultyRole.id)
      .limit(500);

    if (userRolesError) {
      return NextResponse.json(
        {
          error: "Failed to fetch faculty accounts",
          details: userRolesError.message,
        },
        { status: 500 },
      );
    }

    const profileIds = Array.from(
      new Set(
        (userRoles ?? [])
          .map((entry) => entry.profile_id)
          .filter((value): value is string => Boolean(value)),
      ),
    );

    if (profileIds.length === 0) {
      if (debugMode) {
        return NextResponse.json({
          debug: true,
          facultyCount: 0,
          profileIdsSample: [],
          appUsersSample: [],
          queryError: null,
        });
      }

      return NextResponse.json({ faculty: [] });
    }

    const [profilesResult, appUsersResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, user_id, full_name, email, created_at")
        .in("id", profileIds),
      supabase
        .from("app_users")
        .select("profile_id, auth_user_id, metadata, created_at, role")
        .in("profile_id", profileIds),
    ]);

    const profiles = profilesResult.data;
    const profilesError = profilesResult.error;
    const appUsers = appUsersResult.data;
    const queryError = profilesError ?? appUsersResult.error;

    const { data: submissionRows, error: submissionsError } = await supabase
      .from("submissions")
      .select(
        "faculty_profile_id, requirement_code, status, submitted_at, document_versions(id)",
      )
      .in("faculty_profile_id", profileIds)
      .order("submitted_at", { ascending: false })
      .limit(5000);

    if (submissionsError) {
      return NextResponse.json(
        {
          error: "Failed to fetch faculty submissions",
          details: submissionsError.message,
        },
        { status: 500 },
      );
    }

    const statusRank: Record<RequirementStatus, number> = {
      not_submitted: 0,
      uploaded: 1,
      validated: 2,
    };

    const requirementStatusByProfileId = new Map<
      string,
      Record<(typeof DEFAULT_REQUIREMENTS)[number], RequirementStatus>
    >();

    for (const profileId of profileIds) {
      requirementStatusByProfileId.set(
        profileId,
        buildInitialRequirementStatus(),
      );
    }

    for (const row of (submissionRows ?? []) as SubmissionRow[]) {
      const profileId = row.faculty_profile_id;
      const requirementCode = row.requirement_code as
        | (typeof DEFAULT_REQUIREMENTS)[number]
        | undefined;

      if (
        !profileId ||
        !requirementCode ||
        !DEFAULT_REQUIREMENTS.includes(requirementCode)
      ) {
        continue;
      }

      if (!hasDocumentVersion(row)) {
        continue;
      }

      const mappedStatus = toRequirementStatus(row.status);
      const currentStatus = requirementStatusByProfileId.get(profileId);

      if (
        currentStatus &&
        statusRank[mappedStatus] > statusRank[currentStatus[requirementCode]]
      ) {
        currentStatus[requirementCode] = mappedStatus;
      }
    }

    if (debugMode) {
      return NextResponse.json({
        debug: true,
        facultyCount: profiles?.length ?? 0,
        profileIdsSample: profileIds.slice(0, 50),
        appUsersSample: appUsers ?? [],
        queryError: queryError ? queryError.message : null,
      });
    }

    if (queryError) {
      return NextResponse.json(
        { error: "Failed to fetch faculty", details: queryError.message },
        { status: 500 },
      );
    }

    const appUserByProfileId = new Map(
      (appUsers ?? []).map((item: any) => [item.profile_id, item]),
    );

    const faculty = await Promise.all(
      (profiles ?? []).map(async (profile: any) => {
        const appUser = appUserByProfileId.get(profile.id);
        const authUserMetadata = appUser?.auth_user_id
          ? ((await supabase.auth.admin.getUserById(appUser.auth_user_id)).data
              .user?.user_metadata ?? {})
          : {};
        const metadata = {
          ...authUserMetadata,
          ...(appUser?.metadata ?? {}),
        };
        const fullNameFromMetadata = buildFacultyFullName({
          firstName:
            typeof metadata.first_name === "string" ? metadata.first_name : "",
          middleName:
            typeof metadata.middle_name === "string"
              ? metadata.middle_name
              : "",
          lastName:
            typeof metadata.last_name === "string" ? metadata.last_name : "",
        });
        const profileImageBucket =
          typeof metadata.profile_image_bucket === "string" &&
          metadata.profile_image_bucket.trim()
            ? metadata.profile_image_bucket.trim()
            : FACULTY_PROFILE_IMAGE_BUCKET;
        const profileImagePath =
          typeof metadata.profile_image_path === "string" &&
          metadata.profile_image_path.trim()
            ? metadata.profile_image_path.trim()
            : null;
        const requirementStatus =
          requirementStatusByProfileId.get(profile.id) ??
          buildInitialRequirementStatus();

        let profileImageUrl: string | null = null;

        if (profileImagePath) {
          const { data: signedImage, error: signedImageError } =
            await supabase.storage
              .from(profileImageBucket)
              .createSignedUrl(profileImagePath, 60 * 60 * 24);

          if (!signedImageError) {
            profileImageUrl = signedImage.signedUrl;
          }
        }

        return {
          id: profile.id,
          user_id: appUser?.auth_user_id ?? profile.user_id ?? null,
          fullName: fullNameFromMetadata || profile.full_name || "Unknown",
          email: profile.email || "Unknown",
          profileImageUrl,
          is_active: appUser?.metadata?.is_active ?? true,
          created_at:
            appUser?.created_at ||
            profile.created_at ||
            new Date().toISOString(),
          requirementStatus,
        };
      }),
    );

    faculty.sort((a: any, b: any) => a.fullName.localeCompare(b.fullName));

    return NextResponse.json({ faculty });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch faculty", details: String(error) },
      { status: 500 },
    );
  }
}
