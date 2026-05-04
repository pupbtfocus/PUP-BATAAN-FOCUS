import { AppShell } from "@/components/layout/app-shell";
import { FacultySubmissionPanel } from "@/features/faculty-management/components/faculty-submission-panel";

export default function FacultyDashboardPage() {
  return (
    <AppShell
      title="Faculty Dashboard"
      subtitle="Track curriculum-based compliance requirements and deadlines"
      nav={[
        { href: "/faculty/compliance", label: "Compliance" },
        { href: "/faculty/history", label: "History" },
      ]}
    >
      <FacultySubmissionPanel />
    </AppShell>
  );
}
