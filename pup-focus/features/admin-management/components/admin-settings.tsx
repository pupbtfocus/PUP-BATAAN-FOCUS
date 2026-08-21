"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  KeyRound,
  Bell,
  Shield,
  User,
  Save,
  CheckCircle,
  AlertCircle,
  Lock,
  Camera,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  X,
  Clock,
  Mail,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export interface AdminSettingsInitialData {
  fullName?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  autoEmailReminders?: boolean;
  newSubmissionAlerts?: boolean;
  sessionTimeout?: string;
  userId?: string | null;
}

export interface AdminSettingsProps {
  adminName?: string | null;
  adminEmail?: string | null;
  profileImageUrl?: string | null;
  initialData?: AdminSettingsInitialData | null;
  onProfileImageChange?: (file: File | null) => void;
}

interface ToastNotification {
  id: string;
  type: "success" | "error" | "info";
  message: string;
}

function getInitials(name?: string | null): string {
  if (!name || !name.trim()) return "AD";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return parts[0].slice(0, 2).toUpperCase() || "AD";
}

function resolveAvatarPublicUrl(
  supabase: any,
  rawUrl?: string | null
): string | null {
  if (!rawUrl || typeof rawUrl !== "string" || !rawUrl.trim()) return null;
  let trimmed = rawUrl.trim();

  // If already a full HTTP/HTTPS URL
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  // Remove any leading slashes
  while (trimmed.startsWith("/")) {
    trimmed = trimmed.substring(1);
  }

  // Fix double bucket name issue: clean prefix before getPublicUrl()
  let cleanPath = trimmed.replace(/^avatars\//, "");
  let bucket = "avatars";

  if (cleanPath.startsWith("compliance-private/")) {
    cleanPath = cleanPath.replace(/^compliance-private\//, "");
    bucket = "compliance-private";
  } else if (cleanPath.includes("/avatars/")) {
    cleanPath = cleanPath.split("/avatars/")[1].split("?")[0];
    bucket = "avatars";
  } else if (cleanPath.includes("/compliance-private/")) {
    cleanPath = cleanPath.split("/compliance-private/")[1].split("?")[0];
    bucket = "compliance-private";
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(cleanPath);
  return data?.publicUrl || trimmed;
}

async function fetchAdminAvatarUrl(
  supabase: any,
  email?: string | null,
  userId?: string | null,
  rawAvatarUrl?: string | null
): Promise<string | null> {
  // 1. Check rawAvatarUrl if present
  if (rawAvatarUrl && typeof rawAvatarUrl === "string" && rawAvatarUrl.trim()) {
    const resolved = resolveAvatarPublicUrl(supabase, rawAvatarUrl);
    if (resolved) return resolved;
  }

  // 2. Search 'avatars' bucket under admin/${email} (matching Superadmin admin list logic)
  if (email) {
    try {
      const folderPath = `admin/${email}`;
      const { data: files } = await supabase.storage
        .from("avatars")
        .list(folderPath, { limit: 10, sortBy: { column: "created_at", order: "desc" } });

      if (files && files.length > 0) {
        const latestFile = files[0];
        const filePath = `${folderPath}/${latestFile.name}`;
        const { data: publicData } = supabase.storage
          .from("avatars")
          .getPublicUrl(filePath);

        if (publicData?.publicUrl) {
          return publicData.publicUrl;
        }
      }
    } catch {}
  }

  // 3. Search 'avatars' bucket under admin/${userId}
  if (userId) {
    try {
      const folderPath = `admin/${userId}`;
      const { data: files } = await supabase.storage
        .from("avatars")
        .list(folderPath, { limit: 10, sortBy: { column: "created_at", order: "desc" } });

      if (files && files.length > 0) {
        const latestFile = files[0];
        const filePath = `${folderPath}/${latestFile.name}`;
        const { data: publicData } = supabase.storage
          .from("avatars")
          .getPublicUrl(filePath);

        if (publicData?.publicUrl) {
          return publicData.publicUrl;
        }
      }
    } catch {}
  }

  return null;
}

export function AdminSettings({
  adminName,
  adminEmail,
  profileImageUrl,
  initialData,
  onProfileImageChange,
}: AdminSettingsProps) {
  // ---------------------------------------------------------------------------
  // Profile Information State (Hydrated from initialData)
  // ---------------------------------------------------------------------------
  const [fullName, setFullName] = useState<string>(
    initialData?.fullName || adminName || "Admin User"
  );
  const [userEmail, setUserEmail] = useState<string>(
    initialData?.email || adminEmail || ""
  );
  const [userId, setUserId] = useState<string | null>(
    initialData?.userId || null
  );

  // ---------------------------------------------------------------------------
  // Avatar State & Instant Preview
  // ---------------------------------------------------------------------------
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(
    initialData?.avatarUrl || profileImageUrl || null
  );
  const [hasImageError, setHasImageError] = useState<boolean>(false);
  const [isAvatarRemoved, setIsAvatarRemoved] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clean up object URLs to avoid memory leaks
  useEffect(() => {
    if (!avatarFile) return;

    const objectUrl = URL.createObjectURL(avatarFile);
    setAvatarPreviewUrl(objectUrl);
    setHasImageError(false);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [avatarFile]);

  // ---------------------------------------------------------------------------
  // System & Notification Preferences (Hydrated from initialData)
  // ---------------------------------------------------------------------------
  const [emailReminders, setEmailReminders] = useState<boolean>(
    initialData?.autoEmailReminders ?? true
  );
  const [submissionAlerts, setSubmissionAlerts] = useState<boolean>(
    initialData?.newSubmissionAlerts ?? true
  );

  // ---------------------------------------------------------------------------
  // Security & Session Controls (Hydrated from initialData)
  // ---------------------------------------------------------------------------
  const [sessionTimeout, setSessionTimeout] = useState<string>(
    initialData?.sessionTimeout || "60"
  );

  // ---------------------------------------------------------------------------
  // Password Change Modal State
  // ---------------------------------------------------------------------------
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState<boolean>(false);
  const [currentPassword, setCurrentPassword] = useState<string>("");
  const [newPassword, setNewPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [showCurrentPassword, setShowCurrentPassword] = useState<boolean>(false);
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState<boolean>(false);

  // ---------------------------------------------------------------------------
  // Save & Toast Feedback State
  // ---------------------------------------------------------------------------
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState<boolean>(
    !initialData
  );
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  const addToast = (type: "success" | "error" | "info", message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    setToasts((prev) => [...prev, { id, type, message }]);

    // Auto-dismiss toast after 4 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Helper to normalize timeout minutes
  const normalizeTimeoutVal = (raw: any): string => {
    if (raw === undefined || raw === null) return "60";
    const str = String(raw).trim();
    if (str === "15" || str === "15 mins") return "15";
    if (str === "30" || str === "30 mins") return "30";
    if (str === "60" || str === "1 hour") return "60";
    if (str === "120" || str === "2 hours") return "120";
    if (str === "0" || str === "Never") return "0";
    return !isNaN(parseInt(str, 10)) ? str : "60";
  };

  // ---------------------------------------------------------------------------
  // Initial Data Fetching & User Metadata Loading
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let isMounted = true;

    async function loadAdminProfile() {
      try {
        setIsLoadingProfile(true);

        // 1. Fetch profile and resolved avatar from dedicated server API route
        try {
          const res = await fetch("/api/admin/profile");
          if (res.ok) {
            const data = await res.json();
            if (isMounted && data) {
              if (data.id) setUserId(data.id);
              if (data.email) setUserEmail(data.email);
              if (data.full_name) setFullName(data.full_name);
              if (data.avatar_url) {
                setAvatarPreviewUrl(data.avatar_url);
                setHasImageError(false);
                setIsAvatarRemoved(false);
              }
              if (typeof data.auto_email_reminders === "boolean") {
                setEmailReminders(data.auto_email_reminders);
              } else if (typeof data.email_reminders === "boolean") {
                setEmailReminders(data.email_reminders);
              }
              if (typeof data.new_submission_alerts === "boolean") {
                setSubmissionAlerts(data.new_submission_alerts);
              } else if (typeof data.submission_alerts === "boolean") {
                setSubmissionAlerts(data.submission_alerts);
              }
              const timeout = data.session_timeout_minutes ?? data.session_timeout;
              if (timeout !== undefined) {
                setSessionTimeout(normalizeTimeoutVal(timeout));
              }
              console.log("[AdminSettings Avatar Debug from /api/admin/profile]", data);
              return;
            }
          }
        } catch (apiErr) {
          console.warn("[AdminSettings] API profile fetch fallback note:", apiErr);
        }

        // 2. Safe fallback to client session without throwing DB 400 errors
        const supabase = createClient();
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          if (adminEmail) setUserEmail(adminEmail);
          if (adminName) setFullName(adminName);
          if (profileImageUrl) {
            const resolved = resolveAvatarPublicUrl(supabase, profileImageUrl);
            if (resolved) {
              setAvatarPreviewUrl(resolved);
              setHasImageError(false);
              setIsAvatarRemoved(false);
            }
          }
          return;
        }

        if (!isMounted) return;

        setUserId(user.id);
        const metadata = user.user_metadata || {};
        const userEmail = user.email || adminEmail || "";
        const userFullName =
          metadata.full_name ||
          metadata.name ||
          (metadata.first_name
            ? `${metadata.first_name} ${metadata.last_name || ""}`.trim()
            : null) ||
          adminName ||
          "Admin User";

        setUserEmail(userEmail);
        setFullName(userFullName);
        if (typeof metadata.auto_email_reminders === "boolean") {
          setEmailReminders(metadata.auto_email_reminders);
        } else if (typeof metadata.email_reminders === "boolean") {
          setEmailReminders(metadata.email_reminders);
        }
        if (typeof metadata.new_submission_alerts === "boolean") {
          setSubmissionAlerts(metadata.new_submission_alerts);
        } else if (typeof metadata.submission_alerts === "boolean") {
          setSubmissionAlerts(metadata.submission_alerts);
        }
        const timeout = metadata.session_timeout_minutes ?? metadata.session_timeout;
        if (timeout !== undefined) {
          setSessionTimeout(normalizeTimeoutVal(timeout));
        }

        const rawAvatar: string | null =
          metadata.avatar_url ||
          metadata.picture ||
          profileImageUrl ||
          null;

        const finalUrl = await fetchAdminAvatarUrl(
          supabase,
          userEmail,
          user.id,
          rawAvatar
        );

        console.log("[AdminSettings Avatar Debug]", { rawAvatar, finalUrl });

        if (isMounted && finalUrl) {
          setAvatarPreviewUrl(finalUrl);
          setHasImageError(false);
          setIsAvatarRemoved(false);
        }
      } catch (err) {
        console.error("Failed to load admin settings profile:", err);
      } finally {
        if (isMounted) {
          setIsLoadingProfile(false);
        }
      }
    }

    void loadAdminProfile();

    return () => {
      isMounted = false;
    };
  }, [adminEmail, adminName, profileImageUrl]);

  // Synchronize when external profileImageUrl changes
  useEffect(() => {
    if (profileImageUrl && !avatarFile && !isAvatarRemoved) {
      const supabase = createClient();
      const resolved = resolveAvatarPublicUrl(supabase, profileImageUrl);
      console.log("[AdminSettings] Prop Resolved Avatar URL:", resolved);
      if (resolved) {
        setAvatarPreviewUrl(resolved);
        setHasImageError(false);
      }
    }
  }, [profileImageUrl, avatarFile, isAvatarRemoved]);

  // ---------------------------------------------------------------------------
  // Avatar Selection & Removal Handlers
  // ---------------------------------------------------------------------------
  const handleAvatarFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!validTypes.includes(file.type)) {
        addToast(
          "error",
          "Invalid file type. Please upload a JPG, PNG, or WebP image."
        );
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        addToast("error", "Image is too large. Maximum allowed size is 5MB.");
        return;
      }

      setAvatarFile(file);
      setIsAvatarRemoved(false);
      setHasImageError(false);

      if (onProfileImageChange) {
        onProfileImageChange(file);
      }

      addToast("info", "New avatar image selected. Click 'Save Settings' to upload.");
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarFile(null);
    setAvatarPreviewUrl(null);
    setIsAvatarRemoved(true);
    setHasImageError(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (onProfileImageChange) {
      onProfileImageChange(null);
    }

    addToast("info", "Avatar marked for removal. Click 'Save Settings' to apply.");
  };

  // ---------------------------------------------------------------------------
  // Top-Level Save Settings Handler
  // ---------------------------------------------------------------------------
  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSavingSettings(true);

    try {
      const supabase = createClient();
      let updatedAvatarUrl: string | null = avatarPreviewUrl;

      // 1. Upload Avatar to Supabase Storage bucket ('avatars') if a new file is chosen
      if (avatarFile) {
        const fileExt = avatarFile.name.split(".").pop()?.toLowerCase() || "webp";
        const sanitizedName = avatarFile.name
          .replace(/[^a-zA-Z0-9.-]/g, "_")
          .replace(/\s+/g, "_");
        const uniqueId = userId || userEmail || "admin";
        const storagePath = `admin/${uniqueId}/${Date.now()}-${sanitizedName}`;

        // Attempt upload to 'avatars' bucket
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(storagePath, avatarFile, {
            contentType: avatarFile.type || `image/${fileExt}`,
            upsert: true,
          });

        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage
            .from("avatars")
            .getPublicUrl(storagePath);

          if (publicUrlData?.publicUrl) {
            updatedAvatarUrl = publicUrlData.publicUrl;
            setAvatarPreviewUrl(updatedAvatarUrl);
            setHasImageError(false);
            setAvatarFile(null);
            setIsAvatarRemoved(false);
          }
        } else {
          // Fallback check if 'avatars' bucket was unavailable, try 'compliance-private' or user metadata
          console.warn("Storage upload to 'avatars' bucket warning:", uploadError.message);
          const { error: fallbackError } = await supabase.storage
            .from("compliance-private")
            .upload(`admin-avatars/${uniqueId}/${Date.now()}-${sanitizedName}`, avatarFile, {
              upsert: true,
            });

          if (!fallbackError) {
            const { data: fallbackUrlData } = supabase.storage
              .from("compliance-private")
              .getPublicUrl(`admin-avatars/${uniqueId}/${Date.now()}-${sanitizedName}`);

            if (fallbackUrlData?.publicUrl) {
              updatedAvatarUrl = fallbackUrlData.publicUrl;
              setAvatarPreviewUrl(updatedAvatarUrl);
              setHasImageError(false);
              setAvatarFile(null);
              setIsAvatarRemoved(false);
            }
          }
        }
      } else if (isAvatarRemoved) {
        updatedAvatarUrl = null;
      }

      // 2. Update Supabase Auth User Metadata
      const metadataPayload: Record<string, any> = {
        full_name: fullName.trim() || adminName || "Admin User",
        avatar_url: updatedAvatarUrl,
        auto_email_reminders: emailReminders,
        new_submission_alerts: submissionAlerts,
        email_reminders: emailReminders,
        submission_alerts: submissionAlerts,
        session_timeout_minutes: sessionTimeout,
        session_timeout: sessionTimeout,
        system_settings: {
          auto_email_reminders: emailReminders,
          new_submission_alerts: submissionAlerts,
          email_reminders: emailReminders,
          submission_alerts: submissionAlerts,
          session_timeout_minutes: sessionTimeout,
          session_timeout: sessionTimeout,
          updated_at: new Date().toISOString(),
        },
      };

      const { error: authUpdateError } = await supabase.auth.updateUser({
        data: metadataPayload,
      });

      if (authUpdateError) {
        console.warn("User metadata update note:", authUpdateError.message);
      }

      // 3. Update Profiles Table in Database
      if (userId) {
        try {
          await supabase
            .from("profiles")
            .update({
              full_name: fullName.trim(),
            })
            .eq("id", userId);
        } catch (dbErr) {
          console.warn("Profile table update note:", dbErr);
        }

        // Also update admins table if existing
        try {
          await supabase
            .from("admins")
            .update({
              full_name: fullName.trim(),
              updated_at: new Date().toISOString(),
            })
            .eq("profile_id", userId);
        } catch {
          // Admins table is optional
        }
      }

      // 4. Refresh local component state
      setAvatarPreviewUrl(updatedAvatarUrl);
      setAvatarFile(null);
      setIsAvatarRemoved(false);
      setHasImageError(false);

      if (onProfileImageChange) {
        onProfileImageChange(null);
      }

      addToast("success", "Admin settings and system preferences saved successfully.");
    } catch (err) {
      console.error("Save settings error:", err);
      addToast(
        "error",
        err instanceof Error ? err.message : "Failed to save admin settings."
      );
    } finally {
      setIsSavingSettings(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Interactive Password Change Handler
  // ---------------------------------------------------------------------------
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword.trim()) {
      setPasswordError("Current password is required.");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation do not match.");
      return;
    }

    if (currentPassword === newPassword) {
      setPasswordError("New password cannot be the same as the current password.");
      return;
    }

    setIsChangingPassword(true);

    try {
      const supabase = createClient();

      // Verify current password by attempting authentication
      const emailToAuth = userEmail || adminEmail;
      if (emailToAuth) {
        const { error: verifyError } = await supabase.auth.signInWithPassword({
          email: emailToAuth,
          password: currentPassword,
        });

        if (verifyError) {
          setPasswordError("Current password verification failed. Please check your password.");
          setIsChangingPassword(false);
          return;
        }
      }

      // Update password via Supabase Auth
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw new Error(updateError.message);
      }

      setPasswordSuccess("Authentication password updated successfully.");
      addToast("success", "Password updated successfully.");

      // Reset form and close modal after slight delay
      setTimeout(() => {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setIsPasswordModalOpen(false);
        setPasswordSuccess(null);
        setPasswordError(null);
      }, 1400);
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to update authentication password.";
      setPasswordError(errorMsg);
      addToast("error", errorMsg);
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* --------------------------------------------------------------------- */}
      {/* Toast Notification Container (Floating Top-Right)                      */}
      {/* --------------------------------------------------------------------- */}
      {toasts.length > 0 && (
        <div className="fixed top-20 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-3 rounded-xl border p-3.5 shadow-2xl backdrop-blur-md transition-all animate-in fade-in slide-in-from-top-4 duration-300 ${
                toast.type === "success"
                  ? "bg-emerald-950/90 border-emerald-500/40 text-emerald-200"
                  : toast.type === "error"
                  ? "bg-rose-950/90 border-rose-500/40 text-rose-200"
                  : "bg-slate-900/90 border-amber-500/40 text-amber-200"
              }`}
            >
              {toast.type === "success" ? (
                <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
              ) : toast.type === "error" ? (
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
              ) : (
                <Sparkles className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
              )}
              <div className="flex-1 text-xs font-medium leading-relaxed">
                {toast.message}
              </div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="text-slate-400 hover:text-white transition-colors"
                aria-label="Dismiss toast"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* Header Bar & Top Action                                               */}
      {/* --------------------------------------------------------------------- */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-400 dark:border-slate-800 pb-5">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Admin System Settings
          </h2>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            Manage your administrator profile, security credentials, notification rules, and session lifecycle.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => handleSaveSettings()}
            disabled={isSavingSettings || isLoadingProfile}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 px-5 py-2 text-xs font-semibold text-slate-950 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/40 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
          >
            {isSavingSettings ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-slate-950" />
                <span>Saving Changes...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4 text-slate-950" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {/* ------------------------------------------------------------------- */}
        {/* Card 1: Profile & Credentials Section                               */}
        {/* ------------------------------------------------------------------- */}
        <section className="overflow-hidden rounded-2xl border border-slate-400/80 bg-white dark:border-slate-800 dark:bg-slate-950 shadow-sm shadow-slate-200/60 dark:shadow-none">
          <div className="flex items-center gap-2.5 border-b border-slate-400 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            <User className="h-4 w-4 text-amber-500 dark:text-amber-400" />
            <span>Profile & Credentials</span>
          </div>

          <div className="space-y-6 p-5 sm:p-6">
            {/* Avatar Upload & Instant Preview Card */}
            <div className="rounded-2xl border border-slate-400/80 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-900/40 p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
                <div className="relative group shrink-0">
                  {!hasImageError && avatarPreviewUrl && !isAvatarRemoved ? (
                    <img
                      src={avatarPreviewUrl}
                      alt={fullName || "Admin Avatar"}
                      className="h-20 w-20 rounded-full border-2 border-amber-500/40 object-cover bg-slate-100 dark:bg-slate-900 shadow-md ring-4 ring-white dark:ring-slate-950 transition group-hover:border-amber-400"
                      onError={(e) => {
                        console.warn("[AdminSettings] Avatar image failed to load from URL:", avatarPreviewUrl, e);
                        setHasImageError(true);
                      }}
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-amber-500/40 bg-amber-500/10 text-xl font-bold text-amber-800 dark:text-amber-300 shadow-md ring-4 ring-white dark:ring-slate-950">
                      {getInitials(fullName)}
                    </div>
                  )}

                  {/* Camera overlay indicator */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 flex items-center justify-center rounded-full bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity text-amber-300 cursor-pointer"
                    title="Change Avatar"
                  >
                    <Camera className="h-5 w-5" />
                  </button>
                </div>

                <div className="flex-1 space-y-2">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Administrator Avatar
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      JPG, PNG, or WebP (Max 5MB)
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 pt-1">
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handleAvatarFileSelect}
                    />

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300 transition-all hover:bg-amber-500/20 cursor-pointer"
                    >
                      <Camera className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                      <span>Upload Photo</span>
                    </button>

                    {(avatarPreviewUrl || avatarFile) && !isAvatarRemoved && (
                      <button
                        type="button"
                        onClick={handleRemoveAvatar}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-50 dark:bg-rose-950/20 px-3.5 py-1.5 text-xs font-medium text-rose-800 dark:text-rose-300 transition-all hover:bg-rose-100 dark:hover:bg-rose-950/40 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                        <span>Remove Photo</span>
                      </button>
                    )}

                    {avatarFile && (
                      <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1">
                        <Sparkles className="h-3 w-3" />
                        Selected: {avatarFile.name}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Profile Info Form Inputs */}
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Admin Full Name <span className="text-amber-500">*</span>
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g., Prof. Juan Dela Cruz"
                  className="w-full rounded-xl border border-slate-400 bg-white text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 px-3.5 py-2.5 text-xs font-medium outline-none transition"
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Displayed on audit logs, reports, and review workflows.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Admin Email Address
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={userEmail}
                    readOnly
                    placeholder="admin@pup.edu.ph"
                    className="w-full rounded-xl border border-slate-400 bg-slate-100 text-slate-600 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400 px-3.5 py-2.5 pl-9 text-xs font-medium cursor-not-allowed outline-none"
                  />
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Primary login email associated with your administrator account.
                </p>
              </div>
            </div>

            {/* Password Credentials Card */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-slate-400/80 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-900/40 p-4">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                  <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-200">
                    Authentication Password
                  </h4>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Keep your account secure with regular password updates.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setPasswordError(null);
                  setPasswordSuccess(null);
                  setIsPasswordModalOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-400 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700 px-4 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 transition-all focus:outline-none cursor-pointer"
              >
                <KeyRound className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                <span>Change Password</span>
              </button>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------------- */}
        {/* Card 2: Notification Preferences Section                            */}
        {/* ------------------------------------------------------------------- */}
        <section className="overflow-hidden rounded-2xl border border-slate-400/80 bg-white dark:border-slate-800 dark:bg-slate-950 shadow-sm shadow-slate-200/60 dark:shadow-none">
          <div className="flex items-center gap-2.5 border-b border-slate-400 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            <Bell className="h-4 w-4 text-amber-500 dark:text-amber-400" />
            <span>Notification Preferences</span>
          </div>

          <div className="divide-y divide-slate-400 dark:divide-slate-800/70">
            {/* Toggle 1: Automated Email Reminders */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/50">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-200">
                    Automated Email Reminders on Submission Windows
                  </p>
                  {emailReminders && (
                    <span className="rounded-md bg-emerald-50 text-emerald-800 border border-emerald-500/30 px-1.5 py-0.5 text-[10px] font-medium dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed max-w-xl">
                  Send automated deadline and window reminders to faculty.
                </p>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={emailReminders}
                onClick={() => setEmailReminders((prev) => !prev)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-500/50 ${
                  emailReminders
                    ? "bg-amber-500 border border-amber-400"
                    : "bg-slate-300 dark:bg-slate-800 border border-slate-400 dark:border-slate-700"
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

            {/* Toggle 2: New Submission Alert Notifications */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/50">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-200">
                    New Submission Alert Notifications
                  </p>
                  {submissionAlerts && (
                    <span className="rounded-md bg-emerald-50 text-emerald-800 border border-emerald-500/30 px-1.5 py-0.5 text-[10px] font-medium dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed max-w-xl">
                  Receive notifications when faculty members submit compliance documents.
                </p>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={submissionAlerts}
                onClick={() => setSubmissionAlerts((prev) => !prev)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-500/50 ${
                  submissionAlerts
                    ? "bg-amber-500 border border-amber-400"
                    : "bg-slate-300 dark:bg-slate-800 border border-slate-400 dark:border-slate-700"
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
          </div>
        </section>

        {/* ------------------------------------------------------------------- */}
        {/* Card 3: Security & Session Controls Section                         */}
        {/* ------------------------------------------------------------------- */}
        <section className="overflow-hidden rounded-2xl border border-slate-400/80 bg-white dark:border-slate-800 dark:bg-slate-950 shadow-sm shadow-slate-200/60 dark:shadow-none">
          <div className="flex items-center gap-2.5 border-b border-slate-400 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            <Shield className="h-4 w-4 text-amber-500 dark:text-amber-400" />
            <span>Security & Session Controls</span>
          </div>

          <div className="p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-200">
                    Session Timeout Duration
                  </p>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed max-w-xl">
                  Automatically log out after inactivity for security.
                </p>
              </div>

              <div className="shrink-0">
                <select
                  value={sessionTimeout}
                  onChange={(e) => setSessionTimeout(e.target.value)}
                  className="w-full sm:w-48 rounded-xl border border-slate-400 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 px-3.5 py-2 text-xs font-medium focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 cursor-pointer transition"
                >
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="60">1 hour (Recommended)</option>
                  <option value="120">2 hours</option>
                  <option value="0">Never (Persistent Session)</option>
                </select>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* Interactive Change Password Modal                                     */}
      {/* --------------------------------------------------------------------- */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl border border-slate-400 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 shadow-2xl text-slate-900 dark:text-slate-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-400 dark:border-slate-800 pb-4 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-400">
                  <Lock className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Change Password
                  </h3>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Update your account credentials
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsPasswordModalOpen(false)}
                className="rounded-full border border-slate-400 dark:border-slate-800 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Error & Success Feedback in Modal */}
            {passwordError && (
              <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-50 dark:bg-rose-950/50 p-3.5 text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
                <div className="flex-1">{passwordError}</div>
              </div>
            )}

            {passwordSuccess && (
              <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/50 p-3.5 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2.5">
                <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                <div className="flex-1">{passwordSuccess}</div>
              </div>
            )}

            {/* Password Form */}
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-3.5 rounded-2xl border border-slate-400 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-900/40 p-4">
                {/* Current Password Field */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Current Password <span className="text-amber-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter your current password"
                      required
                      className="w-full rounded-xl border border-slate-400 bg-white text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 px-3.5 py-2.5 pr-10 text-xs font-medium outline-none transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword((prev) => !prev)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showCurrentPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* New Password Field */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    New Password <span className="text-amber-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      required
                      minLength={8}
                      className="w-full rounded-xl border border-slate-400 bg-white text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 px-3.5 py-2.5 pr-10 text-xs font-medium outline-none transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((prev) => !prev)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showNewPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Confirm Password Field */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Confirm New Password <span className="text-amber-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter your new password"
                      required
                      minLength={8}
                      className="w-full rounded-xl border border-slate-400 bg-white text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 px-3.5 py-2.5 pr-10 text-xs font-medium outline-none transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  disabled={isChangingPassword}
                  className="rounded-xl border border-slate-400 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-950 dark:hover:text-white transition disabled:opacity-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    isChangingPassword ||
                    !currentPassword.trim() ||
                    newPassword.length < 8 ||
                    newPassword !== confirmPassword
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 px-5 py-2 text-xs font-semibold text-slate-950 transition-all shadow-sm disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                >
                  {isChangingPassword ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-950" />
                      <span>Updating...</span>
                    </>
                  ) : (
                    <span>Update Password</span>
                  )}
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
