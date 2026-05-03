import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { DEFAULT_REQUIREMENTS } from "@/config/compliance";
import { ROLE } from "@/config/roles";

type RequirementStatus = "not_submitted" | "uploaded" | "validated";

function buildInitialRequirementStatus() {
  return DEFAULT_REQUIREMENTS.reduce(
    (acc, requirementCode) => {
      acc[requirementCode] = "not_submitted";
      return acc;
    },
    {} as Record<(typeof DEFAULT_REQUIREMENTS)[number], RequirementStatus>,
  );
}

export async function GET(request: NextRequest) {
  try {
    // detect debug mode and allow unauthenticated debug only on localhost
    const url = new URL(request.url);
    const debugMode = url.searchParams.get("debug") === "1";
    const host = url.hostname;
    const allowDebugUnauth =
      debugMode &&
      (host === "localhost" || host === "127.0.0.1" || host === "::1");

    let user: any = null;
    let requesterRole: string | undefined = undefined;

    if (!allowDebugUnauth) {
      const sessionClient = await createServerSupabaseClient();
      const {
        data: { user: sessionUser },
      } = await sessionClient.auth.getUser();

      user = sessionUser;
      requesterRole =
        (user?.user_metadata?.role as string | undefined) ??
        (user?.app_metadata?.role as string | undefined);

      if (
        !user ||
        (requesterRole !== ROLE.ADMIN && requesterRole !== ROLE.SUPER_ADMIN)
      ) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const supabase = getServiceRoleClient();

    const { data: appUsers, error: queryError } = await supabase
      .from("app_users")
      .select(
        `
        id,
        auth_user_id,
        profile_id,
        metadata,
        created_at,
        profiles(id, full_name, email)
      `,
      )
      .eq("role", "faculty")
      .limit(100);

    if (debugMode) {
      const { count: appUsersCount } = await supabase
        .from("app_users")
        .select("id", { count: "estimated", head: false })
        .eq("role", "faculty");

      const { data: roles } = await supabase
        .from("roles")
        .select("id,code")
        .eq("code", "faculty")
        .limit(1);
      const roleId = roles?.[0]?.id ?? null;

      const { data: userRoles } = roleId
        ? await supabase
            .from("user_roles")
            .select("profile_id")
            .eq("role_id", roleId)
            .limit(50)
        : { data: [] };

      return NextResponse.json({
        debug: true,
        appUsersCount: appUsersCount ?? null,
        appUsersSample: appUsers ?? [],
        userRolesSample: userRoles ?? [],
        queryError: queryError ? queryError.message : null,
      });
    }

    if (queryError) {
      return NextResponse.json(
        { error: "Failed to fetch faculty", details: queryError.message },
        { status: 500 },
      );
    }

    const faculty =
      appUsers
        ?.map((item: any) => {
          const profile = Array.isArray(item.profiles)
            ? item.profiles[0]
            : item.profiles;

          return {
            id: item.id,
            user_id: item.auth_user_id,
            fullName: profile?.full_name || item.full_name || "Unknown",
            email: profile?.email || item.email || "Unknown",
            is_active: item.metadata?.is_active ?? true,
            created_at: item.created_at || new Date().toISOString(),
            requirementStatus: buildInitialRequirementStatus(),
          };
        })
        .filter(
          (value: any, index: number, self: any[]) =>
            self.findIndex((v) => v.id === value.id) === index,
        )
        .sort((a: any, b: any) => a.fullName.localeCompare(b.fullName)) || [];

    // If no app_users rows found, try to locate faculty via user_roles -> profiles
    if ((!faculty || faculty.length === 0) && !queryError) {
      const { data: roleRow } = await supabase
        .from("roles")
        .select("id")
        .eq("code", "faculty")
        .single();

      if (roleRow?.id) {
        const { data: userRoleRows } = await supabase
          .from("user_roles")
          .select("profile_id")
          .eq("role_id", roleRow.id)
          .limit(200);

        const profileIds = (userRoleRows || []).map((r: any) => r.profile_id);

        if (profileIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, user_id, full_name, email")
            .in("id", profileIds)
            .limit(200);

          const appUserMap: Record<string, any> = {};
          (appUsers || []).forEach((au: any) => {
            if (au.auth_user_id) appUserMap[au.auth_user_id] = au;
          });

          const alt = (profiles || []).map((p: any) => ({
            id: p.id,
            user_id: p.user_id,
            fullName: p.full_name || "Unknown",
            email: p.email || "Unknown",
            is_active: appUserMap[p.user_id]?.is_active ?? true,
            created_at:
              appUserMap[p.user_id]?.created_at || new Date().toISOString(),
            requirementStatus: buildInitialRequirementStatus(),
          }));

          // merge
          faculty.push(...alt);
        }
      }
    }

    return NextResponse.json({ faculty });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch faculty", details: String(error) },
      { status: 500 },
    );
  }
}
