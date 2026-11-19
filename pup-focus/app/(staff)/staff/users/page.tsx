import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { FacultySubmissionPanel } from "@/features/faculty-management/components/faculty-submission-panel";
import { getCurrentUser } from "@/lib/auth/session";
import { enforceServerMfaIfEnrolled } from "@/lib/auth/mfa-guard";

export default async function AdminUsersPage() {
  await enforceServerMfaIfEnrolled();
  const user = await getCurrentUser();

  return (
    <AppShell
      title="User Management"
      nav={[{ href: "/admin/dashboard", label: "Dashboard" }]}
      fullBleed
    >
      <Suspense fallback={null}>
        <FacultySubmissionPanel facultyName={user?.fullName ?? null} />
      </Suspense>
    </AppShell>
  );
}
