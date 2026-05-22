import { NextRequest, NextResponse } from "next/server";
import { ROLE } from "@/config/roles";
import {
  convert12HourTo24Hour,
  format24HourTo12Hour,
  evaluateSubmissionWindow,
  getSubmissionWindow,
  validateSubmissionWindow,
} from "@/features/submissions/services/submission-window.service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

function isAdminRole(role: string | undefined) {
  return role === ROLE.ADMIN || role === ROLE.SUPER_ADMIN;
}

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

type UpdatePayload = {
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
};

export async function PUT(request: NextRequest) {
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

    const payload = (await request.json()) as UpdatePayload;
    const startDate = payload.startDate?.trim() ?? "";
    const endDate = payload.endDate?.trim() ?? "";
    const startTime = payload.startTime?.trim() ?? "";
    const endTime = payload.endTime?.trim() ?? "";

    if (!startDate || !endDate || !startTime || !endTime) {
      return NextResponse.json(
        { error: "Start/end date and time are required." },
        { status: 400 },
      );
    }

    const validation = validateSubmissionWindow(
      startDate,
      endDate,
      startTime,
      endTime,
    );
    if (!validation.isValid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const startTime24 = convert12HourTo24Hour(startTime);
    const endTime24 = convert12HourTo24Hour(endTime);

    const supabase = getServiceRoleClient();
    const { error } = await supabase.from("submission_windows").upsert(
      {
        id: 1,
        start_date: startDate,
        end_date: endDate,
        start_time: startTime24,
        end_time: endTime24,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );

    if (error) {
      return NextResponse.json(
        {
          error: "Failed to save submission window",
          details: error.message,
        },
        { status: 500 },
      );
    }

    const status = evaluateSubmissionWindow({
      startDate,
      endDate,
      startTime: startTime24,
      endTime: endTime24,
    });
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
      { error: "Failed to update submission window", details: String(error) },
      { status: 500 },
    );
  }
}

export async function DELETE() {
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
    const { error } = await supabase
      .from("submission_windows")
      .delete()
      .eq("id", 1);

    if (error) {
      return NextResponse.json(
        {
          error: "Failed to close submission window",
          details: error.message,
        },
        { status: 500 },
      );
    }

    const status = evaluateSubmissionWindow(null);
    return NextResponse.json({
      ...status,
      startTimeLabel: null,
      endTimeLabel: null,
      currentTimeLabel: format24HourTo12Hour(status.currentTime),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to close submission window", details: String(error) },
      { status: 500 },
    );
  }
}
