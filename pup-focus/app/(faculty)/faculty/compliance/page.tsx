import { AppShell } from "@/components/layout/app-shell";
import { FacultyRequirementsModule } from "@/features/faculty-management/components/faculty-requirements-module";

export default function FacultyCompliancePage() {
  return (
    <AppShell
      title="Requirements"
      subtitle="Submit documents and track validation status in one place"
      nav={[{ href: "/faculty/dashboard", label: "Dashboard" }]}
    >
      <FacultyRequirementsModule />
    </AppShell>
  );
}
