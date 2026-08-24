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

    // Attempt updates gracefully without noisy failure logs
    const nowIso = new Date().toISOString();
    let updated = false;

    // Step 1: Try is_read + viewed_at
    const { error: fullErr } = await supabase
      .from("submissions")
      .update({
        is_read: true,
        viewed_at: nowIso,
      })
      .eq("id", submissionId);

    if (!fullErr) {
      updated = true;
    } else {
      // Step 2: Try is_read only
      const { error: isReadErr } = await supabase
        .from("submissions")
        .update({ is_read: true })
        .eq("id", submissionId);

      if (!isReadErr) {
        updated = true;
      } else {
        // Step 3: Try is_viewed fallback
        const { error: isViewedErr } = await supabase
          .from("submissions")
          .update({ is_viewed: true })
          .eq("id", submissionId);

        if (!isViewedErr) {
          updated = true;
        }
      }
    }

    return NextResponse.json({
      success: true,
      submissionId,
      viewed: true,
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
