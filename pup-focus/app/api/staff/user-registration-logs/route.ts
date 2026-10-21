export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { ROLE } from "@/config/roles";
import { sendInviteEmail, sendTempPasswordEmail } from "@/lib/email/send-invite";
import { generateTempPassword } from "@/lib/auth/temp-password";
import { logAuditEvent } from "@/features/audit-logs/services/audit-log.service";
import { isValidEmailAddress } from "@/lib/validation/email";

export interface RegistrationLogItem {
  id: string;
  fullName: string;
  email: string;
  role: "Faculty" | "Staff" | "Admin" | "Super Admin";
  status: "Accepted" | "Pending";
  invitedAt: string;
  confirmedAt: string | null;
  lastLoginAt: string | null;
  inviteSent: boolean;
  sendError: string | null;
  program: string | null;
  avatarUrl: string | null;
  invitedBy: string | null;
}

export async function GET(request: NextRequest) {
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
      (requesterRole !== ROLE.STAFF && requesterRole !== ROLE.ADMIN && requesterRole !== ROLE.SUPER_ADMIN && requesterRole !== "staff")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const roleFilter = (searchParams.get("role") || "all").toLowerCase();
    const statusFilter = (searchParams.get("status") || "all").toLowerCase();
    const searchQuery = (searchParams.get("search") || "").trim().toLowerCase();

    const supabase = getServiceRoleClient();

    // 1. Fetch auth users
    const {
      data: { users: authUsers },
      error: authUsersError,
    } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });

    if (authUsersError) {
      return NextResponse.json(
        { error: authUsersError.message },
        { status: 500 }
      );
    }

    // 2. Fetch profiles and user_roles for accurate role mapping
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, user_id, full_name, email, role, status, avatar_url, created_at");

    const profileByUserId = new Map<string, any>();
    const profileByEmail = new Map<string, any>();
    const profileById = new Map<string, any>();

    if (profiles) {
      for (const p of profiles) {
        if (p.user_id) profileByUserId.set(p.user_id, p);
        if (p.email) profileByEmail.set(p.email.toLowerCase(), p);
        profileById.set(p.id, p);
      }
    }

    const staffEmails = new Set<string>();
    const staffProfileIds = new Set<string>();
    try {
      const { data: staffRows } = await supabase
        .from("staff")
        .select("profile_id, email");
      if (staffRows) {
        for (const s of staffRows) {
          if (s.profile_id) staffProfileIds.add(s.profile_id);
          if (s.email) staffEmails.add(s.email.toLowerCase().trim());
        }
      }
    } catch {}

    // Fetch user_roles with roles code for reliable role resolution
    const { data: userRolesData } = await supabase
      .from("user_roles")
      .select("profile_id, roles(code)");

    const roleByProfileId = new Map<string, string>();
    if (userRolesData) {
      for (const ur of userRolesData as any[]) {
        const roleObj = Array.isArray(ur.roles) ? ur.roles[0] : ur.roles;
        if (roleObj?.code) {
          roleByProfileId.set(ur.profile_id, roleObj.code);
        }
      }
    }

    // 3. Fetch programs reference & faculty assignments
    const { data: allPrograms } = await supabase
      .from("programs")
      .select("id, code, name");

    const programMap = new Map<string, string>();
    if (allPrograms) {
      for (const p of allPrograms) {
        if (p.id && p.code) programMap.set(p.id, p.code);
        if (p.code) programMap.set(p.code.toUpperCase(), p.code);
        if (p.name && p.code) programMap.set(p.name.toLowerCase(), p.code);
      }
    }

    const { data: programAssignments } = await supabase
      .from("faculty_program_assignments")
      .select("faculty_profile_id, program_id, programs(code, name)");

    const programByProfileId = new Map<string, string>();
    if (programAssignments) {
      for (const pa of programAssignments as any[]) {
        const prog = Array.isArray(pa.programs) ? pa.programs[0] : pa.programs;
        const code = prog?.code || (pa.program_id ? programMap.get(pa.program_id) : null);
        if (code && pa.faculty_profile_id) {
          programByProfileId.set(pa.faculty_profile_id, code);
        }
      }
    }

    const facultyDepartmentByProfileId = new Map<string, string>();
    const facultyDepartmentByUserId = new Map<string, string>();
    const facultyDepartmentByEmail = new Map<string, string>();
    try {
      const { data: facultyRows } = await supabase
        .from("faculty")
        .select("profile_id, user_id, email, department");
      if (facultyRows) {
        for (const f of facultyRows) {
          const dept = f.department?.trim();
          if (dept) {
            const mappedCode =
              programMap.get(dept) ||
              programMap.get(dept.toUpperCase()) ||
              programMap.get(dept.toLowerCase()) ||
              dept;
            if (f.profile_id) facultyDepartmentByProfileId.set(f.profile_id, mappedCode);
            if (f.user_id) facultyDepartmentByUserId.set(f.user_id, mappedCode);
            if (f.email) facultyDepartmentByEmail.set(f.email.toLowerCase().trim(), mappedCode);
          }
        }
      }
    } catch {}

    // 4. Fetch transaction logs for invite events, cancellations, and deletions
    const { data: inviteAuditLogs } = await supabase
      .from("transaction_logs")
      .select("id, actor_id, action, entity_id, metadata, created_at")
      .in("action", ["faculty.create", "admin.create", "staff.create", "user.invite"])
      .order("created_at", { ascending: false });

    const { data: cancelledAuditLogs } = await supabase
      .from("transaction_logs")
      .select("id, metadata, created_at")
      .eq("action", "user.invite_cancelled")
      .order("created_at", { ascending: false });

    const { data: deletedAuditLogs } = await supabase
      .from("transaction_logs")
      .select("id, entity_id, metadata, created_at")
      .in("action", ["user.delete", "faculty.delete", "admin.delete", "staff.delete"])
      .order("created_at", { ascending: false });

    const cancelledByEmail = new Map<string, string>();
    if (cancelledAuditLogs) {
      for (const log of cancelledAuditLogs) {
        const cEmail = (
          log.metadata?.target_email ||
          log.metadata?.email ||
          ""
        ).trim().toLowerCase();
        if (cEmail && !cancelledByEmail.has(cEmail)) {
          cancelledByEmail.set(cEmail, log.created_at);
        }
      }
    }

    const latestDeleteByEmail = new Map<string, string>();
    const deletedUserIds = new Set<string>();
    if (deletedAuditLogs) {
      for (const log of deletedAuditLogs) {
        const dEmail = (
          log.metadata?.target_email ||
          log.metadata?.email ||
          ""
        ).trim().toLowerCase();
        if (dEmail) {
          const prev = latestDeleteByEmail.get(dEmail);
          if (!prev || new Date(log.created_at) > new Date(prev)) {
            latestDeleteByEmail.set(dEmail, log.created_at);
          }
        }
        if (log.metadata?.target_auth_user_id) {
          deletedUserIds.add(log.metadata.target_auth_user_id);
        }
        if (log.metadata?.target_profile_id) {
          deletedUserIds.add(log.metadata.target_profile_id);
        }
        if (log.entity_id) {
          deletedUserIds.add(log.entity_id);
        }
      }
    }

    const auditByEmail = new Map<string, any>();
    if (inviteAuditLogs) {
      for (const log of inviteAuditLogs) {
        const targetEmail = (
          log.metadata?.target_email ||
          log.metadata?.email ||
          ""
        ).trim().toLowerCase();
        if (targetEmail && !auditByEmail.has(targetEmail)) {
          auditByEmail.set(targetEmail, log);
        }
      }
    }

    const logsMap = new Map<string, RegistrationLogItem>();

    // Process all Auth Users (Faculty, Staff & Admin)
    for (const u of authUsers) {
      const email = (u.email || "").trim().toLowerCase();
      if (!email) continue;

      const profile = profileByUserId.get(u.id) || profileByEmail.get(email);
      const auditLog = auditByEmail.get(email);

      // Check if user was deleted
      const userCreatedAt = new Date(u.created_at).getTime();
      const deleteLogTime = latestDeleteByEmail.get(email)
        ? new Date(latestDeleteByEmail.get(email)!).getTime()
        : 0;

      // An auth user is only considered deleted if explicitly matched by deleted user ID,
      // or if an email deletion audit log was recorded AFTER this auth user was created.
      const isDeleted =
        deletedUserIds.has(u.id) ||
        (deleteLogTime > 0 && deleteLogTime > userCreatedAt);

      const isOrphaned = !profile && !auditLog && !u.last_sign_in_at;

      if (isDeleted || isOrphaned) {
        // Skip from display; never passively delete auth users in a GET query
        continue;
      }

      // Determine Role accurately using auth metadata, staff table, user_roles table, profile, or audit log
      const dbRole = profile?.id ? roleByProfileId.get(profile.id) : null;
      const isStaffMember =
        staffEmails.has(email) ||
        (profile?.id ? staffProfileIds.has(profile.id) : false);
      const auditRole =
        (auditLog?.metadata?.role as string | undefined) ||
        (auditLog?.action === "staff.create" || auditLog?.action === "admin.create"
          ? ROLE.STAFF
          : "");

      const rawRole = (
        u.user_metadata?.role ||
        u.app_metadata?.role ||
        (isStaffMember ? ROLE.STAFF : "") ||
        dbRole ||
        profile?.role ||
        auditRole ||
        ""
      ).toLowerCase();

      const isSuperAdminEmail =
        email === "pupbataanfocus.superadmin@gmail.com" ||
        email === "pupbataanfocus.admin@gmail.com";

      let displayRole: "Faculty" | "Staff" | "Admin" | "Super Admin" = "Faculty";
      if (isSuperAdminEmail || rawRole.includes("super")) {
        displayRole = "Admin";
      } else if (rawRole.includes("staff") || isStaffMember) {
        displayRole = "Staff";
      } else if (rawRole.includes("admin")) {
        displayRole = "Staff";
      } else {
        displayRole = "Faculty";
      }

      // Determine Status: Accepted vs Pending
      // A user is only accepted if they confirmed email or actually signed in
      const isAccepted = Boolean(
        u.email_confirmed_at ||
        u.confirmed_at ||
        u.last_sign_in_at
      );

      const inviteStatus: "Accepted" | "Pending" = isAccepted ? "Accepted" : "Pending";

      // Full Name
      const fullName =
        profile?.full_name?.trim() ||
        u.user_metadata?.full_name?.trim() ||
        auditLog?.metadata?.target_full_name?.trim() ||
        [u.user_metadata?.first_name, u.user_metadata?.last_name].filter(Boolean).join(" ") ||
        email.split("@")[0];

      // Invited / Created Date
      const invitedAt =
        u.invited_at ||
        auditLog?.created_at ||
        profile?.created_at ||
        u.created_at;

      const confirmedAt = u.email_confirmed_at || u.confirmed_at || null;
      const lastLoginAt = u.last_sign_in_at || null;

      // Program (if faculty)
      const rawUserProg =
        u.user_metadata?.program_code ||
        u.user_metadata?.program ||
        u.user_metadata?.programId ||
        u.user_metadata?.program_id ||
        u.user_metadata?.department;

      const userProgMapped = rawUserProg
        ? programMap.get(rawUserProg) ||
          programMap.get(String(rawUserProg).toUpperCase()) ||
          programMap.get(String(rawUserProg).toLowerCase()) ||
          rawUserProg
        : null;

      const progCode =
        (profile ? programByProfileId.get(profile.id) : null) ||
        (profile ? facultyDepartmentByProfileId.get(profile.id) : null) ||
        facultyDepartmentByUserId.get(u.id) ||
        facultyDepartmentByEmail.get(email) ||
        userProgMapped ||
        auditLog?.metadata?.program_code ||
        (auditLog?.metadata?.program_id ? programMap.get(auditLog.metadata.program_id) : null) ||
        null;

      // Inviter Actor
      let invitedBy: string | null = null;
      if (auditLog?.actor_id) {
        const actorProfile = profileByUserId.get(auditLog.actor_id) || profileById.get(auditLog.actor_id);
        invitedBy = actorProfile?.full_name || actorProfile?.email || null;
      }

      logsMap.set(email, {
        id: u.id,
        fullName,
        email,
        role: displayRole,
        status: inviteStatus,
        invitedAt,
        confirmedAt,
        lastLoginAt,
        inviteSent: auditLog?.metadata?.invite_sent !== false,
        sendError: (auditLog?.metadata?.send_error as string) || null,
        program: progCode,
        avatarUrl:
          profile?.avatar_url ||
          (profile as any)?.profile_image_url ||
          u.user_metadata?.avatar_url ||
          u.user_metadata?.profile_image_url ||
          u.user_metadata?.picture ||
          null,
        invitedBy,
      });
    }

    // Process any audit logs whose target_email didn't have an auth user
    if (inviteAuditLogs) {
      for (const log of inviteAuditLogs) {
        const targetEmail = (
          log.metadata?.target_email ||
          log.metadata?.email ||
          ""
        ).trim().toLowerCase();
        if (!targetEmail || logsMap.has(targetEmail)) {
          continue;
        }

        const logTime = new Date(log.created_at).getTime();
        const deleteLogTime = latestDeleteByEmail.get(targetEmail)
          ? new Date(latestDeleteByEmail.get(targetEmail)!).getTime()
          : 0;

        if (deleteLogTime > 0 && deleteLogTime >= logTime) {
          continue;
        }

        // If this invite was cancelled after it was created, skip it
        const cancelledAt = cancelledByEmail.get(targetEmail);
        if (cancelledAt && new Date(cancelledAt).getTime() >= logTime) {
          continue;
        }

        const targetFullName =
          (log.metadata?.target_full_name as string)?.trim() ||
          targetEmail.split("@")[0];

        const isFaculty = log.action === "faculty.create";
        const actorProfile = profileByUserId.get(log.actor_id) || profileById.get(log.actor_id);
        const fallbackProfile = profileByEmail.get(targetEmail);

        logsMap.set(targetEmail, {
          id: log.id,
          fullName: fallbackProfile?.full_name || targetFullName,
          email: targetEmail,
          role: isFaculty ? "Faculty" : "Staff",
          status: "Pending",
          invitedAt: log.created_at,
          confirmedAt: null,
          lastLoginAt: null,
          inviteSent: log.metadata?.invite_sent !== false,
          sendError: (log.metadata?.send_error as string) || null,
          program: (log.metadata?.program_code as string) || null,
          avatarUrl: fallbackProfile?.avatar_url || (fallbackProfile as any)?.profile_image_url || null,
          invitedBy: actorProfile?.full_name || actorProfile?.email || null,
        });
      }
    }

    // Filter by role scope if requested
    let roleScopedItems = Array.from(logsMap.values());
    if (roleFilter !== "all") {
      if (roleFilter === "admin" || roleFilter === "staff") {
        roleScopedItems = roleScopedItems.filter((item) => {
          const r = item.role.toLowerCase();
          return r.includes("admin") || r.includes("staff");
        });
      } else {
        roleScopedItems = roleScopedItems.filter(
          (item) => item.role.toLowerCase() === roleFilter
        );
      }
    }

    const stats = {
      total: roleScopedItems.length,
      accepted: roleScopedItems.filter((i) => i.status === "Accepted").length,
      pending: roleScopedItems.filter((i) => i.status === "Pending").length,
    };

    let items = [...roleScopedItems];

    if (statusFilter !== "all") {
      items = items.filter((item) => item.status.toLowerCase() === statusFilter);
    }

    if (searchQuery) {
      items = items.filter(
        (item) =>
          item.fullName.toLowerCase().includes(searchQuery) ||
          item.email.toLowerCase().includes(searchQuery) ||
          (item.program && item.program.toLowerCase().includes(searchQuery))
      );
    }

    // Sort by invitedAt descending
    items.sort(
      (a, b) => new Date(b.invitedAt).getTime() - new Date(a.invitedAt).getTime()
    );

    return NextResponse.json(
      { logs: items, stats },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    );
  } catch (error: any) {
    console.error("User registration logs fetch error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch user registration logs" },
      { status: 500 }
    );
  }
}

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
      (requesterRole !== ROLE.STAFF && requesterRole !== ROLE.ADMIN && requesterRole !== ROLE.SUPER_ADMIN && requesterRole !== "staff")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const email = (body.email || "").trim().toLowerCase();
    const fullName = (body.fullName || "").trim();

    if (!email || !isValidEmailAddress(email)) {
      return NextResponse.json(
        { error: "A valid email address is required" },
        { status: 400 }
      );
    }

    const supabase = getServiceRoleClient();

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      (request.url ? new URL(request.url).origin : "https://pupfocus.cjaayy.dev");
    const callbackUrl = `${siteUrl.replace(/\/$/, "")}/auth/confirm?email=${encodeURIComponent(email)}`;

    // Generate fresh invite link
    const { data: genData, error: genError } =
      await supabase.auth.admin.generateLink({
        type: "invite",
        email,
        options: {
          data: {
            full_name: fullName,
          },
          redirectTo: callbackUrl,
        },
      });

    const hashedToken = genData?.properties?.hashed_token;
    let actionLink = hashedToken
      ? `${siteUrl.replace(/\/$/, "")}/auth/confirm?token_hash=${encodeURIComponent(hashedToken)}&type=invite&email=${encodeURIComponent(email)}`
      : genData?.properties?.action_link ?? null;
    let sent = false;
    let sendError: string | null = null;
    let isTempPasswordReset = false;

    if (genError) {
      // Check if user already exists in auth.users
      const { data: usersData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const existingUser = usersData?.users?.find(
        (u) => u.email?.trim().toLowerCase() === email
      );

      if (existingUser) {
        // User exists (e.g. invite link was already used or email confirmed).
        // Issue fresh compliant temporary login credentials that strictly meet complexity rules
        const tempPassword = generateTempPassword(16);
        const { error: updateAuthErr } = await supabase.auth.admin.updateUserById(
          existingUser.id,
          {
            password: tempPassword,
            email_confirm: true,
            user_metadata: {
              ...(existingUser.user_metadata ?? {}),
              full_name: fullName || existingUser.user_metadata?.full_name || email.split("@")[0],
              must_change_password: true,
              force_password_change: true,
            },
          }
        );

        if (updateAuthErr) {
          return NextResponse.json(
            { error: `Failed to issue credentials: ${updateAuthErr.message}` },
            { status: 400 }
          );
        }

        isTempPasswordReset = true;
        try {
          await sendTempPasswordEmail({
            to: email,
            tempPassword,
            fullName: fullName || existingUser.user_metadata?.full_name || email.split("@")[0],
          });
          sent = true;
        } catch (err: any) {
          sendError = err?.message || "Failed to send credentials email";
        }
      } else {
        return NextResponse.json(
          { error: genError.message || "Failed to generate invite link" },
          { status: 400 }
        );
      }
    } else if (actionLink) {
      try {
        await sendInviteEmail({
          to: email,
          link: actionLink,
          fullName: fullName || email.split("@")[0],
          invitedRole: (body.role || ROLE.FACULTY) as any,
        });
        sent = true;
      } catch (err: any) {
        sendError = err?.message || "Failed to send email";
      }
    }

    // Log the resend in audit logs
    try {
      await logAuditEvent({
        actorId: currentUser.id,
        action: "user.invite",
        entityType: "user",
        entityId: genData?.user?.id || currentUser.id,
        metadata: {
          target_email: email,
          target_full_name: fullName,
          is_resend: true,
          is_temp_password: isTempPasswordReset,
          invite_sent: sent,
          send_error: sendError,
        },
      });
    } catch {
      // Ignored
    }

    return NextResponse.json({
      success: true,
      sent,
      sendError,
      link: actionLink,
      isTempPasswordReset,
      message: sent
        ? (isTempPasswordReset
            ? `New temporary credentials generated and emailed to ${email} successfully!`
            : "Invitation email resent successfully!")
        : "Credentials generated successfully.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to resend invitation" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
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
      (requesterRole !== ROLE.STAFF && requesterRole !== ROLE.ADMIN && requesterRole !== ROLE.SUPER_ADMIN && requesterRole !== "staff")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const email = (body.email || "").trim().toLowerCase();
    const targetId = body.id;

    if (!email && !targetId) {
      return NextResponse.json(
        { error: "Email or User ID is required to cancel invitation" },
        { status: 400 }
      );
    }

    const supabase = getServiceRoleClient();

    // 1. Fetch auth user
    const {
      data: { users },
    } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });

    const authUser = users?.find(
      (u) =>
        (email && u.email?.trim().toLowerCase() === email) ||
        (targetId && u.id === targetId)
    );

    if (authUser) {
      // Check if user has actively signed in and has a profile
      const { data: prof } = await supabase
        .from("profiles")
        .select("id")
        .or(`user_id.eq.${authUser.id},email.ilike.${email || authUser.email}`)
        .maybeSingle();

      const hasActiveLogin = Boolean(authUser.last_sign_in_at);

      if (hasActiveLogin && prof?.id) {
        return NextResponse.json(
          {
            error:
              "Cannot cancel an active account that has already logged in. To remove this user, use the Delete action in the directory table.",
          },
          { status: 400 }
        );
      }

      // Delete from auth.users
      const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(authUser.id);
      if (deleteAuthError) {
        return NextResponse.json(
          { error: `Failed to delete invited auth user: ${deleteAuthError.message}` },
          { status: 500 }
        );
      }

      // Clean up profiles & assignments
      if (prof?.id) {
        await supabase.from("faculty_program_assignments").delete().eq("faculty_profile_id", prof.id);
        await supabase.from("staff").delete().eq("profile_id", prof.id);
        await supabase.from("admins").delete().eq("profile_id", prof.id);
        await supabase.from("user_roles").delete().eq("profile_id", prof.id);
        await supabase.from("profiles").delete().eq("id", prof.id);
      }
      if (email) {
        await supabase.from("staff").delete().ilike("email", email);
        await supabase.from("admins").delete().ilike("email", email);
      }
    } else if (email) {
      // Clean up profile by email if auth user is already gone
      const { data: prof } = await supabase
        .from("profiles")
        .select("id")
        .ilike("email", email)
        .maybeSingle();

      if (prof?.id) {
        await supabase.from("faculty_program_assignments").delete().eq("faculty_profile_id", prof.id);
        await supabase.from("staff").delete().eq("profile_id", prof.id);
        await supabase.from("admins").delete().eq("profile_id", prof.id);
        await supabase.from("user_roles").delete().eq("profile_id", prof.id);
        await supabase.from("profiles").delete().eq("id", prof.id);
      }
      await supabase.from("staff").delete().ilike("email", email);
      await supabase.from("admins").delete().ilike("email", email);
    }

    // Log the cancellation in audit_logs
    try {
      await logAuditEvent({
        actorId: currentUser.id,
        action: "user.invite_cancelled",
        entityType: "user",
        entityId: authUser?.id || currentUser.id,
        metadata: {
          target_email: email,
          target_full_name: authUser?.user_metadata?.full_name || email,
          cancelled_by_admin: currentUser.id,
        },
      });
    } catch {
      // Ignored
    }

    return NextResponse.json({
      success: true,
      message: `Invitation for ${email} has been cancelled successfully.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to cancel invitation" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
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
      (requesterRole !== ROLE.STAFF && requesterRole !== ROLE.ADMIN && requesterRole !== ROLE.SUPER_ADMIN && requesterRole !== "staff")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const email = (body.email || "").trim().toLowerCase();
    const newEmail = (body.newEmail || email).trim().toLowerCase();
    const newFullName = (body.newFullName || body.fullName || "").trim();
    const newProgram = (body.newProgram || body.program || "").trim();
    const resendNow = Boolean(body.resendNow);
    const targetId = body.id;

    if (!email && !targetId) {
      return NextResponse.json(
        { error: "Original email or User ID is required" },
        { status: 400 }
      );
    }

    if (!newEmail || !isValidEmailAddress(newEmail)) {
      return NextResponse.json(
        { error: "A valid email address is required" },
        { status: 400 }
      );
    }

    if (!newFullName) {
      return NextResponse.json(
        { error: "Full name is required" },
        { status: 400 }
      );
    }

    const supabase = getServiceRoleClient();

    // Check duplicate email if email is being changed
    if (newEmail !== email) {
      const { data: usersData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const duplicateAuthUser = usersData?.users?.find(
        (u) => u.email?.trim().toLowerCase() === newEmail && u.id !== targetId
      );
      if (duplicateAuthUser) {
        return NextResponse.json(
          { error: `Account with email ${newEmail} already exists` },
          { status: 400 }
        );
      }

      const { data: duplicateProfile } = await supabase
        .from("profiles")
        .select("id, user_id")
        .ilike("email", newEmail)
        .maybeSingle();

      if (duplicateProfile && duplicateProfile.user_id !== targetId) {
        return NextResponse.json(
          { error: `Profile with email ${newEmail} already exists` },
          { status: 400 }
        );
      }
    }

    // 1. Locate program row if newProgram is provided
    let progRow: { id: string; code: string; name: string } | null = null;
    if (newProgram) {
      const { data: pData } = await supabase
        .from("programs")
        .select("id, code, name")
        .or(`code.ilike.${newProgram},id.eq.${newProgram}`)
        .maybeSingle();
      progRow = pData;
    }

    // 2. Locate and update auth user
    const { data: usersData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const authUser = usersData?.users?.find(
      (u) =>
        (email && u.email?.trim().toLowerCase() === email) ||
        (targetId && u.id === targetId)
    );

    let updatedUserId = targetId || authUser?.id;

    if (authUser) {
      updatedUserId = authUser.id;
      const updatePayload: any = {
        user_metadata: {
          ...(authUser.user_metadata || {}),
          full_name: newFullName,
          ...(progRow ? { program_id: progRow.id, program_code: progRow.code } : {}),
        },
      };

      if (newEmail !== authUser.email?.trim().toLowerCase()) {
        updatePayload.email = newEmail;
        updatePayload.email_confirm = false;
      }

      const { error: updateAuthErr } = await supabase.auth.admin.updateUserById(
        authUser.id,
        updatePayload
      );

      if (updateAuthErr) {
        return NextResponse.json(
          { error: `Failed to update auth user: ${updateAuthErr.message}` },
          { status: 500 }
        );
      }
    }

    // 3. Update profiles table
    const { data: existingProf } = await supabase
      .from("profiles")
      .select("id")
      .or(`user_id.eq.${updatedUserId || "none"},email.ilike.${email}`)
      .maybeSingle();

    if (existingProf?.id) {
      await supabase
        .from("profiles")
        .update({
          email: newEmail,
          full_name: newFullName,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingProf.id);

      await supabase.from("staff").update({ email: newEmail, full_name: newFullName, updated_at: new Date().toISOString() }).eq("profile_id", existingProf.id);
      await supabase.from("admins").update({ email: newEmail, full_name: newFullName, updated_at: new Date().toISOString() }).eq("profile_id", existingProf.id);
      
      const facultyUpdate: any = { email: newEmail, full_name: newFullName, updated_at: new Date().toISOString() };
      if (progRow) {
        facultyUpdate.department = progRow.name || progRow.code;
      }
      await supabase.from("faculty").update(facultyUpdate).eq("profile_id", existingProf.id);

      if (progRow) {
        await supabase
          .from("faculty_program_assignments")
          .delete()
          .eq("faculty_profile_id", existingProf.id);

        await supabase
          .from("faculty_program_assignments")
          .insert({
            faculty_profile_id: existingProf.id,
            program_id: progRow.id,
            academic_year: "2026-2027",
            term: "1st Semester",
          });
      }
    } else {
      await supabase.from("staff").update({ email: newEmail, full_name: newFullName }).ilike("email", email);
      await supabase.from("admins").update({ email: newEmail, full_name: newFullName }).ilike("email", email);
      if (progRow) {
        await supabase.from("faculty").update({ email: newEmail, full_name: newFullName, department: progRow.name || progRow.code }).ilike("email", email);
      } else {
        await supabase.from("faculty").update({ email: newEmail, full_name: newFullName }).ilike("email", email);
      }
    }

    // 3. Log audit event
    try {
      await logAuditEvent({
        actorId: currentUser.id,
        action: "user.invite_updated",
        entityType: "user",
        entityId: updatedUserId || currentUser.id,
        metadata: {
          previous_email: email,
          updated_email: newEmail,
          updated_full_name: newFullName,
          updated_program: newProgram || null,
          program_code: progRow?.code || newProgram || null,
          program_id: progRow?.id || null,
          resend_requested: resendNow,
        },
      });
    } catch {}

    // 4. Optionally resend invite immediately
    let sent = false;
    let sendError: string | null = null;
    let actionLink: string | null = null;

    if (resendNow) {
      const siteUrl =
        process.env.NEXT_PUBLIC_SITE_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        (request.url ? new URL(request.url).origin : "https://pupfocus.cjaayy.dev");
      const callbackUrl = `${siteUrl.replace(/\/$/, "")}/auth/confirm?email=${encodeURIComponent(newEmail)}`;

      const { data: genData, error: genError } =
        await supabase.auth.admin.generateLink({
          type: "invite",
          email: newEmail,
          options: {
            data: {
              full_name: newFullName,
              ...(progRow ? { program_id: progRow.id, program_code: progRow.code } : {}),
            },
            redirectTo: callbackUrl,
          },
        });

      const hashedToken = genData?.properties?.hashed_token;
      actionLink = hashedToken
        ? `${siteUrl.replace(/\/$/, "")}/auth/confirm?token_hash=${encodeURIComponent(hashedToken)}&type=invite&email=${encodeURIComponent(newEmail)}`
        : genData?.properties?.action_link ?? null;

      if (actionLink) {
        try {
          await sendInviteEmail({
            to: newEmail,
            link: actionLink,
            fullName: newFullName,
            invitedRole: (body.role || ROLE.FACULTY) as any,
          });
          sent = true;
        } catch (err: any) {
          sendError = err?.message || "Failed to send email";
        }
      } else if (genError) {
        sendError = genError.message || "Failed to generate invite link";
      }
    }

    return NextResponse.json({
      success: true,
      sent,
      sendError,
      link: actionLink,
      message: resendNow
        ? (sent
            ? `Details updated and invitation email resent to ${newEmail} successfully!`
            : `Details updated. Email delivery failed: ${sendError || "Check SMTP settings"}`)
        : `Invitation details updated for ${newEmail} successfully.`,
    });
  } catch (error: any) {
    console.error("User registration log update error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update invitation details" },
      { status: 500 }
    );
  }
}
