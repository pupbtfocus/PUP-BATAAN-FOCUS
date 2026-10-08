import { NextResponse } from "next/server";
import {
  evaluateSubmissionWindow,
  format24HourTo12Hour,
  getFacultyPersonalDeadline,
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

    // 1. Resolve currently active academic term strictly
    const { data: currentTerm } = await supabase
      .from("academic_terms")
      .select("academic_year, semester")
      .eq("status", "Current")
      .maybeSingle();

    const activeAY = currentTerm?.academic_year || "2026-2027";
    const rawSem = currentTerm?.semester ? normalizeSemester(currentTerm.semester) : "1st Semester";
    const activeSem: "1st Semester" | "2nd Semester" = rawSem.includes("2") ? "2nd Semester" : "1st Semester";

    // 2. Evaluate schedule strictly for active term
    const config = await getSubmissionWindow(supabase, {
      academicYear: activeAY,
      semester: activeSem,
    });
    const status = evaluateSubmissionWindow(config, undefined, undefined, {
      academicYear: activeAY,
      semester: activeSem,
    });

    // 3. First, check if the Global Submission Window is OPEN. If yes, return isOpen: true.
    if (status.isConfigured && status.isOpen) {
      return NextResponse.json({
        ...status,
        startTimeLabel: status.startTime
          ? format24HourTo12Hour(status.startTime)
          : null,
        endTimeLabel: status.endTime
          ? format24HourTo12Hour(status.endTime)
          : null,
        currentTimeLabel: format24HourTo12Hour(status.currentTime),
        isPersonalDeadline: false,
        isGracePeriod: false,
      });
    }

    // 4. If the Global Window is CLOSED, check the submissions table for this specific faculty member.
    // If the faculty member has pending requirements where due_at is set and in the future (due_at > now()),
    // evaluate isOpen = true for this user!
    const personalDeadline = await getFacultyPersonalDeadline(supabase, user.id);
    if (personalDeadline) {
      return NextResponse.json({
        isConfigured: true,
        status: "Open",
        isOpen: true,
        today: status.today,
        currentTime: status.currentTime,
        startDate: status.startDate || status.today,
        endDate: personalDeadline.endDate,
        startTime: "00:00:00",
        endTime: "23:59:59",
        academicYear: activeAY,
        semester: activeSem,
        startTimeLabel: "12:00 AM",
        endTimeLabel: "11:59 PM",
        currentTimeLabel: format24HourTo12Hour(status.currentTime),
        isGracePeriod: true,
        isPersonalDeadline: true,
        effectiveDeadline: personalDeadline.effectiveDeadline,
        formattedDueAt: personalDeadline.formattedDueAt,
        badgeLabel: "Personal Deadline Active",
      });
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
      isPersonalDeadline: false,
      isGracePeriod: false,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load submission window", details: String(error) },
      { status: 500 },
    );
  }
}
