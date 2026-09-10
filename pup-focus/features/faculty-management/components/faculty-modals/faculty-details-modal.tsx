"use client";

import { useState } from "react";
import {
  X,
  Pencil,
  CheckCircle2,
  Clock3,
  AlertCircle,
  Building,
  Mail,
  User,
  ShieldCheck,
  Maximize2,
  ExternalLink,
  ArrowLeft,
  GraduationCap,
} from "lucide-react";
import { buildFacultyInitials } from "@/lib/faculty-profile";
import { DEFAULT_REQUIREMENTS, REQUIREMENT_LABEL } from "@/config/compliance";
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
  const [showFullProfile, setShowFullProfile] = useState(false);

  if (!isOpen) return null;

  const faculty = facultyAccounts.find((f) => f.id === facultyId);
  if (!faculty) return null;

  const createdDate = new Date(faculty.created_at);
  const formattedCreatedDate = Number.isNaN(createdDate.getTime())
    ? "Unknown"
    : createdDate.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
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

  // Calculate compliance statistics
  const reqStatus = faculty.requirementStatus ?? {};
  let validatedCount = 0;
  let uploadedCount = 0;
  let notSubmittedCount = 0;

  DEFAULT_REQUIREMENTS.forEach((code) => {
    const status = reqStatus[code] ?? "not_submitted";
    if (status === "validated") validatedCount++;
    else if (status === "uploaded") uploadedCount++;
    else notSubmittedCount++;
  });

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="faculty-details-title"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      >
        <div className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xl">
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                <User className="h-4 w-4" />
              </div>
              <div>
                <h2
                  id="faculty-details-title"
                  className="text-base font-bold text-slate-900 dark:text-slate-100"
                >
                  Faculty Member Details
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Full profile, login info, and compliance overview
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content Body */}
          <div className="space-y-6 p-6">
            {/* Profile Card Banner */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-4.5">
              <button
                type="button"
                onClick={() => setShowFullProfile(true)}
                title="Click for full view of profile"
                className="group relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-300 dark:border-slate-700 bg-slate-200 dark:bg-slate-800 text-xl font-bold text-slate-700 dark:text-slate-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                {faculty.profileImageUrl ? (
                  <img
                    src={faculty.profileImageUrl}
                    alt=""
                    aria-hidden="true"
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                ) : (
                  <span aria-hidden="true">{buildFacultyInitials(faculty.fullName)}</span>
                )}
                <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity text-white text-[10px] font-semibold">
                  <Maximize2 className="h-4 w-4" />
                </span>
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
                    {faculty.fullName}
                  </h3>
                  {faculty.is_active ? (
                    <span className="inline-flex items-center gap-1 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                      Inactive
                    </span>
                  )}
                  <span className="rounded-md border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                    {programCode}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                    {faculty.email}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock3 className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                    Last login: {formattedLastLogin}
                  </span>
                </div>
              </div>
            </div>

            {/* Details Grid (Without Duplicates) */}
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Personal Information */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40 p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <User className="h-3.5 w-3.5 text-slate-500" />
                  <span>Personal Information</span>
                </div>
                <div className="space-y-2 text-xs divide-y divide-slate-100 dark:divide-slate-800/60">
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-500 dark:text-slate-400">First Name</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {faculty.firstName || faculty.first_name || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-500 dark:text-slate-400">Middle Name</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {faculty.middleName || faculty.middle_name || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-500 dark:text-slate-400">Last Name</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {faculty.lastName || faculty.last_name || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-500 dark:text-slate-400">Registered On</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {formattedCreatedDate}
                    </span>
                  </div>
                </div>
              </div>

              {/* Academic Information */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40 p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <Building className="h-3.5 w-3.5 text-slate-500" />
                  <span>Academic Information</span>
                </div>
                <div className="space-y-2 text-xs divide-y divide-slate-100 dark:divide-slate-800/60">
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-500 dark:text-slate-400">Program / Dept</span>
                    <span
                      className="font-semibold text-slate-800 dark:text-slate-200 text-right max-w-[180px] truncate"
                      title={programFullName}
                    >
                      {programFullName}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-500 dark:text-slate-400">Program Code</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {programCode}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-500 dark:text-slate-400">Campus</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      PUP Bataan Campus
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-500 dark:text-slate-400">Designation</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      Faculty Member
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Compliance & Requirements Status */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40 p-4 space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <ShieldCheck className="h-3.5 w-3.5 text-slate-500" />
                  <span>Compliance & Submission Status</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {validatedCount} Validated
                  </span>
                  <span>•</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {uploadedCount} Uploaded
                  </span>
                  <span>•</span>
                  <span className="font-semibold text-slate-500 dark:text-slate-400">
                    {notSubmittedCount} Pending
                  </span>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {DEFAULT_REQUIREMENTS.map((code) => {
                  const label = REQUIREMENT_LABEL[code] ?? code;
                  const status = reqStatus[code] ?? "not_submitted";

                  return (
                    <div
                      key={code}
                      className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 px-3 py-2 text-xs"
                    >
                      <span
                        className="font-medium text-slate-700 dark:text-slate-300 truncate"
                        title={label}
                      >
                        {label}
                      </span>

                      {status === "validated" ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" />
                          Validated
                        </span>
                      ) : status === "uploaded" ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-700 dark:text-slate-300">
                          <Clock3 className="h-3 w-3" />
                          Uploaded
                        </span>
                      ) : (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/40 px-2 py-0.5 text-[10px] font-medium text-slate-400 dark:text-slate-500">
                          <AlertCircle className="h-3 w-3" />
                          Not Submitted
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Modal Footer with Full View of Profile button */}
          <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-3.5">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Faculty ID: <code className="font-mono text-[11px]">{faculty.id}</code>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowFullProfile(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 px-3.5 py-1.5 text-xs font-medium transition cursor-pointer"
              >
                <ExternalLink className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                Full View of Profile
              </button>
              {onEdit ? (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onEdit(faculty.id);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 px-3.5 py-1.5 text-xs font-medium transition cursor-pointer"
                >
                  <Pencil className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                  Edit Profile
                </button>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-4 py-1.5 text-xs font-medium transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Full View of Profile Popup Dialog */}
      {showFullProfile ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="full-profile-title"
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/75 p-4"
        >
          <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 px-5 py-3.5">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                <h3
                  id="full-profile-title"
                  className="text-sm font-bold text-slate-900 dark:text-slate-100"
                >
                  Full View of Profile
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowFullProfile(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                aria-label="Close full profile view"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Profile Image & Identification */}
            <div className="p-6 space-y-5">
              {/* Large Photo Display */}
              <div className="flex flex-col items-center justify-center text-center">
                <div className="relative flex h-36 w-36 sm:h-44 sm:w-44 items-center justify-center overflow-hidden rounded-2xl border-2 border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 shadow-md">
                  {faculty.profileImageUrl ? (
                    <img
                      src={faculty.profileImageUrl}
                      alt=""
                      aria-hidden="true"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-4xl sm:text-5xl font-bold text-slate-700 dark:text-slate-300 select-none">
                      {buildFacultyInitials(faculty.fullName)}
                    </span>
                  )}
                </div>
                <h4 className="mt-3.5 text-xl font-bold text-slate-900 dark:text-slate-100">
                  {faculty.fullName}
                </h4>
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Faculty Member • {programCode}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {programFullName}
                </p>
              </div>

              {/* Verified Identity Information */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-4 space-y-2 text-xs divide-y divide-slate-200 dark:divide-slate-800/80">
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500 dark:text-slate-400">Official Email</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {faculty.email}
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500 dark:text-slate-400">Institution</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    PUP Bataan Campus
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500 dark:text-slate-400">Account Status</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-200">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        faculty.is_active ? "bg-emerald-500" : "bg-slate-400"
                      }`}
                    />
                    {faculty.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500 dark:text-slate-400">Last Sign-in</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {formattedLastLogin}
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500 dark:text-slate-400">Registered Date</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {formattedCreatedDate}
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500 dark:text-slate-400">Faculty ID</span>
                  <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400">
                    {faculty.id}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 px-5 py-3">
              <button
                type="button"
                onClick={() => setShowFullProfile(false)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 px-4 py-1.5 text-xs font-medium transition cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                Back to Details
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
