import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
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

    if (
      !user ||
      (requesterRole !== ROLE.ADMIN && requesterRole !== ROLE.SUPER_ADMIN)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(request.url);
    const facultyId = url.searchParams.get("facultyId");

    if (!facultyId) {
      return NextResponse.json(
        { error: "facultyId is required" },
        { status: 400 },
      );
    }

    const supabase = getServiceRoleClient();

    // Get faculty profile ID
    const { data: appUserRow, error: appUserError } = await supabase
      .from("app_users")
      .select("profile_id")
      .eq("id", facultyId)
      .maybeSingle();

    if (appUserError || !appUserRow?.profile_id) {
      return NextResponse.json(
        {
          error: "Faculty profile not found",
          details: appUserError?.message || "No profile_id for this faculty",
        },
        { status: 404 },
      );
    }

    const facultyProfileId = appUserRow.profile_id;

    // Get submissions with document versions
    const { data: submissions, error: submissionsError } = await supabase
      .from("submissions")
      .select(
        `
        id,
        requirement_code,
        status,
        submitted_at,
        created_at,
        document_versions(
          id,
          version_number,
          storage_path,
          mime_type,
          size_bytes,
          created_at
        )
      `,
      )
      .eq("faculty_profile_id", facultyProfileId)
      .order("submitted_at", { ascending: false });

    if (submissionsError) {
      return NextResponse.json(
        {
          error: "Failed to load submissions",
          details: submissionsError.message,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      submissions: submissions || [],
      total: (submissions || []).length,
    });
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
