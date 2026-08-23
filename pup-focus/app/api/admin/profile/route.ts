import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

async function resolveAvatarUrl(
  supabaseAdmin: any,
  email?: string | null,
  userId?: string | null,
  rawAvatarUrl?: string | null
): Promise<string | null> {
  // 1. If rawAvatarUrl is already a valid full HTTP URL
  if (rawAvatarUrl && rawAvatarUrl.startsWith("http")) {
    return rawAvatarUrl;
  }

  // 2. If rawAvatarUrl is a storage path or partial path
  if (rawAvatarUrl) {
    let storagePath = rawAvatarUrl.trim();
    while (storagePath.startsWith("/")) {
      storagePath = storagePath.substring(1);
    }
    if (storagePath.startsWith("avatars/")) {
      storagePath = storagePath.replace(/^avatars\//, "");
    } else if (storagePath.includes("/avatars/")) {
      storagePath = storagePath.split("/avatars/")[1].split("?")[0];
    } else if (storagePath.includes("/compliance-private/")) {
      storagePath = storagePath.split("/compliance-private/")[1].split("?")[0];
    }

    const { data: publicData } = supabaseAdmin.storage
      .from("avatars")
      .getPublicUrl(storagePath);
    if (publicData?.publicUrl) {
      return publicData.publicUrl;
    }
  }

  // 3. Search 'avatars' bucket under admin/${email}
  if (email) {
    try {
      const folderPath = `admin/${email}`;
      const { data: files } = await supabaseAdmin.storage
        .from("avatars")
        .list(folderPath, { limit: 10, sortBy: { column: "created_at", order: "desc" } });

      if (files && files.length > 0) {
        const latestFile = files[0];
        const filePath = `${folderPath}/${latestFile.name}`;
        const { data: publicData } = supabaseAdmin.storage
          .from("avatars")
          .getPublicUrl(filePath);

        if (publicData?.publicUrl) {
          return publicData.publicUrl;
        }
      }
    } catch {}
  }

  // 4. Search 'avatars' bucket under admin/${userId}
  if (userId) {
    try {
      const folderPath = `admin/${userId}`;
      const { data: files } = await supabaseAdmin.storage
        .from("avatars")
        .list(folderPath, { limit: 10, sortBy: { column: "created_at", order: "desc" } });

      if (files && files.length > 0) {
        const latestFile = files[0];
        const filePath = `${folderPath}/${latestFile.name}`;
        const { data: publicData } = supabaseAdmin.storage
          .from("avatars")
          .getPublicUrl(filePath);

        if (publicData?.publicUrl) {
          return publicData.publicUrl;
        }
      }
    } catch {}
  }

  // 5. Legacy fallback: Search compliance-private bucket under admin-profile-images/${email}
  if (email) {
    try {
      const legacyFolderPath = `admin-profile-images/${email}`;
      const { data: legacyFiles } = await supabaseAdmin.storage
        .from("compliance-private")
        .list(legacyFolderPath, { limit: 10, sortBy: { column: "created_at", order: "desc" } });

      if (legacyFiles && legacyFiles.length > 0) {
        const latestFile = legacyFiles[0];
        const filePath = `${legacyFolderPath}/${latestFile.name}`;
        const { data, error } = await supabaseAdmin.storage
          .from("compliance-private")
          .createSignedUrl(filePath, 60 * 60 * 24);

        if (!error && data?.signedUrl) {
          return data.signedUrl;
        }
      }
    } catch {}
  }

  return null;
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

    const supabaseAdmin = getServiceRoleClient();
    const metadata = user.user_metadata || {};

    let fullName =
      metadata.full_name ||
      metadata.name ||
      (metadata.first_name
        ? `${metadata.first_name} ${metadata.last_name || ""}`.trim()
        : null) ||
      user.email?.split("@")[0] ||
      "Admin User";
    let email = user.email || "";

    // 1. Supplementary check from profiles table
    try {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("full_name, email")
        .or(`user_id.eq.${user.id},id.eq.${user.id}`)
        .maybeSingle();

      if (profile?.full_name) fullName = profile.full_name;
      if (profile?.email) email = profile.email;
    } catch {}

    const rawAvatarUrl =
      metadata.avatar_url || metadata.picture || null;

    const resolvedAvatarUrl = await resolveAvatarUrl(
      supabaseAdmin,
      email,
      user.id,
      rawAvatarUrl
    );

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
      email,
      full_name: fullName,
      avatar_url: resolvedAvatarUrl,
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
