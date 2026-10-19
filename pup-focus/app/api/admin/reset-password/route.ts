import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { ROLE } from "@/config/roles";
import { isValidEmailAddress } from "@/lib/validation/email";
import { sendAdminPasswordResetEmail, getAppBaseUrl } from "@/lib/email/send-invite";
import { logAuditEvent } from "@/features/audit-logs/services/audit-log.service";

export async function POST(request: NextRequest) {
  try {
    const sessionClient = await createServerSupabaseClient();
    const {
      data: { user: currentUser },
    } = await sessionClient.auth.getUser();

    const requesterRole =
      (currentUser?.user_metadata?.role as string | undefined) ??
      (currentUser?.app_metadata?.role as string | undefined);

    if (
      !currentUser ||
      (requesterRole !== ROLE.STAFF &&
        requesterRole !== ROLE.ADMIN &&
        requesterRole !== ROLE.SUPER_ADMIN &&
        requesterRole !== "staff")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const profileId = (body.profileId || body.facultyProfileId || "").trim();
    const rawEmail = (body.email || "").trim().toLowerCase();
    const rawAccountType = (body.accountType || "Faculty").trim();

    const supabase = getServiceRoleClient();

    let profile: any = null;
    if (profileId) {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("id, user_id, full_name, email")
          .or(`id.eq.${profileId},user_id.eq.${profileId}`)
          .maybeSingle();
        profile = data;
      } catch {}
    }

    if (!profile && rawEmail) {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("id, user_id, full_name, email")
          .ilike("email", rawEmail)
          .maybeSingle();
        profile = data;
      } catch {}
    }

    const authUserId = profile?.user_id || profileId;
    let authUser: any = null;

    if (authUserId) {
      try {
        const { data } = await supabase.auth.admin.getUserById(authUserId);
        authUser = data?.user ?? null;
      } catch {}
    }

    const targetEmail = (
      rawEmail ||
      authUser?.email ||
      profile?.email ||
      ""
    ).trim().toLowerCase();

    if (!targetEmail || !isValidEmailAddress(targetEmail)) {
      return NextResponse.json(
        { error: "A valid account email address is required." },
        { status: 400 },
      );
    }

    if (!authUser) {
      try {
        const { data: listData } = await supabase.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        });
        authUser = listData?.users?.find(
          (u) => u.email?.trim().toLowerCase() === targetEmail,
        );
      } catch {}
    }

    if (!authUser) {
      return NextResponse.json(
        { error: `Account with email ${targetEmail} was not found.` },
        { status: 404 },
      );
    }

    // Ensure email is marked confirmed so recovery link generation succeeds even for unconfirmed accounts
    if (!authUser.email_confirmed_at && !authUser.confirmed_at) {
      try {
        await supabase.auth.admin.updateUserById(authUser.id, {
          email_confirm: true,
        });
      } catch {}
    }

    const originHeader =
      request.headers.get("origin") || request.nextUrl.origin;
    const isLocal =
      originHeader &&
      (originHeader.includes("localhost") || originHeader.includes("127.0.0.1"));
    const appBase = isLocal ? originHeader.replace(/\/$/, "") : getAppBaseUrl();
    const redirectTo = `${appBase}/auth/change-password`;

    const { data: linkData, error: linkError } =
      await supabase.auth.admin.generateLink({
        type: "recovery",
        email: targetEmail,
        options: {
          redirectTo,
        },
      });

    if (linkError || !linkData?.properties?.action_link) {
      return NextResponse.json(
        {
          error:
            linkError?.message || "Failed to generate password reset link.",
        },
        { status: 400 },
      );
    }

    const actionLink = linkData.properties.action_link;
    const fullName =
      (body.fullName as string | undefined)?.trim() ||
      profile?.full_name ||
      authUser.user_metadata?.full_name ||
      targetEmail.split("@")[0];
    const firstName = fullName ? fullName.split(/\s+/)[0] : undefined;
    const accountRoleLabel =
      rawAccountType.toLowerCase() === "staff" ||
      rawAccountType.toLowerCase() === "admin"
        ? "Staff"
        : "Faculty";

    await sendAdminPasswordResetEmail({
      to: targetEmail,
      resetLink: actionLink,
      fullName,
      firstName,
      accountRoleLabel,
    });

    try {
      await logAuditEvent({
        actorId: currentUser.id,
        action: "user.password_reset",
        entityType: accountRoleLabel.toLowerCase(),
        entityId: authUser.id,
        metadata: {
          target_email: targetEmail,
          target_full_name: fullName,
          account_type: accountRoleLabel,
        },
      });
    } catch {}

    return NextResponse.json({
      success: true,
      email: targetEmail,
      message: `Password reset email sent to ${targetEmail} successfully.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error:
          error?.message || "Failed to send password reset email.",
      },
      { status: 500 },
    );
  }
}

