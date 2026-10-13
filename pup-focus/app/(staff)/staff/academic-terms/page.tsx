import { AppShell } from "@/components/layout/app-shell";
import { AdminAcademicTerms } from "@/features/admin-management/components/admin-academic-terms";
import { getCurrentUser } from "@/lib/auth/session";

export default async function AdminAcademicTermsPage() {
  const user = await getCurrentUser();

  return (
    <AppShell
      title="Academic Term Management"
      nav={[{ href: "/admin/dashboard", label: "Dashboard" }]}
    >
      <AdminAcademicTerms adminName={user?.fullName ?? null} />
    </AppShell>
  );
}
