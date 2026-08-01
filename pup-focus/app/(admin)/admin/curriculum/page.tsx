import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { FacultySubmissionPanel } from "@/features/faculty-management/components/faculty-submission-panel";
import { getCurrentUser } from "@/lib/auth/session";

export default async function AdminCurriculumPage() {
  const user = await getCurrentUser();

  return (
    <AppShell
      title="Curriculum Management"
      nav={[{ href: "/admin/dashboard", label: "Dashboard" }]}
      fullBleed
    >
      <Suspense
        fallback={
          <div className="flex h-full w-full items-center justify-center p-8 text-amber-400">
            <div className="flex items-center gap-3">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
              <span className="text-sm font-medium">Loading curriculum management...</span>
            </div>
          </div>
        }
      >
        <FacultySubmissionPanel facultyName={user?.fullName ?? null} />
      </Suspense>
    </AppShell>
  );
}
