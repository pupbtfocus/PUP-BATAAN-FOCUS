import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { ROLE } from "@/config/roles";
import { getCurrentUser } from "@/lib/auth/session";
import { SuperAdminDashboard } from "@/features/admin-management/components/super-admin-dashboard";

export default async function SuperAdminDashboardPage() {
  const user = await getCurrentUser();

  if (!user || (user.role !== ROLE.SUPER_ADMIN && user.role !== ROLE.ADMIN)) {
    redirect("/");
  }

  return (
    <AppShell title="PUP Bataan FOCUS" nav={[]} fullBleed>
      <SuperAdminDashboard adminName={user?.fullName ?? null} />
    </AppShell>
  );
}
