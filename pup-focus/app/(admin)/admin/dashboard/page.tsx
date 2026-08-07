import { AdminFacultyDashboard } from "@/features/faculty-management/components/admin-faculty-dashboard";
import { getCurrentUser } from "@/lib/auth/session";

export default async function AdminDashboardPage() {
  const user = await getCurrentUser();

  return (
    <AdminFacultyDashboard
      adminName={user?.fullName ?? null}
      adminEmail={user?.email ?? null}
    />
  );
}
