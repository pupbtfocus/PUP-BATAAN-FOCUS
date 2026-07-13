import { AppShell } from "@/components/layout/app-shell";
import { AdminFacultyDashboard } from "@/features/faculty-management/components/admin-faculty-dashboard";
import { getCurrentUser } from "@/lib/auth/session";

export default async function AdminDashboardPage() {
  const user = await getCurrentUser();

  return (
    <AppShell title="Faculty Management" nav={[]} fullBleed>
      <AdminFacultyDashboard adminName={user?.fullName ?? null} />
    </AppShell>
  );
}
