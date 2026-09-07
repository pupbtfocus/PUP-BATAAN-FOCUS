import { NextResponse, type NextRequest } from "next/server";
import { ROLE } from "@/config/roles";
import {
  buildFacultyFullName,
  parseFullNameFallback,
} from "@/lib/faculty-profile";
import { resolveAdminAvatarUrl } from "@/lib/admin-profile";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

function trimOrEmpty(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET() {
  try {
    const sessionClient = await createServerSupabaseClient();
    const {
      data: { user },
      error: userError,
    } = await sessionClient.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const requesterRole =
      (user.user_metadata?.role as string | undefined) ??
      (user.app_metadata?.role as string | undefined);

    if (requesterRole !== ROLE.ADMIN && requesterRole !== ROLE.SUPER_ADMIN) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabaseAdmin = getServiceRoleClient();
    const metadata = user.user_metadata || {};

    let email = user.email || "";
    let fullName =
      metadata.full_name ||
      metadata.name ||
      user.email?.split("@")[0] ||
      "Admin User";

    // Check profiles table
    let profileRecord: any = null;
    try {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, email")
        .or(`user_id.eq.${user.id},id.eq.${user.id}`)
        .maybeSingle();

      if (profile) {
        profileRecord = profile;
        if (profile.full_name) fullName = profile.full_name;
        if (profile.email) email = profile.email;
      }
    } catch {}

    const parsedFallback = parseFullNameFallback(fullName);
    const firstName =
      trimOrEmpty(metadata.first_name) || parsedFallback.firstName;
    const middleName =
      trimOrEmpty(metadata.middle_name) || parsedFallback.middleName;
    const lastName =
      trimOrEmpty(metadata.last_name) || parsedFallback.lastName;
    const formattedFullName =
      buildFacultyFullName({ firstName, middleName, lastName }) || fullName;

    const resolvedAvatarUrl = await resolveAdminAvatarUrl(supabaseAdmin, {
      id: user.id,
      email,
      user_metadata: metadata,
    });

    const autoEmailReminders =
      typeof metadata.auto_email_reminders === "boolean"
        ? metadata.auto_email_reminders
        : typeof metadata.email_reminders === "boolean"
        ? metadata.email_reminders
        : true;

    const newSubmissionAlerts =
      typeof metadata.new_submission_alerts === "boolean"
        ? metadata.new_submission_alerts
        : typeof metadata.submission_alerts === "boolean"
        ? metadata.submission_alerts
        : true;

    const rawTimeout =
      metadata.session_timeout_minutes ?? metadata.session_timeout;
    let sessionTimeoutMinutes = "60";
    if (typeof rawTimeout === "number" || (typeof rawTimeout === "string" && !isNaN(Number(rawTimeout)))) {
      sessionTimeoutMinutes = String(rawTimeout);
    } else if (rawTimeout === "15 mins") {
      sessionTimeoutMinutes = "15";
    } else if (rawTimeout === "30 mins") {
      sessionTimeoutMinutes = "30";
    } else if (rawTimeout === "1 hour") {
      sessionTimeoutMinutes = "60";
    } else if (rawTimeout === "2 hours") {
      sessionTimeoutMinutes = "120";
    } else if (rawTimeout === "Never") {
      sessionTimeoutMinutes = "0";
    }

    return NextResponse.json({
      success: true,
      id: user.id,
      profileId: profileRecord?.id || user.id,
      email,
      full_name: formattedFullName,
      fullName: formattedFullName,
      firstName,
      middleName,
      lastName,
      first_name: firstName,
      middle_name: middleName,
      last_name: lastName,
      avatar_url: resolvedAvatarUrl,
      profileImageUrl: resolvedAvatarUrl,
      auto_email_reminders: autoEmailReminders,
      new_submission_alerts: newSubmissionAlerts,
      email_reminders: autoEmailReminders,
      submission_alerts: newSubmissionAlerts,
      session_timeout_minutes: sessionTimeoutMinutes,
      session_timeout: sessionTimeoutMinutes,
    });
  } catch (error: any) {
    console.error("[Admin Profile API Error]:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to load admin profile" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const sessionClient = await createServerSupabaseClient();
    const {
      data: { user },
      error: userError,
    } = await sessionClient.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const requesterRole =
      (user.user_metadata?.role as string | undefined) ??
      (user.app_metadata?.role as string | undefined);

    if (requesterRole !== ROLE.ADMIN && requesterRole !== ROLE.SUPER_ADMIN) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabaseAdmin = getServiceRoleClient();
    const contentType = request.headers.get("content-type") ?? "";

    let firstName = "";
    let middleName = "";
    let lastName = "";
    let fullName = "";
    let autoEmailReminders: boolean | undefined = undefined;
    let newSubmissionAlerts: boolean | undefined = undefined;
    let sessionTimeoutMinutes: string | undefined = undefined;
    let removeAvatar = false;
    let avatarFile: File | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      firstName = trimOrEmpty(formData.get("firstName") || formData.get("first_name"));
      middleName = trimOrEmpty(formData.get("middleName") || formData.get("middle_name"));
      lastName = trimOrEmpty(formData.get("lastName") || formData.get("last_name"));
      fullName = trimOrEmpty(formData.get("fullName") || formData.get("full_name"));

      if (formData.has("autoEmailReminders")) {
        autoEmailReminders = formData.get("autoEmailReminders") === "true";
      } else if (formData.has("auto_email_reminders")) {
        autoEmailReminders = formData.get("auto_email_reminders") === "true";
      }

      if (formData.has("newSubmissionAlerts")) {
        newSubmissionAlerts = formData.get("newSubmissionAlerts") === "true";
      } else if (formData.has("new_submission_alerts")) {
        newSubmissionAlerts = formData.get("new_submission_alerts") === "true";
      }

      if (formData.has("sessionTimeoutMinutes")) {
        sessionTimeoutMinutes = trimOrEmpty(formData.get("sessionTimeoutMinutes"));
      } else if (formData.has("session_timeout_minutes")) {
        sessionTimeoutMinutes = trimOrEmpty(formData.get("session_timeout_minutes"));
      } else if (formData.has("sessionTimeout")) {
        sessionTimeoutMinutes = trimOrEmpty(formData.get("sessionTimeout"));
      }

      if (formData.get("removeAvatar") === "true") {
        removeAvatar = true;
      }

      const fileField = formData.get("profileImage") || formData.get("avatarFile");
      if (fileField instanceof File && fileField.size > 0) {
        avatarFile = fileField;
      }
    } else {
      const json = await request.json();
      firstName = trimOrEmpty(json.firstName || json.first_name);
      middleName = trimOrEmpty(json.middleName || json.middle_name);
      lastName = trimOrEmpty(json.lastName || json.last_name);
      fullName = trimOrEmpty(json.fullName || json.full_name);

      if (typeof json.autoEmailReminders === "boolean") {
        autoEmailReminders = json.autoEmailReminders;
      } else if (typeof json.auto_email_reminders === "boolean") {
        autoEmailReminders = json.auto_email_reminders;
      }

      if (typeof json.newSubmissionAlerts === "boolean") {
        newSubmissionAlerts = json.newSubmissionAlerts;
      } else if (typeof json.new_submission_alerts === "boolean") {
        newSubmissionAlerts = json.new_submission_alerts;
      }

      if (json.sessionTimeoutMinutes !== undefined) {
        sessionTimeoutMinutes = String(json.sessionTimeoutMinutes);
      } else if (json.session_timeout_minutes !== undefined) {
        sessionTimeoutMinutes = String(json.session_timeout_minutes);
      } else if (json.sessionTimeout !== undefined) {
        sessionTimeoutMinutes = String(json.sessionTimeout);
      }

      if (json.removeAvatar === true) {
        removeAvatar = true;
      }
    }

    // 1. Fetch current profile from profiles table
    const { data: profile, error: profileFetchError } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .or(`user_id.eq.${user.id},id.eq.${user.id}`)
      .maybeSingle();

    if (profileFetchError || !profile) {
      return NextResponse.json(
        { error: "Admin profile not found" },
        { status: 404 }
      );
    }

    const previousMetadata = user.user_metadata || {};
    const previousFullName = profile.full_name || previousMetadata.full_name || "Admin User";
    const previousParsed = parseFullNameFallback(previousFullName);

    // Fall back to current values if not provided
    if (!firstName && !lastName && !fullName) {
      firstName = previousMetadata.first_name || previousParsed.firstName;
      middleName = previousMetadata.middle_name || previousParsed.middleName;
      lastName = previousMetadata.last_name || previousParsed.lastName;
    } else if (!firstName && !lastName && fullName) {
      const parsed = parseFullNameFallback(fullName);
      firstName = parsed.firstName;
      middleName = parsed.middleName;
      lastName = parsed.lastName;
    }

    const updatedFullName =
      buildFacultyFullName({ firstName, middleName, lastName }) ||
      fullName ||
      previousFullName;

    // 2. Handle Avatar Upload or Removal in compliance-private bucket
    let newAvatarUrl: string | null = null;
    let newProfileImagePath: string | null = previousMetadata.profile_image_path || null;
    let newProfileImageBucket: string | null = previousMetadata.profile_image_bucket || "compliance-private";

    if (removeAvatar) {
      if (previousMetadata.profile_image_path) {
        await supabaseAdmin.storage
          .from(previousMetadata.profile_image_bucket || "compliance-private")
          .remove([previousMetadata.profile_image_path])
          .catch(() => null);
      }
      newProfileImagePath = null;
      newProfileImageBucket = null;
      newAvatarUrl = null;
    } else if (avatarFile) {
      if (!avatarFile.type.startsWith("image/")) {
        return NextResponse.json(
          { error: "Uploaded avatar must be an image file (PNG, JPG, or WebP)." },
          { status: 400 }
        );
      }

      if (avatarFile.size > 5 * 1024 * 1024) {
        return NextResponse.json(
          { error: "Profile picture must be 5MB or smaller" },
          { status: 400 }
        );
      }

      const safeFileName = avatarFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const userFolder = profile.email || user.email || user.id;
      const storagePath = `admin-profile-images/${userFolder}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeFileName}`;
      const arrayBuffer = await avatarFile.arrayBuffer();

      const { error: uploadError } = await supabaseAdmin.storage
        .from("compliance-private")
        .upload(storagePath, arrayBuffer, {
          contentType: avatarFile.type || "application/octet-stream",
          upsert: true,
        });

      if (uploadError) {
        return NextResponse.json(
          { error: `Failed to upload profile image: ${uploadError.message}` },
          { status: 400 }
        );
      }

      const { data: signedData } = await supabaseAdmin.storage
        .from("compliance-private")
        .createSignedUrl(storagePath, 60 * 60 * 24 * 7);

      newProfileImagePath = storagePath;
      newProfileImageBucket = "compliance-private";
      newAvatarUrl = signedData?.signedUrl || null;

      // Clean up previous image if different
      if (
        previousMetadata.profile_image_path &&
        previousMetadata.profile_image_path !== storagePath
      ) {
        await supabaseAdmin.storage
          .from(previousMetadata.profile_image_bucket || "compliance-private")
          .remove([previousMetadata.profile_image_path])
          .catch(() => null);
      }
    } else {
      // Re-resolve existing avatar
      newAvatarUrl = await resolveAdminAvatarUrl(supabaseAdmin, {
        id: user.id,
        email: profile.email || user.email,
        user_metadata: previousMetadata,
      });
    }

    // 3. Update profiles table
    const { error: profileUpdateError } = await supabaseAdmin
      .from("profiles")
      .update({
        full_name: updatedFullName,
      })
      .eq("id", profile.id);

    if (profileUpdateError) {
      return NextResponse.json(
        { error: profileUpdateError.message },
        { status: 400 }
      );
    }

    // Update admins table if exists
    try {
      await supabaseAdmin
        .from("admins")
        .update({
          full_name: updatedFullName,
          updated_at: new Date().toISOString(),
        })
        .or(`profile_id.eq.${profile.id},id.eq.${profile.id}`);
    } catch {
      // Optional table
    }

    // 4. Update Auth User Metadata
    const finalAutoEmailReminders =
      autoEmailReminders !== undefined
        ? autoEmailReminders
        : typeof previousMetadata.auto_email_reminders === "boolean"
        ? previousMetadata.auto_email_reminders
        : true;

    const finalNewSubmissionAlerts =
      newSubmissionAlerts !== undefined
        ? newSubmissionAlerts
        : typeof previousMetadata.new_submission_alerts === "boolean"
        ? previousMetadata.new_submission_alerts
        : true;

    const finalSessionTimeout =
      sessionTimeoutMinutes !== undefined
        ? sessionTimeoutMinutes
        : String(previousMetadata.session_timeout_minutes || "60");

    const updatedUserMetadata: Record<string, any> = {
      ...previousMetadata,
      first_name: firstName,
      middle_name: middleName || null,
      last_name: lastName,
      full_name: updatedFullName,
      name: updatedFullName,
      profile_image_bucket: newProfileImageBucket,
      profile_image_path: newProfileImagePath,
      avatar_url: newAvatarUrl,
      picture: newAvatarUrl,
      auto_email_reminders: finalAutoEmailReminders,
      new_submission_alerts: finalNewSubmissionAlerts,
      email_reminders: finalAutoEmailReminders,
      submission_alerts: finalNewSubmissionAlerts,
      session_timeout_minutes: finalSessionTimeout,
      session_timeout: finalSessionTimeout,
      system_settings: {
        auto_email_reminders: finalAutoEmailReminders,
        new_submission_alerts: finalNewSubmissionAlerts,
        session_timeout_minutes: finalSessionTimeout,
        updated_at: new Date().toISOString(),
      },
    };

    const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      {
        user_metadata: updatedUserMetadata,
      }
    );

    if (authUpdateError) {
      return NextResponse.json(
        { error: authUpdateError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      id: user.id,
      profileId: profile.id,
      email: profile.email || user.email || "",
      full_name: updatedFullName,
      fullName: updatedFullName,
      firstName,
      middleName,
      lastName,
      first_name: firstName,
      middle_name: middleName,
      last_name: lastName,
      avatar_url: newAvatarUrl,
      profileImageUrl: newAvatarUrl,
      auto_email_reminders: finalAutoEmailReminders,
      new_submission_alerts: finalNewSubmissionAlerts,
      email_reminders: finalAutoEmailReminders,
      submission_alerts: finalNewSubmissionAlerts,
      session_timeout_minutes: finalSessionTimeout,
      session_timeout: finalSessionTimeout,
    });
  } catch (error: any) {
    console.error("[Admin Profile Update API Error]:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update admin profile" },
      { status: 500 }
    );
  }
}
