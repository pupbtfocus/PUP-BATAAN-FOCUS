import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import {
  FacultySubmissionPanel,
  type PanelView,
} from "@/features/faculty-management/components/faculty-submission-panel";
import { getCurrentUser } from "@/lib/auth/session";
import { getFacultyInitialData } from "@/features/submissions/services/faculty-data.service";
import {
  DashboardMetricsSkeleton,
  ComplianceListSkeleton,
} from "@/features/submissions/components/submission-skeletons";

type PageProps = {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

const VALID_PANEL_VIEWS = [
  "dashboard",
  "submit",
  "history",
  "status",
  "settings",
] as const;

export default async function FacultyDashboardPage(props: PageProps) {
  const user = await getCurrentUser();
  const initialData = user ? await getFacultyInitialData(user.id) : null;
  const searchParams = props.searchParams ? await props.searchParams : {};
  const viewParam =
    typeof searchParams.view === "string" ? searchParams.view : undefined;
  const historyParam = searchParams.history === "true";

  let initialView: PanelView = "dashboard";
  if (
    viewParam === "history" ||
    (viewParam === "status" && historyParam) ||
    searchParams.highlight ||
    searchParams.requirement
  ) {
    initialView = "status";
  } else if (
    viewParam &&
    (VALID_PANEL_VIEWS as readonly string[]).includes(viewParam)
  ) {
    initialView = viewParam as PanelView;
  }

  return (
    <AppShell title="PUP FOCUS" nav={[]} fullBleed>
      <Suspense
        fallback={
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 py-6 space-y-6">
            <DashboardMetricsSkeleton />
            <ComplianceListSkeleton count={6} />
          </div>
        }
      >
        <FacultySubmissionPanel
          facultyName={user?.fullName ?? null}
          facultyEmail={user?.email ?? null}
          initialData={initialData}
          initialView={initialView}
        />
      </Suspense>
    </AppShell>
  );
}
