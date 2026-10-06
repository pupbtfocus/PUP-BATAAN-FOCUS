export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { ROLE } from "@/config/roles";
import { DEFAULT_REQUIREMENTS, REQUIREMENT_LABEL } from "@/config/compliance";
import {
  evaluateSubmissionWindow,
  getSubmissionWindow,
  getTodayInManila,
  getCurrentTimeInManila,
  normalizeTime24Hour,
} from "@/features/submissions/services/submission-window.service";

function isAuthorizedAdmin(role?: string): boolean {
  if (!role) return false;
  const r = role.toLowerCase().trim().replace(/[-_\s]/g, "");
  return (
    r === "admin" ||
    r === "superadmin" ||
    r === "dean" ||
    r === "departmenthead" ||
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

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const requesterRole =
      (user.user_metadata?.role as string | undefined) ??
      (user.app_metadata?.role as string | undefined);

    let hasAccess = isAuthorizedAdmin(requesterRole);
    const supabase = getServiceRoleClient();

    if (!hasAccess) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("id, role")
        .eq("user_id", user.id)
        .maybeSingle();
      if (prof?.role && isAuthorizedAdmin(prof.role)) {
        hasAccess = true;
      } else if (prof?.id) {
        const { data: ur } = await supabase
          .from("user_roles")
          .select("roles(code)")
          .eq("profile_id", prof.id);
        if (ur && ur.length > 0) {
          hasAccess = ur.some((r: any) => {
            const code = Array.isArray(r.roles) ? r.roles[0]?.code : r.roles?.code;
            return isAuthorizedAdmin(code);
          });
        }
      }
    }

    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 1. Fetch currently active academic term with fallback
    let activeAY = "2026-2027";
    let activeSem = "1st Semester";

    try {
      const { data: termRows } = await supabase
        .from("academic_terms")
        .select("id, academic_year, semester, status")
        .order("academic_year", { ascending: false });

      if (Array.isArray(termRows) && termRows.length > 0) {
        const found = termRows.find(
          (t: any) =>
            (t.status || "").trim().toLowerCase() === "current" ||
            (t.status || "").trim().toLowerCase() === "active",
        );
        const currentTerm = found || termRows[0];
        if (currentTerm?.academic_year) activeAY = currentTerm.academic_year.trim();
        if (currentTerm?.semester) activeSem = currentTerm.semester.trim();
      }
    } catch {
      // Fallback
    }

    // 2. Fetch current window config and evaluated status
    const windowConfig = await getSubmissionWindow(supabase, {
      academicYear: activeAY,
      semester: activeSem,
    });

    const windowState = evaluateSubmissionWindow(
      windowConfig,
      undefined,
      undefined,
      { academicYear: activeAY, semester: activeSem },
    );

    // If the window is currently OPEN, submissions are actively accepted; no past deadline restriction!
    if (windowState.isOpen) {
      return NextResponse.json({
        hasPastDeadlines: false,
        hasPastSchedule: false,
        activeTerm: {
          academicYear: activeAY,
          semester: activeSem,
        },
        globalDeadline: {
          endDate: windowState.endDate,
          endTime: windowState.endTime,
          iso: `${windowState.endDate}T${normalizeTime24Hour(windowState.endTime || "23:59:59")}+08:00`,
        },
        schedules: [],
      });
    }

    // Submissions are NOT open (schedule is off, closed, or past deadline).
    let termWin: any = null;
    try {
      const { data: tw } = await supabase
        .from("submission_window_terms")
        .select("start_date, end_date, start_time, end_time")
        .eq("academic_year", activeAY)
        .eq("semester", activeSem)
        .maybeSingle();

      if (tw?.end_date) {
        termWin = tw;
      }
    } catch {
      // Table may not exist yet
    }

    let globalWin: any = null;
    try {
      const { data: gw } = await supabase
        .from("submission_windows")
        .select("start_date, end_date, start_time, end_time, academic_year, semester")
        .eq("id", 1)
        .maybeSingle();

      if (gw?.end_date) {
        globalWin = gw;
      }
    } catch {
      // Fallback
    }

    // Submissions for this term are CLOSED (either deadline passed OR manually closed/off)
    const todayManila = getTodayInManila();
    const timeManila = getCurrentTimeInManila();
    const nowManila = `${todayManila}T${normalizeTime24Hour(timeManila)}`;

    // Check if there was any schedule previously configured, logged, or closed for the active term
    let hasLogEvents = false;
    let lastLoggedEndDate: string | null = null;
    let lastLoggedEndTime: string | null = null;
    try {
      const { data: pastLogs } = await supabase
        .from("submission_window_logs")
        .select("id, action_type, old_end_date, old_end_time, new_end_date, new_end_time, scope_target, created_at")
        .order("created_at", { ascending: false })
        .limit(40);

      if (Array.isArray(pastLogs) && pastLogs.length > 0) {
        const termLogs = pastLogs.filter((log) => {
          if (!log.scope_target) return false;
          return log.scope_target.includes(activeAY) && log.scope_target.includes(activeSem);
        });

        if (termLogs.length > 0) {
          hasLogEvents = true;
          for (const log of termLogs) {
            if (log.new_end_date || log.old_end_date) {
              lastLoggedEndDate = log.new_end_date || log.old_end_date;
              lastLoggedEndTime = log.new_end_time || log.old_end_time;
              break;
            }
          }
        }
      }
    } catch {
      // Ignore if table missing
    }

    let hasAuditScheduleEvents = false;
    try {
      const { data: audits } = await supabase
        .from("audit_logs")
        .select("id, metadata")
        .in("action", [
          "submission_window.update",
          "submission_window.close",
          "submission_window.extend",
        ])
        .limit(50);

      if (Array.isArray(audits) && audits.length > 0) {
        hasAuditScheduleEvents = audits.some((a) => {
          const meta = a.metadata || {};
          return meta.academic_year === activeAY && meta.semester === activeSem;
        });
      }
    } catch {
      // Ignore
    }

    let hasTermRowSchedule = false;
    try {
      const { data: pastTerms } = await supabase
        .from("submission_window_terms")
        .select("start_date, end_date, academic_year, semester")
        .eq("academic_year", activeAY)
        .eq("semester", activeSem)
        .maybeSingle();

      if (pastTerms?.start_date || pastTerms?.end_date) {
        hasTermRowSchedule = true;
      }
    } catch {
      // Ignore
    }

    const hasPastSchedule = Boolean(
      hasLogEvents ||
      hasAuditScheduleEvents ||
      hasTermRowSchedule ||
      Boolean(termWin?.end_date || termWin?.start_date) ||
      Boolean((globalWin?.end_date || globalWin?.start_date) && globalWin?.academic_year === activeAY && globalWin?.semester === activeSem) ||
      Boolean((windowConfig?.endDate || windowConfig?.startDate) && windowConfig?.academicYear === activeAY && windowConfig?.semester === activeSem)
    );

    const effectiveEndDate =
      termWin?.end_date ||
      (globalWin?.academic_year === activeAY && globalWin?.semester === activeSem ? globalWin?.end_date : null) ||
      windowState.endDate ||
      lastLoggedEndDate ||
      todayManila;

    const effectiveEndTime =
      termWin?.end_time ||
      (globalWin?.academic_year === activeAY && globalWin?.semester === activeSem ? globalWin?.end_time : null) ||
      windowState.endTime ||
      lastLoggedEndTime ||
      timeManila;

    const normTime = normalizeTime24Hour(effectiveEndTime || "23:59:59") || "23:59:59";
    const deadlineIso = `${effectiveEndDate}T${normTime}+08:00`;

    // 3. Submissions are closed! Fetch all active requirement schedules in the active term
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
      globalDeadlineDate: effectiveEndDate,
      globalDeadlineTime: effectiveEndTime || "11:59 PM",
    }));

    return NextResponse.json({
      hasPastDeadlines: true,
      hasPastSchedule,
      activeTerm: {
        academicYear: activeAY,
        semester: activeSem,
      },
      globalDeadline: {
        endDate: effectiveEndDate,
        endTime: effectiveEndTime,
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
