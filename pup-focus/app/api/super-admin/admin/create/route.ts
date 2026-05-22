import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ROLE } from "@/config/roles";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { sendInviteEmail } from "@/lib/email/send-invite";
import { isValidEmailAddress } from "@/lib/validation/email";

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
    const { fullName, email, password: _password } = await request.json();

    if (!fullName || !email) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!isValidEmailAddress(normalizedEmail)) {
      return NextResponse.json(
        { error: "Please provide a real email address" },
        { status: 400 },
      );
    }

    const supabase = getServiceRoleClient();

    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (existingProfile) {
      return NextResponse.json(
        { error: `Account with email ${normalizedEmail} already exists` },
        { status: 400 },
      );
    }

    const { data: existingAdmin } = await supabase
      .from("admins")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (existingAdmin) {
      return NextResponse.json(
        { error: `Account with email ${normalizedEmail} already exists` },
        { status: 400 },
      );
    }

    const { data: authUsers, error: authUsersError } =
      await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });

    if (authUsersError) {
      return NextResponse.json(
        { error: authUsersError.message },
        { status: 400 },
      );
    }

    const existingAuthUser = authUsers.users.find(
      (item) => item.email?.trim().toLowerCase() === normalizedEmail,
    );

    if (existingAuthUser) {
      return NextResponse.json(
        { error: `Account with email ${normalizedEmail} already exists` },
        { status: 400 },
      );
    }

    const callbackUrl = new URL("/auth/confirm", request.url);
    callbackUrl.searchParams.set("next", "/super-admin/admin");

    // Use generateLink to get an invite URL that can be sent via a custom
    // email provider or returned to the caller as a fallback when provider
    // email sending is rate-limited.
    const { data: genData, error: genError } =
      await supabase.auth.admin.generateLink({
        type: "invite",
        email: normalizedEmail,
        data: {
          full_name: fullName,
          role: ROLE.ADMIN,
          created_via: "super_admin_admin_panel",
          created_by_super_admin_id: user.id,
        },
        options: {
          redirectTo: callbackUrl.toString(),
        },
      });

    if (genError) {
      return NextResponse.json(
        { error: genError?.message ?? "Failed to generate admin invite link" },
        { status: 400 },
      );
    }

    // `generateLink` returns properties including `action_link` (the URL)
    const actionLink = genData?.properties?.action_link ?? null;

    let sent = false;
    let sendError: string | null = null;

    if (actionLink) {
      try {
        // Attempt to send via configured SMTP. If SMTP env vars are missing
        // or the send fails, we return the link so the caller can copy it.
        await sendInviteEmail({
          to: normalizedEmail,
          link: actionLink,
          fullName,
        });
        sent = true;
      } catch (e) {
        sendError = String(e ?? "unknown error");
      }
    }

    return NextResponse.json({
      success: true,
      invited: true,
      sent,
      sendError,
      link: actionLink,
      user: {
        email: normalizedEmail,
        fullName,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 },
    );
  }
}
