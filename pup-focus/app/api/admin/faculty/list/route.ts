import { NextResponse } from "next/server";
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

export async function GET() {
  try {
    const sessionClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();

    const requesterRole =
      (user?.user_metadata?.role as string | undefined) ??
      (user?.app_metadata?.role as string | undefined);

    if (
      !user ||
      (requesterRole !== ROLE.ADMIN && requesterRole !== ROLE.SUPER_ADMIN)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = getServiceRoleClient();

    const { data: appUsers, error: queryError } = await supabase
      .from("app_users")
      .select(
        `
        id,
        is_active,
        created_at,
        profiles(id, full_name, email)
      `,
      )
      .eq("role", "faculty")
      .limit(100);

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
            fullName: profile?.full_name || "Unknown",
            email: profile?.email || "Unknown",
            is_active: item.is_active ?? true,
            created_at: item.created_at || new Date().toISOString(),
            requirementStatus: buildInitialRequirementStatus(),
          };
        })
        .filter(
          (value: any, index: number, self: any[]) =>
            self.findIndex((v) => v.id === value.id) === index,
        )
        .sort((a: any, b: any) => a.fullName.localeCompare(b.fullName)) || [];

    return NextResponse.json({ faculty });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch faculty", details: String(error) },
      { status: 500 },
    );
  }
}
