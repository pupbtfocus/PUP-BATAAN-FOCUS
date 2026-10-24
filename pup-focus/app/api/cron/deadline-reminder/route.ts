import { NextRequest, NextResponse } from "next/server";
import { checkAndSend3DayDeadlineReminders } from "@/features/submissions/services/deadline-reminder.service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // If CRON_SECRET is configured, enforce authorization header
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await checkAndSend3DayDeadlineReminders();
  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  return GET(request);
}

