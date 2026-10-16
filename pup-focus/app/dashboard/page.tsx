import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { ROUTE_BY_ROLE } from "@/config/routes";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/");
  }

  const destination = ROUTE_BY_ROLE[user.role] || "/";
  redirect(destination);
}
