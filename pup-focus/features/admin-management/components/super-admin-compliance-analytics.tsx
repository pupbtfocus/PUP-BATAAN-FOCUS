"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle, ClockRotateRight, EditPencil, Group, NavArrowRight } from "iconoir-react";
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
    const allRequirementCodes = new Set<string>();
    for (const faculty of activeFaculty) {
      if (faculty.requirementStatus) {
        for (const k of Object.keys(faculty.requirementStatus)) {
          allRequirementCodes.add(k);
        }
      }
    }
    const requiredCodes =
      allRequirementCodes.size > 0
        ? Array.from(allRequirementCodes)
        : (DEFAULT_REQUIREMENTS as readonly string[]);

    const totalRequired = requiredCodes.length;
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
        faculty.requirementStatus || ({} as Record<string, RequirementStatus>);
      let validatedCount = 0;
      let uploadedCount = 0;
      let revisionCount = 0;

      for (const code of requiredCodes) {
        const rawStatus = statusMap[code as RequirementCode] || "not_submitted";
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

  const total = summary.totalActive || 0;

  const completedPct = total > 0 ? Math.round((summary.completedFaculty / total) * 100) : 0;
  const inProgressPct = total > 0 ? Math.round((summary.inProgressFaculty / total) * 100) : 0;
  const revisionPct = total > 0 ? Math.round((summary.needsRevisionFaculty / total) * 100) : 0;
  const notStartedPct = total > 0 ? Math.round((summary.notStartedFaculty / total) * 100) : 0;

  const termLabel =
    windowInfo?.academicYear && windowInfo?.semester
      ? `AY ${windowInfo.academicYear} • ${windowInfo.semester}`
      : "Current Academic Term";

  const categories = [
    {
      id: "completed",
      label: "All Done",
      shortLabel: "Done",
      detail: "Turned in all requirements",
      count: summary.completedFaculty,
      pct: completedPct,
      color: "#0b5336",
      solidBg: "bg-[#0b5336]",
      gradient: "from-[#0b5336] to-[#0b5336]",
      accentBg: "bg-white",
      accentText: "text-emerald-700 dark:text-emerald-400",
      badgePill: "bg-[#0b5336] text-white border border-[#08412a]",
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
      detail: "Still working on requirements",
      count: summary.inProgressFaculty,
      pct: inProgressPct,
      color: "#f59e0b",
      solidBg: "bg-amber-500",
      gradient: "from-amber-500 to-amber-500",
      accentBg: "bg-white",
      accentText: "text-amber-700 dark:text-amber-400",
      badgePill: "bg-amber-500 text-white border border-amber-600",
      cardClass: "bg-amber-500 text-white border border-amber-600 shadow-xs",
      titleClass: "text-white font-extrabold",
      detailClass: "text-amber-100 font-medium",
      countPill: "bg-white/20 text-white border border-white/20 font-bold",
      divideClass: "border-white/20",
      pctClass: "text-white font-black",
    },
    {
      id: "needs_revision",
      label: "Needs Changes",
      shortLabel: "Changes",
      detail: "Sent back for corrections",
      count: summary.needsRevisionFaculty,
      pct: revisionPct,
      color: "#780000",
      solidBg: "bg-[#780000]",
      gradient: "from-[#780000] to-[#780000]",
      accentBg: "bg-white",
      accentText: "text-[#780000] dark:text-rose-400",
      badgePill: "bg-[#780000] text-white border border-[#5e0000]",
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
      detail: "No files uploaded yet",
      count: summary.notStartedFaculty,
      pct: notStartedPct,
      color: "#64748b",
      solidBg: "bg-slate-600",
      gradient: "from-slate-600 to-slate-600",
      accentBg: "bg-white",
      accentText: "text-slate-600 dark:text-slate-400",
      badgePill: "bg-slate-600 text-white border border-slate-700",
      cardClass: "bg-slate-600 text-white border border-slate-500 dark:bg-slate-800 dark:border-slate-700 shadow-xs",
      titleClass: "text-white font-extrabold",
      detailClass: "text-slate-300",
      countPill: "bg-white/20 text-white border border-white/20 font-bold",
      divideClass: "border-white/20",
      pctClass: "text-slate-200 font-black",
    },
  ];

  const donutRadius = 66;
  const donutCircumference = 2 * Math.PI * donutRadius;

  const donutSegments = useMemo(() => {
    if (total === 0) return [];
    let accumulatedOffset = 0;

    return categories
      .filter((cat) => cat.count > 0)
      .map((cat) => {
        const strokeLength = (cat.count / total) * donutCircumference;
        const strokeDashoffset = -accumulatedOffset;
        accumulatedOffset += strokeLength;

        return {
          ...cat,
          strokeLength,
          strokeDashoffset,
        };
      });
  }, [categories, total, donutCircumference]);

  return (
    <section className="mb-6">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs space-y-4 transition-colors">
        {/* Header with casual title & chart toggle */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100">
              Faculty Progress Overview
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {summary.completedFaculty} of {summary.totalActive} faculty are all done ({termLabel})
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
                <span>Check Submissions</span>
                <NavArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Visual Analytics: Pie/Donut Chart or Bar Graph */}
        {chartView === "pie" ? (
          <div className="flex flex-col lg:flex-row items-center gap-6 pt-1">
            {/* Left: Donut Chart with overall submission rate in center */}
            <div className="relative flex items-center justify-center shrink-0">
              <svg className="w-48 h-48 sm:w-56 sm:h-56 -rotate-90 drop-shadow-sm" viewBox="0 0 180 180">
                <circle
                  cx="90"
                  cy="90"
                  r={donutRadius}
                  fill="transparent"
                  stroke="currentColor"
                  strokeWidth="22"
                  className="text-slate-100 dark:text-slate-800"
                />
                {total === 0 ? (
                  <circle
                    cx="90"
                    cy="90"
                    r={donutRadius}
                    fill="transparent"
                    stroke="#cbd5e1"
                    strokeWidth="22"
                    className="dark:stroke-slate-700"
                  />
                ) : (
                  donutSegments.map((seg) => (
                    <circle
                      key={seg.id}
                      cx="90"
                      cy="90"
                      r={donutRadius}
                      fill="transparent"
                      stroke={seg.color}
                      strokeWidth="22"
                      strokeDasharray={`${seg.strokeLength} ${donutCircumference}`}
                      strokeDashoffset={seg.strokeDashoffset}
                      className="transition-all duration-700 ease-out cursor-pointer hover:opacity-90"
                    >
                      <title>{seg.label}: {seg.count} ({seg.pct}%)</title>
                    </circle>
                  ))
                )}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 leading-none">
                  {summary.overallSubmissionRate}%
                </span>
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1">
                  Turned In
                </span>
              </div>
            </div>

            {/* Right: Category Cards (2x2 Grid) matching Columns chart style */}
            <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs flex flex-col justify-between space-y-3 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-xs sm:text-sm text-slate-800 dark:text-slate-100 truncate">
                      {cat.label}
                    </span>
                    {cat.id === "completed" && (
                      <CheckCircle className="h-4.5 w-4.5 text-slate-400" strokeWidth={2} />
                    )}
                    {cat.id === "in_progress" && (
                      <ClockRotateRight className="h-4.5 w-4.5 text-slate-400" strokeWidth={2} />
                    )}
                    {cat.id === "needs_revision" && (
                      <EditPencil className="h-4.5 w-4.5 text-slate-400" strokeWidth={2} />
                    )}
                    {cat.id === "not_started" && (
                      <Group className="h-4.5 w-4.5 text-slate-400" strokeWidth={2} />
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 h-6 bg-slate-200/50 dark:bg-slate-800/50 rounded-lg p-0.5 flex items-center overflow-hidden">
                        <div
                          className={`h-full rounded-md ${cat.solidBg} transition-all duration-700 ease-out shadow-xs`}
                          style={{
                            width: `${summary.totalActive > 0 ? (cat.count > 0 ? Math.max(cat.pct, 6) : 0) : 0}%`,
                          }}
                        />
                      </div>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-black shadow-2xs whitespace-nowrap shrink-0 ${
                          cat.count > 0
                            ? cat.badgePill
                            : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700"
                        }`}
                      >
                        <span className="font-bold mr-1">{cat.count} •</span>
                        <span>{cat.pct}%</span>
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800 truncate">
                      {cat.detail}
                    </p>
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
                Where Everyone Stands ({summary.totalActive} Total Faculty)
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
                              <span
                                className={`inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-black shadow-2xs whitespace-nowrap transition-transform group-hover:scale-105 ${
                                  cat.count > 0
                                    ? cat.badgePill
                                    : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700"
                                }`}
                              >
                                <span className="hidden sm:inline mr-1 font-bold">{cat.count} •</span>
                                <span>{cat.pct}%</span>
                              </span>
                            </div>

                            {/* Column Track & Bar */}
                            <div className="w-10 sm:w-16 h-full flex flex-col justify-end items-center bg-slate-200/50 dark:bg-slate-800/50 rounded-t-xl overflow-hidden p-1">
                              <div
                                className={`w-full rounded-t-lg ${cat.solidBg} transition-all duration-700 ease-out shadow-xs`}
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
                      <span className="font-extrabold text-[11px] sm:text-xs text-slate-800 dark:text-slate-100 truncate">
                        <span className="sm:hidden">{cat.shortLabel}</span>
                        <span className="hidden sm:inline">{cat.label}</span>
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium hidden sm:block truncate max-w-full">
                        {cat.detail}
                      </span>
                      <span className={`text-[10px] font-extrabold mt-0.5 sm:hidden ${cat.accentText}`}>
                        {cat.count} faculty
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Sleek Horizontal Bar Graph - Matching Columns View */
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 p-4 sm:p-5 space-y-4">
                {/* Horizontal scale indicators */}
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 dark:text-slate-500 sm:pl-52 pr-16 border-b border-dashed border-slate-200 dark:border-slate-800 pb-2">
                  <span>0%</span>
                  <span>25%</span>
                  <span>50%</span>
                  <span>75%</span>
                  <span>100%</span>
                </div>

                <div className="space-y-3.5">
                  {categories.map((cat) => (
                    <div
                      key={cat.id}
                      className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 group"
                    >
                      {/* Left: Label & Subtitle */}
                      <div className="w-full sm:w-48 shrink-0">
                        <span className="font-extrabold text-xs sm:text-sm text-slate-800 dark:text-slate-100 truncate block">
                          {cat.label}
                        </span>
                        <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                          {cat.detail}
                        </p>
                      </div>

                      {/* Right: Track + Bar + Badge */}
                      <div className="flex-1 flex items-center gap-2 sm:gap-3 min-w-0">
                        <div className="flex-1 h-8 sm:h-9 bg-slate-200/50 dark:bg-slate-800/50 rounded-xl p-1 flex items-center overflow-hidden">
                          <div
                            className={`h-full rounded-lg ${cat.solidBg} transition-all duration-700 ease-out shadow-xs`}
                            style={{
                              width: `${summary.totalActive > 0 ? (cat.count > 0 ? Math.max(cat.pct, 5) : 0) : 0}%`,
                            }}
                          />
                        </div>

                        {/* Floating Badge matching Columns view */}
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] sm:text-xs font-black shadow-2xs whitespace-nowrap shrink-0 transition-transform group-hover:scale-105 ${
                            cat.count > 0
                              ? cat.badgePill
                              : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700"
                          }`}
                        >
                          <span className="font-bold mr-1">{cat.count} •</span>
                          <span>{cat.pct}%</span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
