import { NextResponse } from "next/server";
import {
  evaluateSubmissionWindow,
  format24HourTo12Hour,
  getSubmissionWindow,
} from "@/features/submissions/services/submission-window.service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { ROLE } from "@/config/roles";

function isAdminRole(role: string | undefined) {
  return role === ROLE.ADMIN || role === ROLE.SUPER_ADMIN;
}

type SubmissionWindowHistoryItem = {
  academicYear: string;
  semester: string;
  startDate: string | null;
  endDate: string | null;
  startTimeLabel: string | null;
  endTimeLabel: string | null;
  status: "Upcoming" | "Open" | "Closed";
  createdAt: string | null;
};

export async function GET() {
  try {
    const sessionClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();

    const requesterRole =
      (user?.user_metadata?.role as string | undefined) ??
      (user?.app_metadata?.role as string | undefined);

    if (!user || !isAdminRole(requesterRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = getServiceRoleClient();
    const config = await getSubmissionWindow(supabase);
    const currentWindow = config
      ? {
          academicYear: config.academicYear ?? null,
          semester: config.semester ?? null,
        }
      : null;
    const status = evaluateSubmissionWindow(config);

    const { data: historyRows, error } = await supabase
      .from("submission_window_terms")
      .select(
        "academic_year, semester, start_date, end_date, start_time, end_time, created_at",
      )
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        {
          error: "Failed to load submission window history",
          details: error.message,
        },
        { status: 500 },
      );
    }

    const history: SubmissionWindowHistoryItem[] = Array.isArray(historyRows)
      ? historyRows.map((row) => {
          const isCurrentTerm =
            currentWindow?.academicYear === row.academic_year &&
            currentWindow?.semester === row.semester;

          return {
            academicYear: row.academic_year,
            semester: row.semester,
            startDate: row.start_date ?? null,
            endDate: row.end_date ?? null,
            startTimeLabel: row.start_time
              ? format24HourTo12Hour(row.start_time)
              : null,
            endTimeLabel: row.end_time
              ? format24HourTo12Hour(row.end_time)
              : null,
            status: isCurrentTerm ? status.status : "Closed",
            createdAt: row.created_at ?? null,
          };
        })
      : [];

    return NextResponse.json({ history });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load submission window history",
        details: String(error),
      },
      { status: 500 },
    );
  }
}
