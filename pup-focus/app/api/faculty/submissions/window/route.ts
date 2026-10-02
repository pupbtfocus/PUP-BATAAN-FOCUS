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

    // 3. If global window is closed/off, check if THIS faculty member has an active personal grace period (Option A)
    if (!status.isOpen || !status.isConfigured) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      const profileId = profile?.id;
      if (profileId) {
        const { data: graceSubs } = await supabase
          .from("submissions")
          .select("due_at")
          .eq("faculty_profile_id", profileId)
          .not("due_at", "is", null);

        if (graceSubs && graceSubs.length > 0) {
          const nowMs = Date.now();
          let earliestGraceDueMs: number | null = null;
          let earliestGraceIso: string | null = null;

          for (const s of graceSubs) {
            if (s.due_at) {
              const iso = s.due_at.includes("T") ? s.due_at : `${s.due_at}T23:59:59+08:00`;
              const ms = new Date(iso).getTime();
              if (!Number.isNaN(ms) && nowMs <= ms) {
                if (earliestGraceDueMs === null || ms < earliestGraceDueMs) {
                  earliestGraceDueMs = ms;
                  earliestGraceIso = iso;
                }
              }
            }
          }

          if (earliestGraceIso) {
            const endDate = earliestGraceIso.split("T")[0];
            return NextResponse.json({
              isConfigured: true,
              status: "Open",
              isOpen: true,
              today: status.today,
              currentTime: status.currentTime,
              startDate: status.startDate || status.today,
              endDate,
              startTime: "00:00:00",
              endTime: "23:59:59",
              academicYear: activeAY,
              semester: activeSem,
              startTimeLabel: "12:00 AM",
              endTimeLabel: "11:59 PM",
              currentTimeLabel: format24HourTo12Hour(status.currentTime),
              isGracePeriod: true,
              badgeLabel: "Option A Grace Period",
            });
          }
        }
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
