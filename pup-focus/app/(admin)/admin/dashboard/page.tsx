import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { ROLE } from "@/config/roles";
import { getCurrentUser } from "@/lib/auth/session";
import { AdminDashboard } from "@/features/admin-management/components/admin-dashboard";

export default async function AdminDashboardPage(props: {
  searchParams?: Promise<{ tab?: string; section?: string }>;
}) {
  const user = await getCurrentUser();

  if (!user || (user.role !== ROLE.ADMIN && user.role !== "super_admin")) {
    redirect("/");
  }

  const searchParams = props.searchParams ? await props.searchParams : undefined;
  const initialTab = searchParams?.tab || searchParams?.section || null;

  return (
    <AppShell title="PUP FOCUS" nav={[]} fullBleed role="admin">
      <AdminDashboard
        adminName={user?.fullName ?? null}
        adminEmail={user?.email ?? null}
        initialTab={initialTab}
      />
    </AppShell>
  );
}
