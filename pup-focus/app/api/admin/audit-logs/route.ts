import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { ROLE } from "@/config/roles";
import { logger } from "@/lib/observability/logger";

const ACTION_CATEGORY_FILTERS: Record<string, string[]> = {
  uploads: ["submission.upload", "document.upload"],
  reviews: ["submission.approve", "submission.reject", "submission.review"],
  user_management: [
    "faculty.create",
    "faculty.update",
    "user.invite",
    "user.update",
    "user.activate",
    "user.deactivate",
    "user.delete",
  ],
  submission_windows: [
    "submission_window.update",
    "submission_window.close",
  ],
};

export async function GET(request: NextRequest) {
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

    const url = new URL(request.url);
    const search = url.searchParams.get("search")?.trim() ?? "";
    const actionCategory = url.searchParams.get("action")?.trim() ?? "";
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
    const limit = Math.min(
      100,
      Math.max(1, Number(url.searchParams.get("limit") ?? "20")),
    );
    const offset = (page - 1) * limit;

    const supabase = getServiceRoleClient();

    // Build base query for count
    let countQuery = supabase
      .from("audit_logs")
      .select("id", { count: "exact", head: true });

    // Build data query
    let dataQuery = supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply action category filter
    if (actionCategory && ACTION_CATEGORY_FILTERS[actionCategory]) {
      const actions = ACTION_CATEGORY_FILTERS[actionCategory];
      countQuery = countQuery.in("action", actions);
      dataQuery = dataQuery.in("action", actions);
    }

    // Apply search filter (ILIKE on action, entity_type)
    if (search) {
      const ilikePattern = `%${search}%`;
      const orFilter = `action.ilike.${ilikePattern},entity_type.ilike.${ilikePattern}`;
      countQuery = countQuery.or(orFilter);
      dataQuery = dataQuery.or(orFilter);
    }

    const [countResult, dataResult] = await Promise.all([
      countQuery,
      dataQuery,
    ]);

    if (countResult.error) {
      logger.error("audit_logs_count_failed", {
        error: countResult.error.message,
      });
      return NextResponse.json(
        { error: "Failed to count audit logs" },
        { status: 500 },
      );
    }

    if (dataResult.error) {
      logger.error("audit_logs_fetch_failed", {
        error: dataResult.error.message,
      });
      return NextResponse.json(
        { error: "Failed to fetch audit logs" },
        { status: 500 },
      );
    }

    const total = countResult.count ?? 0;
    const totalPages = Math.ceil(total / limit);

    // Try to resolve actor names from profiles
    const actorIds = [
      ...new Set(
        (dataResult.data ?? [])
          .map((log: any) => log.actor_id as string | null)
          .filter(Boolean),
      ),
    ];

    let actorMap: Record<string, string> = {};
    if (actorIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", actorIds);

      if (profiles) {
        for (const profile of profiles) {
          if (profile.user_id && profile.full_name) {
            actorMap[profile.user_id] = profile.full_name;
          }
        }
      }

      // Also check app_users for names
      const { data: appUsers } = await supabase
        .from("app_users")
        .select("auth_user_id, full_name")
        .in("auth_user_id", actorIds);

      if (appUsers) {
        for (const appUser of appUsers) {
          if (
            appUser.auth_user_id &&
            appUser.full_name &&
            !actorMap[appUser.auth_user_id]
          ) {
            actorMap[appUser.auth_user_id] = appUser.full_name;
          }
        }
      }
    }

    const logs = (dataResult.data ?? []).map((log: any) => ({
      id: log.id,
      actorId: log.actor_id,
      actorName: actorMap[log.actor_id] ?? null,
      action: log.action,
      entityType: log.entity_type,
      entityId: log.entity_id,
      metadata: log.metadata ?? {},
      createdAt: log.created_at,
    }));

    return NextResponse.json({
      logs,
      total,
      page,
      limit,
      totalPages,
    });
  } catch (error) {
    logger.error("audit_logs_endpoint_error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
