"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { NavArrowRight } from "iconoir-react";
import {
  DEFAULT_REQUIREMENTS,
  type RequirementCode,
} from "@/config/compliance";
import type {
  FacultyAccount,
  RequirementStatus,
  SubmissionWindowResponse,
} from "@/features/faculty-management/types/faculty-dashboard.types";
import { useRealtimeSync } from "@/lib/realtime";

interface SuperAdminComplianceAnalyticsProps {
  facultyAccounts: FacultyAccount[];
  isLoadingFaculty?: boolean;
  onInspectFaculty?: (facultyId: string) => void;
  onNavigateSection?: (
    section: "verification" | "faculty" | "window" | "terms"
  ) => void;
}

type FacultyComplianceCategory =
  | "completed"
  | "in_progress"
  | "needs_revision"
  | "not_started";

export function SuperAdminComplianceAnalytics({
  facultyAccounts,
  onNavigateSection,
}: SuperAdminComplianceAnalyticsProps) {
  const [windowInfo, setWindowInfo] = useState<SubmissionWindowResponse | null>(null);

  const fetchTermAndWindow = useCallback(async () => {
    try {
      const res = await fetch(`/api/staff/submission-window?_t=${Date.now()}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (res.ok) {
        let data = (await res.json()) as SubmissionWindowResponse;
        if (!data.academicYear || !data.semester) {
          const termsRes = await fetch(`/api/staff/academic-terms?_t=${Date.now()}`, {
            credentials: "include",
            cache: "no-store",
          });
          if (termsRes.ok) {
            const termsJson = await termsRes.json();
            const termsList = Array.isArray(termsJson?.terms) ? termsJson.terms : [];
            const currentTerm =
              termsList.find(
                (t: { status?: string }) =>
                  (t.status || "").trim().toLowerCase() === "current"
              ) || termsList[0];
            if (currentTerm?.academicYear && currentTerm?.semester) {
              data = {
                ...data,
                academicYear: currentTerm.academicYear,
                semester: currentTerm.semester,
              };
            }
          }
        }
        setWindowInfo(data);
      }
    } catch {
      // Ignore fetch errors
    }
  }, []);

  useEffect(() => {
    void fetchTermAndWindow();
  }, [fetchTermAndWindow]);

  useRealtimeSync(() => {
    void fetchTermAndWindow();
  });

  const activeFaculty = useMemo(
    () => facultyAccounts.filter((f) => f.is_active),
    [facultyAccounts]
  );

  const summary = useMemo(() => {
    const totalRequired = DEFAULT_REQUIREMENTS.length;
    const totalActive = activeFaculty.length;

    let completedFaculty = 0;
    let inProgressFaculty = 0;
    let needsRevisionFaculty = 0;
    let notStartedFaculty = 0;

    let totalSubmittedDocs = 0;
    let totalValidatedDocs = 0;
    let totalPendingReviewDocs = 0;
    let totalRevisionDocs = 0;

    for (const faculty of activeFaculty) {
      const statusMap =
        faculty.requirementStatus || ({} as Record<RequirementCode, RequirementStatus>);
      let validatedCount = 0;
      let uploadedCount = 0;
      let revisionCount = 0;

      for (const code of DEFAULT_REQUIREMENTS) {
        const rawStatus = statusMap[code] || "not_submitted";
        if (rawStatus === "validated") {
          validatedCount += 1;
        } else if (rawStatus === "uploaded") {
          uploadedCount += 1;
        } else if (rawStatus === "rejected" || rawStatus === "needs_revision") {
          revisionCount += 1;
        }
      }

      const submittedOrValidated = validatedCount + uploadedCount;
      totalSubmittedDocs += submittedOrValidated;
      totalValidatedDocs += validatedCount;
      totalPendingReviewDocs += uploadedCount;
      totalRevisionDocs += revisionCount;

      let category: FacultyComplianceCategory = "in_progress";
      if (submittedOrValidated === totalRequired && totalRequired > 0) {
        category = "completed";
      } else if (revisionCount > 0) {
        category = "needs_revision";
      } else if (submittedOrValidated === 0) {
        category = "not_started";
      } else {
        category = "in_progress";
      }

      if (category === "completed") completedFaculty += 1;
      else if (category === "in_progress") inProgressFaculty += 1;
      else if (category === "needs_revision") needsRevisionFaculty += 1;
      else notStartedFaculty += 1;
    }

    const notCompletedFaculty = totalActive - completedFaculty;
    const totalPossibleDocs = totalActive * totalRequired;
    const overallSubmissionRate =
      totalPossibleDocs > 0
        ? Math.round((totalSubmittedDocs / totalPossibleDocs) * 1000) / 10
        : 0;
    const overallValidationRate =
      totalPossibleDocs > 0
        ? Math.round((totalValidatedDocs / totalPossibleDocs) * 1000) / 10
        : 0;

    return {
      totalActive,
      completedFaculty,
      notCompletedFaculty,
      inProgressFaculty,
      needsRevisionFaculty,
      notStartedFaculty,
      totalPossibleDocs,
      totalValidatedDocs,
      totalPendingReviewDocs,
      totalRevisionDocs,
      overallSubmissionRate,
      overallValidationRate,
    };
  }, [activeFaculty]);

  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const completedArc =
    summary.totalActive > 0
      ? (summary.completedFaculty / summary.totalActive) * circumference
      : 0;
  const inProgressArc =
    summary.totalActive > 0
      ? (summary.inProgressFaculty / summary.totalActive) * circumference
      : 0;
  const revisionArc =
    summary.totalActive > 0
      ? (summary.needsRevisionFaculty / summary.totalActive) * circumference
      : 0;
  const notStartedArc =
    summary.totalActive > 0
      ? (summary.notStartedFaculty / summary.totalActive) * circumference
      : 0;

  const termLabel =
    windowInfo?.academicYear && windowInfo?.semester
      ? `AY ${windowInfo.academicYear} • ${windowInfo.semester}`
      : "Current Academic Term";

  return (
    <section className="mb-6">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#800000] dark:text-amber-400">
              Faculty Completion Analytics
            </span>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100 mt-0.5">
              Term Submission Scale &amp; Distribution
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {summary.completedFaculty} Completed • {summary.notCompletedFaculty} Not Completed ({termLabel})
            </p>
          </div>

          {onNavigateSection && (
            <button
              type="button"
              onClick={() => onNavigateSection("verification")}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-600 px-3 py-1.5 text-xs font-bold transition cursor-pointer shadow-xs"
            >
              <span>Verify Submissions</span>
              <NavArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Radial Donut Gauge + 4 Status Distribution Cards */}
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="relative flex items-center justify-center shrink-0">
            <svg className="w-36 h-36 -rotate-90" viewBox="0 0 140 140">
              <circle
                cx="70"
                cy="70"
                r={radius}
                fill="transparent"
                stroke="currentColor"
                strokeWidth="16"
                className="text-slate-100 dark:text-slate-800"
              />
              {completedArc > 0 && (
                <circle
                  cx="70"
                  cy="70"
                  r={radius}
                  fill="transparent"
                  stroke="#0b5336"
                  strokeWidth="16"
                  strokeDasharray={`${completedArc} ${circumference}`}
                  strokeDashoffset={0}
                />
              )}
              {inProgressArc > 0 && (
                <circle
                  cx="70"
                  cy="70"
                  r={radius}
                  fill="transparent"
                  stroke="#f59e0b"
                  strokeWidth="16"
                  strokeDasharray={`${inProgressArc} ${circumference}`}
                  strokeDashoffset={-completedArc}
                />
              )}
              {revisionArc > 0 && (
                <circle
                  cx="70"
                  cy="70"
                  r={radius}
                  fill="transparent"
                  stroke="#e11d48"
                  strokeWidth="16"
                  strokeDasharray={`${revisionArc} ${circumference}`}
                  strokeDashoffset={-(completedArc + inProgressArc)}
                />
              )}
              {notStartedArc > 0 && (
                <circle
                  cx="70"
                  cy="70"
                  r={radius}
                  fill="transparent"
                  stroke="#780000"
                  strokeWidth="16"
                  strokeDasharray={`${notStartedArc} ${circumference}`}
                  strokeDashoffset={-(completedArc + inProgressArc + revisionArc)}
                />
              )}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-2xl font-black text-slate-900 dark:text-slate-100 leading-none">
                {summary.overallSubmissionRate}%
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-1">
                Term Scale
              </span>
            </div>
          </div>

          <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#0b5336] text-white border border-[#08412a] shadow-xs">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm bg-white/90 shrink-0" />
                <span className="font-bold text-white">
                  Completed (All 6)
                </span>
              </div>
              <span className="font-extrabold text-white">
                {summary.completedFaculty} faculty
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-amber-500 text-slate-950 border border-amber-600 shadow-xs">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm bg-slate-950 shrink-0" />
                <span className="font-bold text-slate-950">
                  In Progress (Partial)
                </span>
              </div>
              <span className="font-extrabold text-slate-950">
                {summary.inProgressFaculty} faculty
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-rose-600 text-white border border-rose-700 shadow-xs">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm bg-white/90 shrink-0" />
                <span className="font-bold text-white">
                  Needs Revision
                </span>
              </div>
              <span className="font-extrabold text-white">
                {summary.needsRevisionFaculty} faculty
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-[#780000] text-white border border-[#5e0000] shadow-xs">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm bg-amber-400 shrink-0" />
                <span className="font-bold text-white">
                  Not Completed (0/6)
                </span>
              </div>
              <span className="font-extrabold text-amber-300">
                {summary.notStartedFaculty} faculty
              </span>
            </div>
          </div>
        </div>

        {/* 0% - 100% Linear Compliance Scale Meter */}
        <div className="space-y-2 pt-3 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700 dark:text-slate-300">
              Campus Compliance Scale Meter ({summary.completedFaculty} Completed / {summary.notCompletedFaculty} Not Completed)
            </span>
            <span className="font-extrabold text-[#800000] dark:text-amber-400">
              {summary.overallSubmissionRate}% Submitted • {summary.overallValidationRate}% Validated
            </span>
          </div>

          <div className="relative h-3.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden flex shadow-inner">
            {summary.totalPossibleDocs > 0 && (
              <>
                <div
                  className="h-full bg-[#0b5336] transition-all duration-500"
                  style={{
                    width: `${(summary.totalValidatedDocs / summary.totalPossibleDocs) * 100}%`,
                  }}
                  title={`Validated: ${summary.totalValidatedDocs}`}
                />
                <div
                  className="h-full bg-amber-500 transition-all duration-500"
                  style={{
                    width: `${(summary.totalPendingReviewDocs / summary.totalPossibleDocs) * 100}%`,
                  }}
                  title={`Pending Review: ${summary.totalPendingReviewDocs}`}
                />
                <div
                  className="h-full bg-rose-600 transition-all duration-500"
                  style={{
                    width: `${(summary.totalRevisionDocs / summary.totalPossibleDocs) * 100}%`,
                  }}
                  title={`Needs Revision: ${summary.totalRevisionDocs}`}
                />
              </>
            )}
          </div>

          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 dark:text-slate-500">
            <span>0% (None)</span>
            <span>25%</span>
            <span>50% (Halfway)</span>
            <span>75%</span>
            <span>100% (Complete)</span>
          </div>
        </div>
      </div>
    </section>
  );
}
