"use client";

import { useState } from "react";
import {
  Check,
  CheckCircle,
  EditPencil,
  GraduationCap,
  Hourglass,
  Mail,
  Minus,
  Page,
  ShieldCheck,
  User,
  WarningCircle,
  Xmark,
} from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";
import { ModalHeader } from "@/components/ui/modal-header";
import { buildFacultyInitials } from "@/lib/faculty-profile";
import { DEFAULT_REQUIREMENTS, REQUIREMENT_LABEL } from "@/config/compliance";
import { SubmissionStatusBadge } from "@/features/submissions/components/submission-status-badge";
import type { FacultyAccount } from "@/features/faculty-management/types/faculty-dashboard.types";

export interface FacultyDetailsModalProps {
  facultyId: string;
  facultyAccounts: FacultyAccount[];
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (facultyId: string) => void;
}

export function FacultyDetailsModal({
  facultyId,
  facultyAccounts,
  isOpen,
  onClose,
  onEdit,
}: FacultyDetailsModalProps) {
  const [showPhotoPreview, setShowPhotoPreview] = useState(false);

  if (!isOpen) return null;

  const faculty = facultyAccounts.find((f) => f.id === facultyId);
  if (!faculty) return null;

  const createdDate = new Date(faculty.created_at);
  const formattedCreatedDate = Number.isNaN(createdDate.getTime())
    ? "Unknown"
    : createdDate.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });

  const lastLoginIso = faculty.last_sign_in_at || faculty.lastLoginAt;
  const formattedLastLogin = lastLoginIso
    ? (() => {
        const d = new Date(lastLoginIso);
        return Number.isNaN(d.getTime())
          ? "Never logged in"
          : d.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            });
      })()
    : "Never logged in";

  const programCode =
    faculty.program?.code || faculty.program?.name || "Unassigned";
  const programFullName = faculty.program?.name || "No department assigned";

  // Split names cleanly (First, Middle, Last)
  const rawFirstName = faculty.firstName || faculty.first_name || "";
  const rawMiddleName = faculty.middleName || faculty.middle_name || "";
  const rawLastName = faculty.lastName || faculty.last_name || "";

  let firstName = rawFirstName.trim();
  let middleName = rawMiddleName.trim();
  let lastName = rawLastName.trim();

  // If first and last name are not separated in DB columns, parse from fullName
  if (!firstName && !lastName && faculty.fullName) {
    const parts = faculty.fullName.trim().split(/\s+/);
    if (parts.length === 1) {
      firstName = parts[0];
    } else if (parts.length === 2) {
      firstName = parts[0];
      lastName = parts[1];
    } else if (parts.length >= 3) {
      firstName = parts[0];
      middleName = parts.slice(1, -1).join(" ");
      lastName = parts[parts.length - 1];
    }
  }

  // Calculate compliance statistics matching Documents to be Submitted
  const reqStatus = faculty.requirementStatus ?? {};
  let validatedCount = 0;
  let uploadedCount = 0;
  let rejectedCount = 0;
  let notSubmittedCount = 0;

  DEFAULT_REQUIREMENTS.forEach((code) => {
    const raw = reqStatus[code] ?? "not_submitted";
    const status = raw.toLowerCase().trim();
    if (status === "validated" || status === "approved") {
      validatedCount++;
    } else if (
      status === "uploaded" ||
      status === "pending" ||
      status === "pending_review" ||
      status === "revision_under_review" ||
      status === "submitted"
    ) {
      uploadedCount++;
    } else if (
      status === "rejected" ||
      status === "needs_revision" ||
      status === "needs revision" ||
      status === "revision_requested"
    ) {
      rejectedCount++;
    } else {
      notSubmittedCount++;
    }
  });

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="faculty-details-title"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      >
        <div className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100 shadow-xl">
          {/* Header */}
          <ModalHeader
            icon={User}
            title="Faculty Member Details"
            subtitle="Full profile, login info, and compliance overview"
            className="sticky top-0 z-10"
          />

          {/* Content Body */}
          <div className="space-y-6 p-6">
            {/* Faculty Profile Overview Banner Card */}
            <div className="flex items-center gap-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-4">
              <button
                type="button"
                onClick={() => {
                  if (faculty.profileImageUrl) {
                    setShowPhotoPreview(true);
                  }
                }}
                title={faculty.profileImageUrl ? "Click to view photo" : undefined}
                className={`relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-lg font-bold text-slate-700 dark:text-slate-200 ${
                  faculty.profileImageUrl ? "cursor-pointer hover:ring-2 hover:ring-slate-400 dark:hover:ring-slate-600 transition-all" : "cursor-default"
                }`}
              >
                {faculty.profileImageUrl ? (
                  <img
                    src={faculty.profileImageUrl}
                    alt={faculty.fullName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span>{buildFacultyInitials(faculty.fullName)}</span>
                )}
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
                    {faculty.fullName}
                  </h3>
                  {faculty.is_active ? (
                    <span className="bg-[#0b5336] text-white border border-[#08412a] px-2 py-0.5 text-xs font-semibold rounded-md inline-flex items-center gap-1 shadow-2xs">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                      Active
                    </span>
                  ) : (
                    <span className="bg-[#780000] text-white border border-[#5e0000] px-2 py-0.5 text-xs font-semibold rounded-md inline-flex items-center gap-1 shadow-2xs">
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-300" />
                      Inactive
                    </span>
                  )}
                  <span
                    title={programFullName}
                    className="bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 px-2 py-0.5 text-xs font-semibold rounded-md inline-flex items-center"
                  >
                    {programCode}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <AppIcon icon={Mail} size="sm" color="muted" />
                  <span className="truncate">{faculty.email}</span>
                </div>
              </div>
            </div>

            {/* Organized Details Grid: Personal & Academic Information */}
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Personal Information */}
              <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <AppIcon icon={User} size="sm" color="default" />
                  <span>Personal Information</span>
                </div>
                <div className="space-y-2 text-xs divide-y divide-slate-200/60 dark:divide-slate-800/60">
                  <div className="flex justify-between items-center py-1.5">
                    <span className="text-slate-500 dark:text-slate-400">First Name</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {firstName || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1.5">
                    <span className="text-slate-500 dark:text-slate-400">Middle Name</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {middleName || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1.5">
                    <span className="text-slate-500 dark:text-slate-400">Last Name</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {lastName || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1.5">
                    <span className="text-slate-500 dark:text-slate-400">Registered On</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {formattedCreatedDate}
                    </span>
                  </div>
                </div>
              </div>

              {/* Academic & System Information */}
              <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <AppIcon icon={GraduationCap} size="sm" color="default" />
                  <span>Academic & System</span>
                </div>
                <div className="space-y-2 text-xs divide-y divide-slate-200/60 dark:divide-slate-800/60">
                  <div className="flex justify-between items-center py-1.5">
                    <span className="text-slate-500 dark:text-slate-400">Program / Dept</span>
                    <span
                      className="font-semibold text-slate-800 dark:text-slate-200 text-right max-w-[190px] truncate"
                      title={programFullName}
                    >
                      {programFullName}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1.5">
                    <span className="text-slate-500 dark:text-slate-400">Program Code</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {programCode}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1.5">
                    <span className="text-slate-500 dark:text-slate-400">Account Status</span>
                    <span className="inline-flex items-center gap-1.5 font-semibold">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          faculty.is_active ? "bg-[#0b5336]" : "bg-[#780000]"
                        }`}
                      />
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded-md border shadow-2xs ${
                        faculty.is_active
                          ? "bg-[#0b5336] text-white border-[#08412a]"
                          : "bg-[#780000] text-white border-[#5e0000]"
                      }`}>
                        {faculty.is_active ? "Active" : "Inactive"}
                      </span>
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1.5">
                    <span className="text-slate-500 dark:text-slate-400">Last Sign-in</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {formattedLastLogin}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Documents to be Submitted Section (Matching Faculty Documents View) */}
            <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-4 space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/70 dark:border-slate-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded-lg bg-[#800000]/10 dark:bg-[#800000]/20 text-[#800000] dark:text-amber-400">
                    <AppIcon icon={Page} size="sm" color="inherit" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                      Documents to be Submitted
                    </h4>
                  </div>
                </div>

                {/* Status counts with circular icon badges (matching Documents to be Submitted) */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-slate-600 dark:text-slate-400 font-medium">
                  <span className="inline-flex items-center gap-1.5" title="Validated">
                    <span className="inline-flex items-center justify-center h-4.5 w-4.5 rounded-full bg-[#0b5336] text-white border border-[#08412a] shrink-0 shadow-2xs">
                      <AppIcon icon={Check} size="xs" color="white" />
                    </span>
                    <span>
                      <strong className="text-slate-900 dark:text-slate-100 font-semibold">{validatedCount}</strong> Validated
                    </span>
                  </span>

                  <span className="inline-flex items-center gap-1.5" title="Uploaded / Pending">
                    <span className="inline-flex items-center justify-center h-4.5 w-4.5 rounded-full bg-amber-500 text-slate-950 border border-amber-600 shrink-0 shadow-2xs">
                      <AppIcon icon={Hourglass} size="xs" color="inherit" />
                    </span>
                    <span>
                      <strong className="text-slate-900 dark:text-slate-100 font-semibold">{uploadedCount}</strong> Pending
                    </span>
                  </span>

                  {rejectedCount > 0 && (
                    <span className="inline-flex items-center gap-1.5" title="Needs Revision">
                      <span className="inline-flex items-center justify-center h-4.5 w-4.5 rounded-full bg-[#780000] text-white border border-[#5e0000] shrink-0 shadow-2xs">
                        <AppIcon icon={Xmark} size="xs" color="white" />
                      </span>
                      <span>
                        <strong className="text-slate-900 dark:text-slate-100 font-semibold">{rejectedCount}</strong> Needs Revision
                      </span>
                    </span>
                  )}

                  <span className="inline-flex items-center gap-1.5" title="Not Submitted">
                    <span className="inline-flex items-center justify-center h-4.5 w-4.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-300 dark:border-slate-700 shrink-0 shadow-2xs">
                      <AppIcon icon={Minus} size="xs" color="inherit" />
                    </span>
                    <span>
                      <strong className="text-slate-900 dark:text-slate-100 font-semibold">{notSubmittedCount}</strong> Not Submitted
                    </span>
                  </span>
                </div>
              </div>

              {/* Unified Table Container Matching Documents to be Submitted */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
                      <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Document
                      </th>
                      <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                    {DEFAULT_REQUIREMENTS.map((code, index) => {
                      const label = REQUIREMENT_LABEL[code] ?? code;
                      const raw = reqStatus[code] ?? "not_submitted";
                      const s = raw.toLowerCase().trim();

                      const isUploaded =
                        s === "uploaded" ||
                        s === "pending" ||
                        s === "pending_review" ||
                        s === "revision_under_review" ||
                        s === "submitted";

                      const isValidated = s === "validated" || s === "approved";

                      const isRevision =
                        s === "rejected" ||
                        s === "needs_revision" ||
                        s === "needs revision" ||
                        s === "revision_requested";

                      const statusBadgeKey = isValidated
                        ? "Validated"
                        : isRevision
                        ? "Needs Revision"
                        : isUploaded
                        ? "Pending Review"
                        : "Not Submitted";

                      const statusBadgeLabel = isUploaded ? "Uploaded" : undefined;

                      return (
                        <tr
                          key={code}
                          className="bg-white hover:bg-slate-50/80 dark:bg-slate-900 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="px-4 py-3 align-middle">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 font-mono text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                {index + 1}
                              </span>
                              <span className="font-semibold text-slate-900 dark:text-slate-100 text-xs sm:text-sm leading-snug">
                                {label}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 align-middle text-right shrink-0">
                            <div className="inline-flex justify-end">
                              <SubmissionStatusBadge
                                status={statusBadgeKey}
                                label={statusBadgeLabel}
                                size="sm"
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-3.5">
            {onEdit ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(faculty.id);
                }}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold rounded-xl px-4 py-2 transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
              >
                <AppIcon icon={EditPencil} size="sm" color="inherit" className="text-slate-950" />
                Edit Profile
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] text-xs font-semibold rounded-xl px-5 py-2 transition-colors cursor-pointer shadow-xs"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Photo Preview Lightbox */}
      {showPhotoPreview && faculty.profileImageUrl ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setShowPhotoPreview(false)}
        >
          <div
            className="relative max-w-xs w-full rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-4 py-3 bg-slate-50 dark:bg-slate-900/50">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Profile Photo</span>
              <button
                type="button"
                onClick={() => setShowPhotoPreview(false)}
                className="p-1 rounded-lg border border-[#5e0000] bg-[#780000] hover:bg-[#5e0000] text-white transition-colors cursor-pointer shadow-xs"
                aria-label="Close preview"
              >
                <AppIcon icon={Xmark} size="md" color="inherit" />
              </button>
            </div>
            <div className="p-4 flex flex-col items-center">
              <img
                src={faculty.profileImageUrl}
                alt={faculty.fullName}
                className="w-48 h-48 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shadow"
              />
              <p className="mt-3 text-sm font-bold text-slate-900 dark:text-slate-100">{faculty.fullName}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{programFullName}</p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
