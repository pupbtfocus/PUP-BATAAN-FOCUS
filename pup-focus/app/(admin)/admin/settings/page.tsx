import { AppShell } from "@/components/layout/app-shell";
import {
  AdminSettings,
  type AdminSettingsInitialData,
} from "@/features/admin-management/components/admin-settings";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

async function resolveAvatarUrl(
  supabaseAdmin: any,
  email?: string | null,
  userId?: string | null,
  rawAvatarUrl?: string | null
): Promise<string | null> {
  // 1. Full HTTP/HTTPS URL
  if (rawAvatarUrl && rawAvatarUrl.startsWith("http")) {
    return rawAvatarUrl;
  }

  // 2. Storage relative path
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

  // 3. Search avatars bucket under admin/${email}
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

  // 4. Search avatars bucket under admin/${userId}
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

  return null;
}

export default async function AdminSettingsPage() {
  const sessionClient = await createServerSupabaseClient();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();

  let initialData: AdminSettingsInitialData | null = null;

  if (user) {
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

    try {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("full_name, email")
        .eq("id", user.id)
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
    let sessionTimeout = "60";
    if (rawTimeout === "15" || rawTimeout === "15 mins") {
      sessionTimeout = "15";
    } else if (rawTimeout === "30" || rawTimeout === "30 mins") {
      sessionTimeout = "30";
    } else if (rawTimeout === "60" || rawTimeout === "1 hour") {
      sessionTimeout = "60";
    } else if (rawTimeout === "120" || rawTimeout === "2 hours") {
      sessionTimeout = "120";
    } else if (rawTimeout === "0" || rawTimeout === "Never") {
      sessionTimeout = "0";
    } else if (rawTimeout && !isNaN(Number(rawTimeout))) {
      sessionTimeout = String(rawTimeout);
    }

    initialData = {
      userId: user.id,
      fullName,
      email,
      avatarUrl: resolvedAvatarUrl,
      autoEmailReminders,
      newSubmissionAlerts,
      sessionTimeout,
    };
  }

  return (
    <AppShell
      title="Admin System Settings"
      nav={[{ href: "/admin/dashboard", label: "Dashboard" }]}
    >
      <div className="mx-auto max-w-5xl py-6">
        <AdminSettings
          adminName={initialData?.fullName ?? user?.email?.split("@")[0] ?? "Admin User"}
          adminEmail={initialData?.email ?? user?.email ?? ""}
          profileImageUrl={initialData?.avatarUrl ?? null}
          initialData={initialData}
        />
      </div>
    </AppShell>
  );
}
