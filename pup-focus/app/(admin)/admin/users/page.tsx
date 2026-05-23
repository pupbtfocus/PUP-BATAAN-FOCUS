import { AppShell } from "@/components/layout/app-shell";
import { FacultySubmissionPanel } from "@/features/faculty-management/components/faculty-submission-panel";
import { getCurrentUser } from "@/lib/auth/session";

export default async function AdminUsersPage() {
  const user = await getCurrentUser();

  return (
    <AppShell
      title="User Management"
      nav={[{ href: "/admin/dashboard", label: "Dashboard" }]}
      fullBleed
    >
      <FacultySubmissionPanel facultyName={user?.fullName ?? null} />
    </AppShell>
  );
}
