import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { logger } from "@/lib/observability/logger";

export async function POST(request: NextRequest) {
  try {
    const sessionClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { submissionId } = body;

    if (!submissionId || typeof submissionId !== "string") {
      return NextResponse.json(
        { error: "submissionId is required" },
        { status: 400 },
      );
    }

    const supabase = getServiceRoleClient();

    // 1. Attempt update with is_read and viewed_at
    const nowIso = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("submissions")
      .update({
        is_read: true,
        viewed_at: nowIso,
      })
      .eq("id", submissionId);

    if (updateError) {
      logger.warn("mark_viewed_update_warning", {
        submissionId,
        error: updateError.message,
      });

      // Step 2 fallback: Try minimal update with is_read only if viewed_at doesn't exist
      const { error: isReadOnlyErr } = await supabase
        .from("submissions")
        .update({ is_read: true })
        .eq("id", submissionId);

      if (isReadOnlyErr) {
        logger.warn("mark_viewed_is_read_only_fallback_failed", {
          submissionId,
          error: isReadOnlyErr.message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      submissionId,
      is_read: true,
      viewed_at: nowIso,
    });
  } catch (err) {
    logger.error("mark_submission_viewed_error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
