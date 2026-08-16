import { AppShell } from "@/components/layout/app-shell";
import { AdminSettings } from "@/features/admin-management/components/admin-settings";
import { getCurrentUser } from "@/lib/auth/session";

export default async function AdminSettingsPage() {
  const user = await getCurrentUser();
  const rawAvatar =
    (user as any)?.user_metadata?.avatar_url ||
    (user as any)?.user_metadata?.picture ||
    null;

  return (
    <AppShell
      title="Admin System Settings"
      nav={[{ href: "/admin/dashboard", label: "Dashboard" }]}
    >
      <div className="mx-auto max-w-5xl py-6">
        <AdminSettings
          adminName={user?.fullName ?? null}
          adminEmail={user?.email ?? null}
          profileImageUrl={rawAvatar}
        />
      </div>
    </AppShell>
  );
}
