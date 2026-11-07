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
import type { AuthUser } from "@/types/global";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

async function FacultyDashboardStream({
  user,
  initialView,
}: {
  user: AuthUser | null;
  initialView: PanelView;
}) {
  const initialData = user ? await getFacultyInitialData(user.id) : null;

  return (
    <FacultySubmissionPanel
      facultyName={user?.fullName ?? null}
      facultyEmail={user?.email ?? null}
      facultyAvatarUrl={initialData?.avatarUrl ?? null}
      initialFirstName={user?.firstName ?? null}
      initialMiddleName={user?.middleName ?? null}
      initialLastName={user?.lastName ?? null}
      initialData={initialData}
      initialView={initialView}
    />
  );
}

export default async function FacultyDashboardPage(props: PageProps) {
  const [user, searchParams] = await Promise.all([
    getCurrentUser(),
    props.searchParams ? props.searchParams : Promise.resolve({} as Record<string, string | string[] | undefined>),
  ]);
  const viewParam =
    typeof searchParams.view === "string" ? searchParams.view : undefined;
  const historyParam = searchParams.history === "true";

  let initialView: PanelView = "dashboard";
  if (
    viewParam &&
    (VALID_PANEL_VIEWS as readonly string[]).includes(viewParam)
  ) {
    initialView = viewParam as PanelView;
  } else if (
    viewParam === "history" ||
    (viewParam === "status" && historyParam) ||
    searchParams.highlight ||
    searchParams.requirement
  ) {
    initialView = "status";
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
        <FacultyDashboardStream user={user} initialView={initialView} />
      </Suspense>
    </AppShell>
  );
}
