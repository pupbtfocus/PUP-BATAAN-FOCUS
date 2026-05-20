import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { ROLE } from "@/config/roles";

export async function POST(request: NextRequest) {
  try {
    const sessionClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const requesterRole =
      (user?.user_metadata?.role as string | undefined) ??
      (user?.app_metadata?.role as string | undefined);

    if (requesterRole !== ROLE.SUPER_ADMIN && requesterRole !== ROLE.ADMIN) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = getServiceRoleClient();

    // Find submissions where faculty_profile_id is null
    const { data: submissions, error: submissionsError } = await supabase
      .from("submissions")
      .select("id")
      .is("faculty_profile_id", null)
      .limit(1000);

    if (submissionsError) {
      return NextResponse.json(
        {
          error: "Failed to query submissions",
          details: submissionsError.message,
        },
        { status: 500 },
      );
    }

    const results: Array<{
      submissionId: string;
      profileId?: string;
      ok: boolean;
      error?: string;
    }> = [];

    for (const row of submissions || []) {
      const submissionId = row.id as string;

      // Find a document version for this submission to extract the storage path
      const { data: docs, error: docsError } = await supabase
        .from("document_versions")
        .select("storage_path")
        .eq("submission_id", submissionId)
        .limit(1)
        .maybeSingle();

      if (docsError || !docs || !docs.storage_path) {
        results.push({
          submissionId,
          ok: false,
          error: docsError?.message || "no document version found",
        });
        continue;
      }

      const parts = (docs.storage_path as string).split("/");
      // expected: faculty-submissions/{profile_id}/{submissionId}/{filename}
      const profileId = parts.length >= 3 ? parts[1] : undefined;

      if (!profileId) {
        results.push({
          submissionId,
          ok: false,
          error: "unable to parse profile id from storage_path",
        });
        continue;
      }

      const { error: updateError } = await supabase
        .from("submissions")
        .update({ faculty_profile_id: profileId })
        .eq("id", submissionId);

      if (updateError) {
        results.push({
          submissionId,
          profileId,
          ok: false,
          error: updateError.message,
        });
        continue;
      }

      results.push({ submissionId, profileId, ok: true });
    }

    const successCount = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok);

    return NextResponse.json(
      { total: results.length, successCount, failed },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Backfill failed", details: String(error) },
      { status: 500 },
    );
  }
}
