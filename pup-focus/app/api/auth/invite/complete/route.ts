import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { bootstrapInvitedAdminAccount } from "@/lib/auth/bootstrap-invited-admin";
import { bootstrapInvitedFacultyAccount } from "@/lib/auth/bootstrap-invited-faculty";
import {
  sendTempPasswordEmail,
  sendEmailChangeTempPasswordEmail,
} from "@/lib/email/send-invite";
import { ROLE } from "@/config/roles";
import { generateTempPassword } from "@/lib/auth/temp-password";

export async function POST(req: Request) {
  try {
    // 1. Properly parse incoming request body (e.g., userId, password, full_name, email, token)
    let body: Record<string, any> = {};
    try {
      body = await req.json();
    } catch {
      // Body may be empty if request sent without payload
      body = {};
    }

    const {
      userId: bodyUserId,
      user_id: bodyUserIdSnake,
      id: bodyId,
      password: bodyPassword,
      full_name: bodyFullNameSnake,
      fullName: bodyFullNameCamel,
      name: bodyName,
      email: bodyEmail,
      mode: bodyMode,
      token,
      recoverIfPending: bodyRecoverIfPending,
      recover: bodyRecover,
    } = body;

    const requestedUserId = bodyUserId || bodyUserIdSnake || bodyId;
    const requestedFullName = bodyFullNameSnake || bodyFullNameCamel || bodyName;
    const requestedPassword = bodyPassword;
    const requestedEmail = (bodyEmail as string | undefined)?.trim().toLowerCase();
    const isRecoveryRequest = Boolean(bodyRecoverIfPending || bodyRecover);

    // 2. Use @supabase/supabase-js initialized with process.env.SUPABASE_SERVICE_ROLE_KEY to grant admin privileges
    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl) {
      return NextResponse.json(
        { error: "Missing environment variable: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL" },
        { status: 400 }
      );
    }

    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "Missing environment variable: SUPABASE_SERVICE_ROLE_KEY is required to grant admin privileges." },
        { status: 400 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Identify target user:
    // When an email is supplied (via link query param, cached session, or recovery input),
    // prioritize looking up that specific invited user instead of using an ambient active session.
    let targetUserId: string | null = requestedUserId || null;
    let authUser: any = null;

    if (requestedEmail) {
      try {
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
        const match = listData?.users?.find(
          (u) => u.email?.trim().toLowerCase() === requestedEmail
        );
        if (match) {
          authUser = match;
          targetUserId = match.id;
        }
      } catch {
        // Ignored
      }
    }

    if (!authUser && targetUserId) {
      const { data: userData, error: getUserError } =
        await supabaseAdmin.auth.admin.getUserById(targetUserId);

      if (getUserError || !userData?.user) {
        return NextResponse.json(
          {
            error: `Failed to fetch user by ID (${targetUserId}): ${getUserError?.message || "User does not exist"}`,
          },
          { status: 400 }
        );
      }
      authUser = userData.user;
    } else if (!authUser) {
      // Fallback to active session user if userId/email is not in request body
      try {
        const serverSupabase = await createServerSupabaseClient();
        const {
          data: { user: sessionUser },
        } = await serverSupabase.auth.getUser();

        if (sessionUser) {
          authUser = sessionUser;
          targetUserId = sessionUser.id;
        }
      } catch {
        // Session lookup fallback ignored if unauthenticated
      }
    }

    if (!targetUserId || !authUser) {
      return NextResponse.json(
        {
          error:
            "Missing target user identification. Please supply your institutional email or click the link in your email.",
        },
        { status: 400 }
      );
    }

    const hasCompletedSetup =
      authUser.user_metadata?.must_change_password === false &&
      authUser.user_metadata?.force_password_change !== true;

    if (isRecoveryRequest && hasCompletedSetup) {
      return NextResponse.json(
        {
          alreadySetup: true,
          error:
            "This invitation link has expired because your account is already set up. Please sign in with your password.",
        },
        { status: 400 },
      );
    }

    const isEmailChange = Boolean(
      bodyMode === "email_change" ||
        authUser.user_metadata?.pending_email_change_verification,
    );

    // 3. Call supabase.auth.admin.updateUserById to update the password and set email_confirm: true
    const isTempPasswordGenerated = !requestedPassword;
    const passwordToSet = requestedPassword || generateTempPassword(16);
    const fullNameToSet =
      requestedFullName ||
      authUser.user_metadata?.full_name ||
      authUser.email ||
      "Admin User";

    const updatePayload: {
      password: string;
      email_confirm: boolean;
      user_metadata: Record<string, any>;
    } = {
      password: passwordToSet,
      email_confirm: true,
      user_metadata: {
        ...(authUser.user_metadata ?? {}),
        full_name: fullNameToSet,
        must_change_password: true,
        force_password_change: true,
        pending_email_change_verification: false,
      },
    };

    const { data: updateData, error: updateError } =
      await supabaseAdmin.auth.admin.updateUserById(targetUserId, updatePayload);

    if (updateError) {
      return NextResponse.json(
        { error: `Failed to update auth user: ${updateError.message}` },
        { status: 400 }
      );
    }

    const updatedUser = updateData.user;
    const email =
      updatedUser.email?.trim().toLowerCase() ||
      authUser.email?.trim().toLowerCase() ||
      body.email?.trim().toLowerCase();

    if (!email) {
      return NextResponse.json(
        { error: "User email address is missing and required for profile setup." },
        { status: 400 }
      );
    }

    // 4. Ensure profiles table is updated/upserted with user's id, email, and full_name
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          user_id: targetUserId,
          email: email,
          full_name: fullNameToSet,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )
      .select("id")
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        {
          error: `Failed to upsert profiles table: ${profileError?.message || "Unknown error"}`,
        },
        { status: 400 }
      );
    }

    // Sync roles / admin tables via bootstrap helpers if required
    try {
      await bootstrapInvitedAdminAccount(updatedUser);
      await bootstrapInvitedFacultyAccount(updatedUser);
    } catch (bootstrapErr) {
      console.warn("Bootstrap sync note:", bootstrapErr);
    }

    // Send temp password email if generated automatically
    let tempPasswordEmailSent = false;
    let tempPasswordError: string | undefined = undefined;

    if (isTempPasswordGenerated) {
      try {
        if (isEmailChange) {
          await sendEmailChangeTempPasswordEmail({
            to: email,
            tempPassword: passwordToSet,
            fullName: fullNameToSet,
          });
        } else {
          await sendTempPasswordEmail({
            to: email,
            tempPassword: passwordToSet,
            fullName: fullNameToSet,
          });
        }
        tempPasswordEmailSent = true;
      } catch (emailErr) {
        tempPasswordError =
          emailErr instanceof Error ? emailErr.message : String(emailErr);
      }
    }

    const userRole =
      (updatedUser.user_metadata?.role as string | undefined) ??
      ROLE.FACULTY;

    return NextResponse.json({
      success: true,
      bootstrapped: true,
      isEmailChange,
      email: email,
      fullName: fullNameToSet,
      role: userRole,
      needsPasswordSetup: isTempPasswordGenerated,
      tempPasswordIssued: isTempPasswordGenerated,
      tempPasswordEmailSent,
      ...(tempPasswordError ? { tempPasswordError } : {}),
      ...(isTempPasswordGenerated ? { tempPassword: passwordToSet } : {}),
    });
  } catch (error) {
    // 5. Return exact error messages in JSON response payload if validation or Supabase calls fail
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Failed to complete invited admin setup: ${errorMessage}` },
      { status: 400 }
    );
  }
}
