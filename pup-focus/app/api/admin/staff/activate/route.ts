import { NextResponse, type NextRequest } from "next/server";
import {
  ROLE,
  canManageAdminAccount,
  isAdminRoleToken,
  isOriginalAdmin,
  resolveTrustedUserRole,
} from "@/config/roles";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { verifyMfaAal2IfEnrolled } from "@/lib/auth/admin-security";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { filterCondition, orFilter } from "@/lib/supabase/filters";

export async function POST(request: NextRequest) {
  const sessionClient = await createServerSupabaseClient();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();

  const requesterRole = resolveTrustedUserRole(user);

  if (
    !user ||
    (!isOriginalAdmin(user.email) && !isAdminRoleToken(requesterRole))
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const mfaCheck = await verifyMfaAal2IfEnrolled(sessionClient);
  if (!mfaCheck.ok) {
    return NextResponse.json(
      { error: "Two-factor authentication verification required." },
      { status: 403 },
    );
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
    const targetRole = resolveTrustedUserRole(targetUser) ?? ROLE.STAFF;

    const allowed = canManageAdminAccount({
      targetEmail,
      targetRole,
      actorEmail: user.email,
      action: "deactivate",
    });

    if (!allowed) {
      return NextResponse.json(
        { error: "You do not have permission to activate this admin account" },
        { status: 403 },
      );
    }

    try {
      await supabase
        .from("profiles")
        .update({ status: "active", updated_at: new Date().toISOString() })
        .or(
          orFilter([
            filterCondition("id", "eq", profileId),
            filterCondition("user_id", "eq", profileId),
          ])
        );
    } catch {}

    if (targetEmail) {
      try {
        await supabase
          .from("staff")
          .update({ is_active: true, updated_at: new Date().toISOString() })
          .ilike("email", targetEmail);
      } catch {}
      try {
        await supabase
          .from("admins")
          .update({ is_active: true, updated_at: new Date().toISOString() })
          .ilike("email", targetEmail);
      } catch {}
    }

    try {
      await supabase.auth.admin.updateUserById(profileId, {
        user_metadata: { ...targetUser.user_metadata, is_active: true },
      });
    } catch {}

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to activate admin", details: String(error) },
      { status: 500 },
    );
  }
}
