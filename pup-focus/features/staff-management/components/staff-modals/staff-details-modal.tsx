"use client";

import { useState } from "react";
import {
  EditPencil,
  Mail,
  Shield,
  User,
  Xmark,
} from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";
import { ModalHeader } from "@/components/ui/modal-header";
import { ROLE, type AppRole, canManageAdminAccount } from "@/config/roles";
import type { AdminAccount } from "@/features/staff-management/components/staff-accounts-directory";

export interface StaffDetailsModalProps {
  profileId: string;
  adminAccounts: AdminAccount[];
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (profileId: string) => void;
  currentAdminEmail?: string | null;
}

function getStaffInitials(name?: string | null, fallback = "ST"): string {
  if (!name || !name.trim()) return fallback;
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return parts[0].slice(0, 2).toUpperCase() || fallback;
}

export function StaffDetailsModal({
  profileId,
  adminAccounts,
  isOpen,
  onClose,
  onEdit,
  currentAdminEmail,
}: StaffDetailsModalProps) {
  const [showPhotoPreview, setShowPhotoPreview] = useState(false);

  if (!isOpen) return null;

  const staff = adminAccounts.find(
    (a) => a.profile_id === profileId || a.id === profileId,
  );
  if (!staff) return null;

  const isSuperAdmin =
    (staff.role || "").toLowerCase() === "admin" ||
    (staff.role || "").toLowerCase().includes("super") ||
    staff.email?.toLowerCase() === "pupbataanfocus.superadmin@gmail.com" ||
    staff.email?.toLowerCase() === "pupbataanfocus.admin@gmail.com";

  const roleLabel = isSuperAdmin ? "Admin" : "Staff";

  const createdDate = new Date(staff.created_at);
  const formattedCreatedDate = Number.isNaN(createdDate.getTime())
    ? "Unknown"
    : createdDate.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });

  const lastLoginIso = staff.last_sign_in_at || staff.lastLoginAt;
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

  const profile = staff.profile;
  let firstName = (profile?.firstName ?? "").trim();
  let middleName = (profile?.middleName ?? "").trim();
  let lastName = (profile?.lastName ?? "").trim();

  if (!firstName && !lastName && staff.full_name) {
    const parts = staff.full_name.trim().split(/\s+/);
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

  const displayName =
    firstName || lastName
      ? [firstName, middleName ? `${middleName[0]}.` : "", lastName]
          .filter(Boolean)
          .join(" ")
      : staff.full_name || staff.email;

  const canEdit = canManageAdminAccount({
    targetEmail: staff.email,
    targetRole: staff.role,
    actorEmail: currentAdminEmail,
    action: "edit",
  });

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="staff-details-title"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      >
        <div className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100 shadow-xl">
          {/* Header */}
          <ModalHeader
            icon={User}
            title="Staff Member Details"
            subtitle="Full profile, administrative role, and account details"
            className="sticky top-0 z-10"
            onClose={onClose}
          />

          {/* Content Body */}
          <div className="space-y-6 p-6">
            {/* Staff Profile Overview Banner Card */}
            <div className="flex items-center gap-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-4">
              <button
                type="button"
                onClick={() => {
                  if (staff.profileImageUrl) {
                    setShowPhotoPreview(true);
                  }
                }}
                title={staff.profileImageUrl ? "Click to view photo" : undefined}
                className={`relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-lg font-bold text-slate-700 dark:text-slate-200 ${
                  staff.profileImageUrl
                    ? "cursor-pointer hover:ring-2 hover:ring-slate-400 dark:hover:ring-slate-600 transition-all"
                    : "cursor-default"
                }`}
              >
                {staff.profileImageUrl ? (
                  <img
                    src={staff.profileImageUrl}
                    alt={displayName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span>{getStaffInitials(displayName, isSuperAdmin ? "SA" : "ST")}</span>
                )}
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
                    {displayName}
                  </h3>
                  {staff.is_active ? (
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
                  <span className="bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 px-2 py-0.5 text-xs font-semibold rounded-md inline-flex items-center">
                    {roleLabel}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <AppIcon icon={Mail} size="sm" color="muted" />
                  <span className="truncate">{staff.email}</span>
                </div>
              </div>
            </div>

            {/* Organized Details Grid: Personal & Administrative Information */}
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

              {/* Administrative & System Information */}
              <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <AppIcon icon={Shield} size="sm" color="default" />
                  <span>Administrative & System</span>
                </div>
                <div className="space-y-2 text-xs divide-y divide-slate-200/60 dark:divide-slate-800/60">
                  <div className="flex justify-between items-center py-1.5">
                    <span className="text-slate-500 dark:text-slate-400">Assigned Role</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {roleLabel}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1.5">
                    <span className="text-slate-500 dark:text-slate-400">Department</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {staff.department || "Administration"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1.5">
                    <span className="text-slate-500 dark:text-slate-400">Account Status</span>
                    <span className="inline-flex items-center gap-1.5 font-semibold">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          staff.is_active ? "bg-[#0b5336]" : "bg-[#780000]"
                        }`}
                      />
                      <span
                        className={`px-2 py-0.5 text-xs font-semibold rounded-md border shadow-2xs ${
                          staff.is_active
                            ? "bg-[#0b5336] text-white border-[#08412a]"
                            : "bg-[#780000] text-white border-[#5e0000]"
                        }`}
                      >
                        {staff.is_active ? "Active" : "Inactive"}
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
          </div>

          {/* Modal Footer */}
          <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-3.5">
            {onEdit && canEdit ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(staff.profile_id);
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
      {showPhotoPreview && staff.profileImageUrl ? (
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
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Profile Photo
              </span>
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
                src={staff.profileImageUrl}
                alt={displayName}
                className="w-48 h-48 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shadow"
              />
              <p className="mt-3 text-sm font-bold text-slate-900 dark:text-slate-100">
                {displayName}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {roleLabel} • {staff.department || "Administration"}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

