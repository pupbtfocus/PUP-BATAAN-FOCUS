import { NextRequest, NextResponse } from "next/server";
import { ROLE } from "@/config/roles";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isAdminRole(role: string | undefined) {
  return role === ROLE.ADMIN || role === ROLE.SUPER_ADMIN;
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

    if (!user || !isAdminRole(requesterRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Backup ID is required" }, { status: 400 });
    }

    const supabase = getServiceRoleClient();
    const { data: backupRecord, error } = await supabase
      .from("system_backups")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !backupRecord) {
      return NextResponse.json({ error: "Backup record not found" }, { status: 404 });
    }

    const snapshot =
      backupRecord.metadata?.snapshot || {
        version: "1.0",
        backup_name: backupRecord.backup_name,
        created_at: backupRecord.created_at,
        total_records: backupRecord.total_records,
        note: "System snapshot data",
      };

    const fileName = `${backupRecord.backup_name.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`;
    const jsonStr = JSON.stringify(snapshot, null, 2);

    return new NextResponse(jsonStr, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("GET /api/admin/backups/download error:", error);
    return NextResponse.json(
      { error: "Failed to download backup snapshot" },
      { status: 500 }
    );
  }
}
