import { NextResponse } from "next/server";
import { APP_CONFIG } from "@/config/app";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { ROLE } from "@/config/roles";
import { isValidEmailAddress } from "@/lib/validation/email";

const SUPER_ADMIN_EMAIL = APP_CONFIG.superAdminEmail;
const SUPER_ADMIN_PASSWORD =
  process.env.SUPER_ADMIN_PASSWORD?.trim() || "SuperAdmin123!";
const SUPER_ADMIN_FULL_NAME = "PUP FOCUS Super Admin";

export async function POST() {
  try {
    if (!isValidEmailAddress(SUPER_ADMIN_EMAIL)) {
      return NextResponse.json(
        {
          error:
            "Set SUPER_ADMIN_EMAIL to a real email address before bootstrapping.",
        },
        { status: 400 },
      );
    }

    const supabase = getServiceRoleClient();

    const { data: rolesData, error: roleError } = await supabase
      .from("roles")
      .select("id, code")
      .in("code", [ROLE.SUPER_ADMIN, ROLE.ADMIN]);

    if (roleError) {
      return NextResponse.json({ error: roleError.message }, { status: 400 });
    }

    const superAdminRole = rolesData?.find(
      (role) => role.code === ROLE.SUPER_ADMIN,
    );
    const adminRole = rolesData?.find((role) => role.code === ROLE.ADMIN);

    if (!superAdminRole || !adminRole) {
      return NextResponse.json(
        { error: "Roles are not seeded. Run the database migration first." },
        { status: 400 },
      );
    }

    const { data: usersData, error: listError } =
      await supabase.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });

    if (listError) {
      return NextResponse.json({ error: listError.message }, { status: 400 });
    }

    const existingUser =
      usersData.users.find((item) => item.email === SUPER_ADMIN_EMAIL) ??
      usersData.users.find((item) => {
        const userRole =
          (item.user_metadata?.role as string | undefined) ??
          (item.app_metadata?.role as string | undefined);

        return (
          userRole === ROLE.SUPER_ADMIN ||
          item.user_metadata?.full_name === SUPER_ADMIN_FULL_NAME
        );
      });

    let authUserId = existingUser?.id;

    if (existingUser) {
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        existingUser.id,
        {
          email: SUPER_ADMIN_EMAIL,
          password: SUPER_ADMIN_PASSWORD,
          email_confirm: true,
          user_metadata: {
            full_name: SUPER_ADMIN_FULL_NAME,
            role: ROLE.SUPER_ADMIN,
          },
        },
      );

      if (updateError) {
        return NextResponse.json(
          { error: updateError.message },
          { status: 400 },
        );
      }
    } else {
      const { data: createdUser, error: createError } =
        await supabase.auth.admin.createUser({
          email: SUPER_ADMIN_EMAIL,
          password: SUPER_ADMIN_PASSWORD,
          email_confirm: true,
          user_metadata: {
            full_name: SUPER_ADMIN_FULL_NAME,
            role: ROLE.SUPER_ADMIN,
          },
        });

      if (createError || !createdUser.user) {
        return NextResponse.json(
          {
            error: createError?.message ?? "Failed to create super admin user",
          },
          { status: 400 },
        );
      }

      authUserId = createdUser.user.id;
    }

    if (!authUserId) {
      return NextResponse.json(
        { error: "Unable to resolve super admin user id" },
        { status: 400 },
      );
    }

    const { data: existingProfile, error: profileLookupError } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", authUserId)
      .maybeSingle();

    if (profileLookupError) {
      return NextResponse.json(
        { error: profileLookupError.message },
        { status: 400 },
      );
    }

    let profileId = existingProfile?.id;

    if (profileId) {
      const { error: profileUpdateError } = await supabase
        .from("profiles")
        .update({
          user_id: authUserId,
          full_name: SUPER_ADMIN_FULL_NAME,
          email: SUPER_ADMIN_EMAIL,
        })
        .eq("id", profileId);

      if (profileUpdateError) {
        return NextResponse.json(
          { error: profileUpdateError.message },
          { status: 400 },
        );
      }
    } else {
      const { data: createdProfile, error: profileCreateError } = await supabase
        .from("profiles")
        .insert({
          user_id: authUserId,
          full_name: SUPER_ADMIN_FULL_NAME,
          email: SUPER_ADMIN_EMAIL,
        })
        .select("id")
        .single();

      if (profileCreateError || !createdProfile) {
        return NextResponse.json(
          { error: profileCreateError?.message ?? "Failed to create profile" },
          { status: 400 },
        );
      }

      profileId = createdProfile.id;
    }

    if (!profileId) {
      return NextResponse.json(
        { error: "Unable to resolve profile id" },
        { status: 400 },
      );
    }

    const { error: deleteExistingAdminRoleError } = await supabase
      .from("user_roles")
      .delete()
      .eq("profile_id", profileId);

    if (deleteExistingAdminRoleError) {
      return NextResponse.json(
        { error: deleteExistingAdminRoleError.message },
        { status: 400 },
      );
    }

    const { error: userRoleError } = await supabase.from("user_roles").insert({
      profile_id: profileId,
      role_id: superAdminRole.id,
    });

    if (userRoleError) {
      return NextResponse.json(
        { error: userRoleError.message },
        { status: 400 },
      );
    }

    const { data: existingAppUser } = await supabase
      .from("app_users")
      .select("id")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    const appUsersPayload = {
      auth_user_id: authUserId,
      profile_id: profileId,
      email: SUPER_ADMIN_EMAIL,
      full_name: SUPER_ADMIN_FULL_NAME,
      role: ROLE.SUPER_ADMIN,
    };

    const { error: appUsersError } = existingAppUser
      ? await supabase
          .from("app_users")
          .update(appUsersPayload)
          .eq("id", existingAppUser.id)
      : await supabase.from("app_users").insert(appUsersPayload);

    if (appUsersError) {
      return NextResponse.json(
        { error: appUsersError.message },
        { status: 400 },
      );
    }

    const { data: existingAdmin } = await supabase
      .from("admins")
      .select("id")
      .eq("profile_id", profileId)
      .maybeSingle();

    const adminPayload = {
      profile_id: profileId,
      full_name: SUPER_ADMIN_FULL_NAME,
      email: SUPER_ADMIN_EMAIL,
      is_active: true,
    };

    const { error: adminTableError } = existingAdmin
      ? await supabase
          .from("admins")
          .update(adminPayload)
          .eq("id", existingAdmin.id)
      : await supabase.from("admins").insert(adminPayload);

    if (adminTableError) {
      return NextResponse.json(
        { error: adminTableError.message },
        { status: 400 },
      );
    }

    await supabase.auth.admin.updateUserById(authUserId, {
      email_confirm: true,
      user_metadata: {
        full_name: SUPER_ADMIN_FULL_NAME,
        role: ROLE.SUPER_ADMIN,
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: authUserId,
        email: SUPER_ADMIN_EMAIL,
        fullName: SUPER_ADMIN_FULL_NAME,
      },
      password: SUPER_ADMIN_PASSWORD,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 },
    );
  }
}
