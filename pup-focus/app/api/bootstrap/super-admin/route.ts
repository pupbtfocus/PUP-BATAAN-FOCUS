import { NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { ROLE } from "@/config/roles";

const SUPER_ADMIN_EMAIL = "superadmin@pup-focus.local";
const SUPER_ADMIN_PASSWORD = "SuperAdmin123!";
const SUPER_ADMIN_FULL_NAME = "PUP FOCUS Super Admin";

export async function POST() {
  try {
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

    const existingUser = usersData.users.find(
      (item) => item.email === SUPER_ADMIN_EMAIL,
    );

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
      .eq("email", SUPER_ADMIN_EMAIL)
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
