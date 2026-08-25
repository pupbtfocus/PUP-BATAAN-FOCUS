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
    const versionId = url.searchParams.get("versionId");
    const download = url.searchParams.get("download");
    const filename = url.searchParams.get("filename");
    const asJson = url.searchParams.get("json") === "true";

    if (!submissionId) {
      return NextResponse.json(
        { error: "submissionId is required" },
        { status: 400 },
      );
    }

    const supabase = getServiceRoleClient();

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError || !profile?.id) {
      return NextResponse.json(
        { error: "Faculty profile not found" },
        { status: 404 },
      );
    }

    // Check user role: faculty owner or admin/super_admin
    const requesterRole =
      (user?.user_metadata?.role as string | undefined) ??
      (user?.app_metadata?.role as string | undefined);
    const isAdmin =
      requesterRole === "admin" || requesterRole === "super_admin";

    let submissionQuery = supabase
      .from("submissions")
      .select("id, file_name, storage_path, file_path")
      .eq("id", submissionId);

    if (!isAdmin) {
      submissionQuery = submissionQuery.or(
        `faculty_profile_id.eq.${profile.id},user_id.eq.${profile.id}`,
      );
    }

    const { data: submission, error: submissionError } =
      await submissionQuery.maybeSingle();

    if (submissionError || !submission) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 },
      );
    }

    let storagePath: string | null = null;
    const targetFileName = filename || submission.file_name || undefined;

    if (versionId) {
      const { data: versionData } = await supabase
        .from("document_versions")
        .select("storage_path, version_number")
        .eq("id", versionId)
        .eq("submission_id", submissionId)
        .maybeSingle();

      if (versionData?.storage_path) {
        storagePath = versionData.storage_path;
      }
    }

    if (!storagePath) {
      const { data: versions } = await supabase
        .from("document_versions")
        .select("storage_path, version_number")
        .eq("submission_id", submissionId)
        .order("version_number", { ascending: false })
        .limit(1);

      if (versions && versions.length > 0 && versions[0]?.storage_path) {
        storagePath = versions[0].storage_path;
      } else {
        storagePath = submission.storage_path || submission.file_path || null;
      }
    }

    if (!storagePath) {
      return NextResponse.json(
        { error: "No file found for this submission" },
        { status: 404 },
      );
    }

    const downloadOptions =
      download === "true" || filename
        ? { download: targetFileName || storagePath.split("/").pop() || true }
        : undefined;

    const { data: signed, error: signedError } = await supabase.storage
      .from("faculty-submissions")
      .createSignedUrl(storagePath, 60 * 60, downloadOptions);

    if (signedError || !signed?.signedUrl) {
      return NextResponse.json(
        { error: "Failed to generate file link" },
        { status: 500 },
      );
    }

    if (asJson) {
      return NextResponse.json({
        success: true,
        downloadUrl: signed.signedUrl,
        storagePath,
      });
    }

    return NextResponse.redirect(signed.signedUrl);
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
