export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { logger } from "@/lib/observability/logger";
import { ROLE } from "@/config/roles";
import {
  evaluateSubmissionWindow,
  getSubmissionWindow,
  format24HourTo12Hour,
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

import type { SubmissionScheduleLogEntry } from "@/features/faculty-management/types/submission-schedule-logs.types";
export type { SubmissionScheduleLogEntry };

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
      (user?.user_metadata?.role as string | undefined) ??
      (user?.app_metadata?.role as string | undefined);

    let hasAdminAccess = isAuthorizedAdmin(requesterRole);
    const supabase = getServiceRoleClient();

    if (!hasAdminAccess) {
      try {
        const { data: prof } = await supabase
          .from("profiles")
          .select("id, role, user_roles(roles(code))")
          .eq("user_id", user.id)
          .maybeSingle();

        const roleFromCol = (prof as any)?.role;
        const roleFromRel = (prof as any)?.user_roles?.[0]?.roles?.code;
        if (
          (roleFromCol && isAuthorizedAdmin(roleFromCol)) ||
          (roleFromRel && isAuthorizedAdmin(roleFromRel))
        ) {
          hasAdminAccess = true;
        }
      } catch {}
    }

    if (!hasAdminAccess) {
      return NextResponse.json(
        { error: "Forbidden - Administrator access required" },
        { status: 403 },
      );
    }

    // 1. Get active academic term
    let activeTerm: { academicYear: string; semester: string } | null = null;
    try {
      const { data: termRows } = await supabase
        .from("academic_terms")
        .select("academic_year, semester, status")
        .order("academic_year", { ascending: false });

      if (Array.isArray(termRows) && termRows.length > 0) {
        const currentTerm = termRows.find((t: any) => {
          const s = (t.status || "").trim().toLowerCase();
          return s === "current" || s === "active";
        });
        const row = currentTerm || termRows[0];
        if (row?.academic_year && row?.semester) {
          activeTerm = {
            academicYear: row.academic_year.trim(),
            semester: row.semester.trim(),
          };
        }
      }
    } catch {
      // Fallback term
    }

    if (!activeTerm) {
      activeTerm = {
        academicYear: "2026-2027",
        semester: "1st Semester",
      };
    }

    // 2. Fetch current submission window status
    let currentSchedule = null;
    try {
      const winConfig = await getSubmissionWindow(supabase, activeTerm);
      const evalStatus = evaluateSubmissionWindow(winConfig, undefined, undefined, activeTerm);
      currentSchedule = {
        status: evalStatus.status,
        isOpen: evalStatus.isOpen,
        startDate: evalStatus.startDate,
        endDate: evalStatus.endDate,
        startTime: evalStatus.startTime ? format24HourTo12Hour(evalStatus.startTime) : null,
        endTime: evalStatus.endTime ? format24HourTo12Hour(evalStatus.endTime) : null,
        academicYear: activeTerm.academicYear,
        semester: activeTerm.semester,
      };
    } catch {
      // ignore eval error
    }

    // 3. Query submission_window_logs table
    const { data: windowLogsData, error: windowLogsError } = await supabase
      .from("submission_window_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(60);

    if (windowLogsError && !windowLogsError.message?.includes("Could not find the table") && windowLogsError.code !== "PGRST204") {
      logger.warn("fetch_submission_window_logs_table_error", {
        error: windowLogsError.message,
      });
    }

    // 4. Query transaction_logs table for schedule related actions
    const scheduleActions = [
      "submission_window.update",
      "submission_window.close",
      "submission_window.extend",
      "submission_window.faculty_override",
      "submission_window.faculty_close",
      "submission_window.broadcast_reminder",
      "faculty.create",
    ];

    const { data: transactionLogsData } = await supabase
      .from("transaction_logs")
      .select("*")
      .in("action", scheduleActions)
      .order("created_at", { ascending: false })
      .limit(80);

    // 5. Query submission_window_terms table for term schedule history
    const { data: termsData } = await supabase
      .from("submission_window_terms")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);

    // 6. Query current submission_windows table row to capture active schedule
    const { data: currentWindowRow } = await supabase
      .from("submission_windows")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    // 7. Gather all unique actor IDs to look up friendly names
    const actorIds = new Set<string>();
    (windowLogsData || []).forEach((row: any) => {
      if (row.extended_by) actorIds.add(row.extended_by);
    });
    (transactionLogsData || []).forEach((log: any) => {
      if (log.actor_id) actorIds.add(log.actor_id);
    });
    (termsData || []).forEach((term: any) => {
      if (term.created_by) actorIds.add(term.created_by);
    });
    if (currentWindowRow?.updated_by) {
      actorIds.add(currentWindowRow.updated_by);
    }

    const actorNameMap = new Map<string, string>();
    if (actorIds.size > 0) {
      try {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, email")
          .in("user_id", Array.from(actorIds));

        (profiles || []).forEach((p: any) => {
          actorNameMap.set(p.user_id, p.full_name || p.email || "Administrator");
        });
      } catch {
        // ignore profile lookup error
      }
    }

    const unifiedLogs: SubmissionScheduleLogEntry[] = [];
    const seenLogKeys = new Set<string>();

    // A. Map from submission_window_logs table
    (windowLogsData || []).forEach((row: any) => {
      const actor =
        row.extended_by_name ||
        actorNameMap.get(row.extended_by) ||
        "Administrator";

      const key = `swl-${row.id}`;
      seenLogKeys.add(key);

      const actionType = (row.action_type as any) || "EXTENSION";
      let actionLabel = "Schedule Modified";
      if (actionType === "EXTENSION") actionLabel = "Deadline Extended";
      else if (actionType === "SCHEDULE_UPDATE" || actionType === "SCHEDULE_SET") actionLabel = "Submission Schedule Configured";
      else if (actionType === "SCHEDULE_CLOSE") actionLabel = "Submissions Closed";

      unifiedLogs.push({
        id: row.id,
        action_type: actionType,
        action_label: actionLabel,
        created_at: row.created_at,
        extended_by: row.extended_by,
        extended_by_name: actor,
        actor_name: actor,
        academic_year: activeTerm?.academicYear ?? null,
        semester: activeTerm?.semester ?? null,
        old_end_date: row.old_end_date,
        old_end_time: row.old_end_time ? format24HourTo12Hour(row.old_end_time) : null,
        new_end_date: row.new_end_date,
        new_end_time: row.new_end_time ? format24HourTo12Hour(row.new_end_time) : "",
        scope: row.scope || "global",
        scope_target: row.scope_target || "All Faculty",
        reason: row.reason || "Deadline extension granted",
        reason_details: row.reason_details,
        extension_preset: row.extension_preset || (actionType === "EXTENSION" ? "Extended" : null),
        notified_faculty: row.notified_faculty ?? true,
      });
    });

    // B. Map from transaction_logs table
    (transactionLogsData || []).forEach((log: any) => {
      const meta = log.metadata || {};
      const actor =
        meta.extended_by_name ||
        meta.updatedBy ||
        meta.actor_name ||
        actorNameMap.get(log.actor_id) ||
        "Administrator";

      // If action is faculty.create, only include if onboarding_option was specified
      if (log.action === "faculty.create") {
        const option = meta.onboarding_option;
        if (!option || option === "default") return;

        const facultyName = meta.target_full_name || meta.target_email || "New Faculty Member";
        const programCode = meta.program_code || meta.program_name || "";

        let label = "Faculty Standard Schedule";
        let reason = "Standard Registration";
        if (option === "grace_period") {
          label = "Faculty Grace Period Assigned";
          reason = "7-Day Onboarding Grace Period";
        } else if (option === "custom_deadlines") {
          label = "Custom Deadlines Assigned";
          reason = "Custom requirement deadlines specified";
        } else if (option === "exempt") {
          label = "Faculty Exempted from Schedule";
          reason = "Marked as exempted for past deadlines";
        }

        unifiedLogs.push({
          id: log.id,
          action_type: "FACULTY_ONBOARDING",
          action_label: label,
          created_at: log.created_at,
          extended_by: log.actor_id,
          extended_by_name: actor,
          actor_name: actor,
          academic_year: activeTerm?.academicYear ?? null,
          semester: activeTerm?.semester ?? null,
          old_end_date: null,
          old_end_time: null,
          new_end_date: "",
          new_end_time: "",
          scope: "faculty",
          scope_target: programCode ? `${facultyName} (${programCode})` : facultyName,
          reason,
          reason_details: `Account registered with onboarding policy: ${option}. Requirements configured accordingly.`,
          extension_preset: option === "grace_period" ? "+7 Days" : null,
          notified_faculty: Boolean(meta.invite_sent),
        });
        return;
      }

      if (log.action === "submission_window.update") {
        unifiedLogs.push({
          id: log.id,
          action_type: "SCHEDULE_UPDATE",
          action_label: "Submission Schedule Configured",
          created_at: log.created_at,
          extended_by: log.actor_id,
          extended_by_name: actor,
          actor_name: actor,
          academic_year: meta.academic_year || activeTerm?.academicYear,
          semester: meta.semester || activeTerm?.semester,
          start_date: meta.start_date,
          start_time: meta.start_time ? format24HourTo12Hour(meta.start_time) : null,
          old_end_date: null,
          old_end_time: null,
          new_end_date: meta.end_date || "",
          new_end_time: meta.end_time ? format24HourTo12Hour(meta.end_time) : "",
          scope: "global",
          scope_target: meta.academic_year ? `${meta.academic_year} • ${meta.semester}` : "All Faculty",
          reason: "Submission Window Configured",
          reason_details: `Dates set: ${meta.start_date || ""} to ${meta.end_date || ""}`,
          extension_preset: null,
          notified_faculty: true,
        });
        return;
      }

      if (log.action === "submission_window.close") {
        unifiedLogs.push({
          id: log.id,
          action_type: "SCHEDULE_CLOSE",
          action_label: "Submissions Closed",
          created_at: log.created_at,
          extended_by: log.actor_id,
          extended_by_name: actor,
          actor_name: actor,
          academic_year: meta.academic_year || activeTerm?.academicYear,
          semester: meta.semester || activeTerm?.semester,
          old_end_date: null,
          old_end_time: null,
          new_end_date: "",
          new_end_time: "",
          scope: "global",
          scope_target: meta.academic_year ? `${meta.academic_year} • ${meta.semester}` : "All Faculty",
          reason: "Window Closed Manually",
          reason_details: "Active submission window was closed by administrator",
          extension_preset: null,
          notified_faculty: true,
        });
        return;
      }

      if (log.action === "submission_window.extend") {
        // Prevent duplicate if already in submission_window_logs
        const dedupKey = `${meta.new_end_date}_${meta.scope_target}`;
        if (seenLogKeys.has(dedupKey)) return;

        unifiedLogs.push({
          id: log.id,
          action_type: "EXTENSION",
          action_label: "Deadline Extended",
          created_at: log.created_at,
          extended_by: log.actor_id,
          extended_by_name: actor,
          actor_name: actor,
          academic_year: activeTerm?.academicYear ?? null,
          semester: activeTerm?.semester ?? null,
          old_end_date: meta.old_end_date || null,
          old_end_time: meta.old_end_time ? format24HourTo12Hour(meta.old_end_time) : null,
          new_end_date: meta.new_end_date || meta.newEndDate || meta.end_date || "",
          new_end_time: meta.new_end_time || meta.newEndTime || meta.end_time || "",
          scope: meta.scope || "global",
          scope_target: meta.scope_target || meta.scopeTarget || "All Faculty",
          reason: meta.reason || "Administrative Extension",
          reason_details: meta.reason_details || null,
          extension_preset: meta.extension_preset || meta.preset || "Extended",
          notified_faculty: meta.notified_faculty ?? true,
        });
        return;
      }

      if (log.action === "submission_window.faculty_override" || log.action === "submission_window.faculty_close") {
        unifiedLogs.push({
          id: log.id,
          action_type: "FACULTY_OVERRIDE",
          action_label: log.action === "submission_window.faculty_close" ? "Faculty Window Closed" : "Faculty Window Adjusted",
          created_at: log.created_at,
          extended_by: log.actor_id,
          extended_by_name: actor,
          actor_name: actor,
          academic_year: activeTerm?.academicYear ?? null,
          semester: activeTerm?.semester ?? null,
          old_end_date: null,
          old_end_time: null,
          new_end_date: meta.due_at || meta.end_date || "",
          new_end_time: "",
          scope: "faculty",
          scope_target: meta.faculty_name || meta.faculty_email || "Individual Faculty",
          reason: meta.reason || "Individual Schedule Override",
          reason_details: meta.remarks || null,
          extension_preset: null,
          notified_faculty: true,
        });
        return;
      }
    });

    // C. Map recorded terms from submission_window_terms (if not already represented)
    (termsData || []).forEach((term: any) => {
      const termKey = `${term.academic_year}_${term.semester}`;
      const hasTermUpdate = unifiedLogs.some(
        (l) => l.academic_year === term.academic_year && l.semester === term.semester && l.action_type === "SCHEDULE_UPDATE",
      );

      if (!hasTermUpdate && term.start_date && term.end_date) {
        const actor = actorNameMap.get(term.created_by) || "Administrator";
        unifiedLogs.push({
          id: `term-${term.id || termKey}`,
          action_type: "SCHEDULE_UPDATE",
          action_label: "Term Schedule Established",
          created_at: term.created_at || new Date().toISOString(),
          extended_by: term.created_by,
          extended_by_name: actor,
          actor_name: actor,
          academic_year: term.academic_year,
          semester: term.semester,
          start_date: term.start_date,
          start_time: term.start_time ? format24HourTo12Hour(term.start_time) : null,
          old_end_date: null,
          old_end_time: null,
          new_end_date: term.end_date,
          new_end_time: term.end_time ? format24HourTo12Hour(term.end_time) : "",
          scope: "global",
          scope_target: `${term.academic_year} • ${term.semester}`,
          reason: "Academic Term Submission Window",
          reason_details: `Scheduled from ${term.start_date} to ${term.end_date}`,
          extension_preset: null,
          notified_faculty: true,
        });
      }
    });

    // D. Map current active window from submission_windows if not already represented
    if (currentWindowRow?.start_date && currentWindowRow?.end_date) {
      const activeAY = currentWindowRow.academic_year || activeTerm.academicYear;
      const activeSem = currentWindowRow.semester || activeTerm.semester;

      const hasExactScheduleLog = unifiedLogs.some(
        (l) =>
          l.action_type === "SCHEDULE_UPDATE" &&
          (l.new_end_date === currentWindowRow.end_date || l.start_date === currentWindowRow.start_date),
      );

      if (!hasExactScheduleLog) {
        const actor = actorNameMap.get(currentWindowRow.updated_by) || "Administrator";
        unifiedLogs.push({
          id: `active-schedule-1`,
          action_type: "SCHEDULE_UPDATE",
          action_label: "Submission Schedule Configured",
          created_at: currentWindowRow.updated_at || new Date().toISOString(),
          extended_by: currentWindowRow.updated_by,
          extended_by_name: actor,
          actor_name: actor,
          academic_year: activeAY,
          semester: activeSem,
          start_date: currentWindowRow.start_date,
          start_time: currentWindowRow.start_time ? format24HourTo12Hour(currentWindowRow.start_time) : "12:30 PM",
          old_end_date: null,
          old_end_time: null,
          new_end_date: currentWindowRow.end_date,
          new_end_time: currentWindowRow.end_time ? format24HourTo12Hour(currentWindowRow.end_time) : "12:30 PM",
          scope: "global",
          scope_target: `${activeAY} • ${activeSem}`,
          reason: "Live Submission Schedule",
          reason_details: `Configured submission schedule: Opening ${currentWindowRow.start_date} ${currentWindowRow.start_time ? format24HourTo12Hour(currentWindowRow.start_time) : "12:30 PM"} → Deadline ${currentWindowRow.end_date} ${currentWindowRow.end_time ? format24HourTo12Hour(currentWindowRow.end_time) : "12:30 PM"}`,
          extension_preset: null,
          notified_faculty: true,
        });
      }
    }

    // Sort all unified logs newest first
    unifiedLogs.sort((a, b) => {
      const timeA = new Date(a.created_at).getTime();
      const timeB = new Date(b.created_at).getTime();
      return timeB - timeA;
    });

    return NextResponse.json({
      logs: unifiedLogs,
      activeTerm,
      currentSchedule,
    });
  } catch (err) {
    logger.error("get_submission_window_logs_exception", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ logs: [] }, { status: 200 });
  }
}

