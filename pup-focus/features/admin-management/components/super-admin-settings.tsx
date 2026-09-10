"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { buildFacultyInitials } from "@/lib/faculty-profile";
import { createClient } from "@/lib/supabase/client";
import {
  Bell,
  Camera,
  Check,
  Circle,
  Clock,
  EditPencil,
  Eye,
  EyeClosed,
  FloppyDisk,
  Refresh,
  Shield,
  ShieldAlert,
  ShieldCheck,
  SystemRestart,
  Trash,
  Xmark,
} from "iconoir-react";

export interface SuperAdminSettingsProps {
  adminName?: string | null;
  adminEmail?: string | null;
  profileImageUrl?: string | null;
  onProfileUpdated?: (updated: {
    fullName?: string;
    email?: string;
    avatarUrl?: string | null;
  }) => void;
}

export function SuperAdminSettings({
  adminName,
  adminEmail,
  profileImageUrl,
  onProfileUpdated,
}: SuperAdminSettingsProps) {
  const router = useRouter();
  const profileImageInputRef = useRef<HTMLInputElement>(null);
  const fullNameInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const currentPasswordRef = useRef<HTMLInputElement>(null);

  const [activeField, setActiveField] = useState<"fullName" | "email" | null>(null);
  const [isPasswordEditing, setIsPasswordEditing] = useState(false);
  const isUserDirty = useRef(false);

  // Profile data state
  const initialName = adminName || "Super Administrator";
  const initialEmail = adminEmail || "";
  const [fullName, setFullName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [savedFullName, setSavedFullName] = useState(initialName);
  const [savedEmail, setSavedEmail] = useState(initialEmail);

  // Avatar state
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profileImageUrl ?? null);
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [profileImagePreviewUrl, setProfileImagePreviewUrl] = useState<string | null>(null);
  const [isProfileImageMenuOpen, setIsProfileImageMenuOpen] = useState(false);
  const [isFullImageOpen, setIsFullImageOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isAvatarMarkedForRemoval, setIsAvatarMarkedForRemoval] = useState(false);

  // Password state
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // System Preferences state
  const [emailReminders, setEmailReminders] = useState<boolean>(true);
  const [submissionAlerts, setSubmissionAlerts] = useState<boolean>(true);
  const [sessionTimeout, setSessionTimeout] = useState<string>("60");
  const [initialPreferences, setInitialPreferences] = useState({
    emailReminders: true,
    submissionAlerts: true,
    sessionTimeout: "60",
  });

  // Action status states
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);

  // Feedback modal
  const [feedbackModal, setFeedbackModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "success" | "error";
  } | null>(null);

  // Update image preview URL when file changes
  useEffect(() => {
    if (!profileImageFile) {
      setProfileImagePreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(profileImageFile);
    setProfileImagePreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [profileImageFile]);

  // Keep prop changes in sync if not edited
  useEffect(() => {
    if (!isUserDirty.current) {
      if (adminName) {
        setFullName(adminName);
        setSavedFullName(adminName);
      }
      if (adminEmail) {
        setEmail(adminEmail);
        setSavedEmail(adminEmail);
      }
      if (profileImageUrl !== undefined) {
        setAvatarUrl(profileImageUrl);
      }
    }
  }, [adminName, adminEmail, profileImageUrl]);

  // Load account settings from backend on mount
  useEffect(() => {
    void refreshAccount();
  }, []);

  async function refreshAccount() {
    try {
      setIsRefreshing(true);

      // Fetch super-admin account
      const accountRes = await fetch(`/api/super-admin/account?_t=${Date.now()}`, {
        cache: "no-store",
      });
      if (accountRes.ok) {
        const accountData = await accountRes.json();
        if (accountData.account) {
          const loadedName = accountData.account.fullName || adminName || "Super Administrator";
          const loadedEmail = accountData.account.email || adminEmail || "";
          const loadedAvatar =
            accountData.account.avatar_url ||
            accountData.account.profileImageUrl ||
            null;

          setFullName(loadedName);
          setSavedFullName(loadedName);
          setEmail(loadedEmail);
          setSavedEmail(loadedEmail);
          if (loadedAvatar) {
            setAvatarUrl(loadedAvatar);
            setImageError(false);
          }
        }
      }

      // Fetch preferences from admin profile route
      const profileRes = await fetch(`/api/admin/profile?_t=${Date.now()}`, {
        cache: "no-store",
      });
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        if (profileData.account) {
          const autoReminders = profileData.account.autoEmailReminders ?? true;
          const alerts = profileData.account.newSubmissionAlerts ?? true;
          const timeout = String(profileData.account.sessionTimeoutMinutes ?? "60");

          setEmailReminders(autoReminders);
          setSubmissionAlerts(alerts);
          setSessionTimeout(timeout);
          setInitialPreferences({
            emailReminders: autoReminders,
            submissionAlerts: alerts,
            sessionTimeout: timeout,
          });
        }
      }
    } catch {
      // Retain current state gracefully
    } finally {
      setIsRefreshing(false);
    }
  }

  function handleFocusField(
    fieldKey: "fullName" | "email",
    ref: React.RefObject<HTMLInputElement | null>
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

  function handleCancelEdit(fieldKey: "fullName" | "email") {
    if (fieldKey === "fullName") {
      setFullName(savedFullName);
    } else {
      setEmail(savedEmail);
    }
    setActiveField(null);
  }

  function handleResetProfile() {
    setFullName(savedFullName);
    setEmail(savedEmail);
    setProfileImageFile(null);
    setIsAvatarMarkedForRemoval(false);
    setActiveField(null);
    isUserDirty.current = false;
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

  function handleCancelPasswordEditing() {
    setIsPasswordEditing(false);
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  // Profile Save
  async function handleSaveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!fullName.trim()) {
      setFeedbackModal({
        isOpen: true,
        title: "Name Required",
        message: "Please enter your full name before saving.",
        type: "error",
      });
      return;
    }

    setIsSavingProfile(true);

    try {
      let updatedAvatar = avatarUrl;

      // 1. Upload or remove avatar & update full_name via /api/admin/profile
      const formData = new FormData();
      formData.append("fullName", fullName.trim());
      if (isAvatarMarkedForRemoval) {
        formData.append("removeAvatar", "true");
        updatedAvatar = null;
      } else if (profileImageFile) {
        formData.append("profileImage", profileImageFile);
      }

      const profileResponse = await fetch("/api/admin/profile", {
        method: "PATCH",
        body: formData,
      });

      const profilePayload = await profileResponse.json();
      if (!profileResponse.ok || !profilePayload.success) {
        throw new Error(profilePayload.error || "Failed to update profile details");
      }

      if (profilePayload.avatar_url !== undefined) {
        updatedAvatar = profilePayload.avatar_url;
      }

      // 2. If email changed, also patch via /api/super-admin/account
      const emailHasChanged = email.trim().toLowerCase() !== savedEmail.trim().toLowerCase();
      if (emailHasChanged) {
        const accountResponse = await fetch("/api/super-admin/account", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName: fullName.trim(),
            email: email.trim(),
          }),
        });

        const accountPayload = await accountResponse.json();
        if (!accountResponse.ok) {
          throw new Error(accountPayload.error || "Failed to update email address");
        }
      }

      const finalizedName = fullName.trim();
      const finalizedEmail = email.trim();

      setSavedFullName(finalizedName);
      setSavedEmail(finalizedEmail);
      setAvatarUrl(updatedAvatar);
      setProfileImageFile(null);
      setIsAvatarMarkedForRemoval(false);
      setActiveField(null);
      isUserDirty.current = false;

      if (profileImageInputRef.current) {
        profileImageInputRef.current.value = "";
      }

      onProfileUpdated?.({
        fullName: finalizedName,
        email: finalizedEmail,
        avatarUrl: updatedAvatar,
      });

      setFeedbackModal({
        isOpen: true,
        title: "Profile Updated Successfully",
        message: "Your super administrator credentials and profile details have been saved.",
        type: "success",
      });

      router.refresh();
    } catch (err: any) {
      setFeedbackModal({
        isOpen: true,
        title: "Profile Update Failed",
        message: err instanceof Error ? err.message : "Failed to update super administrator profile.",
        type: "error",
      });
    } finally {
      setIsSavingProfile(false);
    }
  }

  // Password Submit
  async function handleChangePasswordSubmit(event: React.FormEvent<HTMLFormElement>) {
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
        message: "The new password and confirmation password do not match. Please verify and try again.",
        type: "error",
      });
      return;
    }

    setIsChangingPassword(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const currentAccountEmail = user?.email || savedEmail;
      if (!currentAccountEmail) {
        throw new Error("Unable to resolve current super administrator email.");
      }

      // Verify old password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: currentAccountEmail,
        password: oldPassword,
      });

      if (signInError) {
        throw new Error("Current password is incorrect. Please check your credentials.");
      }

      // Update password via server API endpoint
      const response = await fetch("/api/super-admin/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oldPassword,
          password: newPassword,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Failed to update password.");
      }

      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setIsPasswordEditing(false);

      setFeedbackModal({
        isOpen: true,
        title: "Password Updated Successfully",
        message: "Your super administrator password has been updated securely.",
        type: "success",
      });
    } catch (err: any) {
      setFeedbackModal({
        isOpen: true,
        title: "Password Update Failed",
        message: err instanceof Error ? err.message : "Failed to update password.",
        type: "error",
      });
    } finally {
      setIsChangingPassword(false);
    }
  }

  // Preferences Submit
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
        throw new Error(payload.error || "Failed to update system preferences.");
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
    } catch (err: any) {
      setFeedbackModal({
        isOpen: true,
        title: "Preferences Update Failed",
        message: err instanceof Error ? err.message : "Failed to update system preferences.",
        type: "error",
      });
    } finally {
      setIsSavingPreferences(false);
    }
  }

  const DEFAULT_SUPER_ADMIN_AVATAR = "/icons/pup-focus-emblem-logo.png";

  // Active avatar resolution: defaults to FOCUS emblem logo
  const displayedProfileImage = isAvatarMarkedForRemoval
    ? DEFAULT_SUPER_ADMIN_AVATAR
    : profileImagePreviewUrl || avatarUrl || DEFAULT_SUPER_ADMIN_AVATAR;

  const isUsingCustomAvatar =
    !isAvatarMarkedForRemoval &&
    Boolean(profileImagePreviewUrl || (avatarUrl && avatarUrl !== DEFAULT_SUPER_ADMIN_AVATAR));

  // Validation flags
  const isProfileChanged =
    Boolean(profileImageFile) ||
    isAvatarMarkedForRemoval ||
    fullName.trim() !== savedFullName.trim() ||
    email.trim() !== savedEmail.trim();

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
            Manage your super administrator account details, security settings, and system preferences.
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
              View and update your super administrator credentials and identity.
            </p>
          </div>

          <form onSubmit={handleSaveProfile} className="mt-5 space-y-5">
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
                <div className="relative h-20 w-20 rounded-full border-2 border-amber-500/40 bg-slate-100 dark:bg-slate-900 p-1.5 overflow-hidden flex items-center justify-center shadow-md">
                  <img
                    src={displayedProfileImage}
                    alt="PUP FOCUS Super Administrator"
                    loading="eager"
                    fetchPriority="high"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = DEFAULT_SUPER_ADMIN_AVATAR;
                    }}
                    className="h-full w-full object-contain"
                  />
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
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Super Administrator
                  </h3>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wide uppercase bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/80 shrink-0">
                    <Shield className="h-2.5 w-2.5" /> Root
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Office of Institutional System Administration
                </p>
                <p className="text-[11px] text-amber-600 dark:text-amber-400/90 mt-1 font-medium">
                  Click avatar to upload or modify photo
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
                  }}
                  className="ml-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 shrink-0 cursor-pointer"
                >
                  Remove
                </button>
              </div>
            )}

            {isAvatarMarkedForRemoval && (
              <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 dark:border-rose-900/60 dark:bg-rose-950/30 px-3.5 py-2 text-xs text-rose-800 dark:text-rose-300 font-medium">
                <span className="truncate">Avatar will reset to default PUP FOCUS emblem upon saving</span>
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
              {/* 1 Single Input for Full Name of Super Admin */}
              <div className="sm:col-span-2">
                <label
                  htmlFor="super-admin-full-name"
                  className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block"
                >
                  Full Name
                </label>
                <div className="relative flex items-center">
                  <input
                    id="super-admin-full-name"
                    ref={fullNameInputRef}
                    readOnly={activeField !== "fullName"}
                    className={`w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-4 py-2.5 pr-20 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:outline-none focus-visible:outline-none transition-all ${
                      activeField === "fullName"
                        ? "border-amber-500 ring-2 ring-amber-500/80 dark:ring-amber-500/60"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 cursor-default"
                    }`}
                    value={fullName}
                    onChange={(e) => {
                      isUserDirty.current = true;
                      setFullName(e.target.value);
                    }}
                    onBlur={() => setActiveField(null)}
                    placeholder="Enter full name"
                  />
                  {activeField === "fullName" ? (
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleCancelEdit("fullName")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border border-[#5e0000] bg-[#780000] hover:bg-[#5e0000] text-white transition-all shadow-2xs cursor-pointer active:scale-95"
                    >
                      <Xmark className="h-3.5 w-3.5" />
                      <span>Cancel</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleFocusField("fullName", fullNameInputRef)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:border-amber-500 hover:text-amber-500 dark:hover:border-amber-400 dark:hover:text-amber-400 transition-all shadow-2xs cursor-pointer active:scale-95"
                    >
                      <EditPencil className="h-3.5 w-3.5" />
                      <span>Edit</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Email Address */}
              <div className="sm:col-span-2">
                <label
                  htmlFor="super-admin-email"
                  className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block"
                >
                  Email Address
                </label>
                <div className="relative flex items-center">
                  <input
                    id="super-admin-email"
                    ref={emailInputRef}
                    type="email"
                    readOnly={activeField !== "email"}
                    className={`w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-4 py-2.5 pr-20 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:outline-none focus-visible:outline-none transition-all ${
                      activeField === "email"
                        ? "border-amber-500 ring-2 ring-amber-500/80 dark:ring-amber-500/60"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 cursor-default"
                    }`}
                    value={email}
                    onChange={(e) => {
                      isUserDirty.current = true;
                      setEmail(e.target.value);
                    }}
                    onBlur={() => setActiveField(null)}
                    placeholder="Enter email address"
                  />
                  {activeField === "email" ? (
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleCancelEdit("email")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border border-[#5e0000] bg-[#780000] hover:bg-[#5e0000] text-white transition-all shadow-2xs cursor-pointer active:scale-95"
                    >
                      <Xmark className="h-3.5 w-3.5" />
                      <span>Cancel</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleFocusField("email", emailInputRef)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:border-amber-500 hover:text-amber-500 dark:hover:border-amber-400 dark:hover:text-amber-400 transition-all shadow-2xs cursor-pointer active:scale-95"
                    >
                      <EditPencil className="h-3.5 w-3.5" />
                      <span>Edit</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Role / Access Level */}
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">
                  Role / Campus Office
                </label>
                <input
                  className="w-full bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 cursor-not-allowed rounded-xl px-4 py-2.5 text-xs font-medium"
                  value="Super Administrator — System Oversight & Security"
                  disabled
                  readOnly
                />
              </div>
            </div>

            {/* Card Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleResetProfile}
                disabled={!isProfileChanged || isSavingProfile}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-100/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-all text-xs font-semibold shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-[0.98]"
              >
                <Refresh className="h-3.5 w-3.5" />
                <span>Reset</span>
              </button>
              <button
                type="submit"
                disabled={isSavingProfile || !isProfileChanged}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-4 py-2.5 rounded-xl text-xs shadow-sm active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
              >
                {isSavingProfile ? "Saving..." : "Save Profile Changes"}
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
                onClick={handleCancelPasswordEditing}
                className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-[#5e0000] bg-[#780000] hover:bg-[#5e0000] text-white transition-all shadow-2xs cursor-pointer active:scale-95"
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
                  ? "bg-amber-500 border border-amber-400 shadow-xs"
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
                  ? "bg-amber-500 border border-amber-400 shadow-xs"
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
                <div className="absolute inset-0 rounded-full bg-rose-500/20 blur-xl dark:bg-rose-500/30" />
                <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 p-3 ring-8 ring-rose-500/5 dark:bg-rose-500/20 dark:ring-rose-500/10">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-600 text-white shadow-lg">
                    <ShieldAlert className="h-6 w-6 stroke-[2.2]" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative mb-5 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-xl dark:bg-emerald-500/30" />
                <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 p-3 ring-8 ring-emerald-500/5 dark:bg-emerald-500/20 dark:ring-emerald-500/10">
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
              className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-semibold py-3 rounded-2xl text-sm shadow-md transition-all active:scale-[0.98] cursor-pointer"
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
                className="rounded-lg border border-[#5e0000] bg-[#780000] hover:bg-[#5e0000] text-white p-1.5 transition-colors cursor-pointer shadow-2xs"
                aria-label="Close"
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

              {isUsingCustomAvatar && (
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileImageMenuOpen(false);
                    setProfileImageFile(null);
                    setIsAvatarMarkedForRemoval(true);
                  }}
                  className="flex w-full items-center justify-between rounded-xl border border-rose-200 bg-rose-50/50 hover:bg-rose-100/70 dark:border-rose-900/60 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 px-4 py-3.5 text-left text-rose-800 dark:text-rose-300 transition cursor-pointer"
                >
                  <div>
                    <p className="text-xs font-semibold">Reset to Default Logo</p>
                    <p className="text-[11px] text-rose-600/80 dark:text-rose-400/80 mt-0.5 font-normal">
                      Reset avatar to PUP FOCUS emblem logo
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setIsFullImageOpen(false)}
        >
          <div
            className="relative max-w-lg w-full rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl p-2 flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex justify-between items-center px-3 py-2 border-b border-slate-800 mb-2">
              <span className="text-xs font-semibold text-slate-300">
                {fullName || "Super Administrator"}
              </span>
              <button
                type="button"
                onClick={() => setIsFullImageOpen(false)}
                className="rounded-lg border border-[#5e0000] bg-[#780000] hover:bg-[#5e0000] text-white p-1 transition cursor-pointer"
                aria-label="Close"
              >
                <Xmark className="h-4 w-4" />
              </button>
            </div>
            <img
              src={displayedProfileImage}
              alt={fullName || "Super Administrator"}
              className="max-h-[70vh] w-auto rounded-xl object-contain shadow-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
}
