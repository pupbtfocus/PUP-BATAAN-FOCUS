export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { ROLE } from "@/config/roles";

function isApproverOrAdmin(role?: string): boolean {
  const r = (role || "").toLowerCase().trim();
  return (
    r === ROLE.ADMIN ||
    r === ROLE.SUPER_ADMIN ||
    r === "dean" ||
    r === "department_head" ||
    r === "approver"
  );
}

export async function GET(request: NextRequest) {
  try {
    const sessionClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const requestId = searchParams.get("requestId");
    const download = searchParams.get("download") === "true";

    if (!requestId) {
      return NextResponse.json(
        { error: "Missing requestId parameter" },
        { status: 400 },
      );
    }

    const supabase = getServiceRoleClient();

    // Query extension request details
    let docPath: string | null = null;
    let fileName = "supporting-document";
    let ownerId: string | null = null;

    try {
      const { data: extRow } = await supabase
        .from("extension_requests")
        .select("faculty_user_id, supporting_document_url, supporting_document_name")
        .eq("id", requestId)
        .maybeSingle();

      if (extRow) {
        ownerId = extRow.faculty_user_id;
        docPath = extRow.supporting_document_url;
        fileName = extRow.supporting_document_name || fileName;
      }
    } catch {
      // Fallback
    }

    // Fallback: check notifications table
    if (!docPath) {
      const { data: notif } = await supabase
        .from("notifications")
        .select("user_id, message")
        .eq("id", requestId)
        .maybeSingle();

      if (notif) {
        ownerId = notif.user_id;
        try {
          const parsed = JSON.parse(notif.message);
          docPath = parsed.supporting_document_url || null;
          fileName = parsed.supporting_document_name || fileName;
        } catch {}
      }
    }

    if (!docPath) {
      return NextResponse.json(
        { error: "Supporting document not found for this request" },
        { status: 404 },
      );
    }

    // Verify authorization: must be the owner faculty or an approver/admin
    const userRole =
      (user.user_metadata?.role as string | undefined) ??
      (user.app_metadata?.role as string | undefined);

    const isOwner = user.id === ownerId;
    const isApprover = isApproverOrAdmin(userRole);

    if (!isOwner && !isApprover) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Create a 1-hour signed URL from storage bucket
    const { data: signedData, error: signError } = await supabase.storage
      .from("faculty-submissions")
      .createSignedUrl(docPath, 3600);

    if (signError || !signedData?.signedUrl) {
      return NextResponse.json(
        { error: "Failed to generate access URL for document" },
        { status: 500 },
      );
    }

    if (download) {
      return NextResponse.redirect(`${signedData.signedUrl}&download=${encodeURIComponent(fileName)}`);
    }

    return NextResponse.redirect(signedData.signedUrl);
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
