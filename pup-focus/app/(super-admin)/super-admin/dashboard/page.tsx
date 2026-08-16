import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { ROLE } from "@/config/roles";
import { getCurrentUser } from "@/lib/auth/session";
import { SuperAdminDashboard } from "@/features/admin-management/components/super-admin-dashboard";

export default async function SuperAdminDashboardPage(props: {
  searchParams?: Promise<{ tab?: string; section?: string }>;
}) {
  const user = await getCurrentUser();

  if (!user || (user.role !== ROLE.SUPER_ADMIN && user.role !== ROLE.ADMIN)) {
    redirect("/");
  }

  const searchParams = props.searchParams ? await props.searchParams : undefined;
  const initialTab = searchParams?.tab || searchParams?.section || null;

  return (
    <AppShell title="PUP FOCUS" nav={[]} fullBleed>
      <SuperAdminDashboard
        adminName={user?.fullName ?? null}
        adminEmail={user?.email ?? null}
        initialTab={initialTab}
      />
    </AppShell>
  );
}
