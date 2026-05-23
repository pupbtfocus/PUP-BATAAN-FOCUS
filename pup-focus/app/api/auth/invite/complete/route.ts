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
  for (let i = 0; i < len; i++)
    out += chars[Math.floor(Math.random() * chars.length)];
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
      return NextResponse.json({ success: true });
    }

    // Set a temporary password so invited users can sign in with email/password
    // after accepting the invite.
    try {
      const service = getServiceRoleClient();
      const tempPassword = generateTempPassword(12);
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

      // If setting the password succeeds, attempt to email the temp password
      if (!pwError) {
        try {
          const fullName =
            (user.user_metadata && (user.user_metadata as any).full_name) ||
            user.email ||
            "Admin User";
          await sendTempPasswordEmail({
            to: user.email ?? "",
            tempPassword,
            fullName,
          });
        } catch (emailErr) {
          // If emailing fails, still return success so the account can be
          // recovered through support or a resend.
        }
      }

      return NextResponse.json({ success: true, tempPasswordIssued: true });
    } catch (e) {
      return NextResponse.json({ success: true, tempPasswordIssued: false });
    }
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
