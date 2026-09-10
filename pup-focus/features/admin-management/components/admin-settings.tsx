"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  buildFacultyFullName,
  buildFacultyInitials,
  parseFullNameFallback,
} from "@/lib/faculty-profile";
import { createClient } from "@/lib/supabase/client";
import { Bell, Camera, Check, Circle, Clock, EditPencil, Eye, EyeClosed, FloppyDisk, Refresh, ShieldAlert, ShieldCheck, SystemRestart, Trash, Xmark } from "iconoir-react";

export interface AdminAccountResponse {
  id?: string;
  profileId?: string;
  firstName: string;
  middleName: string;
  lastName: string;
  fullName: string;
  email: string;
  profileImageUrl: string | null;
  avatar_url?: string | null;
  autoEmailReminders?: boolean;
  newSubmissionAlerts?: boolean;
  sessionTimeoutMinutes?: string;
}

export interface AdminSettingsInitialData {
  fullName?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  autoEmailReminders?: boolean;
  newSubmissionAlerts?: boolean;
  sessionTimeout?: string;
  userId?: string | null;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
}

export interface AdminSettingsProps {
  adminName?: string | null;
  adminEmail?: string | null;
  profileImageUrl?: string | null;
  initialData?: AdminSettingsInitialData | null;
  onProfileImageChange?: (file: File | null) => void;
  onProfileUpdated?: (updated: {
    fullName?: string;
    avatarUrl?: string | null;
  }) => void;
}

type NameFormState = {
  firstName: string;
  middleName: string;
  lastName: string;
};

export function AdminSettings({
  adminName,
  adminEmail,
  profileImageUrl,
  initialData,
  onProfileImageChange,
  onProfileUpdated,
}: AdminSettingsProps = {}) {
  const router = useRouter();
  const profileImageInputRef = useRef<HTMLInputElement>(null);
  const firstNameInputRef = useRef<HTMLInputElement>(null);
  const middleNameInputRef = useRef<HTMLInputElement>(null);
  const lastNameInputRef = useRef<HTMLInputElement>(null);
  const currentPasswordRef = useRef<HTMLInputElement>(null);

  const [activeField, setActiveField] = useState<
    "firstName" | "middleName" | "lastName" | null
  >(null);
  const [isPasswordEditing, setIsPasswordEditing] = useState(false);
  const isUserDirty = useRef(false);

  function handleFocusField(
    fieldKey: "firstName" | "middleName" | "lastName",
    ref: React.RefObject<HTMLInputElement | null>,
  ) {
    setActiveField(fieldKey);
    setTimeout(() => {
      if (ref.current) {
        ref.current.focus();
        const length = ref.current.value.length;
        ref.current.setSelectionRange(length, length);
      }
    }, 0);
  }

  function handleCancelEdit(fieldKey: "firstName" | "middleName" | "lastName") {
    setForm((prev) => ({
      ...prev,
      [fieldKey]: account[fieldKey],
    }));
    setActiveField(null);
  }

  function handleResetForm() {
    setAccount(account);
    isUserDirty.current = false;
    setForm({
      firstName: account.firstName,
      middleName: account.middleName,
      lastName: account.lastName,
    });
    setProfileImageFile(null);
    setIsAvatarMarkedForRemoval(false);
    if (profileImageInputRef.current) {
      profileImageInputRef.current.value = "";
    }
  }

  function handleEnablePasswordEditing() {
    setIsPasswordEditing(true);
    setTimeout(() => {
      if (currentPasswordRef.current) {
        currentPasswordRef.current.focus();
      }
    }, 0);
  }

  // Synchronous, non-blocking initial state from session props
  const [account, setAccount] = useState<AdminAccountResponse>(() => {
    const rawName =
      initialData?.fullName ?? adminName ?? "Admin User";
    const parsed = parseFullNameFallback(rawName);

    const firstName =
      initialData?.firstName || parsed.firstName || "Admin";
    const middleName =
      initialData?.middleName || parsed.middleName || "";
    const lastName =
      initialData?.lastName || parsed.lastName || "User";
    const fullName =
      initialData?.fullName ??
      adminName ??
      buildFacultyFullName({ firstName, middleName, lastName }) ??
      "Admin User";
    const email = initialData?.email ?? adminEmail ?? "";
    const resolvedAvatar =
      initialData?.avatarUrl ?? profileImageUrl ?? null;

    return {
      profileId: initialData?.userId ?? "",
      id: initialData?.userId ?? "",
      firstName,
      middleName,
      lastName,
      fullName,
      email,
      profileImageUrl: resolvedAvatar,
      avatar_url: resolvedAvatar,
    };
  });

  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [profileImagePreviewUrl, setProfileImagePreviewUrl] = useState<
    string | null
  >(null);
  const [isProfileImageMenuOpen, setIsProfileImageMenuOpen] = useState(false);
  const [isFullImageOpen, setIsFullImageOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isAvatarMarkedForRemoval, setIsAvatarMarkedForRemoval] = useState(false);

  const [form, setForm] = useState<NameFormState>(() => {
    const rawName =
      initialData?.fullName ?? adminName ?? "Admin User";
    const parsed = parseFullNameFallback(rawName);

    return {
      firstName: initialData?.firstName || parsed.firstName || "Admin",
      middleName: initialData?.middleName || parsed.middleName || "",
      lastName: initialData?.lastName || parsed.lastName || "User",
    };
  });

  // System and notification preferences
  const [emailReminders, setEmailReminders] = useState<boolean>(
    initialData?.autoEmailReminders ?? true
  );
  const [submissionAlerts, setSubmissionAlerts] = useState<boolean>(
    initialData?.newSubmissionAlerts ?? true
  );
  const [sessionTimeout, setSessionTimeout] = useState<string>(
    initialData?.sessionTimeout || "60"
  );

  const [initialPreferences, setInitialPreferences] = useState({
    emailReminders: initialData?.autoEmailReminders ?? true,
    submissionAlerts: initialData?.newSubmissionAlerts ?? true,
    sessionTimeout: initialData?.sessionTimeout || "60",
  });

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);

  // Password state
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Modal feedback state
  const [feedbackModal, setFeedbackModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "error" | "success";
  } | null>(null);

  const displayedProfileImage = isAvatarMarkedForRemoval
    ? null
    : profileImagePreviewUrl ??
      account.profileImageUrl ??
      account.avatar_url ??
      profileImageUrl ??
      null;

  useEffect(() => {
    if (!profileImageFile) {
      setProfileImagePreviewUrl(null);
      return;
    }

    const previewUrl = URL.createObjectURL(profileImageFile);
    setProfileImagePreviewUrl(previewUrl);

    return () => URL.revokeObjectURL(previewUrl);
  }, [profileImageFile]);

  useEffect(() => {
    setImageError(false);
  }, [displayedProfileImage]);

  // Synchronize when external profileImageUrl changes
  useEffect(() => {
    if (profileImageUrl && !profileImageFile && !isAvatarMarkedForRemoval) {
      setAccount((prev) => ({
        ...prev,
        profileImageUrl,
        avatar_url: profileImageUrl,
      }));
      setImageError(false);
    }
  }, [profileImageUrl, profileImageFile, isAvatarMarkedForRemoval]);

  useEffect(() => {
    let isMounted = true;

    // Fast client-side session hydration
    async function hydrateLocalSession() {
      try {
        const supabase = createClient();
        const result = await supabase.auth.getUser();
        const user = result.data?.user;
        if (!isMounted || !user) return;
        const meta = (user.user_metadata || {}) as Record<string, unknown>;

        const rawFullName =
          (meta.full_name as string) ||
          (user.user_metadata?.name as string) ||
          adminName ||
          "";
        const parsedFallback = parseFullNameFallback(rawFullName);
        const metaFirst =
          (meta.first_name as string) || parsedFallback.firstName;
        const metaMiddle =
          (meta.middle_name as string) || parsedFallback.middleName;
        const metaLast =
          (meta.last_name as string) || parsedFallback.lastName;
        const metaFull =
          (meta.full_name as string) ||
          buildFacultyFullName({
            firstName: metaFirst,
            middleName: metaMiddle,
            lastName: metaLast,
          }) ||
          user.email ||
          "Admin";

        setAccount((prev) => {
          return {
            ...prev,
            profileId: prev.profileId || user.id,
            id: prev.id || user.id,
            firstName: metaFirst || prev.firstName,
            middleName: typeof meta.middle_name === "string" ? metaMiddle : prev.middleName,
            lastName: metaLast || prev.lastName,
            fullName: metaFull || prev.fullName,
            email: prev.email || user.email || "",
            profileImageUrl:
              prev.profileImageUrl ||
              (meta.avatar_url as string) ||
              (meta.picture as string) ||
              null,
            avatar_url:
              prev.avatar_url ||
              (meta.avatar_url as string) ||
              (meta.picture as string) ||
              null,
          };
        });

        setForm((prev) => {
          if (isUserDirty.current) return prev;
          return {
            firstName: metaFirst,
            middleName: metaMiddle,
            lastName: metaLast,
          };
        });
      } catch {
        // Ignore client supabase error
      }
    }

    void hydrateLocalSession();

    // Authoritative background fetch from /api/admin/profile
    async function loadAccount() {
      try {
        const response = await fetch("/api/admin/profile");
        if (!response.ok) return;

        const data = await response.json();
        if (!isMounted || !data.success) return;

        const rawFullName = data.full_name || data.fullName || "Admin";
        const parsedFallback = parseFullNameFallback(rawFullName);
        const fetchedFirstName = data.firstName || data.first_name || parsedFallback.firstName;
        const fetchedMiddleName = data.middleName || data.middle_name || parsedFallback.middleName;
        const fetchedLastName = data.lastName || data.last_name || parsedFallback.lastName;
        const profileImg = data.avatar_url || data.profileImageUrl || null;

        setAccount((prev) => ({
          ...prev,
          id: data.id || prev.id,
          profileId: data.profileId || data.id || prev.profileId,
          firstName: fetchedFirstName,
          middleName: fetchedMiddleName,
          lastName: fetchedLastName,
          fullName: rawFullName,
          email: data.email || prev.email || "",
          profileImageUrl: profileImg,
          avatar_url: profileImg,
        }));

        if (profileImg) {
          setImageError(false);
        }

        setForm((prev) => {
          if (isUserDirty.current) return prev;

          return {
            firstName: fetchedFirstName,
            middleName: fetchedMiddleName,
            lastName: fetchedLastName,
          };
        });

        if (typeof data.auto_email_reminders === "boolean") {
          setEmailReminders(data.auto_email_reminders);
        }
        if (typeof data.new_submission_alerts === "boolean") {
          setSubmissionAlerts(data.new_submission_alerts);
        }
        if (data.session_timeout_minutes !== undefined) {
          setSessionTimeout(String(data.session_timeout_minutes));
        }

        setInitialPreferences({
          emailReminders:
            typeof data.auto_email_reminders === "boolean"
              ? data.auto_email_reminders
              : true,
          submissionAlerts:
            typeof data.new_submission_alerts === "boolean"
              ? data.new_submission_alerts
              : true,
          sessionTimeout: String(data.session_timeout_minutes ?? "60"),
        });
      } catch {
        // Silent background fetch
      }
    }

    void loadAccount();

    return () => {
      isMounted = false;
    };
  }, [adminName]);

  async function refreshAccount() {
    try {
      setIsRefreshing(true);
      const response = await fetch("/api/admin/profile");
      if (!response.ok) return;

      const data = await response.json();
      if (!data.success) return;

      const rawFullName = data.full_name || data.fullName || "Admin";
      const parsedFallback = parseFullNameFallback(rawFullName);
      const fetchedFirstName = data.firstName || data.first_name || parsedFallback.firstName;
      const fetchedMiddleName = data.middleName || data.middle_name || parsedFallback.middleName;
      const fetchedLastName = data.lastName || data.last_name || parsedFallback.lastName;

      const profileImg = data.avatar_url || data.profileImageUrl || null;

      setAccount((prev) => ({
        ...prev,
        id: data.id || prev.id,
        profileId: data.profileId || data.id || prev.profileId,
        firstName: fetchedFirstName,
        middleName: fetchedMiddleName,
        lastName: fetchedLastName,
        fullName: rawFullName,
        email: data.email || prev.email || "",
        profileImageUrl: profileImg,
        avatar_url: profileImg,
      }));

      if (profileImg) {
        setImageError(false);
      }

      setForm((prev) => {
        if (isUserDirty.current) return prev;

        return {
          firstName: fetchedFirstName,
          middleName: fetchedMiddleName,
          lastName: fetchedLastName,
        };
      });

      if (typeof data.auto_email_reminders === "boolean") {
        setEmailReminders(data.auto_email_reminders);
      }
      if (typeof data.new_submission_alerts === "boolean") {
        setSubmissionAlerts(data.new_submission_alerts);
      }
      if (data.session_timeout_minutes !== undefined) {
        setSessionTimeout(String(data.session_timeout_minutes));
      }

      setInitialPreferences({
        emailReminders:
          typeof data.auto_email_reminders === "boolean"
            ? data.auto_email_reminders
            : true,
        submissionAlerts:
          typeof data.new_submission_alerts === "boolean"
            ? data.new_submission_alerts
            : true,
        sessionTimeout: String(data.session_timeout_minutes ?? "60"),
      });
    } catch {
      // Retain existing state silently
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleSaveName(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);

    try {
      const formData = new FormData();
      formData.append("firstName", form.firstName.trim());
      formData.append("middleName", form.middleName.trim());
      formData.append("lastName", form.lastName.trim());

      if (isAvatarMarkedForRemoval) {
        formData.append("removeAvatar", "true");
      } else if (profileImageFile) {
        formData.append("profileImage", profileImageFile);
      }

      const response = await fetch("/api/admin/profile", {
        method: "PATCH",
        body: formData,
      });

      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Failed to update administrator profile");
      }

      const updatedFullName =
        payload.full_name ||
        buildFacultyFullName({
          firstName: form.firstName,
          middleName: form.middleName,
          lastName: form.lastName,
        });

      const updatedAvatar = payload.avatar_url ?? null;

      setAccount((prev) => ({
        ...prev,
        firstName: form.firstName,
        middleName: form.middleName,
        lastName: form.lastName,
        fullName: updatedFullName,
        profileImageUrl: updatedAvatar,
        avatar_url: updatedAvatar,
      }));

      setProfileImageFile(null);
      setIsAvatarMarkedForRemoval(false);
      isUserDirty.current = false;

      if (onProfileImageChange) {
        onProfileImageChange(null);
      }

      setFeedbackModal({
        isOpen: true,
        title: "Profile Updated Successfully",
        message: "Your profile information and changes have been saved.",
        type: "success",
      });

      onProfileUpdated?.({
        fullName: updatedFullName,
        avatarUrl: updatedAvatar,
      });

      router.refresh();
    } catch (saveError) {
      setFeedbackModal({
        isOpen: true,
        title: "Profile Update Failed",
        message:
          saveError instanceof Error
            ? saveError.message
            : "Failed to update administrator profile",
        type: "error",
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleChangePasswordSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!oldPassword.trim()) {
      setFeedbackModal({
        isOpen: true,
        title: "Current Password Required",
        message: "Please enter your current password to continue.",
        type: "error",
      });
      return;
    }

    if (newPassword.length < 8) {
      setFeedbackModal({
        isOpen: true,
        title: "Password Too Short",
        message: "New password must be at least 8 characters long.",
        type: "error",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setFeedbackModal({
        isOpen: true,
        title: "Passwords Do Not Match",
        message:
          "The new password and confirmation password do not match. Please verify and try again.",
        type: "error",
      });
      return;
    }

    setIsChangingPassword(true);

    try {
      const supabase = createClient();

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: account.email,
        password: oldPassword,
      });

      if (signInError) {
        throw new Error(
          "Incorrect current password. Please check your credentials and try again.",
        );
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw new Error(updateError.message);
      }

      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setIsPasswordEditing(false);
      setFeedbackModal({
        isOpen: true,
        title: "Password Updated Successfully",
        message: "Your administrator account password has been updated securely.",
        type: "success",
      });
    } catch (err) {
      setFeedbackModal({
        isOpen: true,
        title: "Password Update Failed",
        message:
          err instanceof Error ? err.message : "Failed to update password.",
        type: "error",
      });
    } finally {
      setIsChangingPassword(false);
    }
  }

  async function handleSavePreferences() {
    setIsSavingPreferences(true);

    try {
      const response = await fetch("/api/admin/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          autoEmailReminders: emailReminders,
          newSubmissionAlerts: submissionAlerts,
          sessionTimeoutMinutes: sessionTimeout,
        }),
      });

      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Failed to update system preferences");
      }

      setInitialPreferences({
        emailReminders,
        submissionAlerts,
        sessionTimeout,
      });

      setFeedbackModal({
        isOpen: true,
        title: "Preferences Saved",
        message: "Your notification and session lifecycle preferences have been updated.",
        type: "success",
      });
    } catch (err) {
      setFeedbackModal({
        isOpen: true,
        title: "Preferences Update Failed",
        message:
          err instanceof Error
            ? err.message
            : "Failed to update system preferences.",
        type: "error",
      });
    } finally {
      setIsSavingPreferences(false);
    }
  }

  const isProfileChanged =
    Boolean(profileImageFile) ||
    isAvatarMarkedForRemoval ||
    form.firstName.trim() !== account.firstName.trim() ||
    form.middleName.trim() !== account.middleName.trim() ||
    form.lastName.trim() !== account.lastName.trim();

  const isPreferencesChanged =
    emailReminders !== initialPreferences.emailReminders ||
    submissionAlerts !== initialPreferences.submissionAlerts ||
    sessionTimeout !== initialPreferences.sessionTimeout;

  const isCurrentPasswordFilled = oldPassword.trim() !== "";
  const isLengthValid = newPassword.length >= 8;
  const isMatching =
    newPassword.length > 0 &&
    confirmPassword.length > 0 &&
    newPassword === confirmPassword;

  const isPasswordFormValid =
    isCurrentPasswordFilled && isLengthValid && isMatching;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
            Settings
          </h1>
          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400 font-normal">
            Manage your administrator account details, security settings, and system preferences.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refreshAccount()}
          disabled={isRefreshing}
          title="Refresh account details"
          className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60 p-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition disabled:opacity-50 cursor-pointer shadow-xs"
        >
          <Refresh className={`h-4 w-4 ${isRefreshing ? "animate-spin text-amber-500" : ""}`} />
          <span className="sr-only">Refresh</span>
        </button>
      </div>

      {/* Grid Layout (2-Column) */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Profile Details Card */}
        <article className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white shadow-xs dark:bg-slate-900 p-6 transition-colors">
          <div className="pb-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 tracking-normal">
              Profile Details
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 font-normal">
              View and update your administrator credentials and identity.
            </p>
          </div>

          <form onSubmit={handleSaveName} className="mt-5 space-y-5">
            {/* Profile Avatar Layout */}
            <div className="flex items-center gap-4">
              <div
                className="relative group shrink-0 cursor-pointer"
                onClick={() => setIsProfileImageMenuOpen(true)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setIsProfileImageMenuOpen(true);
                  }
                }}
                aria-label="Profile photo options"
              >
                <div className="relative h-20 w-20 rounded-full border border-slate-200 dark:border-slate-700/80 bg-slate-100 dark:bg-slate-950 overflow-hidden flex items-center justify-center text-lg font-semibold text-slate-800 dark:text-slate-200 shadow-xs">
                  {/* Clean initials rendered immediately */}
                  <span className="select-none font-semibold text-slate-700 dark:text-slate-300">
                    {buildFacultyInitials(account.fullName || "Admin User")}
                  </span>

                  {displayedProfileImage && !imageError ? (
                    <img
                      src={displayedProfileImage}
                      alt={account.fullName || "Administrator"}
                      loading="eager"
                      fetchPriority="high"
                      onError={() => setImageError(true)}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                {/* Hover darken overlay */}
                <div
                  className="absolute inset-0 rounded-full bg-black/40 text-white text-[11px] font-medium opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center pointer-events-none"
                  aria-hidden="true"
                >
                  <Camera className="h-4 w-4 mb-0.5" />
                  <span>Change</span>
                </div>

                {/* Persistent Floating Camera Badge */}
                <div
                  className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center shadow-md border-2 border-white dark:border-slate-900 transition-transform group-hover:scale-110 pointer-events-none"
                  aria-hidden="true"
                >
                  <Camera className="h-3.5 w-3.5" />
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {account.fullName || "Administrator"}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 truncate mt-0.5">
                  {account.email || "No email on record"}
                </p>
              </div>

              <input
                ref={profileImageInputRef}
                type="file"
                accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setProfileImageFile(file);
                  setIsAvatarMarkedForRemoval(false);
                  setIsProfileImageMenuOpen(false);
                  if (onProfileImageChange) {
                    onProfileImageChange(file);
                  }
                }}
              />
            </div>

            {profileImageFile && (
              <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/40 px-3.5 py-2 text-xs text-amber-800 dark:text-amber-300 font-medium">
                <span className="truncate">New image selected: {profileImageFile.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    setProfileImageFile(null);
                    if (profileImageInputRef.current) {
                      profileImageInputRef.current.value = "";
                    }
                    if (onProfileImageChange) {
                      onProfileImageChange(null);
                    }
                  }}
                  className="ml-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 shrink-0 cursor-pointer"
                >
                  Remove
                </button>
              </div>
            )}

            {isAvatarMarkedForRemoval && (
              <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 dark:border-rose-900/60 dark:bg-rose-950/30 px-3.5 py-2 text-xs text-rose-800 dark:text-rose-300 font-medium">
                <span className="truncate">Avatar marked for removal upon saving</span>
                <button
                  type="button"
                  onClick={() => setIsAvatarMarkedForRemoval(false)}
                  className="ml-2 text-rose-600 hover:text-rose-800 dark:text-rose-400 dark:hover:text-rose-200 shrink-0 cursor-pointer"
                >
                  Undo
                </button>
              </div>
            )}

            {/* Form Input Fields */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="admin-first-name"
                  className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block"
                >
                  First Name
                </label>
                <div className="relative flex items-center">
                  <input
                    id="admin-first-name"
                    ref={firstNameInputRef}
                    readOnly={activeField !== "firstName"}
                    className={`w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-4 py-2.5 pr-20 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:outline-none focus-visible:outline-none transition-all ${
                      activeField === "firstName"
                        ? "border-amber-500 ring-2 ring-amber-500/80 dark:ring-amber-500/60"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 cursor-default"
                    }`}
                    value={form.firstName}
                    onChange={(e) => {
                      isUserDirty.current = true;
                      setForm((prev) => ({ ...prev, firstName: e.target.value }));
                    }}
                    onBlur={() => setActiveField(null)}
                    placeholder="First name"
                  />
                  {activeField === "firstName" ? (
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleCancelEdit("firstName")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-500 hover:text-white dark:hover:bg-rose-600 transition-all shadow-2xs cursor-pointer active:scale-95"
                    >
                      <Xmark className="h-3.5 w-3.5" />
                      <span>Cancel</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleFocusField("firstName", firstNameInputRef)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:border-amber-500 hover:text-amber-500 dark:hover:border-amber-400 dark:hover:text-amber-400 transition-all shadow-2xs cursor-pointer active:scale-95"
                    >
                      <EditPencil className="h-3.5 w-3.5" />
                      <span>Edit</span>
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label
                  htmlFor="admin-middle-name"
                  className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block"
                >
                  Middle Name
                </label>
                <div className="relative flex items-center">
                  <input
                    id="admin-middle-name"
                    ref={middleNameInputRef}
                    readOnly={activeField !== "middleName"}
                    className={`w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-4 py-2.5 pr-20 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:outline-none focus-visible:outline-none transition-all ${
                      activeField === "middleName"
                        ? "border-amber-500 ring-2 ring-amber-500/80 dark:ring-amber-500/60"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 cursor-default"
                    }`}
                    value={form.middleName}
                    onChange={(e) => {
                      isUserDirty.current = true;
                      setForm((prev) => ({ ...prev, middleName: e.target.value }));
                    }}
                    onBlur={() => setActiveField(null)}
                    placeholder="Middle name"
                  />
                  {activeField === "middleName" ? (
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleCancelEdit("middleName")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-500 hover:text-white dark:hover:bg-rose-600 transition-all shadow-2xs cursor-pointer active:scale-95"
                    >
                      <Xmark className="h-3.5 w-3.5" />
                      <span>Cancel</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleFocusField("middleName", middleNameInputRef)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:border-amber-500 hover:text-amber-500 dark:hover:border-amber-400 dark:hover:text-amber-400 transition-all shadow-2xs cursor-pointer active:scale-95"
                    >
                      <EditPencil className="h-3.5 w-3.5" />
                      <span>Edit</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="admin-last-name"
                  className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block"
                >
                  Last Name
                </label>
                <div className="relative flex items-center">
                  <input
                    id="admin-last-name"
                    ref={lastNameInputRef}
                    readOnly={activeField !== "lastName"}
                    className={`w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-4 py-2.5 pr-20 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:outline-none focus-visible:outline-none transition-all ${
                      activeField === "lastName"
                        ? "border-amber-500 ring-2 ring-amber-500/80 dark:ring-amber-500/60"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 cursor-default"
                    }`}
                    value={form.lastName}
                    onChange={(e) => {
                      isUserDirty.current = true;
                      setForm((prev) => ({ ...prev, lastName: e.target.value }));
                    }}
                    onBlur={() => setActiveField(null)}
                    placeholder="Last name"
                  />
                  {activeField === "lastName" ? (
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleCancelEdit("lastName")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-500 hover:text-white dark:hover:bg-rose-600 transition-all shadow-2xs cursor-pointer active:scale-95"
                    >
                      <Xmark className="h-3.5 w-3.5" />
                      <span>Cancel</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleFocusField("lastName", lastNameInputRef)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:border-amber-500 hover:text-amber-500 dark:hover:border-amber-400 dark:hover:text-amber-400 transition-all shadow-2xs cursor-pointer active:scale-95"
                    >
                      <EditPencil className="h-3.5 w-3.5" />
                      <span>Edit</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">
                  Email Address
                </label>
                <input
                  className="w-full bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 cursor-not-allowed rounded-xl px-4 py-2.5 text-xs font-medium"
                  value={account.email || ""}
                  disabled
                  readOnly
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">
                  Role / Campus Office
                </label>
                <input
                  className="w-full bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 cursor-not-allowed rounded-xl px-4 py-2.5 text-xs font-medium"
                  value="Administrator — Office of Academic Affairs"
                  disabled
                  readOnly
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleResetForm}
                disabled={!isProfileChanged || isSaving}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-100/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-all text-xs font-semibold shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-100 dark:disabled:hover:bg-slate-800/80 cursor-pointer active:scale-[0.98]"
              >
                <Refresh className="h-3.5 w-3.5" />
                <span>Reset</span>
              </button>
              <button
                type="submit"
                disabled={isSaving || !isProfileChanged}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-4 py-2.5 rounded-xl text-xs shadow-sm active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
              >
                {isSaving ? "Saving..." : "Save Profile Changes"}
              </button>
            </div>
          </form>
        </article>

        {/* Change Password Card */}
        <article className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white shadow-xs dark:bg-slate-900 p-6 transition-colors">
          <div className="pb-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 tracking-normal">
                Change Password
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 font-normal">
                Update your account password for security.
              </p>
            </div>
            {!isPasswordEditing ? (
              <button
                type="button"
                onClick={handleEnablePasswordEditing}
                className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:border-amber-500 hover:text-amber-500 dark:hover:border-amber-400 dark:hover:text-amber-400 transition-all shadow-2xs cursor-pointer active:scale-95"
                title="Change Password"
                aria-label="Change Password"
              >
                <EditPencil className="h-3.5 w-3.5" />
                <span>Edit</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsPasswordEditing(false);
                  setOldPassword("");
                  setNewPassword("");
                  setConfirmPassword("");
                }}
                className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-500 hover:text-white dark:hover:bg-rose-600 transition-all shadow-2xs cursor-pointer active:scale-95"
                title="Cancel Change Password"
                aria-label="Cancel Change Password"
              >
                <Xmark className="h-3.5 w-3.5" />
                <span>Cancel</span>
              </button>
            )}
          </div>

          <form className="mt-5 space-y-4" onSubmit={handleChangePasswordSubmit}>
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">
                Current Password
              </label>
              <div className="relative flex items-center">
                <input
                  ref={currentPasswordRef}
                  type={showOldPassword ? "text" : "password"}
                  autoComplete="current-password"
                  readOnly={!isPasswordEditing}
                  className={`w-full h-11 px-3.5 pr-11 rounded-xl text-sm transition-all outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 border ${
                    !isPasswordEditing
                      ? "bg-slate-100/70 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800/80 cursor-not-allowed opacity-80"
                      : "bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/80 dark:focus:ring-amber-500/60"
                  }`}
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="Enter current password"
                />
                <button
                  type="button"
                  onClick={() => setShowOldPassword((prev) => !prev)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 z-10 flex items-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer p-1"
                  title={showOldPassword ? "Hide password" : "Show password"}
                  aria-label={showOldPassword ? "Hide password" : "Show password"}
                >
                  {showOldPassword ? (
                    <Eye className="h-4 w-4 text-amber-500" />
                  ) : (
                    <EyeClosed className="h-4 w-4 text-slate-400" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">
                New Password
              </label>
              <div className="relative flex items-center">
                <input
                  type={showNewPassword ? "text" : "password"}
                  autoComplete="new-password"
                  readOnly={!isPasswordEditing}
                  className={`w-full h-11 px-3.5 pr-11 rounded-xl text-sm transition-all outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 border ${
                    !isPasswordEditing
                      ? "bg-slate-100/70 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800/80 cursor-not-allowed opacity-80"
                      : "bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/80 dark:focus:ring-amber-500/60"
                  }`}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((prev) => !prev)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 z-10 flex items-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer p-1"
                  title={showNewPassword ? "Hide password" : "Show password"}
                  aria-label={showNewPassword ? "Hide password" : "Show password"}
                >
                  {showNewPassword ? (
                    <Eye className="h-4 w-4 text-amber-500" />
                  ) : (
                    <EyeClosed className="h-4 w-4 text-slate-400" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">
                Confirm New Password
              </label>
              <div className="relative flex items-center">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  readOnly={!isPasswordEditing}
                  className={`w-full h-11 px-3.5 pr-11 rounded-xl text-sm transition-all outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 border ${
                    !isPasswordEditing
                      ? "bg-slate-100/70 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800/80 cursor-not-allowed opacity-80"
                      : "bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/80 dark:focus:ring-amber-500/60"
                  }`}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 z-10 flex items-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer p-1"
                  title={showConfirmPassword ? "Hide password" : "Show password"}
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? (
                    <Eye className="h-4 w-4 text-amber-500" />
                  ) : (
                    <EyeClosed className="h-4 w-4 text-slate-400" />
                  )}
                </button>
              </div>
            </div>

            {/* Live Password Requirement Indicators */}
            <div className="bg-slate-50 border border-slate-200/80 dark:bg-slate-900/50 dark:border-slate-800 p-4 rounded-lg space-y-2">
              <p className="text-slate-900 dark:text-slate-100 font-semibold text-xs">
                Password Requirements
              </p>
              <ul className="space-y-1.5 text-xs">
                <li
                  className={`flex items-center gap-2 transition-colors ${
                    isCurrentPasswordFilled
                      ? "text-emerald-700 dark:text-emerald-400 font-medium"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  {isCurrentPasswordFilled ? (
                    <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Circle className="h-2 w-2 shrink-0 fill-current ml-0.5 mr-1 text-slate-400 dark:text-slate-500" />
                  )}
                  <span>Current password required</span>
                </li>

                <li
                  className={`flex items-center gap-2 transition-colors ${
                    isLengthValid
                      ? "text-emerald-700 dark:text-emerald-400 font-medium"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  {isLengthValid ? (
                    <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Circle className="h-2 w-2 shrink-0 fill-current ml-0.5 mr-1 text-slate-400 dark:text-slate-500" />
                  )}
                  <span>At least 8 characters</span>
                </li>

                <li
                  className={`flex items-center gap-2 transition-colors ${
                    isMatching
                      ? "text-emerald-700 dark:text-emerald-400 font-medium"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  {isMatching ? (
                    <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Circle className="h-2 w-2 shrink-0 fill-current ml-0.5 mr-1 text-slate-400 dark:text-slate-500" />
                  )}
                  <span>Passwords match</span>
                </li>
              </ul>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={!isPasswordEditing || !isPasswordFormValid || isChangingPassword}
                className="inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-4 py-2 rounded-xl text-xs shadow-sm active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-amber-500 disabled:shadow-none cursor-pointer"
              >
                {isChangingPassword ? (
                  <>
                    <SystemRestart className="h-3.5 w-3.5 animate-spin" />
                    <span>Updating Password...</span>
                  </>
                ) : (
                  "Update Password"
                )}
              </button>
            </div>
          </form>
        </article>
      </section>

      {/* System Preferences & Session Duration Section */}
      <article className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white shadow-xs dark:bg-slate-900 p-6 transition-colors">
        <div className="pb-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 tracking-normal">
              System Preferences & Session Controls
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 font-normal">
              Configure automated reminders, compliance notifications, and inactivity timeout.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-5">
          {/* Notification Rule 1: Automated Email Reminders */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 border border-slate-200/80 dark:bg-slate-900/50 dark:border-slate-800 p-4 rounded-lg transition-colors">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-amber-500" />
                <span className="text-slate-900 dark:text-slate-100 font-semibold text-xs">
                  Automated Email Reminders on Submission Windows
                </span>
                {emailReminders ? (
                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800/80 px-2 py-0.5 text-xs font-semibold rounded-md">
                    Active
                  </span>
                ) : (
                  <span className="bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 px-2 py-0.5 text-xs font-medium rounded-md">
                    Disabled
                  </span>
                )}
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed max-w-xl">
                Send automatic notifications and deadline alerts to faculty regarding document submissions.
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={emailReminders}
              onClick={() => setEmailReminders((prev) => !prev)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-500/50 ${
                emailReminders
                  ? "bg-slate-900 border border-slate-800 dark:bg-white dark:border-slate-200"
                  : "bg-slate-300 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full shadow-md transition duration-200 ease-in-out my-auto ${
                  emailReminders
                    ? "translate-x-5.5 bg-slate-950"
                    : "translate-x-1 bg-white dark:bg-slate-400"
                }`}
              />
            </button>
          </div>

          {/* Notification Rule 2: New Submission Alerts */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 border border-slate-200/80 dark:bg-slate-900/50 dark:border-slate-800 p-4 rounded-lg transition-colors">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-amber-500" />
                <span className="text-slate-900 dark:text-slate-100 font-semibold text-xs">
                  New Submission Alert Notifications
                </span>
                {submissionAlerts ? (
                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800/80 px-2 py-0.5 text-xs font-semibold rounded-md">
                    Active
                  </span>
                ) : (
                  <span className="bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 px-2 py-0.5 text-xs font-medium rounded-md">
                    Disabled
                  </span>
                )}
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed max-w-xl">
                Receive dashboard alerts when faculty upload new curriculum and syllabi files.
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={submissionAlerts}
              onClick={() => setSubmissionAlerts((prev) => !prev)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-500/50 ${
                submissionAlerts
                  ? "bg-slate-900 border border-slate-800 dark:bg-white dark:border-slate-200"
                  : "bg-slate-300 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full shadow-md transition duration-200 ease-in-out my-auto ${
                  submissionAlerts
                    ? "translate-x-5.5 bg-slate-950"
                    : "translate-x-1 bg-white dark:bg-slate-400"
                }`}
              />
            </button>
          </div>

          {/* Session Duration Control */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 border border-slate-200/80 dark:bg-slate-900/50 dark:border-slate-800 p-4 rounded-lg transition-colors">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" />
                <span className="text-slate-900 dark:text-slate-100 font-semibold text-xs">
                  Session Timeout Duration
                </span>
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed max-w-xl">
                Automatically invalidate session and log out user after continuous inactivity.
              </p>
            </div>

            <div className="shrink-0">
              <select
                value={sessionTimeout}
                onChange={(e) => setSessionTimeout(e.target.value)}
                className="w-full sm:w-48 rounded-xl border border-slate-200 bg-white text-slate-900 focus:border-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-slate-600 px-4 py-2.5 text-xs font-medium focus:outline-none cursor-pointer transition"
              >
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
                <option value="60">1 hour (Recommended)</option>
                <option value="120">2 hours</option>
                <option value="0">Never (Persistent Session)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={handleSavePreferences}
              disabled={isSavingPreferences || !isPreferencesChanged}
              className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-4 py-2.5 rounded-xl text-xs shadow-sm active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
            >
              {isSavingPreferences ? (
                <>
                  <SystemRestart className="h-3.5 w-3.5 animate-spin" />
                  <span>Saving Preferences...</span>
                </>
              ) : (
                <>
                  <FloppyDisk className="h-3.5 w-3.5" />
                  <span>Save System Preferences</span>
                </>
              )}
            </button>
          </div>
        </div>
      </article>

      {/* Feedback & Alert Modal Dialog */}
      {feedbackModal?.isOpen && (
        <div
          className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          onClick={() => setFeedbackModal(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 shadow-2xl rounded-3xl p-7 max-w-sm w-full mx-4 flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-200"
            onClick={(event) => event.stopPropagation()}
          >
            {feedbackModal.type === "error" ? (
              <div className="relative mb-5 flex items-center justify-center">
                {/* Ambient Backdrop Glow */}
                <div className="absolute inset-0 rounded-full bg-rose-500/20 blur-xl dark:bg-rose-500/30" />

                {/* Outer Layer Ring */}
                <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 p-3 ring-8 ring-rose-500/5 dark:bg-rose-500/20 dark:ring-rose-500/10">
                  {/* Inner Shield Icon */}
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-600 text-white shadow-lg">
                    <ShieldAlert className="h-6 w-6 stroke-[2.2]" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative mb-5 flex items-center justify-center">
                {/* Ambient Backdrop Glow */}
                <div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-xl dark:bg-emerald-500/30" />

                {/* Outer Layer Ring */}
                <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 p-3 ring-8 ring-emerald-500/5 dark:bg-emerald-500/20 dark:ring-emerald-500/10">
                  {/* Inner Shield Icon */}
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-lg">
                    <ShieldCheck className="h-6 w-6 stroke-[2.2]" />
                  </div>
                </div>
              </div>
            )}

            <h3 className="text-slate-900 dark:text-slate-100 font-bold text-lg tracking-tight mb-1">
              {feedbackModal.title}
            </h3>
            <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed mb-5">
              {feedbackModal.message}
            </p>

            <button
              type="button"
              onClick={() => setFeedbackModal(null)}
              className={
                feedbackModal.type === "success"
                  ? "w-full bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-semibold py-3 rounded-2xl text-sm shadow-md transition-all active:scale-[0.98] cursor-pointer"
                  : "w-full bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-semibold py-3 rounded-2xl text-sm shadow-md transition-all active:scale-[0.98] cursor-pointer"
              }
            >
              {feedbackModal.type === "success" ? "Done" : "Dismiss"}
            </button>
          </div>
        </div>
      )}

      {/* Profile Image Action Modal */}
      {isProfileImageMenuOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsProfileImageMenuOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Profile Photo Options
              </h3>
              <button
                type="button"
                onClick={() => setIsProfileImageMenuOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <Xmark className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6 space-y-3">
              <button
                type="button"
                onClick={() => {
                  setIsProfileImageMenuOpen(false);
                  profileImageInputRef.current?.click();
                }}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950/60 px-4 py-3.5 text-left text-slate-800 dark:text-slate-200 transition hover:border-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-800/40 cursor-pointer"
              >
                <div>
                  <p className="text-xs font-semibold">Upload Photo</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-normal">
                    Select a new image file from your device
                  </p>
                </div>
                <Camera className="h-4 w-4 text-slate-400" />
              </button>

              {displayedProfileImage && (
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileImageMenuOpen(false);
                    setIsFullImageOpen(true);
                  }}
                  className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950/60 px-4 py-3.5 text-left text-slate-800 dark:text-slate-200 transition hover:border-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-800/40 cursor-pointer"
                >
                  <div>
                    <p className="text-xs font-semibold">View Full Image</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-normal">
                      Preview your current profile picture in full size
                    </p>
                  </div>
                  <Eye className="h-4 w-4 text-slate-400" />
                </button>
              )}

              {displayedProfileImage && (
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileImageMenuOpen(false);
                    setProfileImageFile(null);
                    setIsAvatarMarkedForRemoval(true);
                    if (profileImageInputRef.current) {
                      profileImageInputRef.current.value = "";
                    }
                  }}
                  className="flex w-full items-center justify-between rounded-xl border border-rose-200 bg-rose-50/50 hover:bg-rose-100/60 dark:border-rose-900/40 dark:bg-rose-950/20 px-4 py-3.5 text-left text-rose-700 dark:text-rose-300 transition cursor-pointer"
                >
                  <div>
                    <p className="text-xs font-semibold">Remove Photo</p>
                    <p className="text-[11px] text-rose-600/80 dark:text-rose-400/80 mt-0.5 font-normal">
                      Remove current photo and restore fallback initials
                    </p>
                  </div>
                  <Trash className="h-4 w-4 text-rose-500" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Full Image Preview Modal */}
      {isFullImageOpen && displayedProfileImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsFullImageOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                {account.fullName || "Profile Photo"}
              </h3>
              <button
                type="button"
                onClick={() => setIsFullImageOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <Xmark className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6 flex items-center justify-center">
              <div className="flex items-center justify-center overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 max-h-[60vh]">
                <img
                  src={displayedProfileImage}
                  alt={account.fullName || "Administrator"}
                  className="max-h-[60vh] max-w-full object-contain"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminSettings;
