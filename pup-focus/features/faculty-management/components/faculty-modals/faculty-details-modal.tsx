"use client";

import { useState } from "react";
import { CheckCircle, Clock, EditPencil, GraduationCap, Mail, ShieldCheck, User, WarningCircle, Xmark } from "iconoir-react";
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
        <div className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100 shadow-xl">
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
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
              className="rounded-lg border border-[#5e0000] bg-[#780000] hover:bg-[#5e0000] text-white p-1.5 transition-colors cursor-pointer shadow-2xs"
              aria-label="Close dialog"
            >
              <Xmark className="h-5 w-5" />
            </button>
          </div>

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
                  <Mail className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                  <span className="truncate">{faculty.email}</span>
                </div>
              </div>
            </div>

            {/* Organized Details Grid: Personal & Academic Information */}
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Personal Information */}
              <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <User className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
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
                  <GraduationCap className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
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

            {/* Compliance & Requirements Status */}
            <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-4 space-y-3.5">
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
                {DEFAULT_REQUIREMENTS.map((code, index) => {
                  const label = REQUIREMENT_LABEL[code] ?? code;
                  const status = reqStatus[code] ?? "not_submitted";

                  return (
                    <div
                      key={code}
                      className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 px-3 py-2 text-xs"
                    >
                      <span
                        className="font-medium text-slate-700 dark:text-slate-300 truncate"
                        title={label}
                      >
                        <span className="text-slate-400 dark:text-slate-500 mr-1.5 font-mono text-[11px]">
                          {index + 1}.
                        </span>
                        {label}
                      </span>

                      {status === "validated" ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                          <CheckCircle className="h-3 w-3" />
                          Validated
                        </span>
                      ) : status === "uploaded" ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                          <Clock className="h-3 w-3" />
                          Uploaded
                        </span>
                      ) : (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:text-slate-400">
                          <WarningCircle className="h-3 w-3" />
                          Not Submitted
                        </span>
                      )}
                    </div>
                  );
                })}
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
                <EditPencil className="h-3.5 w-3.5 text-slate-950" />
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
                className="rounded-lg border border-[#5e0000] bg-[#780000] hover:bg-[#5e0000] text-white p-1 transition-colors cursor-pointer shadow-2xs"
                aria-label="Close preview"
              >
                <Xmark className="h-4 w-4" />
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
