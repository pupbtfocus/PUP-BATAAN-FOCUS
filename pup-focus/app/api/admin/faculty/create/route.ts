import { NextResponse, type NextRequest } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ROLE } from "@/config/roles";
import { isValidEmailAddress } from "@/lib/validation/email";
import { sendInviteEmail } from "@/lib/email/send-invite";

export async function POST(request: NextRequest) {
  try {
    const sessionClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();

    const requesterRole =
      (user?.user_metadata?.role as string | undefined) ??
      (user?.app_metadata?.role as string | undefined);

    if (
      !user ||
      (requesterRole !== ROLE.ADMIN && requesterRole !== ROLE.SUPER_ADMIN)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

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
        {
          error: `Faculty account with email ${normalizedEmail} already exists`,
        },
        { status: 400 },
      );
    }

    const { data: existingAppUser } = await supabase
      .from("app_users")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (existingAppUser) {
      return NextResponse.json(
        {
          error: `Faculty account with email ${normalizedEmail} already exists`,
        },
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
        {
          error: `Faculty account with email ${normalizedEmail} already exists`,
        },
        { status: 400 },
      );
    }

    const publicAppOrigin =
      process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
    const callbackUrl = new URL("/auth/confirm", publicAppOrigin);
    callbackUrl.searchParams.set("next", "/faculty/dashboard");

    const { data: genData, error: genError } =
      await supabase.auth.admin.generateLink({
        type: "invite",
        email: normalizedEmail,
        options: {
          data: {
            full_name: fullName,
            role: ROLE.FACULTY,
            created_via: "admin_faculty_panel",
            created_by_admin_id: user.id,
          },
          redirectTo: callbackUrl.toString(),
        },
      });

    if (genError) {
      return NextResponse.json(
        {
          error: genError?.message ?? "Failed to generate faculty invite link",
        },
        { status: 400 },
      );
    }

    const actionLink = genData?.properties?.action_link ?? null;

    let sent = false;
    let sendError: string | null = null;

    if (actionLink) {
      try {
        await sendInviteEmail({
          to: normalizedEmail,
          link: actionLink,
          fullName,
          invitedRole: ROLE.FACULTY,
        });
        sent = true;
      } catch (e) {
        sendError =
          e instanceof Error ? e.message : String(e ?? "unknown error");
        console.error("Failed to send faculty invite email", {
          email: normalizedEmail,
          fullName,
          sendError,
        });
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
