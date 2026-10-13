import { AdminFacultyDashboard } from "@/features/faculty-management/components/admin-faculty-dashboard";
import { getCurrentUser } from "@/lib/auth/session";

export default async function AdminDashboardPage(props: {
  searchParams?: Promise<{ tab?: string; section?: string }>;
}) {
  const user = await getCurrentUser();
  const searchParams = props.searchParams ? await props.searchParams : undefined;
  const initialTab = searchParams?.tab || searchParams?.section || null;

  return (
    <AdminFacultyDashboard
      adminName={user?.fullName ?? null}
      adminEmail={user?.email ?? null}
      initialTab={initialTab}
    />
  );
}
