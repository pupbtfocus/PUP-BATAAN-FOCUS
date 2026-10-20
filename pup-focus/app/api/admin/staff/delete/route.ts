import { NextResponse, type NextRequest } from "next/server";
import { ROLE, canManageAdminAccount } from "@/config/roles";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

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
    const { profileId } = await request.json();

    if (!profileId) {
      return NextResponse.json(
        { error: "profileId is required" },
        { status: 400 },
      );
    }

    const supabase = getServiceRoleClient();

    const { data: targetAuthData, error: targetError } =
      await supabase.auth.admin.getUserById(profileId);

    if (targetError || !targetAuthData?.user) {
      return NextResponse.json(
        { error: "Target admin account not found" },
        { status: 404 },
      );
    }

    const targetUser = targetAuthData.user;
    const targetEmail = targetUser.email ?? "";
    const targetRole =
      (targetUser.user_metadata?.role as string | undefined) ??
      (targetUser.app_metadata?.role as string | undefined) ??
      ROLE.STAFF;

    const allowed = canManageAdminAccount({
      targetEmail,
      targetRole,
      actorEmail: user.email,
      action: "delete",
    });

    if (!allowed) {
      return NextResponse.json(
        { error: "You do not have permission to delete this admin account" },
        { status: 403 },
      );
    }

    // 1. Clean up dependent references in public tables
    try {
      await supabase.from("transaction_logs").update({ actor_id: null }).eq("actor_id", profileId);
    } catch {}
    try {
      await supabase.from("audit_logs").update({ actor_id: null }).eq("actor_id", profileId);
    } catch {}

    try {
      await supabase.from("submission_window_logs").update({ extended_by: null }).eq("extended_by", profileId);
    } catch {}

    try {
      await supabase.from("submission_windows").update({ updated_by: null }).eq("updated_by", profileId);
    } catch {}

    try {
      await supabase.from("submission_window_used_terms").update({ created_by: null }).eq("created_by", profileId);
    } catch {}

    try {
      await supabase.from("academic_terms").update({ created_by: null }).eq("created_by", profileId);
    } catch {}

    try {
      await supabase.from("extension_requests").update({ reviewed_by: null }).eq("reviewed_by", profileId);
    } catch {}

    try {
      await supabase.from("notifications").delete().eq("user_id", profileId);
    } catch {}

    let resolvedProfileId = profileId;
    try {
      const { data: profRow } = await supabase
        .from("profiles")
        .select("id")
        .or(`id.eq.${profileId},user_id.eq.${profileId}`)
        .maybeSingle();
      if (profRow?.id) {
        resolvedProfileId = profRow.id;
      }
    } catch {}

    try {
      await supabase.from("user_roles").delete().in("profile_id", [profileId, resolvedProfileId]);
    } catch {}

    try {
      await supabase.from("staff").delete().in("profile_id", [profileId, resolvedProfileId]);
      if (targetEmail) {
        await supabase.from("staff").delete().ilike("email", targetEmail);
      }
    } catch {}

    try {
      await supabase.from("admins").delete().in("profile_id", [profileId, resolvedProfileId]);
      if (targetEmail) {
        await supabase.from("admins").delete().ilike("email", targetEmail);
      }
    } catch {}

    try {
      await supabase.from("faculty").delete().in("profile_id", [profileId, resolvedProfileId]);
    } catch {}

    try {
      await supabase.from("app_users").delete().or(`profile_id.eq.${profileId},profile_id.eq.${resolvedProfileId},auth_user_id.eq.${profileId}`);
    } catch {}

    try {
      await supabase.from("profiles").delete().or(`id.eq.${profileId},id.eq.${resolvedProfileId},user_id.eq.${profileId}`);
    } catch {}

    // Clean up avatar storage files
    if (targetEmail) {
      try {
        const folderPath = `admin/${targetEmail}`;
        const { data: files } = await supabase.storage.from("avatars").list(folderPath);
        if (files && files.length > 0) {
          await supabase.storage.from("avatars").remove(files.map((f) => `${folderPath}/${f.name}`));
        }
      } catch {}
    }

    // 2. Delete the user from auth.users
    const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(profileId);

    if (deleteAuthError) {
      return NextResponse.json(
        { error: deleteAuthError.message || "Failed to delete user from authentication provider" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete admin account", details: String(error) },
      { status: 500 },
    );
  }
}
