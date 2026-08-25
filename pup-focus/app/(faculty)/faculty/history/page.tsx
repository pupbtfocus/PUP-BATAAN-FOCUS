import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { FacultySubmissionPanel } from "@/features/faculty-management/components/faculty-submission-panel";
import { getCurrentUser } from "@/lib/auth/session";
import { getFacultyInitialData } from "@/features/submissions/services/faculty-data.service";
import { SubmissionHistorySkeleton } from "@/features/submissions/components/submission-skeletons";

export default async function FacultyHistoryPage() {
  const user = await getCurrentUser();
  const initialData = user ? await getFacultyInitialData(user.id) : null;

  return (
    <AppShell title="Validation History" nav={[]} fullBleed>
      <Suspense
        fallback={
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 py-6 space-y-4">
            <SubmissionHistorySkeleton count={6} />
          </div>
        }
      >
        <FacultySubmissionPanel
          facultyName={user?.fullName ?? null}
          facultyEmail={user?.email ?? null}
          initialData={initialData}
          initialView="history"
        />
      </Suspense>
    </AppShell>
  );
}
