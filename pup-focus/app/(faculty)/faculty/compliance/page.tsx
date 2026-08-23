import { AppShell } from "@/components/layout/app-shell";
import { FacultyRequirementsModule } from "@/features/faculty-management/components/faculty-requirements-module";
import { getCurrentUser } from "@/lib/auth/session";
import { getFacultyInitialData } from "@/features/submissions/services/faculty-data.service";

export default async function FacultyCompliancePage() {
  const user = await getCurrentUser();
  const initialData = user ? await getFacultyInitialData(user.id) : null;

  return (
    <AppShell
      title="Requirements Compliance"
      subtitle="Submit documents and track validation status in one place"
      nav={[
        { href: "/faculty/dashboard", label: "Dashboard" },
        { href: "/faculty/history", label: "History" },
      ]}
    >
      <FacultyRequirementsModule
        initialStatuses={initialData?.requirementStatuses}
        initialTemplates={initialData?.requirementTemplates}
        initialCounts={initialData?.counts}
        initialSubmissionWindow={initialData?.submissionWindow}
      />
    </AppShell>
  );
}
