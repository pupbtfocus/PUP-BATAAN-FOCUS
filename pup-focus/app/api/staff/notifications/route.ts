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
import { FACULTY_PROFILE_IMAGE_BUCKET } from "@/lib/faculty-profile";

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

    if (user && requesterRole !== ROLE.STAFF && requesterRole !== ROLE.ADMIN && requesterRole !== ROLE.SUPER_ADMIN && requesterRole !== "staff") {
      const { data: userRoleRow } = await supabase
        .from("user_roles")
        .select("roles!inner(code)")
        .or(`profile_id.eq.${user.id}`)
        .maybeSingle();

      const dbCode = (userRoleRow?.roles as any)?.code;
      if (dbCode === ROLE.STAFF || dbCode === ROLE.ADMIN || dbCode === ROLE.SUPER_ADMIN || dbCode === "staff") {
        requesterRole = dbCode;
      }
    }

    if (
      !user ||
      (requesterRole !== ROLE.STAFF && requesterRole !== ROLE.ADMIN && requesterRole !== ROLE.SUPER_ADMIN && requesterRole !== "staff")
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

    // 2. Fetch all faculty profiles and faculty records to enrich metadata
    let facultyProfiles: Array<{
      id: string;
      user_id?: string | null;
      full_name: string | null;
      email: string | null;
      avatar_url?: string | null;
      department?: string | null;
    }> = [];

    try {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, user_id, full_name, email, avatar_url");

      if (profiles && profiles.length > 0) {
        facultyProfiles = profiles.map((p) => ({
          id: p.id,
          user_id: p.user_id,
          full_name: p.full_name,
          email: p.email,
          avatar_url: p.avatar_url,
          department: null,
        }));
      }
    } catch (e) {
      console.warn("[ADMIN_NOTIFS] Profiles fetch warning:", e);
    }

    try {
      const { data: facultyRows } = await supabase
        .from("faculty")
        .select("id, profile_id, user_id, full_name, email, metadata");

      if (facultyRows) {
        for (const f of facultyRows) {
          const meta = (f.metadata || {}) as Record<string, any>;
          const existing = facultyProfiles.find(
            (p) =>
              p.id === f.profile_id ||
              p.id === f.id ||
              (f.email && p.email?.toLowerCase() === f.email.toLowerCase()),
          );
          if (existing) {
            existing.avatar_url =
              existing.avatar_url || meta.avatar_url || meta.profile_image_url || null;
            existing.department =
              existing.department || meta.department || meta.program || null;
          } else {
            facultyProfiles.push({
              id: f.profile_id || f.id,
              user_id: f.user_id,
              full_name: f.full_name,
              email: f.email,
              avatar_url: meta.avatar_url || meta.profile_image_url || null,
              department: meta.department || meta.program || null,
            });
          }
        }
      }
    } catch {}

    // Query auth.users to resolve avatars from user_metadata and storage buckets
    const authUserById = new Map<string, any>();
    const authUserByEmail = new Map<string, any>();
    try {
      const { data: authUsersResult } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      if (authUsersResult?.users) {
        for (const u of authUsersResult.users) {
          if (u.id) authUserById.set(u.id, u);
          if (u.email) authUserByEmail.set(u.email.toLowerCase(), u);
        }
      }
    } catch (e) {
      console.warn("[ADMIN_NOTIFS] listUsers warning:", e);
    }

    // Cache resolved avatar signed URLs to minimize storage calls
    const avatarCache = new Map<string, string>();
    async function resolveFacultyAvatar(
      userIdOrEmail?: string | null,
      fallbackAvatar?: string | null,
    ): Promise<string | null> {
      const cacheKey = (userIdOrEmail || fallbackAvatar || "").toLowerCase().trim();
      if (!cacheKey) return null;
      if (avatarCache.has(cacheKey)) return avatarCache.get(cacheKey) || null;

      const authUser = userIdOrEmail
        ? authUserById.get(userIdOrEmail) || authUserByEmail.get(userIdOrEmail.toLowerCase())
        : null;

      const meta = (authUser?.user_metadata || {}) as Record<string, any>;
      const rawPath = (meta.profile_image_path ||
        fallbackAvatar ||
        meta.avatar_url ||
        meta.picture ||
        meta.profile_image_url) as string | null;
      const bucket = (meta.profile_image_bucket || FACULTY_PROFILE_IMAGE_BUCKET) as string;

      if (rawPath && typeof rawPath === "string" && rawPath.trim()) {
        const trimmed = rawPath.trim();
        if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
          avatarCache.set(cacheKey, trimmed);
          return trimmed;
        }

        const cleanPath = trimmed
          .replace(/^profile-pictures\//, "")
          .replace(/^avatars\//, "")
          .replace(/^\/+/, "");

        try {
          const { data: signed } = await supabase.storage
            .from(bucket)
            .createSignedUrl(cleanPath, 60 * 60 * 24);
          if (signed?.signedUrl) {
            avatarCache.set(cacheKey, signed.signedUrl);
            return signed.signedUrl;
          }
        } catch {}

        try {
          const { data: signedAvatar } = await supabase.storage
            .from("avatars")
            .createSignedUrl(cleanPath, 60 * 60 * 24);
          if (signedAvatar?.signedUrl) {
            avatarCache.set(cacheKey, signedAvatar.signedUrl);
            return signedAvatar.signedUrl;
          }
        } catch {}

        // Public url fallback
        const { data: pub } = supabase.storage.from(bucket).getPublicUrl(cleanPath);
        if (pub?.publicUrl) {
          avatarCache.set(cacheKey, pub.publicUrl);
          return pub.publicUrl;
        }
      }

      // Check storage list under user id folder if authUser exists
      if (authUser?.id) {
        for (const testBucket of [FACULTY_PROFILE_IMAGE_BUCKET, "avatars"]) {
          try {
            const { data: files } = await supabase.storage.from(testBucket).list(authUser.id);
            if (files && files.length > 0) {
              const file = files.find((f) => !f.name.startsWith("."));
              if (file) {
                const { data: signed } = await supabase.storage
                  .from(testBucket)
                  .createSignedUrl(`${authUser.id}/${file.name}`, 60 * 60 * 24);
                if (signed?.signedUrl) {
                  avatarCache.set(cacheKey, signed.signedUrl);
                  return signed.signedUrl;
                }
              }
            }
          } catch {}
        }
      }

      return null;
    }

    // Enrich notifications with parsed details
    const notifications = await Promise.all(
      deduplicatedRows.map(async (row) => {
        let parsedPayload: Record<string, any> | null = null;
        let displayMessage = row.message || "";

        if (typeof row.message === "string" && row.message.trim().startsWith("{")) {
          try {
            const parsed = JSON.parse(row.message);
            if (parsed && typeof parsed === "object") {
              parsedPayload = parsed;
              const preset = parsed.requested_preset || "+3 Days";
              const reason = parsed.reason ? `: "${parsed.reason}"` : "";
              displayMessage = `Requested ${preset} extension${reason}`;
            }
          } catch {
            // Keep raw string on parsing error
          }
        }

        const mergedMetadata = {
          ...(parsedPayload || {}),
          ...(row.metadata || {}),
        };

        const fullText = `${row.title || ""} ${displayMessage}`;
        const reqCode =
          mergedMetadata.requirement_code ||
          mergedMetadata.requirementCode ||
          (Array.isArray(parsedPayload?.requirement_codes) && parsedPayload.requirement_codes.length > 0
            ? parsedPayload.requirement_codes[0]
            : null) ||
          extractRequirementCodeFromText(fullText);
        const reqLabel = reqCode ? REQUIREMENT_LABEL[reqCode as RequirementCode] : null;

        const extractedFacultyName =
          mergedMetadata.facultyName ||
          mergedMetadata.faculty_name ||
          parsedPayload?.faculty_name ||
          extractFacultyNameFromTitle(row.title || "");

        let facultyId =
          mergedMetadata.faculty_profile_id ||
          mergedMetadata.facultyId ||
          parsedPayload?.faculty_user_id ||
          null;

        const extractedFacultyEmail =
          mergedMetadata.faculty_email ||
          mergedMetadata.facultyEmail ||
          parsedPayload?.faculty_email ||
          null;

        // Match against faculty profiles
        const matchedFaculty = facultyProfiles.find(
          (f) =>
            (facultyId && (f.id === facultyId || f.user_id === facultyId)) ||
            (f.email &&
              extractedFacultyEmail &&
              f.email.toLowerCase() === extractedFacultyEmail.toLowerCase()) ||
            (f.full_name &&
              extractedFacultyName &&
              (f.full_name.toLowerCase().includes(extractedFacultyName.toLowerCase()) ||
                extractedFacultyName.toLowerCase().includes(f.full_name.toLowerCase()))),
        );

        if (matchedFaculty) {
          facultyId = matchedFaculty.id || facultyId;
        }

        const facultyEmail =
          matchedFaculty?.email || extractedFacultyEmail || null;

        // Resolve real avatar using auth user metadata and storage buckets
        const lookupKey = facultyId || matchedFaculty?.user_id || facultyEmail;
        const initialAvatar =
          matchedFaculty?.avatar_url ||
          mergedMetadata.avatar_url ||
          mergedMetadata.profile_image_url ||
          null;

        const facultyAvatarUrl =
          (await resolveFacultyAvatar(lookupKey, initialAvatar)) ||
          initialAvatar;

        const facultyDepartment =
          matchedFaculty?.department ||
          mergedMetadata.department ||
          mergedMetadata.program ||
          "Faculty of Instruction";

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
          Boolean(parsedPayload?.requested_preset) ||
          (row.title || "").toLowerCase().includes("extension");

        return {
          id: row.id,
          userId: row.user_id,
          title: row.title,
          message: displayMessage,
          type: row.type || (isExtension ? "EXTENSION_REQUEST" : "INFO"),
          isRead: Boolean(row.is_read),
          createdAt: row.created_at,
          isSubmission,
          isRevision,
          isExtensionRequest: isExtension,
          facultyName: extractedFacultyName,
          facultyId,
          facultyEmail,
          facultyAvatarUrl,
          facultyDepartment,
          requirementCode: reqCode,
          requirementLabel: reqLabel,
          metadata: {
            ...mergedMetadata,
            faculty_email: facultyEmail,
            avatar_url: facultyAvatarUrl,
            department: facultyDepartment,
          },
        };
      }),
    );

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

    if (user && requesterRole !== ROLE.STAFF && requesterRole !== ROLE.ADMIN && requesterRole !== ROLE.SUPER_ADMIN && requesterRole !== "staff") {
      const { data: userRoleRow } = await supabase
        .from("user_roles")
        .select("roles!inner(code)")
        .or(`profile_id.eq.${user.id}`)
        .maybeSingle();

      const dbCode = (userRoleRow?.roles as any)?.code;
      if (dbCode === ROLE.STAFF || dbCode === ROLE.ADMIN || dbCode === ROLE.SUPER_ADMIN || dbCode === "staff") {
        requesterRole = dbCode;
      }
    }

    if (
      !user ||
      (requesterRole !== ROLE.STAFF && requesterRole !== ROLE.ADMIN && requesterRole !== ROLE.SUPER_ADMIN && requesterRole !== "staff")
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

    if (user && requesterRole !== ROLE.STAFF && requesterRole !== ROLE.ADMIN && requesterRole !== ROLE.SUPER_ADMIN && requesterRole !== "staff") {
      const { data: userRoleRow } = await supabase
        .from("user_roles")
        .select("roles!inner(code)")
        .or(`profile_id.eq.${user.id}`)
        .maybeSingle();

      const dbCode = (userRoleRow?.roles as any)?.code;
      if (dbCode === ROLE.STAFF || dbCode === ROLE.ADMIN || dbCode === ROLE.SUPER_ADMIN || dbCode === "staff") {
        requesterRole = dbCode;
      }
    }

    if (
      !user ||
      (requesterRole !== ROLE.STAFF && requesterRole !== ROLE.ADMIN && requesterRole !== ROLE.SUPER_ADMIN && requesterRole !== "staff")
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
