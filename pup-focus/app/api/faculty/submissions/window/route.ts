import { NextResponse } from "next/server";
import {
  evaluateSubmissionWindow,
  format24HourTo12Hour,
  getSubmissionWindow,
  normalizeSemester,
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

    if (!status.academicYear || !status.semester) {
      let { data: currentTerm } = await supabase
        .from("academic_terms")
        .select("academic_year, semester")
        .eq("status", "Current")
        .maybeSingle();

      if (!currentTerm) {
        const { data: latestTerm } = await supabase
          .from("academic_terms")
          .select("academic_year, semester")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        currentTerm = latestTerm;
      }

      if (currentTerm?.academic_year && currentTerm?.semester) {
        status.academicYear = currentTerm.academic_year;
        const rawSem = normalizeSemester(currentTerm.semester);
        status.semester = rawSem.includes("2") ? "2nd Semester" : "1st Semester";
      } else {
        status.academicYear = "2026-2027";
        status.semester = "1st Semester";
      }
    }

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
