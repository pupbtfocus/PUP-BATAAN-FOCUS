import { NextRequest, NextResponse } from "next/server";
import {
  ROLE,
  isAdminRoleToken,
  isOriginalAdmin,
  resolveTrustedUserRole,
} from "@/config/roles";
import { logger } from "@/lib/observability/logger";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { verifyMfaAal2IfEnrolled } from "@/lib/auth/admin-security";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isAdminRole(role?: string | null): boolean {
  return isAdminRoleToken(role);
}

async function authorizeAdmin() {
  const sessionClient = await createServerSupabaseClient();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();

  if (!user) return null;

  let requesterRole = resolveTrustedUserRole(user);

  const supabase = getServiceRoleClient();

  if (!isOriginalAdmin(user.email) && !isAdminRole(requesterRole)) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, user_roles(roles(code))")
      .eq("user_id", user.id)
      .maybeSingle();

    const userRoles = profile?.user_roles as
      | Array<{ roles: { code: string } | null }>
      | undefined;
    const dbRoleCode = userRoles?.[0]?.roles?.code;
    if (isAdminRole(dbRoleCode)) {
      requesterRole = dbRoleCode;
    }
  }

  if (!isAdminRole(requesterRole)) return null;

  const mfaCheck = await verifyMfaAal2IfEnrolled(sessionClient);
  if (!mfaCheck.ok) return null;

  return supabase;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await authorizeAdmin();
    if (!supabase) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(request.url);
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? "10")));

    const [{ count, error: countError }, { data, error: dataError }] =
      await Promise.all([
        supabase
          .from("cron_keepalive_logs")
          .select("id", { count: "exact", head: true }),
        supabase
          .from("cron_keepalive_logs")
          .select("id, job_name, status, executed_at")
          .order("executed_at", { ascending: false })
          .limit(limit),
      ]);

    const missingTable =
      countError?.code === "42P01" ||
      dataError?.code === "42P01" ||
      countError?.message?.includes("does not exist") ||
      dataError?.message?.includes("does not exist");

    if (missingTable) {
      return NextResponse.json({ logs: [], total: 0 });
    }

    if (countError || dataError) {
      logger.error("keepalive_logs_fetch_failed", {
        error: countError?.message ?? dataError?.message,
      });
      return NextResponse.json(
        { error: "Failed to load database keep-alive logs" },
        { status: 500 },
      );
    }

    const logs = (data ?? []).map((row) => ({
      id: row.id,
      jobName: row.job_name,
      status: row.status,
      executedAt: row.executed_at,
    }));

    return NextResponse.json({
      logs,
      total: count ?? logs.length,
    });
  } catch (error) {
    logger.error("keepalive_logs_endpoint_error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
