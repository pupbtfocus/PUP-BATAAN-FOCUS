import { AppShell } from "@/components/layout/app-shell";
import { AdminFacultyDashboard } from "@/features/faculty-management/components/admin-faculty-dashboard";

export default function AdminDashboardPage() {
  return (
    <AppShell
      title="Admin Dashboard"
      subtitle="Manage faculty accounts, program assignments, and curriculum-based requirement validation"
      nav={[
        { href: "/admin/users", label: "Users" },
        { href: "/admin/curriculum", label: "Curriculum" },
      ]}
    >
      <AdminFacultyDashboard />
    </AppShell>
  );
}
