"use client";

import { useEffect, useRef, useState } from "react";
import {
  CheckCircle,
  EditPencil,
  Key,
  Mail,
  SendMail,
  User,
  Xmark,
} from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";
import { ModalHeader } from "@/components/ui/modal-header";
import { AlertPopup } from "@/components/ui/alert-popup";
import { ROLE, type AppRole, canManageAdminAccount } from "@/config/roles";
import type { AdminAccount } from "@/features/staff-management/components/staff-accounts-directory";

export interface EditStaffModalProps {
  profileId: string;
  adminAccounts: AdminAccount[];
  isOpen: boolean;
  onClose: () => void;
  onSave?: (updatedAdmin?: Partial<AdminAccount>) => Promise<void> | void;
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

export function EditStaffModal({
  profileId,
  adminAccounts,
  isOpen,
  onClose,
  onSave,
  currentAdminEmail,
}: EditStaffModalProps) {
  const selectedStaff = adminAccounts.find(
    (a) => a.profile_id === profileId || a.id === profileId,
  );

  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [profileImagePreviewUrl, setProfileImagePreviewUrl] = useState<
    string | null
  >(null);

  const [isSaving, setIsSaving] = useState(false);
  const [isResendingVerification, setIsResendingVerification] = useState(false);
  const [isSendingPasswordReset, setIsSendingPasswordReset] = useState(false);
  const [hasReverifiedPendingSave, setHasReverifiedPendingSave] = useState(false);
  const [reverifySuccessMessage, setReverifySuccessMessage] = useState<string | null>(null);
  const [passwordResetSuccessMessage, setPasswordResetSuccessMessage] = useState<string | null>(null);
  const [closeReminder, setCloseReminder] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [verificationFeedback, setVerificationFeedback] = useState<{
    emailChanged?: boolean;
    verificationSent?: boolean;
    verificationError?: string | null;
    email?: string;
  } | null>(null);

  const firstNameInputRef = useRef<HTMLInputElement>(null);
  const middleNameInputRef = useRef<HTMLInputElement>(null);
  const lastNameInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);

  const [activeField, setActiveField] = useState<
    "firstName" | "middleName" | "lastName" | "email" | null
  >(null);

  const [initialValues, setInitialValues] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
  });

  useEffect(() => {
    if (!selectedStaff) return;

    const profile = selectedStaff.profile;
    let initialFirst = (profile?.firstName ?? "").trim();
    let initialMiddle = (profile?.middleName ?? "").trim();
    let initialLast = (profile?.lastName ?? "").trim();

    if (!initialFirst && !initialLast && selectedStaff.full_name) {
      const parts = selectedStaff.full_name.trim().split(/\s+/);
      if (parts.length === 1) {
        initialFirst = parts[0];
      } else if (parts.length === 2) {
        initialFirst = parts[0];
        initialLast = parts[1];
      } else if (parts.length >= 3) {
        initialFirst = parts[0];
        initialMiddle = parts.slice(1, -1).join(" ");
        initialLast = parts[parts.length - 1];
      }
    }

    const initialEmail = (selectedStaff.email ?? "").trim();

    setFirstName(initialFirst);
    setMiddleName(initialMiddle);
    setLastName(initialLast);
    setEmail(initialEmail);
    setProfileImageFile(null);
    setProfileImagePreviewUrl(selectedStaff.profileImageUrl ?? null);

    setInitialValues({
      firstName: initialFirst,
      middleName: initialMiddle,
      lastName: initialLast,
      email: initialEmail,
    });

    setActiveField(null);
    setSaveError(null);
    setHasReverifiedPendingSave(false);
    setReverifySuccessMessage(null);
    setPasswordResetSuccessMessage(null);
    setCloseReminder(null);
    setShowConfirmModal(false);
    setShowSuccessModal(false);
  }, [selectedStaff, isOpen]);

  useEffect(() => {
    if (!selectedStaff) return;
    if (!profileImageFile) {
      setProfileImagePreviewUrl(selectedStaff.profileImageUrl ?? null);
      return;
    }
    const previewUrl = URL.createObjectURL(profileImageFile);
    setProfileImagePreviewUrl(previewUrl);
    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [profileImageFile, selectedStaff]);

  if (!isOpen || !selectedStaff) return null;

  const isSuperAdmin =
    (selectedStaff.role || "").toLowerCase() === "admin" ||
    (selectedStaff.role || "").toLowerCase().includes("super") ||
    selectedStaff.email?.toLowerCase() === "pupbataanfocus.superadmin@gmail.com" ||
    selectedStaff.email?.toLowerCase() === "pupbataanfocus.admin@gmail.com";

  const createdDate = new Date(selectedStaff.created_at);
  const formattedDate = Number.isNaN(createdDate.getTime())
    ? "Unknown"
    : createdDate.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedInitialEmail = initialValues.email.trim().toLowerCase();
  const isEmailModified =
    normalizedEmail.length > 0 && normalizedEmail !== normalizedInitialEmail;
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);

  const currentFullName = [
    firstName.trim(),
    middleName.trim() ? `${middleName.trim()[0]}.` : "",
    lastName.trim(),
  ]
    .filter(Boolean)
    .join(" ");

  const hasChanges =
    firstName.trim() !== initialValues.firstName.trim() ||
    middleName.trim() !== initialValues.middleName.trim() ||
    lastName.trim() !== initialValues.lastName.trim() ||
    isEmailModified ||
    profileImageFile !== null ||
    hasReverifiedPendingSave;

  const canEdit = canManageAdminAccount({
    targetEmail: initialValues.email || selectedStaff.email,
    targetRole: selectedStaff.role,
    actorEmail: currentAdminEmail,
    action: "edit",
  });

  function handleAttemptClose() {
    if (hasChanges && !showSuccessModal) {
      setCloseReminder(
        "You have unsaved changes. Please click 'Save Changes' or close to discard.",
      );
      return;
    }
    onClose();
  }

  function handleFocusField(
    fieldKey: "firstName" | "middleName" | "lastName" | "email",
    ref: React.RefObject<HTMLInputElement | null>,
  ) {
    setActiveField(fieldKey);
    setTimeout(() => {
      if (ref.current) {
        ref.current.focus();
        const length = ref.current.value.length;
        try {
          ref.current.setSelectionRange(length, length);
        } catch {}
      }
    }, 0);
  }

  function handleCancelEdit(
    fieldKey: "firstName" | "middleName" | "lastName" | "email",
  ) {
    if (fieldKey === "firstName") setFirstName(initialValues.firstName);
    if (fieldKey === "middleName") setMiddleName(initialValues.middleName);
    if (fieldKey === "lastName") setLastName(initialValues.lastName);
    if (fieldKey === "email") {
      setEmail(initialValues.email);
      setHasReverifiedPendingSave(false);
      setReverifySuccessMessage(null);
    }
    setCloseReminder(null);
    setActiveField(null);
  }

  async function handleReverifyEmail() {
    if (!selectedStaff?.profile_id || !isEmailModified || !isEmailValid) return;
    setIsResendingVerification(true);
    setSaveError(null);
    setCloseReminder(null);

    try {
      setHasReverifiedPendingSave(true);
      setReverifySuccessMessage(
        `Re-verification queued for ${normalizedEmail}. Click "Save Changes" to commit and send the verification email.`,
      );
      setActiveField(null);
    } finally {
      setIsResendingVerification(false);
    }
  }

  async function handleSendPasswordReset() {
    const targetResetEmail =
      initialValues.email.trim().toLowerCase() || normalizedEmail;
    if (!selectedStaff?.profile_id || !targetResetEmail) return;

    setIsSendingPasswordReset(true);
    setSaveError(null);
    setPasswordResetSuccessMessage(null);
    setCloseReminder(null);

    try {
      const response = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: selectedStaff.profile_id,
          email: targetResetEmail,
          fullName: currentFullName || selectedStaff.full_name,
          accountType: "Staff",
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setSaveError(data.error ?? "Failed to send password reset email.");
        return;
      }
      setPasswordResetSuccessMessage(
        data.message || `Password reset link sent to ${targetResetEmail}.`,
      );
    } catch {
      setSaveError("Failed to send password reset email.");
    } finally {
      setIsSendingPasswordReset(false);
    }
  }

  async function handleExecuteSave() {
    setShowConfirmModal(false);
    setSaveError(null);
    setCloseReminder(null);

    if (!selectedStaff?.profile_id) {
      setSaveError("Staff profile ID is missing.");
      return;
    }

    if (!canEdit) {
      setSaveError("You do not have permission to edit this account.");
      return;
    }

    if (!firstName.trim() || !lastName.trim()) {
      setSaveError("First name and last name are required.");
      return;
    }

    if (!normalizedEmail || !isEmailValid) {
      setSaveError("A valid email address is required.");
      return;
    }

    setIsSaving(true);

    try {
      let response: Response;
      if (profileImageFile) {
        const formData = new FormData();
        formData.append("profileId", selectedStaff.profile_id);
        formData.append("fullName", currentFullName);
        formData.append("firstName", firstName.trim());
        if (middleName.trim()) {
          formData.append("middleName", middleName.trim());
        }
        formData.append("lastName", lastName.trim());
        formData.append("email", normalizedEmail);
        if (hasReverifiedPendingSave || isEmailModified) {
          formData.append("resendVerification", "true");
        }
        formData.append("profileImage", profileImageFile);

        response = await fetch("/api/admin/staff/details", {
          method: "PATCH",
          body: formData,
        });
      } else {
        response = await fetch("/api/admin/staff/details", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            profileId: selectedStaff.profile_id,
            fullName: currentFullName,
            firstName: firstName.trim(),
            middleName: middleName.trim() || null,
            lastName: lastName.trim(),
            email: normalizedEmail,
            resendVerification: hasReverifiedPendingSave || isEmailModified,
          }),
        });
      }

      const data = await response.json();

      if (!response.ok) {
        setSaveError(data.error ?? "Failed to update staff details.");
        setIsSaving(false);
        return;
      }

      setVerificationFeedback({
        emailChanged: data.emailChanged,
        verificationSent: data.verificationSent,
        verificationError: data.verificationError,
        email: normalizedEmail,
      });

      const updatedName = data.details?.full_name ?? currentFullName;
      const updatedEmail = data.details?.email ?? normalizedEmail;

      setInitialValues({
        firstName: firstName.trim(),
        middleName: middleName.trim(),
        lastName: lastName.trim(),
        email: updatedEmail,
      });

      setHasReverifiedPendingSave(false);
      setReverifySuccessMessage(null);
      setActiveField(null);
      setShowSuccessModal(true);

      if (onSave) {
        await onSave({
          profile_id: selectedStaff.profile_id,
          full_name: updatedName,
          email: updatedEmail,
        });
      }
    } catch {
      setSaveError("An unexpected error occurred while saving changes.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4">
        <div className="w-full max-w-xl max-h-[94vh] overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100 shadow-2xl flex flex-col">
          {/* Header */}
          <ModalHeader
            icon={User}
            title="Staff Details"
            subtitle="View and manage staff profile and account credentials"
            className="rounded-t-2xl shrink-0"
            onClose={handleAttemptClose}
          />

          <div className="p-4 sm:p-5 space-y-3 overflow-y-auto flex-1">
            {saveError ? (
              <AlertPopup
                type="error"
                message={saveError}
                position="inline"
                onClose={() => setSaveError(null)}
              />
            ) : null}

            {closeReminder ? (
              <AlertPopup
                type="warning"
                message={closeReminder}
                position="inline"
                onClose={() => setCloseReminder(null)}
              />
            ) : null}

            {reverifySuccessMessage ? (
              <AlertPopup
                type="info"
                message={reverifySuccessMessage}
                position="inline"
                onClose={() => setReverifySuccessMessage(null)}
              />
            ) : null}

            {passwordResetSuccessMessage ? (
              <AlertPopup
                type="success"
                message={passwordResetSuccessMessage}
                position="inline"
                onClose={() => setPasswordResetSuccessMessage(null)}
              />
            ) : null}

            {/* Profile Overview Card */}
            <article className="rounded-xl border border-slate-200/80 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50 p-3.5 space-y-3">
              {/* Row 1: Profile Picture, Account Status, Created Date */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-13 w-13 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-amber-500/30 bg-slate-100 dark:bg-slate-800 text-base font-bold text-slate-700 dark:text-slate-300 shadow-sm">
                    {profileImagePreviewUrl ? (
                      <img
                        src={profileImagePreviewUrl}
                        alt={selectedStaff.full_name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span>
                        {getStaffInitials(
                          currentFullName || selectedStaff.full_name,
                          isSuperAdmin ? "SA" : "ST",
                        )}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1 min-w-0">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400 font-semibold">
                      Profile Picture
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          document.getElementById("staffProfileImageInput")?.click()
                        }
                        className="rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 dark:text-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-semibold transition cursor-pointer shadow-2xs"
                      >
                        Change Photo
                      </button>
                      {profileImageFile ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-amber-600 dark:text-amber-400 truncate max-w-[120px] font-medium">
                            {profileImageFile.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setProfileImageFile(null);
                              const input = document.getElementById(
                                "staffProfileImageInput",
                              ) as HTMLInputElement | null;
                              if (input) input.value = "";
                            }}
                            className="text-xs text-rose-500 hover:text-rose-600 hover:underline cursor-pointer font-semibold"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 w-full sm:w-auto justify-between sm:justify-end">
                  <div className="space-y-0.5">
                    <p className="text-[10px] uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400 font-semibold">
                      Account Status
                    </p>
                    <p
                      className={`text-xs font-semibold inline-flex items-center px-2 py-0.5 rounded-md border shadow-2xs ${
                        selectedStaff.is_active
                          ? "bg-[#0b5336] text-white border-[#08412a]"
                          : "bg-[#780000] text-white border-[#5e0000]"
                      }`}
                    >
                      {selectedStaff.is_active ? "Active" : "Inactive"}
                    </p>
                  </div>

                  <div className="space-y-0.5 text-right">
                    <p className="text-[10px] uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400 font-semibold">
                      Created Date
                    </p>
                    <p className="text-xs font-medium text-slate-900 dark:text-slate-200">
                      {formattedDate}
                    </p>
                  </div>
                </div>
              </div>

              {/* Row 2: First Name, Middle Name, Last Name in 3 Columns */}
              <div className="grid gap-2.5 sm:grid-cols-3 pt-2.5 border-t border-slate-200/80 dark:border-slate-800">
                {/* FIRST NAME */}
                <div className="space-y-1">
                  <label
                    htmlFor="staff-first-name"
                    className="block text-[11px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400 font-semibold"
                  >
                    First Name
                  </label>
                  <div className="relative flex items-center">
                    <input
                      id="staff-first-name"
                      ref={firstNameInputRef}
                      readOnly={activeField !== "firstName"}
                      className={`w-full bg-slate-50 dark:bg-slate-950 border rounded-xl pl-3 pr-8 py-1.5 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:outline-none focus-visible:outline-none transition-all ${
                        activeField === "firstName"
                          ? "border-amber-500 ring-2 ring-amber-500/80 dark:ring-amber-500/60"
                          : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 cursor-default"
                      }`}
                      value={firstName}
                      onChange={(event) => {
                        setFirstName(event.target.value);
                        setCloseReminder(null);
                      }}
                      onBlur={() => setActiveField(null)}
                      placeholder="First name"
                    />
                    {activeField === "firstName" ? (
                      <button
                        type="button"
                        title="Cancel edit"
                        aria-label="Cancel edit"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleCancelEdit("firstName")}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-5.5 w-5.5 items-center justify-center rounded-md border border-[#5e0000] bg-[#780000] hover:bg-[#5e0000] text-white transition-all shadow-2xs cursor-pointer active:scale-95"
                      >
                        <AppIcon icon={Xmark} size="xs" color="inherit" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        title="Edit first name"
                        aria-label="Edit first name"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() =>
                          handleFocusField("firstName", firstNameInputRef)
                        }
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-5.5 w-5.5 items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:border-amber-500 hover:text-amber-500 dark:hover:border-amber-400 dark:hover:text-amber-400 transition-all shadow-2xs cursor-pointer active:scale-95"
                      >
                        <AppIcon icon={EditPencil} size="xs" color="inherit" />
                      </button>
                    )}
                  </div>
                </div>

                {/* MIDDLE NAME */}
                <div className="space-y-1">
                  <label
                    htmlFor="staff-middle-name"
                    className="block text-[11px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400 font-semibold"
                  >
                    Middle Name
                  </label>
                  <div className="relative flex items-center">
                    <input
                      id="staff-middle-name"
                      ref={middleNameInputRef}
                      readOnly={activeField !== "middleName"}
                      className={`w-full bg-slate-50 dark:bg-slate-950 border rounded-xl pl-3 pr-8 py-1.5 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:outline-none focus-visible:outline-none transition-all ${
                        activeField === "middleName"
                          ? "border-amber-500 ring-2 ring-amber-500/80 dark:ring-amber-500/60"
                          : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 cursor-default"
                      }`}
                      value={middleName}
                      onChange={(event) => {
                        setMiddleName(event.target.value);
                        setCloseReminder(null);
                      }}
                      onBlur={() => setActiveField(null)}
                      placeholder="Middle name"
                    />
                    {activeField === "middleName" ? (
                      <button
                        type="button"
                        title="Cancel edit"
                        aria-label="Cancel edit"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleCancelEdit("middleName")}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-5.5 w-5.5 items-center justify-center rounded-md border border-[#5e0000] bg-[#780000] hover:bg-[#5e0000] text-white transition-all shadow-2xs cursor-pointer active:scale-95"
                      >
                        <AppIcon icon={Xmark} size="xs" color="inherit" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        title="Edit middle name"
                        aria-label="Edit middle name"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() =>
                          handleFocusField("middleName", middleNameInputRef)
                        }
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-5.5 w-5.5 items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:border-amber-500 hover:text-amber-500 dark:hover:border-amber-400 dark:hover:text-amber-400 transition-all shadow-2xs cursor-pointer active:scale-95"
                      >
                        <AppIcon icon={EditPencil} size="xs" color="inherit" />
                      </button>
                    )}
                  </div>
                </div>

                {/* LAST NAME */}
                <div className="space-y-1">
                  <label
                    htmlFor="staff-last-name"
                    className="block text-[11px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400 font-semibold"
                  >
                    Last Name
                  </label>
                  <div className="relative flex items-center">
                    <input
                      id="staff-last-name"
                      ref={lastNameInputRef}
                      readOnly={activeField !== "lastName"}
                      className={`w-full bg-slate-50 dark:bg-slate-950 border rounded-xl pl-3 pr-8 py-1.5 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:outline-none focus-visible:outline-none transition-all ${
                        activeField === "lastName"
                          ? "border-amber-500 ring-2 ring-amber-500/80 dark:ring-amber-500/60"
                          : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 cursor-default"
                      }`}
                      value={lastName}
                      onChange={(event) => {
                        setLastName(event.target.value);
                        setCloseReminder(null);
                      }}
                      onBlur={() => setActiveField(null)}
                      placeholder="Last name"
                    />
                    {activeField === "lastName" ? (
                      <button
                        type="button"
                        title="Cancel edit"
                        aria-label="Cancel edit"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleCancelEdit("lastName")}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-5.5 w-5.5 items-center justify-center rounded-md border border-[#5e0000] bg-[#780000] hover:bg-[#5e0000] text-white transition-all shadow-2xs cursor-pointer active:scale-95"
                      >
                        <AppIcon icon={Xmark} size="xs" color="inherit" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        title="Edit last name"
                        aria-label="Edit last name"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() =>
                          handleFocusField("lastName", lastNameInputRef)
                        }
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-5.5 w-5.5 items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:border-amber-500 hover:text-amber-500 dark:hover:border-amber-400 dark:hover:text-amber-400 transition-all shadow-2xs cursor-pointer active:scale-95"
                      >
                        <AppIcon icon={EditPencil} size="xs" color="inherit" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Row 3: Email Address (Account Recovery / Change Email) */}
              <div className="space-y-1.5 pt-2.5 border-t border-slate-200/80 dark:border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label
                    htmlFor="staff-email-address"
                    className="block text-[11px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400 font-semibold"
                  >
                    Email Address (Account Recovery / Change Email)
                  </label>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => void handleSendPasswordReset()}
                      disabled={isSendingPasswordReset || isSaving}
                      title="Send password reset email to staff member"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs shrink-0 whitespace-nowrap"
                    >
                      <AppIcon icon={Key} size="xs" color="white" />
                      <span>
                        {isSendingPasswordReset
                          ? "Sending Reset..."
                          : "Reset Password"}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleReverifyEmail()}
                      disabled={
                        isResendingVerification ||
                        isSaving ||
                        !isEmailModified ||
                        !isEmailValid
                      }
                      title={
                        !isEmailModified
                          ? "Change the email address first to re-verify"
                          : "Re-verify the updated email address"
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-600/30 px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs shrink-0 whitespace-nowrap"
                    >
                      <AppIcon icon={SendMail} size="xs" color="inherit" className="text-slate-950" />
                      <span>
                        {isResendingVerification
                          ? "Sending..."
                          : hasReverifiedPendingSave
                            ? "Re-verify Ready"
                            : "Re-verify Email"}
                      </span>
                    </button>
                  </div>
                </div>

                <div className="relative flex items-center">
                  <input
                    id="staff-email-address"
                    ref={emailInputRef}
                    type="email"
                    readOnly={activeField !== "email"}
                    className={`w-full bg-slate-50 dark:bg-slate-950 border rounded-xl pl-3 pr-8 py-1.5 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:outline-none focus-visible:outline-none transition-all ${
                      activeField === "email"
                        ? "border-amber-500 ring-2 ring-amber-500/80 dark:ring-amber-500/60"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 cursor-default"
                    }`}
                    value={email}
                    onChange={(event) => {
                      const nextEmail = event.target.value;
                      setEmail(nextEmail);
                      setCloseReminder(null);
                      if (
                        nextEmail.trim().toLowerCase() ===
                        initialValues.email.trim().toLowerCase()
                      ) {
                        setHasReverifiedPendingSave(false);
                        setReverifySuccessMessage(null);
                      }
                    }}
                    onBlur={() => setActiveField(null)}
                    placeholder="staff@pup.edu.ph"
                  />
                  {activeField === "email" ? (
                    <button
                      type="button"
                      title="Cancel email edit"
                      aria-label="Cancel email edit"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleCancelEdit("email")}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-5.5 w-5.5 items-center justify-center rounded-md border border-[#5e0000] bg-[#780000] hover:bg-[#5e0000] text-white transition-all shadow-2xs cursor-pointer active:scale-95"
                    >
                      <AppIcon icon={Xmark} size="xs" color="inherit" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      title="Change email address"
                      aria-label="Change email address"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleFocusField("email", emailInputRef)}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-5.5 w-5.5 items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:border-amber-500 hover:text-amber-500 dark:hover:border-amber-400 dark:hover:text-amber-400 transition-all shadow-2xs cursor-pointer active:scale-95"
                    >
                      <AppIcon icon={EditPencil} size="xs" color="inherit" />
                    </button>
                  )}
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                  If the staff member lost access to their email or their email was compromised, update only the email here. All account data and records remain intact, and a new verification link will be sent to the new email.
                </p>
              </div>
            </article>

            <input
              id="staffProfileImageInput"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                setProfileImageFile(event.target.files?.[0] ?? null);
                setCloseReminder(null);
              }}
            />
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-2.5 px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 rounded-b-2xl">
            <button
              type="button"
              onClick={handleAttemptClose}
              className="rounded-xl bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] px-5 py-2 text-xs font-semibold transition cursor-pointer shadow-xs"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => setShowConfirmModal(true)}
              disabled={
                isSaving ||
                !hasChanges ||
                !firstName.trim() ||
                !lastName.trim() ||
                !isEmailValid
              }
              className="rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-5 py-2 text-xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl text-slate-900 dark:text-slate-100 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Confirm Staff Update
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Are you sure you want to save changes to this staff member&apos;s account?
              {isEmailModified
                ? " A verification email will be sent to the new email address."
                : ""}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] text-xs font-semibold rounded-xl px-4 py-2 transition-colors cursor-pointer shadow-xs"
              >
                No, Go Back
              </button>
              <button
                type="button"
                onClick={handleExecuteSave}
                disabled={isSaving}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold rounded-xl px-4 py-2 transition-colors cursor-pointer shadow-2xs"
              >
                {isSaving ? "Saving Changes..." : "Yes, Save Changes"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Success Modal */}
      {showSuccessModal ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl text-slate-900 dark:text-slate-100 space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <AppIcon icon={CheckCircle} size="lg" color="inherit" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Staff Account Updated
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {verificationFeedback?.emailChanged
                ? `Account updated successfully. A verification link has been sent to ${verificationFeedback.email}.`
                : "The staff account profile has been updated successfully."}
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowSuccessModal(false);
                  onClose();
                }}
                className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl py-2.5 transition-colors cursor-pointer shadow-2xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
