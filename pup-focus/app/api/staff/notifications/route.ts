export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { ROLE } from "@/config/roles";
import {
  DEFAULT_REQUIREMENTS,
  REQUIREMENT_LABEL,
  type RequirementCode,
} from "@/config/compliance";

const SUBMISSION_ALERT_TYPES = [
  "NEW_SUBMISSION",
  "SUBMISSION_CREATED",
  "FACULTY_SUBMITTED",
  "SUBMISSION_UPLOADED",
  "SUBMISSION_RESUBMITTED",
  "submission_uploaded",
  "new_submission",
  "submission_created",
  "faculty_submitted",
  "EXTENSION_REQUEST",
  "extension_request",
];

function extractRequirementCodeFromText(text: string): RequirementCode | null {
  const lower = text.toLowerCase();
  for (const code of DEFAULT_REQUIREMENTS) {
    const label = REQUIREMENT_LABEL[code]?.toLowerCase() || "";
    if (lower.includes(code.toLowerCase()) || (label && lower.includes(label))) {
      return code;
    }
  }
  return null;
}

function extractFacultyNameFromTitle(title: string): string | null {
  const match = title.match(/(?:from|by)\s+([A-Za-z\s.\-]+?)(?:\s*\(|$)/i);
  if (match && match[1]) {
    return match[1].trim();
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const sessionClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();

    let requesterRole =
      (user?.user_metadata?.role as string | undefined) ??
      (user?.app_metadata?.role as string | undefined);

    const supabase = getServiceRoleClient();

    if (user && requesterRole !== ROLE.ADMIN && requesterRole !== ROLE.SUPER_ADMIN) {
      const { data: userRoleRow } = await supabase
        .from("user_roles")
        .select("roles!inner(code)")
        .or(`profile_id.eq.${user.id}`)
        .maybeSingle();

      const dbCode = (userRoleRow?.roles as any)?.code;
      if (dbCode === ROLE.ADMIN || dbCode === ROLE.SUPER_ADMIN) {
        requesterRole = dbCode;
      }
    }

    if (
      !user ||
      (requesterRole !== ROLE.ADMIN && requesterRole !== ROLE.SUPER_ADMIN)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 1. Fetch notifications for this admin user OR general submission alerts
    const { data: rows, error } = await supabase
      .from("notifications")
      .select("*")
      .or(
        `user_id.eq.${user.id},type.in.(${SUBMISSION_ALERT_TYPES.map((t) => `"${t}"`).join(",")})`,
      )
      .order("created_at", { ascending: false })
      .limit(80);

    if (error) {
      console.error("[ADMIN_NOTIFS_GET_ERROR]", error);
      return NextResponse.json(
        { error: "Failed to fetch notifications", details: error.message },
        { status: 500 },
      );
    }

    // Deduplicate notifications so identical submission alerts sent to multiple reviewers only show once
    const seenKeys = new Set<string>();
    const deduplicatedRows: typeof rows = [];

    // Sort so user's own rows take precedence
    const sortedRows = [...(rows || [])].sort((a, b) => {
      if (a.user_id === user.id && b.user_id !== user.id) return -1;
      if (a.user_id !== user.id && b.user_id === user.id) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    for (const row of sortedRows) {
      const timeBucket = Math.floor(new Date(row.created_at).getTime() / 120000);
      const dedupeKey = `${row.title}|${row.message}|${timeBucket}`;
      if (!seenKeys.has(dedupeKey)) {
        seenKeys.add(dedupeKey);
        deduplicatedRows.push(row);
      }
    }

    // 2. Fetch all faculty profiles to enrich metadata
    const { data: facultyRole } = await supabase
      .from("roles")
      .select("id")
      .eq("code", "faculty")
      .maybeSingle();

    let facultyProfiles: Array<{
      id: string;
      full_name: string | null;
      email: string | null;
    }> = [];

    if (facultyRole?.id) {
      const { data: userRoles } = await supabase
        .from("user_roles")
        .select("profile_id")
        .eq("role_id", facultyRole.id);

      const profileIds = Array.from(
        new Set(
          (userRoles ?? [])
            .map((r) => r.profile_id)
            .filter((val): val is string => Boolean(val)),
        ),
      );

      if (profileIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", profileIds);
        facultyProfiles = profiles || [];
      }
    }

    // Enrich notifications with parsed details
    const notifications = deduplicatedRows.map((row) => {
      const fullText = `${row.title || ""} ${row.message || ""}`;
      const reqCode =
        row.metadata?.requirement_code ||
        row.metadata?.requirementCode ||
        extractRequirementCodeFromText(fullText);
      const reqLabel = reqCode ? REQUIREMENT_LABEL[reqCode as RequirementCode] : null;

      const extractedFacultyName =
        row.metadata?.facultyName ||
        row.metadata?.faculty_name ||
        extractFacultyNameFromTitle(row.title || "");

      let facultyId =
        row.metadata?.faculty_profile_id ||
        row.metadata?.facultyId ||
        null;

      // If facultyId is missing, attempt match by name against faculty profiles
      if (!facultyId && extractedFacultyName) {
        const matchedFaculty = facultyProfiles.find(
          (f) =>
            f.full_name &&
            (f.full_name.toLowerCase().includes(extractedFacultyName.toLowerCase()) ||
              extractedFacultyName.toLowerCase().includes(f.full_name.toLowerCase())),
        );
        if (matchedFaculty) {
          facultyId = matchedFaculty.id;
        }
      }

      const isSubmission =
        SUBMISSION_ALERT_TYPES.includes(row.type || "") ||
        (row.title || "").toLowerCase().includes("submission") ||
        (row.message || "").toLowerCase().includes("uploaded") ||
        (row.message || "").toLowerCase().includes("resubmitted");

      const isRevision =
        (row.title || "").toLowerCase().includes("resubmission") ||
        (row.message || "").toLowerCase().includes("resubmitted") ||
        (row.title || "").includes("v2") ||
        (row.title || "").includes("v3");

      const isExtension =
        row.type === "EXTENSION_REQUEST" ||
        row.type === "extension_request" ||
        (row.title || "").toLowerCase().includes("extension");

      return {
        id: row.id,
        userId: row.user_id,
        title: row.title,
        message: row.message,
        type: row.type || "INFO",
        isRead: Boolean(row.is_read),
        createdAt: row.created_at,
        isSubmission,
        isRevision,
        isExtensionRequest: isExtension,
        facultyName: extractedFacultyName,
        facultyId,
        requirementCode: reqCode,
        requirementLabel: reqLabel,
        metadata: row.metadata || null,
      };
    });

    const unreadCount = notifications.filter((n) => !n.isRead).length;

    return NextResponse.json({
      notifications,
      unreadCount,
    });
  } catch (error) {
    console.error("[ADMIN_NOTIFS_ROUTE_EXCEPTION]", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const sessionClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();

    let requesterRole =
      (user?.user_metadata?.role as string | undefined) ??
      (user?.app_metadata?.role as string | undefined);

    const supabase = getServiceRoleClient();

    if (user && requesterRole !== ROLE.ADMIN && requesterRole !== ROLE.SUPER_ADMIN) {
      const { data: userRoleRow } = await supabase
        .from("user_roles")
        .select("roles!inner(code)")
        .or(`profile_id.eq.${user.id}`)
        .maybeSingle();

      const dbCode = (userRoleRow?.roles as any)?.code;
      if (dbCode === ROLE.ADMIN || dbCode === ROLE.SUPER_ADMIN) {
        requesterRole = dbCode;
      }
    }

    if (
      !user ||
      (requesterRole !== ROLE.ADMIN && requesterRole !== ROLE.SUPER_ADMIN)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { notificationId, markAll } = body as {
      notificationId?: string;
      markAll?: boolean;
    };

    if (markAll) {
      // Mark all read for this user
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id);

      return NextResponse.json({ success: true, message: "All notifications marked as read" });
    }

    if (notificationId) {
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notificationId);

      return NextResponse.json({ success: true, message: "Notification marked as read" });
    }

    return NextResponse.json(
      { error: "Missing notificationId or markAll parameter" },
      { status: 400 },
    );
  } catch (error) {
    console.error("[ADMIN_NOTIFS_PATCH_EXCEPTION]", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
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

    let requesterRole =
      (user?.user_metadata?.role as string | undefined) ??
      (user?.app_metadata?.role as string | undefined);

    const supabase = getServiceRoleClient();

    if (user && requesterRole !== ROLE.ADMIN && requesterRole !== ROLE.SUPER_ADMIN) {
      const { data: userRoleRow } = await supabase
        .from("user_roles")
        .select("roles!inner(code)")
        .or(`profile_id.eq.${user.id}`)
        .maybeSingle();

      const dbCode = (userRoleRow?.roles as any)?.code;
      if (dbCode === ROLE.ADMIN || dbCode === ROLE.SUPER_ADMIN) {
        requesterRole = dbCode;
      }
    }

    if (
      !user ||
      (requesterRole !== ROLE.ADMIN && requesterRole !== ROLE.SUPER_ADMIN)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Remove notifications for this user
    await supabase
      .from("notifications")
      .delete()
      .eq("user_id", user.id);

    return NextResponse.json({ success: true, message: "All notifications cleared" });
  } catch (error) {
    console.error("[ADMIN_NOTIFS_DELETE_EXCEPTION]", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 },
    );
  }
}
