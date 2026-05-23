import { AppShell } from "@/components/layout/app-shell";
import { FacultySubmissionPanel } from "@/features/faculty-management/components/faculty-submission-panel";
import { getCurrentUser } from "@/lib/auth/session";

export default async function FacultyDashboardPage() {
  const user = await getCurrentUser();

  return (
    <AppShell title="PUP Bataan FOCUS" nav={[]} fullBleed>
      <FacultySubmissionPanel facultyName={user?.fullName ?? null} />
    </AppShell>
  );
}
