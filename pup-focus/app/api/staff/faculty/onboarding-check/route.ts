export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { resolveOnboardingContext } from "@/features/submissions/services/submission-window.service";

function isAuthorizedAdmin(role?: string): boolean {
  if (!role) return false;
  const r = role.toLowerCase().trim().replace(/[-_\s]/g, "");
  return (
    r === "admin" ||
    r === "superadmin" ||
    r === "dean" ||
    r === "departmenthead" ||
    r === "chairperson" ||
    r === "coordinator"
  );
}

export async function GET() {
  try {
    const sessionClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const requesterRole =
      (user.user_metadata?.role as string | undefined) ??
      (user.app_metadata?.role as string | undefined);

    let hasAccess = isAuthorizedAdmin(requesterRole);
    const supabase = getServiceRoleClient();

    if (!hasAccess) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("id, role")
        .eq("user_id", user.id)
        .maybeSingle();
      if (prof?.role && isAuthorizedAdmin(prof.role)) {
        hasAccess = true;
      } else if (prof?.id) {
        const { data: ur } = await supabase
          .from("user_roles")
          .select("roles(code)")
          .eq("profile_id", prof.id);
        if (ur && ur.length > 0) {
          hasAccess = ur.some((r: any) => {
            const code = Array.isArray(r.roles) ? r.roles[0]?.code : r.roles?.code;
            return isAuthorizedAdmin(code);
          });
        }
      }
    }

    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const ctx = await resolveOnboardingContext(supabase);
    const {
      term,
      windowState,
      deadline,
      templates,
      isWindowActive,
      hasAnyScheduleHistory,
    } = ctx;

    // Requirement templates are always returned so the UI knows exactly what
    // will be assigned, whether submissions are open or closed.
    const schedules = templates.map((t) => ({
      code: t.code,
      title: t.title,
      description: t.description || null,
      globalDeadlineIso: deadline.iso,
      globalDeadlineDate: deadline.endDate,
      globalDeadlineTime: deadline.endTime,
    }));

    return NextResponse.json({
      // Only a closed window requires choosing an onboarding option.
      hasPastDeadlines: !isWindowActive,
      hasPastSchedule: !isWindowActive && hasAnyScheduleHistory,
      hasAnyScheduleHistory,
      isWindowActive,
      isWindowOpen: windowState.isOpen,
      windowStatus: windowState.status,
      activeTerm: {
        academicYear: term.academicYear,
        semester: term.semester,
      },
      globalDeadline: {
        endDate: deadline.endDate,
        endTime: deadline.endTime,
        iso: deadline.iso,
      },
      schedules,
      templates,
      requirements: schedules,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to check onboarding schedule status", details: String(error) },
      { status: 500 },
    );
  }
}
