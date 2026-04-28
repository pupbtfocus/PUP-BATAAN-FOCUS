import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { ROLE } from "@/config/roles";
import { getCurrentUser } from "@/lib/auth/session";
import { SuperAdminDashboard } from "@/features/admin-management/components/super-admin-dashboard";

export default async function SuperAdminDashboardPage() {
  const user = await getCurrentUser();

  if (!user || user.role !== ROLE.SUPER_ADMIN) {
    redirect("/");
  }

  return (
    <AppShell
      title="Super Admin Dashboard"
      subtitle="Create and manage Admin accounts"
      nav={[{ href: "/super-admin/dashboard", label: "Admin Provisioning" }]}
    >
      <SuperAdminDashboard />
    </AppShell>
  );
}
