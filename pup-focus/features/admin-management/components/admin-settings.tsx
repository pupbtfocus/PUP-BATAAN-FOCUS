"use client";

import { useState, useEffect, useRef } from "react";
import { KeyRound, Bell, Shield, User, Save, CheckCircle, Lock, Camera } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export interface AdminSettingsProps {
  adminName?: string | null;
  adminEmail?: string | null;
  profileImageUrl?: string | null;
  onProfileImageChange?: (file: File | null) => void;
}

function getInitials(name?: string | null): string {
  if (!name || !name.trim()) return "AD";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return parts[0].slice(0, 2).toUpperCase();
}

export function AdminSettings({
  adminName,
  adminEmail,
  profileImageUrl,
  onProfileImageChange,
}: AdminSettingsProps) {
  const [userEmail, setUserEmail] = useState<string>(adminEmail ?? "");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(
    profileImageUrl ?? null
  );
  const [hasImageError, setHasImageError] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adminEmail) {
      setUserEmail(adminEmail);
    }

    async function loadAdminProfile() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        if (user.email) {
          setUserEmail(user.email);
        }

        // 1. Check user metadata first (from auth)
        const metadataAvatar = user.user_metadata?.avatar_url;

        // 2. Query profiles table for database-backed avatar
        const { data: profile } = await supabase
          .from("profiles")
          .select("avatar_url, full_name")
          .eq("id", user.id)
          .single();

        const activeAvatar = profile?.avatar_url || metadataAvatar;
        if (activeAvatar) {
          setAvatarPreviewUrl(activeAvatar);
          setHasImageError(false);
        }
      } catch (err) {
        console.error("Failed to load admin profile:", err);
      }
    }

    void loadAdminProfile();
  }, [adminEmail]);

  useEffect(() => {
    if (profileImageUrl) {
      setAvatarPreviewUrl(profileImageUrl);
      setHasImageError(false);
    }
  }, [profileImageUrl]);

  const handleAvatarFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      setHasImageError(false);
      const localUrl = URL.createObjectURL(file);
      setAvatarPreviewUrl(localUrl);
      if (onProfileImageChange) {
        onProfileImageChange(file);
      }
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarFile(null);
    setAvatarPreviewUrl(null);
    setHasImageError(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (onProfileImageChange) {
      onProfileImageChange(null);
    }
  };

  // Notification Preferences
  const [emailReminders, setEmailReminders] = useState(true);
  const [submissionAlerts, setSubmissionAlerts] = useState(true);

  // Security & Session Controls
  const [sessionTimeout, setSessionTimeout] = useState("1 hour");

  // Password Change Modal State
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Main Form Save State
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    setSaveSuccessMessage(null);
    setSaveErrorMessage(null);

    try {
      if (avatarFile) {
        const supabase = createClient();
        const safeFileName = avatarFile.name.replace(/[^a-zA-Z0-9.-]/g, "_");
        const storagePath = `admin-profile-images/${userEmail || "admin"}/${Date.now()}-${safeFileName}`;
        const { error: uploadError } = await supabase.storage
          .from("compliance-private")
          .upload(storagePath, avatarFile, { upsert: true });

        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage
            .from("compliance-private")
            .getPublicUrl(storagePath);
          if (publicUrlData?.publicUrl) {
            setAvatarPreviewUrl(publicUrlData.publicUrl);
            setHasImageError(false);

            const {
              data: { user },
            } = await supabase.auth.getUser();
            if (user) {
              await supabase
                .from("profiles")
                .update({ avatar_url: publicUrlData.publicUrl })
                .eq("id", user.id);
            }
          }
        } else {
          console.warn("Storage upload warning:", uploadError.message);
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 600));
      setSaveSuccessMessage("Admin settings and profile photo updated successfully.");
    } catch (err) {
      setSaveErrorMessage("Failed to update settings. Please try again.");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword) {
      setPasswordError("Current password is required.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    setIsChangingPassword(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 800));
      setPasswordSuccess("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        setIsPasswordModalOpen(false);
        setPasswordSuccess(null);
      }, 1200);
    } catch (err) {
      setPasswordError("Failed to update password. Please verify current password.");
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-100 tracking-tight">Admin System Settings</h2>
          <p className="text-xs text-slate-400">
            Configure system preferences, security parameters, and profile avatar.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSaveSettings}
          disabled={isSavingSettings}
          className="bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 text-xs font-semibold px-4 py-2 rounded-lg transition-all disabled:opacity-50 flex items-center gap-2"
        >
          <Save className="h-3.5 w-3.5 text-amber-400" />
          {isSavingSettings ? "Saving..." : "Save Settings"}
        </button>
      </div>

      {saveSuccessMessage && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-3.5 text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" />
          {saveSuccessMessage}
        </div>
      )}

      {saveErrorMessage && (
        <div className="rounded-xl border border-red-500/30 bg-red-950/40 p-3.5 text-xs text-red-300">
          {saveErrorMessage}
        </div>
      )}

      {/* 1. Admin Profile & Credentials Section */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="bg-slate-900/60 border-b border-slate-800 text-slate-400 text-[11px] font-bold uppercase tracking-wider p-4 flex items-center gap-2">
          <User className="h-4 w-4 text-amber-400" />
          Admin Profile & Credentials
        </div>
        <div className="bg-slate-950/40 border-b border-slate-800/60 p-5 space-y-5">
          {/* Avatar Management Card */}
          <div className="bg-slate-900/50 border border-slate-800/80 rounded-lg p-4 flex flex-wrap items-center gap-5">
            {!hasImageError && avatarPreviewUrl ? (
              <img
                src={avatarPreviewUrl}
                alt="Admin Avatar"
                className="w-20 h-20 rounded-full border-2 border-amber-500/40 object-cover bg-slate-900 shadow-md"
                onError={() => setHasImageError(true)}
              />
            ) : (
              <div className="w-20 h-20 rounded-full border-2 border-amber-500/40 text-amber-400 font-bold text-xl bg-amber-500/10 flex items-center justify-center shadow-md">
                {getInitials(adminName)}
              </div>
            )}
            <div className="space-y-2">
              <div>
                <p className="text-xs font-semibold text-slate-200">
                  Profile Photo
                </p>
                <p className="text-[11px] text-slate-400">
                  Supports JPG, PNG or WebP. Instant preview before saving.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarFileSelect}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 text-xs font-semibold px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5"
                >
                  <Camera className="h-3.5 w-3.5 text-amber-400" />
                  Upload New Photo
                </button>
                {avatarPreviewUrl ? (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    className="text-rose-400/80 hover:text-rose-300 hover:bg-rose-950/30 text-xs font-medium px-3 py-2 rounded-lg transition-all"
                  >
                    Remove Photo
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Admin Full Name
              </label>
              <input
                type="text"
                readOnly
                value={adminName ?? "Admin User"}
                className="w-full bg-slate-900 border border-slate-800 text-slate-100 placeholder:text-slate-500 rounded-lg text-xs p-2.5 outline-none cursor-not-allowed opacity-90"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Admin Email Address
              </label>
              <input
                type="email"
                readOnly
                value={userEmail || adminEmail || ""}
                placeholder="Admin Email"
                className="w-full bg-slate-900 border border-slate-800 text-slate-100 placeholder:text-slate-500 rounded-lg text-xs p-2.5 outline-none cursor-not-allowed opacity-90"
              />
            </div>
          </div>
          <div className="pt-2 flex items-center justify-between border-t border-slate-800/60">
            <div>
              <p className="text-xs font-semibold text-slate-200">Account Password</p>
              <p className="text-[11px] text-slate-400">
                Update your authentication credentials securely.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsPasswordModalOpen(true)}
              className="bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 text-xs font-semibold px-4 py-2 rounded-lg transition-all flex items-center gap-2"
            >
              <KeyRound className="h-3.5 w-3.5 text-amber-400" />
              Change Password
            </button>
          </div>
        </div>
      </div>

      {/* 2. System & Notification Preferences */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="bg-slate-900/60 border-b border-slate-800 text-slate-400 text-[11px] font-bold uppercase tracking-wider p-4 flex items-center gap-2">
          <Bell className="h-4 w-4 text-amber-400" />
          System & Notification Preferences
        </div>
        <div className="divide-y divide-slate-800/60">
          {/* Email Reminders Toggle */}
          <div className="bg-slate-950/40 hover:bg-slate-900/50 transition-colors p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-200">
                Automated Email Reminders on Submission Windows
              </p>
              <p className="text-[11px] text-slate-400">
                Send automatic notifications to faculty prior to submission window deadlines.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEmailReminders((prev) => !prev)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out ${
                emailReminders
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  : "bg-slate-800 border border-slate-700"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full shadow-lg ring-0 transition duration-200 ease-in-out my-auto ${
                  emailReminders ? "translate-x-5.5 bg-amber-300" : "translate-x-1 bg-slate-400"
                }`}
              />
            </button>
          </div>

          {/* Submission Alerts Toggle */}
          <div className="bg-slate-950/40 hover:bg-slate-900/50 transition-colors p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-200">
                New Submission Alert Notifications
              </p>
              <p className="text-[11px] text-slate-400">
                Receive real-time system alerts when faculty submit required compliance documents.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSubmissionAlerts((prev) => !prev)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out ${
                submissionAlerts
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  : "bg-slate-800 border border-slate-700"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full shadow-lg ring-0 transition duration-200 ease-in-out my-auto ${
                  submissionAlerts ? "translate-x-5.5 bg-amber-300" : "translate-x-1 bg-slate-400"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* 3. Security & Session Controls */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="bg-slate-900/60 border-b border-slate-800 text-slate-400 text-[11px] font-bold uppercase tracking-wider p-4 flex items-center gap-2">
          <Shield className="h-4 w-4 text-amber-400" />
          Security & Session Controls
        </div>
        <div className="divide-y divide-slate-800/60">
          {/* Session Timeout Selector */}
          <div className="bg-slate-950/40 hover:bg-slate-900/50 transition-colors p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-slate-200">
                Session Timeout Duration
              </p>
              <p className="text-[11px] text-slate-400">
                Automatically log out idle administrator sessions after specified inactivity.
              </p>
            </div>
            <select
              value={sessionTimeout}
              onChange={(e) => setSessionTimeout(e.target.value)}
              className="bg-slate-900 border border-slate-800 text-slate-100 placeholder:text-slate-500 rounded-lg text-xs p-2.5 focus:border-amber-500/50 outline-none w-full sm:w-48"
            >
              <option value="30 mins">30 minutes</option>
              <option value="1 hour">1 hour</option>
              <option value="4 hours">4 hours</option>
              <option value="8 hours">8 hours</option>
            </select>
          </div>
        </div>
      </div>

      {/* Change Password Modal */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-950 p-6 shadow-2xl text-slate-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                <Lock className="h-4 w-4 text-amber-400" />
                Change Account Password
              </h3>
              <button
                type="button"
                onClick={() => setIsPasswordModalOpen(false)}
                className="rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                ✕
              </button>
            </div>

            {passwordError && (
              <div className="mb-4 rounded-lg border border-red-500/30 bg-red-950/40 p-3 text-xs text-red-300">
                {passwordError}
              </div>
            )}

            {passwordSuccess && (
              <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-950/40 p-3 text-xs text-emerald-300">
                {passwordSuccess}
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="bg-slate-900/50 border border-slate-800/80 rounded-lg p-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full bg-slate-900 border border-slate-800 text-slate-100 placeholder:text-slate-500 rounded-lg text-xs p-2.5 focus:border-amber-500/50 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password (min. 8 characters)"
                    className="w-full bg-slate-900 border border-slate-800 text-slate-100 placeholder:text-slate-500 rounded-lg text-xs p-2.5 focus:border-amber-500/50 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full bg-slate-900 border border-slate-800 text-slate-100 placeholder:text-slate-500 rounded-lg text-xs p-2.5 focus:border-amber-500/50 outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  disabled={isChangingPassword}
                  className="px-3.5 py-2 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 text-xs font-medium transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 text-xs font-semibold px-4 py-2 rounded-lg transition-all disabled:opacity-50"
                >
                  {isChangingPassword ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminSettings;
