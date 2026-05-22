import { NextResponse } from "next/server";
import {
  evaluateSubmissionWindow,
  format24HourTo12Hour,
  getSubmissionWindow,
} from "@/features/submissions/services/submission-window.service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

export async function GET() {
  try {
    const sessionClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getServiceRoleClient();
    const config = await getSubmissionWindow(supabase);
    const status = evaluateSubmissionWindow(config);

    return NextResponse.json({
      ...status,
      startTimeLabel: status.startTime
        ? format24HourTo12Hour(status.startTime)
        : null,
      endTimeLabel: status.endTime
        ? format24HourTo12Hour(status.endTime)
        : null,
      currentTimeLabel: format24HourTo12Hour(status.currentTime),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load submission window", details: String(error) },
      { status: 500 },
    );
  }
}
