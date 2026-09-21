import { NextResponse, type NextRequest } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { sendForgotPasswordEmail } from "@/lib/email/send-invite";
import { isValidEmailAddress } from "@/lib/validation/email";
import { getAppBaseUrl } from "@/lib/email/email-templates";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = body?.email?.trim().toLowerCase();

    if (!email || !isValidEmailAddress(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 },
      );
    }

    const supabase = getServiceRoleClient();

    // 1. Look up profile to extract recipient name if available
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("email", email)
      .maybeSingle();

    const fullName = profile?.full_name || undefined;
    const firstName = fullName ? fullName.split(/\s+/)[0] : undefined;

    // 2. Generate recovery link via Supabase Admin API (bypasses client-side email rate limits)
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
        email,
        options: {
          redirectTo,
        },
      });

    if (linkError) {
      console.error("Failed to generate recovery link:", linkError);
      const msg = linkError.message || "";
      if (
        msg.toLowerCase().includes("rate limit") ||
        msg.toLowerCase().includes("over_email_send_rate_limit")
      ) {
        return NextResponse.json(
          {
            error:
              "Too many password reset requests. Please wait a few minutes before trying again.",
          },
          { status: 429 },
        );
      }
      return NextResponse.json(
        { error: msg || "Failed to generate password reset link." },
        { status: 400 },
      );
    }

    const actionLink = linkData?.properties?.action_link;
    if (!actionLink) {
      return NextResponse.json(
        { error: "Failed to generate password recovery link." },
        { status: 500 },
      );
    }

    // 3. Send email using custom SMTP and PUP FOCUS branded template
    try {
      await sendForgotPasswordEmail({
        to: email,
        resetLink: actionLink,
        fullName,
        firstName,
      });
    } catch (emailError: any) {
      console.error("Failed to send reset email via SMTP:", emailError);
      return NextResponse.json(
        {
          error:
            "Unable to send reset email at this time. Please check your SMTP configuration or contact your campus administrator.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: error?.message || "An unexpected error occurred." },
      { status: 500 },
    );
  }
}
