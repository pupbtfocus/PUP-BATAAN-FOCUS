import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { bootstrapInvitedAdminAccount } from "@/lib/auth/bootstrap-invited-admin";
import { bootstrapInvitedFacultyAccount } from "@/lib/auth/bootstrap-invited-faculty";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { sendTempPasswordEmail } from "@/lib/email/send-invite";
import { ROLE } from "@/config/roles";

function generateTempPassword(len = 12) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export async function POST() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await bootstrapInvitedAdminAccount(user);
    await bootstrapInvitedFacultyAccount(user);

    const metadata = user.user_metadata ?? {};
    const isInvitedAdmin =
      metadata.role === ROLE.ADMIN &&
      metadata.created_via === "super_admin_admin_panel";
    const isInvitedFaculty =
      metadata.role === ROLE.FACULTY &&
      metadata.created_via === "admin_faculty_panel";

    if (!isInvitedAdmin && !isInvitedFaculty) {
      return NextResponse.json({
        success: true,
        bootstrapped: true,
        needsPasswordSetup: false,
      });
    }

    try {
      const service = getServiceRoleClient();
      const tempPassword = generateTempPassword(12);
      const recipientEmail = user.email?.trim().toLowerCase();

      if (!recipientEmail) {
        return NextResponse.json(
          {
            error: "Missing email address for invited account",
            tempPasswordIssued: false,
            tempPasswordEmailSent: false,
            tempPassword,
          },
          { status: 400 },
        );
      }

      const { error: pwError } = await service.auth.admin.updateUserById(
        user.id,
        {
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            ...(user.user_metadata ?? {}),
            force_password_change: true,
          },
        },
      );

      if (pwError) {
        return NextResponse.json(
          {
            success: true,
            tempPasswordIssued: false,
            tempPasswordEmailSent: false,
            tempPasswordError: pwError.message,
            tempPassword,
          },
          { status: 400 },
        );
      }

      const fullName =
        (user.user_metadata && (user.user_metadata as any).full_name) ||
        recipientEmail ||
        "Admin User";

      try {
        await sendTempPasswordEmail({
          to: recipientEmail,
          tempPassword,
          fullName,
        });

        return NextResponse.json({
          success: true,
          tempPasswordIssued: true,
          tempPasswordEmailSent: true,
          tempPassword,
        });
      } catch (emailErr) {
        const emailError =
          emailErr instanceof Error ? emailErr.message : String(emailErr);

        return NextResponse.json(
          {
            success: true,
            tempPasswordIssued: true,
            tempPasswordEmailSent: false,
            tempPasswordError: emailError,
            tempPassword,
          },
          { status: 202 },
        );
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);

      console.error("Failed to prepare invited account temporary password", {
        userId: user.id,
        email: user.email,
        errorMessage,
      });

      return NextResponse.json(
        {
          success: true,
          tempPasswordIssued: false,
          tempPasswordEmailSent: false,
          tempPasswordError: errorMessage,
          tempPassword,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      bootstrapped: true,
      needsPasswordSetup: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to complete invited admin setup",
        details: String(error),
      },
      { status: 400 },
    );
  }
}
