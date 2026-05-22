import { NextRequest, NextResponse } from "next/server";
import { ROLE } from "@/config/roles";
import {
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

    return NextResponse.json(status);
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

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "Start date and end date are required." },
        { status: 400 },
      );
    }

    const validation = validateSubmissionWindow(startDate, endDate);
    if (!validation.isValid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const supabase = getServiceRoleClient();
    const { error } = await supabase.from("submission_windows").upsert(
      {
        id: 1,
        start_date: startDate,
        end_date: endDate,
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

    const status = evaluateSubmissionWindow({ startDate, endDate });
    return NextResponse.json(status);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update submission window", details: String(error) },
      { status: 500 },
    );
  }
}
