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
  const [chartView, setChartView] = useState<"pie" | "bar">("pie");
  const [barLayout, setBarLayout] = useState<"column" | "horizontal">("column");

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

  // Donut/Pie Arc Calculations
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const total = summary.totalActive || 1;

  const completedPct = Math.round((summary.completedFaculty / total) * 100);
  const inProgressPct = Math.round((summary.inProgressFaculty / total) * 100);
  const revisionPct = Math.round((summary.needsRevisionFaculty / total) * 100);
  const notStartedPct = Math.round((summary.notStartedFaculty / total) * 100);

  const completedArc = (summary.completedFaculty / total) * circumference;
  const inProgressArc = (summary.inProgressFaculty / total) * circumference;
  const revisionArc = (summary.needsRevisionFaculty / total) * circumference;
  const notStartedArc = (summary.notStartedFaculty / total) * circumference;

  const termLabel =
    windowInfo?.academicYear && windowInfo?.semester
      ? `AY ${windowInfo.academicYear} • ${windowInfo.semester}`
      : "Current Academic Term";

  const categories = [
    {
      id: "completed",
      label: "All Done",
      shortLabel: "Done",
      detail: "Turned in all 6 requirements",
      count: summary.completedFaculty,
      pct: completedPct,
      color: "#0b5336",
      gradient: "from-[#0b5336] to-emerald-600",
      accentBg: "bg-white",
      accentText: "text-emerald-700 dark:text-emerald-400",
      badgePill: "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800",
      cardClass: "bg-[#0b5336] text-white border border-[#08412a] shadow-xs",
      titleClass: "text-white font-extrabold",
      detailClass: "text-emerald-100",
      countPill: "bg-white/20 text-white border border-white/20 font-bold",
      divideClass: "border-white/20",
      pctClass: "text-emerald-200 font-black",
    },
    {
      id: "in_progress",
      label: "In Progress",
      shortLabel: "In Progress",
      detail: "Working on requirements",
      count: summary.inProgressFaculty,
      pct: inProgressPct,
      color: "#f59e0b",
      gradient: "from-amber-600 to-amber-400",
      accentBg: "bg-slate-950",
      accentText: "text-amber-700 dark:text-amber-400",
      badgePill: "bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800",
      cardClass: "bg-amber-500 text-slate-950 border border-amber-600 shadow-xs",
      titleClass: "text-slate-950 font-extrabold",
      detailClass: "text-amber-950/90 font-medium",
      countPill: "bg-slate-950/15 text-slate-950 border border-slate-950/25 font-bold",
      divideClass: "border-slate-950/20",
      pctClass: "text-slate-950 font-black",
    },
    {
      id: "needs_revision",
      label: "Needs Changes",
      shortLabel: "Changes",
      detail: "Returned for re-upload",
      count: summary.needsRevisionFaculty,
      pct: revisionPct,
      color: "#780000",
      gradient: "from-[#780000] to-red-600",
      accentBg: "bg-white",
      accentText: "text-[#780000] dark:text-rose-400",
      badgePill: "bg-red-50 dark:bg-red-950/60 text-red-900 dark:text-red-300 border border-red-200 dark:border-red-900",
      cardClass: "bg-[#780000] text-white border border-[#5e0000] shadow-xs",
      titleClass: "text-white font-extrabold",
      detailClass: "text-red-200",
      countPill: "bg-white/20 text-white border border-white/20 font-bold",
      divideClass: "border-white/20",
      pctClass: "text-amber-300 font-black",
    },
    {
      id: "not_started",
      label: "Haven't Started",
      shortLabel: "Not Started",
      detail: "No documents uploaded yet",
      count: summary.notStartedFaculty,
      pct: notStartedPct,
      color: "#475569",
      gradient: "from-slate-700 to-slate-500",
      accentBg: "bg-white",
      accentText: "text-slate-600 dark:text-slate-400",
      badgePill: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700",
      cardClass: "bg-slate-700 text-white border border-slate-600 dark:bg-slate-800 dark:border-slate-700 shadow-xs",
      titleClass: "text-white font-extrabold",
      detailClass: "text-slate-300",
      countPill: "bg-white/20 text-white border border-white/20 font-bold",
      divideClass: "border-white/20",
      pctClass: "text-slate-200 font-black",
    },
  ];

  return (
    <section className="mb-6">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs space-y-5 transition-colors">
        {/* Header with casual title & chart toggle */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#780000] dark:text-amber-400">
              Submission Tracker
            </span>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100 mt-0.5">
              Faculty Submissions Overview
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {summary.completedFaculty} of {summary.totalActive} faculty have finished everything ({termLabel})
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* View Mode Toggle: Pie vs Bar */}
            <div className="inline-flex items-center rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-1">
              <button
                type="button"
                onClick={() => setChartView("pie")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                  chartView === "pie"
                    ? "bg-[#780000] text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                }`}
                title="View as Pie Chart"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
                  <path d="M22 12A10 10 0 0 0 12 2v10z" />
                </svg>
                <span>Pie Chart</span>
              </button>
              <button
                type="button"
                onClick={() => setChartView("bar")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                  chartView === "bar"
                    ? "bg-[#780000] text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                }`}
                title="View as Bar Graph"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
                <span>Bar Graph</span>
              </button>
            </div>

            {onNavigateSection && (
              <button
                type="button"
                onClick={() => onNavigateSection("verification")}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-600 px-3 py-1.5 text-xs font-bold transition cursor-pointer shadow-xs active:scale-[0.98]"
              >
                <span>Review Submissions</span>
                <NavArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Visual Analytics: Pie Chart or Bar Graph */}
        {chartView === "pie" ? (
          <div className="flex flex-col md:flex-row items-center gap-6 pt-1">
            {/* Pie / Donut Chart */}
            <div className="relative flex items-center justify-center shrink-0">
              <svg className="w-40 h-40 -rotate-90" viewBox="0 0 140 140">
                <circle
                  cx="70"
                  cy="70"
                  r={radius}
                  fill="transparent"
                  stroke="currentColor"
                  strokeWidth="20"
                  className="text-slate-100 dark:text-slate-800"
                />
                {summary.totalActive === 0 ? (
                  <circle
                    cx="70"
                    cy="70"
                    r={radius}
                    fill="transparent"
                    stroke="#cbd5e1"
                    strokeWidth="20"
                    className="dark:stroke-slate-700"
                  />
                ) : (
                  <>
                    {completedArc > 0 && (
                      <circle
                        cx="70"
                        cy="70"
                        r={radius}
                        fill="transparent"
                        stroke="#0b5336"
                        strokeWidth="20"
                        strokeDasharray={`${completedArc} ${circumference}`}
                        strokeDashoffset={0}
                        className="transition-all duration-700 ease-out"
                      />
                    )}
                    {inProgressArc > 0 && (
                      <circle
                        cx="70"
                        cy="70"
                        r={radius}
                        fill="transparent"
                        stroke="#f59e0b"
                        strokeWidth="20"
                        strokeDasharray={`${inProgressArc} ${circumference}`}
                        strokeDashoffset={-completedArc}
                        className="transition-all duration-700 ease-out"
                      />
                    )}
                    {revisionArc > 0 && (
                      <circle
                        cx="70"
                        cy="70"
                        r={radius}
                        fill="transparent"
                        stroke="#780000"
                        strokeWidth="20"
                        strokeDasharray={`${revisionArc} ${circumference}`}
                        strokeDashoffset={-(completedArc + inProgressArc)}
                        className="transition-all duration-700 ease-out"
                      />
                    )}
                    {notStartedArc > 0 && (
                      <circle
                        cx="70"
                        cy="70"
                        r={radius}
                        fill="transparent"
                        stroke="#475569"
                        strokeWidth="20"
                        strokeDasharray={`${notStartedArc} ${circumference}`}
                        strokeDashoffset={-(completedArc + inProgressArc + revisionArc)}
                        className="transition-all duration-700 ease-out"
                      />
                    )}
                  </>
                )}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                <span className="text-2xl font-black text-slate-900 dark:text-slate-100 leading-none">
                  {summary.overallSubmissionRate}%
                </span>
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1">
                  Turned In
                </span>
              </div>
            </div>

            {/* Status Cards (2x2 Grid) */}
            <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className={`flex flex-col justify-between p-3.5 rounded-xl border shadow-xs transition ${cat.cardClass}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`h-2.5 w-2.5 rounded-full ${cat.accentBg} shrink-0 ring-2 ring-white/30`} />
                      <span className={`font-extrabold text-sm truncate ${cat.titleClass}`}>
                        {cat.label}
                      </span>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${cat.countPill}`}>
                      {cat.count} {cat.count === 1 ? "faculty" : "faculty"}
                    </span>
                  </div>
                  <div className={`flex items-center justify-between mt-2 pt-1.5 border-t text-[11px] ${cat.divideClass} ${cat.detailClass}`}>
                    <span className="truncate pr-1">{cat.detail}</span>
                    <span className={`font-black shrink-0 ${cat.pctClass}`}>
                      {summary.totalActive > 0 ? `${cat.pct}%` : "0%"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Bar Graph View */
          <div className="space-y-4 pt-1">
            {/* Sub-header with orientation switch */}
            <div className="flex items-center justify-between pb-1 text-xs">
              <span className="font-bold text-slate-600 dark:text-slate-400">
                Category Distribution ({summary.totalActive} Total Faculty)
              </span>
              <div className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-950 p-0.5">
                <button
                  type="button"
                  onClick={() => setBarLayout("column")}
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold transition cursor-pointer ${
                    barLayout === "column"
                      ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-2xs"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                  title="Columns (Vertical)"
                >
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="20" x2="18" y2="10" />
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="14" />
                  </svg>
                  <span>Columns</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBarLayout("horizontal")}
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold transition cursor-pointer ${
                    barLayout === "horizontal"
                      ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-2xs"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                  title="Rows (Horizontal)"
                >
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="4" y1="6" x2="20" y2="6" />
                    <line x1="4" y1="12" x2="20" y2="12" />
                    <line x1="4" y1="18" x2="20" y2="18" />
                  </svg>
                  <span>Rows</span>
                </button>
              </div>
            </div>

            {barLayout === "column" ? (
              /* Vertical Column Bar Graph */
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 p-4 sm:p-5">
                <div className="relative flex">
                  {/* Y-Axis scale */}
                  <div className="flex flex-col justify-between items-end pr-2.5 sm:pr-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 h-48 sm:h-56 shrink-0 select-none pb-1">
                    <span>100%</span>
                    <span>75%</span>
                    <span>50%</span>
                    <span>25%</span>
                    <span>0%</span>
                  </div>

                  {/* Chart area with gridlines & columns */}
                  <div className="relative flex-1 h-48 sm:h-56 border-l border-b border-slate-200 dark:border-slate-800">
                    {/* Horizontal dashed gridlines */}
                    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                      <div className="border-b border-dashed border-slate-200/90 dark:border-slate-800/80 w-full" />
                      <div className="border-b border-dashed border-slate-200/90 dark:border-slate-800/80 w-full" />
                      <div className="border-b border-dashed border-slate-200/90 dark:border-slate-800/80 w-full" />
                      <div className="border-b border-dashed border-slate-200/90 dark:border-slate-800/80 w-full" />
                      <div className="w-full" />
                    </div>

                    {/* Columns Grid */}
                    <div className="relative h-full grid grid-cols-4 gap-2 sm:gap-6 px-2 sm:px-6 items-end">
                      {categories.map((cat) => {
                        const heightPct = summary.totalActive > 0 ? (cat.count > 0 ? Math.max(cat.pct, 5) : 0) : 0;
                        return (
                          <div key={cat.id} className="h-full flex flex-col justify-end items-center group relative">
                            {/* Value badge floating above bar */}
                            <div className="mb-1.5 flex flex-col items-center">
                              <span className={`inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-black shadow-2xs whitespace-nowrap transition-transform group-hover:scale-105 ${cat.badgePill}`}>
                                <span className="hidden sm:inline mr-1 font-bold">{cat.count} •</span>
                                <span>{cat.pct}%</span>
                              </span>
                            </div>

                            {/* Column Track & Bar */}
                            <div className="w-10 sm:w-16 h-full flex flex-col justify-end items-center bg-slate-200/50 dark:bg-slate-800/50 rounded-t-xl overflow-hidden p-1">
                              <div
                                className={`w-full rounded-t-lg bg-gradient-to-t ${cat.gradient} transition-all duration-700 ease-out shadow-xs`}
                                style={{ height: `${heightPct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* X-Axis Category Labels beneath chart */}
                <div className="grid grid-cols-4 gap-2 sm:gap-6 pl-9 sm:pl-12 pr-2 sm:pr-6 pt-3">
                  {categories.map((cat) => (
                    <div key={cat.id} className="flex flex-col items-center text-center">
                      <div className="flex items-center gap-1.5">
                        <span className={`h-2 w-2 rounded-full ${cat.accentBg} shrink-0`} />
                        <span className="font-extrabold text-[11px] sm:text-xs text-slate-800 dark:text-slate-100 truncate">
                          <span className="sm:hidden">{cat.shortLabel}</span>
                          <span className="hidden sm:inline">{cat.label}</span>
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium hidden sm:block truncate max-w-full">
                        {cat.detail}
                      </span>
                      <span className={`text-[10px] font-extrabold mt-0.5 sm:hidden ${cat.accentText}`}>
                        {cat.count} {cat.count === 1 ? "faculty" : "faculty"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Sleek Horizontal Bar Graph */
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 p-4 sm:p-5 space-y-3.5">
                {/* Horizontal scale indicators */}
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 dark:text-slate-500 px-1 border-b border-slate-200 dark:border-slate-800 pb-2">
                  <span>0%</span>
                  <span>25%</span>
                  <span>50%</span>
                  <span>75%</span>
                  <span>100%</span>
                </div>

                <div className="space-y-3">
                  {categories.map((cat) => (
                    <div
                      key={cat.id}
                      className="p-3.5 sm:p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`h-2.5 w-2.5 rounded-full ${cat.accentBg} shrink-0 ring-2 ring-slate-100 dark:ring-slate-800`} />
                          <span className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                            {cat.label}
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline truncate">
                            • {cat.detail}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                            {cat.count} {cat.count === 1 ? "faculty" : "faculty"}
                          </span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-black ${cat.badgePill}`}>
                            {summary.totalActive > 0 ? `${cat.pct}%` : "0%"}
                          </span>
                        </div>
                      </div>

                      <div className="h-3.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 overflow-hidden p-0.5 shadow-inner">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${cat.gradient} transition-all duration-700 ease-out`}
                          style={{
                            width: `${summary.totalActive > 0 ? (cat.count > 0 ? Math.max(cat.pct, 3) : 0) : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Casual Progress Bar */}
        <div className="space-y-2 pt-3 border-t border-slate-200 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
            <span className="font-bold text-slate-800 dark:text-slate-200">
              Campus Progress: {summary.overallSubmissionRate}% turned in • {summary.overallValidationRate}% approved
            </span>
            <span className="text-slate-500 dark:text-slate-400 text-[11px]">
              {summary.completedFaculty} of {summary.totalActive} finished all requirements
            </span>
          </div>

          <div className="relative h-3 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden flex shadow-inner">
            {summary.totalPossibleDocs > 0 && (
              <>
                <div
                  className="h-full bg-[#0b5336] transition-all duration-500"
                  style={{
                    width: `${(summary.totalValidatedDocs / summary.totalPossibleDocs) * 100}%`,
                  }}
                  title={`Approved: ${summary.totalValidatedDocs}`}
                />
                <div
                  className="h-full bg-amber-500 transition-all duration-500"
                  style={{
                    width: `${(summary.totalPendingReviewDocs / summary.totalPossibleDocs) * 100}%`,
                  }}
                  title={`Waiting for Review: ${summary.totalPendingReviewDocs}`}
                />
                <div
                  className="h-full bg-rose-600 transition-all duration-500"
                  style={{
                    width: `${(summary.totalRevisionDocs / summary.totalPossibleDocs) * 100}%`,
                  }}
                  title={`Needs Changes: ${summary.totalRevisionDocs}`}
                />
              </>
            )}
          </div>

          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 dark:text-slate-500">
            <span>0% (Just starting)</span>
            <span>25%</span>
            <span>50% (Halfway)</span>
            <span>75%</span>
            <span>100% (All done!)</span>
          </div>
        </div>
      </div>
    </section>
  );
}
