import { NextResponse, type NextRequest } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ROLE } from "@/config/roles";

export async function GET(request: NextRequest) {
  try {
    // Verify admin role
    const sessionClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();

    const requesterRole =
      (user?.user_metadata?.role as string | undefined) ??
      (user?.app_metadata?.role as string | undefined);

    const url = new URL(request.url);
    const path = url.searchParams.get("path");
    const download = url.searchParams.get("download");
    const filename = url.searchParams.get("filename");
    const asJson =
      url.searchParams.get("json") === "true" ||
      url.searchParams.get("format") === "json";

    if (!path) {
      return NextResponse.json({ error: "path is required" }, { status: 400 });
    }

    const isFaculty = requesterRole === ROLE.FACULTY;
    const isOwner = Boolean(isFaculty && user?.id && path.includes(user.id));

    if (
      !user ||
      (!isOwner &&
        requesterRole !== ROLE.ADMIN &&
        requesterRole !== ROLE.SUPER_ADMIN)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get signed URL from Supabase
    const supabase = getServiceRoleClient();
    const options =
      download === "true" || filename
        ? { download: filename || path.split("/").pop() || true }
        : undefined;

    const { data, error } = await supabase.storage
      .from("faculty-submissions")
      .createSignedUrl(path, 3600, options); // 1 hour expiry

    if (error || !data?.signedUrl) {
      return NextResponse.json(
        {
          error: "Failed to generate download link",
          details: error?.message,
        },
        { status: 500 },
      );
    }

    if (asJson) {
      return NextResponse.json({
        success: true,
        signedUrl: data.signedUrl,
        url: data.signedUrl,
      });
    }

    // Redirect to the signed URL
    return NextResponse.redirect(data.signedUrl);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
