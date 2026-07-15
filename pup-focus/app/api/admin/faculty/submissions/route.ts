import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { ROLE } from "@/config/roles";

type ReviewDecision = {
  decision: "validated" | "rejected";
  remarks?: string | null;
  created_at?: string | null;
};

type SubmissionRow = {
  id: string;
  requirement_code: string;
  status: string | null;
  submitted_at?: string | null;
  created_at?: string | null;
  remarks?: string | null;
  document_versions?: Array<{
    id: string;
    storage_path: string;
    mime_type?: string | null;
    size_bytes?: number | null;
    created_at?: string | null;
  }> | null;
  review_decisions?: ReviewDecision[] | null;
};

function isMissingRemarksColumnError(
  error: { message?: string } | null,
): boolean {
  const message = (error?.message || "").toLowerCase();
  return message.includes("remarks") && message.includes("submissions");
}

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

    // Get faculty profile ID. Accept either app_users.id or profile_id (frontend may pass profile id)
    const { data: appUserRow, error: appUserError } = await supabase
      .from("app_users")
      .select("profile_id")
      .or(`id.eq.${facultyId},profile_id.eq.${facultyId}`)
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

    // Get submissions with document versions and review history
    const initialResult = await supabase
      .from("submissions")
      .select(
        `
        id,
        requirement_code,
        status,
        submitted_at,
        created_at,
        remarks,
        document_versions(
          id,
          version_number,
          storage_path,
          mime_type,
          size_bytes,
          created_at
        ),
        review_decisions(
          decision,
          remarks,
          created_at
        )
      `,
      )
      .eq("faculty_profile_id", facultyProfileId)
      .order("submitted_at", { ascending: false });

    let submissions = (initialResult.data as SubmissionRow[] | null) ?? null;
    let submissionsError = initialResult.error;

    if (submissionsError && isMissingRemarksColumnError(submissionsError)) {
      const fallbackResult = await supabase
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
          ),
          review_decisions(
            decision,
            remarks,
            created_at
          )
        `,
        )
        .eq("faculty_profile_id", facultyProfileId)
        .order("submitted_at", { ascending: false });

      submissions = (fallbackResult.data as SubmissionRow[] | null) ?? null;
      submissionsError = fallbackResult.error;
    }

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
