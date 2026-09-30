export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { ROLE } from "@/config/roles";
import { DEFAULT_REQUIREMENTS, REQUIREMENT_LABEL } from "@/config/compliance";
import { normalizeTime24Hour } from "@/features/submissions/services/submission-window.service";

function isAuthorizedAdmin(role?: string): boolean {
  if (!role) return false;
  const r = role.toLowerCase().trim();
  return (
    r === "admin" ||
    r === "super_admin" ||
    r === "dean" ||
    r === "department_head" ||
    r === "chairperson" ||
    r === "coordinator"
  );
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

    let hasAccess = isAuthorizedAdmin(requesterRole);
    if (!hasAccess && user) {
      const supabaseCheck = getServiceRoleClient();
      const { data: prof } = await supabaseCheck
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();
      if (prof?.role && isAuthorizedAdmin(prof.role)) {
        hasAccess = true;
      }
    }

    if (!user || !hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = getServiceRoleClient();

    // 1. Fetch currently active academic term
    const { data: activeTerm } = await supabase
      .from("academic_terms")
      .select("id, academic_year, semester, status")
      .eq("status", "Current")
      .limit(1)
      .maybeSingle();

    if (!activeTerm) {
      return NextResponse.json({
        hasPastDeadlines: false,
        activeTerm: null,
        schedules: [],
      });
    }

    // 2. Fetch submission window for this active term
    let windowRow: any = null;

    // Check submission_window_terms first
    try {
      const { data: termWin } = await supabase
        .from("submission_window_terms")
        .select("start_date, end_date, start_time, end_time")
        .eq("academic_year", activeTerm.academic_year)
        .eq("semester", activeTerm.semester)
        .maybeSingle();

      if (termWin?.end_date) {
        windowRow = termWin;
      }
    } catch {
      // Table may not exist yet
    }

    // Fallback to submission_windows
    if (!windowRow) {
      try {
        const { data: globalWin } = await supabase
          .from("submission_windows")
          .select("start_date, end_date, start_time, end_time, academic_year, semester")
          .eq("id", 1)
          .maybeSingle();

        if (globalWin?.end_date) {
          windowRow = globalWin;
        }
      } catch {
        // Fallback
      }
    }

    if (!windowRow || !windowRow.end_date) {
      // No closed schedule / deadline configured
      return NextResponse.json({
        hasPastDeadlines: false,
        activeTerm: {
          academicYear: activeTerm.academic_year,
          semester: activeTerm.semester,
        },
        schedules: [],
      });
    }

    const normTime = normalizeTime24Hour(windowRow.end_time || "23:59:59") || "23:59:59";
    const deadlineIso = `${windowRow.end_date}T${normTime}+08:00`;
    const deadlineMs = new Date(deadlineIso).getTime();
    const nowMs = Date.now();

    const isPastDeadline = !Number.isNaN(deadlineMs) && nowMs > deadlineMs;

    if (!isPastDeadline) {
      return NextResponse.json({
        hasPastDeadlines: false,
        activeTerm: {
          academicYear: activeTerm.academic_year,
          semester: activeTerm.semester,
        },
        globalDeadline: {
          endDate: windowRow.end_date,
          endTime: windowRow.end_time,
          iso: deadlineIso,
        },
        schedules: [],
      });
    }

    // 3. Deadline has passed! Fetch all active requirement schedules in the active term
    let activeTemplates: Array<{
      code: string;
      title: string;
      description?: string | null;
    }> = [];

    try {
      const { data: templates } = await supabase
        .from("requirement_templates")
        .select("code, title, description")
        .eq("is_active", true)
        .order("title", { ascending: true });

      if (templates && templates.length > 0) {
        activeTemplates = templates;
      }
    } catch {
      // Fallback
    }

    if (activeTemplates.length === 0) {
      activeTemplates = DEFAULT_REQUIREMENTS.map((code) => ({
        code,
        title: REQUIREMENT_LABEL[code] || code,
      }));
    }

    const schedules = activeTemplates.map((t) => ({
      code: t.code,
      title: t.title,
      description: t.description || null,
      globalDeadlineIso: deadlineIso,
      globalDeadlineDate: windowRow.end_date,
      globalDeadlineTime: windowRow.end_time || "11:59 PM",
    }));

    return NextResponse.json({
      hasPastDeadlines: true,
      activeTerm: {
        academicYear: activeTerm.academic_year,
        semester: activeTerm.semester,
      },
      globalDeadline: {
        endDate: windowRow.end_date,
        endTime: windowRow.end_time,
        iso: deadlineIso,
      },
      schedules,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to check onboarding schedule status", details: String(error) },
      { status: 500 },
    );
  }
}
