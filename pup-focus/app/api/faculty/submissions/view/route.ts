import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

export async function GET(request: NextRequest) {
  try {
    const sessionClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const submissionId = url.searchParams.get("submissionId");

    if (!submissionId) {
      return NextResponse.json(
        { error: "submissionId is required" },
        { status: 400 },
      );
    }

    const supabase = getServiceRoleClient();

    const { data: appUser, error: appUserError } = await supabase
      .from("app_users")
      .select("profile_id")
      .eq("auth_user_id", user.id)
      .single();

    if (appUserError || !appUser?.profile_id) {
      return NextResponse.json(
        { error: "Faculty profile not found" },
        { status: 404 },
      );
    }

    const { data: submission, error: submissionError } = await supabase
      .from("submissions")
      .select("id")
      .eq("id", submissionId)
      .eq("faculty_profile_id", appUser.profile_id)
      .maybeSingle();

    if (submissionError || !submission) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 },
      );
    }

    const { data: versions, error: versionsError } = await supabase
      .from("document_versions")
      .select("storage_path, version_number")
      .eq("submission_id", submissionId)
      .order("version_number", { ascending: false })
      .limit(1);

    if (versionsError || !versions || versions.length === 0) {
      return NextResponse.json(
        { error: "No file found for this submission" },
        { status: 404 },
      );
    }

    const storagePath = versions[0]?.storage_path;
    if (!storagePath) {
      return NextResponse.json(
        { error: "No file path found for this submission" },
        { status: 404 },
      );
    }

    const { data: signed, error: signedError } = await supabase.storage
      .from("faculty-submissions")
      .createSignedUrl(storagePath, 60 * 60);

    if (signedError || !signed?.signedUrl) {
      return NextResponse.json(
        { error: "Failed to generate file link" },
        { status: 500 },
      );
    }

    return NextResponse.redirect(signed.signedUrl);
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
