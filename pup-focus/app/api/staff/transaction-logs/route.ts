import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { ROLE } from "@/config/roles";
import { logger } from "@/lib/observability/logger";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ACTION_CATEGORY_FILTERS: Record<string, string[]> = {
  auth: ["auth.login", "auth.logout", "user.password_reset"],
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
    "submission_window.extend",
    "submission_window.reminder",
  ],
  academic_terms: [
    "academic_term.create",
    "academic_term.summer_create",
    "academic_term.set_current",
    "academic_term.delete",
  ],
  templates: [
    "template.create",
    "template.update",
    "template.delete",
  ],
  classes: [
    "class.create",
    "class.update",
    "class.delete",
    "program.assign",
  ],
  backup: [
    "backup.create",
    "backup.download",
    "backup.export_zip",
    "backup.delete",
  ],
};

async function executeTableQuery(
  supabase: any,
  tableName: "transaction_logs" | "audit_logs",
  offset: number,
  limit: number,
  actionCategory: string,
  search: string,
) {
  let countQuery = supabase
    .from(tableName)
    .select("id", { count: "exact", head: true });

  let dataQuery = supabase
    .from(tableName)
    .select("*")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (actionCategory && ACTION_CATEGORY_FILTERS[actionCategory]) {
    const actions = ACTION_CATEGORY_FILTERS[actionCategory];
    countQuery = countQuery.in("action", actions);
    dataQuery = dataQuery.in("action", actions);
  }

  if (search) {
    const ilikePattern = `%${search}%`;
    const orFilter = `action.ilike.${ilikePattern},entity_type.ilike.${ilikePattern}`;
    countQuery = countQuery.or(orFilter);
    dataQuery = dataQuery.or(orFilter);
  }

  return Promise.all([countQuery, dataQuery]);
}

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
      (requesterRole !== ROLE.STAFF &&
        requesterRole !== ROLE.ADMIN &&
        requesterRole !== ROLE.SUPER_ADMIN &&
        requesterRole !== "staff")
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

    let [countResult, dataResult] = await executeTableQuery(
      supabase,
      "transaction_logs",
      offset,
      limit,
      actionCategory,
      search,
    );

    // If transaction_logs does not exist, seamlessly fallback to audit_logs
    if (
      (countResult.error && (countResult.error.code === "42P01" || countResult.error.message.includes("does not exist"))) ||
      (dataResult.error && (dataResult.error.code === "42P01" || dataResult.error.message.includes("does not exist")))
    ) {
      [countResult, dataResult] = await executeTableQuery(
        supabase,
        "audit_logs",
        offset,
        limit,
        actionCategory,
        search,
      );
    }

    if (countResult.error) {
      logger.error("transaction_logs_count_failed", {
        error: countResult.error.message,
      });
      return NextResponse.json(
        { error: "Failed to count transaction logs" },
        { status: 500 },
      );
    }

    if (dataResult.error) {
      logger.error("transaction_logs_fetch_failed", {
        error: dataResult.error.message,
      });
      return NextResponse.json(
        { error: "Failed to fetch transaction logs" },
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
        .select("id, user_id, full_name");

      if (profiles) {
        for (const profile of profiles) {
          if (profile.user_id && profile.full_name && actorIds.includes(profile.user_id)) {
            actorMap[profile.user_id] = profile.full_name;
          }
          if (profile.id && profile.full_name && actorIds.includes(profile.id)) {
            actorMap[profile.id] = profile.full_name;
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
    logger.error("transaction_logs_endpoint_error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
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
      (requesterRole !== ROLE.STAFF &&
        requesterRole !== ROLE.ADMIN &&
        requesterRole !== ROLE.SUPER_ADMIN &&
        requesterRole !== "staff")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(request.url);
    const singleId = url.searchParams.get("id")?.trim();
    const bulkIds = url.searchParams.get("ids")?.trim();

    const supabase = getServiceRoleClient();

    const deleteFromTable = async (tableName: "transaction_logs" | "audit_logs", idList: string[]) => {
      return supabase.from(tableName).delete().in("id", idList);
    };

    const targetIds = singleId ? [singleId] : bulkIds ? bulkIds.split(",").map((id) => id.trim()).filter(Boolean) : [];

    if (targetIds.length === 0) {
      return NextResponse.json(
        { error: "Provide ?id= or ?ids= parameter" },
        { status: 400 },
      );
    }

    let { error } = await deleteFromTable("transaction_logs", targetIds);

    if (error && (error.code === "42P01" || error.message.includes("does not exist"))) {
      const fallback = await deleteFromTable("audit_logs", targetIds);
      error = fallback.error;
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, deleted: targetIds.length });
  } catch (error) {
    logger.error("transaction_logs_delete_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
