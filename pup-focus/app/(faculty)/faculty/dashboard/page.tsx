import { AppShell } from "@/components/layout/app-shell";
import { FacultySubmissionPanel } from "@/features/faculty-management/components/faculty-submission-panel";
import { getCurrentUser } from "@/lib/auth/session";

export default async function FacultyDashboardPage() {
  const user = await getCurrentUser();

  return (
    <AppShell
      title="Faculty Dashboard"
      subtitle="Track curriculum-based compliance requirements and deadlines"
      nav={[
        { href: "/faculty/compliance", label: "Compliance" },
        { href: "/faculty/history", label: "History" },
      ]}
    >
      <FacultySubmissionPanel facultyName={user?.fullName ?? null} />
    </AppShell>
  );
}
