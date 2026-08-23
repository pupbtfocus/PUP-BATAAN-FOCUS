import { NextResponse, type NextRequest } from "next/server";
import { ROLE } from "@/config/roles";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { isValidEmailAddress } from "@/lib/validation/email";

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
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error || !profile) {
      return NextResponse.json(
        { error: "Failed to load account details" },
        { status: 400 },
      );
    }

    let avatarUrl: string | null =
      user.user_metadata?.avatar_url || user.user_metadata?.picture || null;

    if (avatarUrl && !avatarUrl.startsWith("http")) {
      let cleanPath = avatarUrl.replace(/^avatars\//, "");
      if (cleanPath.includes("/avatars/")) {
        cleanPath = cleanPath.split("/avatars/")[1].split("?")[0];
      }
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(cleanPath);
      if (pub?.publicUrl) {
        avatarUrl = pub.publicUrl;
      }
    }

    return NextResponse.json({
      success: true,
      account: {
        fullName:
          profile.full_name ??
          (user.user_metadata?.full_name as string | undefined) ??
          "",
        email: profile.email ?? user.email ?? "",
        avatar_url: avatarUrl,
        profileImageUrl: avatarUrl,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
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
    const payload = (await request.json()) as {
      fullName?: string;
      email?: string;
      oldPassword?: string;
      password?: string;
    };

    const wantsAccountUpdate =
      payload.fullName !== undefined || payload.email !== undefined;
    const wantsPasswordUpdate =
      typeof payload.password === "string" && payload.password.length > 0;

    if (!wantsAccountUpdate && !wantsPasswordUpdate) {
      return NextResponse.json(
        { error: "No update fields provided" },
        { status: 400 },
      );
    }

    if (wantsPasswordUpdate && payload.password!.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 },
      );
    }

    if (wantsPasswordUpdate && !payload.oldPassword?.trim()) {
      return NextResponse.json(
        { error: "Old password is required" },
        { status: 400 },
      );
    }

    if (!wantsAccountUpdate) {
      const supabase = getServiceRoleClient();
      const verifier = await createServerSupabaseClient();

      const { error: oldPasswordError } =
        await verifier.auth.signInWithPassword({
          email: user.email ?? "",
          password: payload.oldPassword!,
        });

      if (oldPasswordError) {
        return NextResponse.json(
          { error: "Old password is incorrect" },
          { status: 400 },
        );
      }

      const { error: passwordUpdateError } =
        await supabase.auth.admin.updateUserById(user.id, {
          password: payload.password,
        });

      if (passwordUpdateError) {
        return NextResponse.json(
          { error: passwordUpdateError.message },
          { status: 400 },
        );
      }

      return NextResponse.json({ success: true, passwordUpdated: true });
    }

    const fullName = payload.fullName?.trim() ?? "";
    const email = payload.email?.trim().toLowerCase() ?? "";

    if (!fullName || !email) {
      return NextResponse.json(
        { error: "Full name and email are required" },
        { status: 400 },
      );
    }

    if (!isValidEmailAddress(email)) {
      return NextResponse.json(
        { error: "Please provide a real email address" },
        { status: 400 },
      );
    }

    const supabase = getServiceRoleClient();

    const { data: profile, error: profileFetchError } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileFetchError || !profile?.id) {
      return NextResponse.json(
        { error: "Unable to resolve account profile" },
        { status: 400 },
      );
    }

    const profileId = profile.id;
    const previousEmail = profile.email ?? user.email ?? "";
    const previousFullName =
      profile.full_name ??
      (user.user_metadata?.full_name as string | undefined) ??
      "";

    if (wantsPasswordUpdate) {
      const verifier = await createServerSupabaseClient();
      const { error: oldPasswordError } =
        await verifier.auth.signInWithPassword({
          email: previousEmail,
          password: payload.oldPassword!,
        });

      if (oldPasswordError) {
        return NextResponse.json(
          { error: "Old password is incorrect" },
          { status: 400 },
        );
      }
    }

    const { data: duplicateProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .neq("id", profileId)
      .maybeSingle();

    if (duplicateProfile) {
      return NextResponse.json(
        { error: `Another account already uses ${email}` },
        { status: 400 },
      );
    }

    const { error: authUpdateError } = await supabase.auth.admin.updateUserById(
      user.id,
      {
        email,
        password: wantsPasswordUpdate ? payload.password : undefined,
        email_confirm: true,
        user_metadata: {
          ...(user.user_metadata ?? {}),
          full_name: fullName,
          role: requesterRole,
        },
      },
    );

    if (authUpdateError) {
      return NextResponse.json(
        { error: authUpdateError.message },
        { status: 400 },
      );
    }

    const { error: profileUpdateError } = await supabase
      .from("profiles")
      .update({ full_name: fullName, email })
      .eq("id", profileId);

    if (profileUpdateError) {
      await supabase.auth.admin.updateUserById(user.id, {
        email: previousEmail,
        email_confirm: true,
        user_metadata: {
          ...(user.user_metadata ?? {}),
          full_name: previousFullName,
          role: requesterRole,
        },
      });

      return NextResponse.json(
        { error: profileUpdateError.message },
        { status: 400 },
      );
    }

    await supabase
      .from("admins")
      .update({ full_name: fullName, email })
      .eq("profile_id", profileId);

    return NextResponse.json({
      success: true,
      account: {
        fullName,
        email,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 },
    );
  }
}
