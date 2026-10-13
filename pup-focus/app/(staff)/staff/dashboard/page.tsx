import { redirect } from "next/navigation";
import { AdminFacultyDashboard } from "@/features/faculty-management/components/admin-faculty-dashboard";
import { ROLE } from "@/config/roles";
import { getCurrentUser } from "@/lib/auth/session";

export default async function StaffDashboardPage(props: {
  searchParams?: Promise<{ tab?: string; section?: string }>;
}) {
  const user = await getCurrentUser();

  if (!user || (user.role !== ROLE.STAFF && user.role !== ROLE.ADMIN && user.role !== "super_admin")) {
    redirect("/");
  }

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
