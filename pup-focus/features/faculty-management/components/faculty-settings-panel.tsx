"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  buildFacultyFullName,
  buildFacultyInitials,
} from "@/lib/faculty-profile";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff, RotateCw, X, Camera } from "lucide-react";

type FacultyAccountResponse = {
  profileId: string;
  firstName: string;
  middleName: string;
  lastName: string;
  fullName: string;
  email: string;
  profileImageUrl: string | null;
  program?: {
    id: string;
    code: string;
    name: string;
  } | null;
};

type NameFormState = {
  firstName: string;
  middleName: string;
  lastName: string;
};

export function FacultySettingsPanel() {
  const router = useRouter();
  const profileImageInputRef = useRef<HTMLInputElement>(null);
  const [account, setAccount] = useState<FacultyAccountResponse | null>(null);
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [profileImagePreviewUrl, setProfileImagePreviewUrl] = useState<
    string | null
  >(null);
  const [isProfileImageMenuOpen, setIsProfileImageMenuOpen] = useState(false);
  const [isFullImageOpen, setIsFullImageOpen] = useState(false);
  const [form, setForm] = useState<NameFormState>({
    firstName: "",
    middleName: "",
    lastName: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

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
    let isMounted = true;

    async function loadAccount() {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch("/api/faculty/account");
        if (!response.ok) {
          throw new Error("Failed to load faculty account");
        }

        const data = (await response.json()) as FacultyAccountResponse;
        if (!isMounted) {
          return;
        }

        setAccount(data);
        setForm({
          firstName: data.firstName,
          middleName: data.middleName,
          lastName: data.lastName,
        });
      } catch (loadError) {
        if (isMounted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load faculty account",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadAccount();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleChangePasswordSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setPasswordError(null);
    setPasswordMessage(null);

    if (!oldPassword.trim()) {
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
      const supabase = createClient();

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: account?.email ?? "",
        password: oldPassword,
      });

      if (signInError) {
        throw new Error("Incorrect current password.");
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw new Error(updateError.message);
      }

      setPasswordMessage("Password updated successfully.");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPasswordError(
        err instanceof Error ? err.message : "Failed to update password.",
      );
    } finally {
      setIsChangingPassword(false);
    }
  }

  async function refreshAccount() {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch("/api/faculty/account");
      if (!response.ok) {
        throw new Error("Failed to load faculty account");
      }

      const data = (await response.json()) as FacultyAccountResponse;
      setAccount(data);
      setForm({
        firstName: data.firstName,
        middleName: data.middleName,
        lastName: data.lastName,
      });
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load faculty account",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSaveName(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage(null);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("firstName", form.firstName);
      formData.append("middleName", form.middleName);
      formData.append("lastName", form.lastName);
      if (profileImageFile) {
        formData.append("profileImage", profileImageFile);
      }

      const response = await fetch("/api/faculty/account", {
        method: "PATCH",
        body: formData,
      });

      const payload = (await response.json()) as unknown;

      if (!response.ok) {
        const errorMessage =
          typeof payload === "object" &&
          payload !== null &&
          "error" in payload &&
          typeof (payload as { error?: unknown }).error === "string"
            ? (payload as { error: string }).error
            : "Failed to update faculty account";

        throw new Error(errorMessage);
      }

      const updatedAccount = payload as FacultyAccountResponse;
      setAccount(updatedAccount);
      setForm({
        firstName: updatedAccount.firstName,
        middleName: updatedAccount.middleName,
        lastName: updatedAccount.lastName,
      });
      setProfileImageFile(null);
      setMessage("Profile updated successfully.");
      router.refresh();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to update faculty account",
      );
    } finally {
      setIsSaving(false);
    }
  }

  const displayedProfileImage =
    profileImagePreviewUrl ?? account?.profileImageUrl;

  const isProfileChanged =
    Boolean(profileImageFile) ||
    (account &&
      (form.firstName !== account.firstName ||
        form.middleName !== account.middleName ||
        form.lastName !== account.lastName));

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-[#000000] dark:border-slate-800/80 pb-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
            Settings
          </h1>
          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400 font-normal">
            Manage your faculty account details and security settings.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refreshAccount()}
          disabled={isLoading}
          title="Refresh account details"
          className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white dark:border-slate-800 dark:bg-slate-900/60 p-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition disabled:opacity-50 cursor-pointer shadow-sm shadow-slate-300/50 dark:shadow-none"
        >
          <RotateCw className={`h-4 w-4 ${isLoading ? "animate-spin text-amber-500" : ""}`} />
          <span className="sr-only">Refresh</span>
        </button>
      </div>

      {/* Grid Layout */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Profile Details Card */}
        <article className="rounded-xl border border-slate-300 dark:border-slate-800 bg-white shadow-sm shadow-slate-300/50 dark:border dark:bg-slate-900 dark:shadow-none p-6 transition-colors">
          <div className="pb-4 border-b border-slate-300 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 tracking-normal">
              Profile Details
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 font-normal">
              View and update your personal information.
            </p>
          </div>

          {isLoading ? (
            <p className="mt-6 text-xs text-slate-500 dark:text-slate-400">Loading profile details...</p>
          ) : error ? (
            <p className="mt-6 text-xs text-red-500 dark:text-red-400">{error}</p>
          ) : account ? (
            <form onSubmit={handleSaveName} className="mt-5 space-y-5">
              {/* Profile Avatar Layout */}
              <div className="flex items-center gap-4">
                <div className="relative group shrink-0">
                  <div className="h-20 w-20 rounded-full border border-slate-300 dark:border-slate-700/80 bg-slate-100 dark:bg-slate-950 overflow-hidden flex items-center justify-center text-lg font-semibold text-slate-800 dark:text-slate-200 shadow-xs">
                    {displayedProfileImage ? (
                      <img
                        src={displayedProfileImage}
                        alt={account.fullName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span>{buildFacultyInitials(account.fullName)}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsProfileImageMenuOpen(true)}
                    className="absolute inset-0 rounded-full bg-slate-950/60 text-white text-[11px] font-medium opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center cursor-pointer"
                    aria-label="Change profile picture"
                  >
                    <Camera className="h-4 w-4 mb-0.5" />
                    <span>Change</span>
                  </button>
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {account.fullName}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 truncate mt-0.5">
                    {account.email}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => profileImageInputRef.current?.click()}
                      className="text-xs text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 transition underline underline-offset-2 cursor-pointer font-medium"
                    >
                      Upload new image
                    </button>
                    {displayedProfileImage && (
                      <button
                        type="button"
                        onClick={() => setIsFullImageOpen(true)}
                        className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition cursor-pointer"
                      >
                        • View full
                      </button>
                    )}
                  </div>
                </div>

                <input
                  ref={profileImageInputRef}
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp"
                  className="hidden"
                  onChange={(event) => {
                    setProfileImageFile(event.target.files?.[0] ?? null);
                    setIsProfileImageMenuOpen(false);
                  }}
                />
              </div>

              {profileImageFile && (
                <div className="flex items-center justify-between rounded-xl border border-amber-600/50 bg-amber-500/10 px-3.5 py-2 text-xs text-amber-900 dark:text-amber-300 font-medium">
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

              {/* Form Input Fields */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">
                    First Name
                  </label>
                  <input
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl px-4 py-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
                    value={form.firstName}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, firstName: e.target.value }))
                    }
                    placeholder="First name"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">
                    Middle Name
                  </label>
                  <input
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl px-4 py-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
                    value={form.middleName}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, middleName: e.target.value }))
                    }
                    placeholder="Middle name"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">
                    Last Name
                  </label>
                  <input
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl px-4 py-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
                    value={form.lastName}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, lastName: e.target.value }))
                    }
                    placeholder="Last name"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">
                    Email Address
                  </label>
                  <input
                    className="w-full bg-slate-100 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-400 cursor-not-allowed rounded-xl px-4 py-2.5 text-xs font-medium"
                    value={account.email}
                    disabled
                    readOnly
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">
                    Department / Program
                  </label>
                  <input
                    className="w-full bg-slate-100 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-400 cursor-not-allowed rounded-xl px-4 py-2.5 text-xs font-medium"
                    value={
                      account.program
                        ? `${account.program.code} — ${account.program.name}`
                        : "Unassigned"
                    }
                    disabled
                    readOnly
                  />
                </div>
              </div>

              {message && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">{message}</p>
              )}
              {error && (
                <p className="text-xs text-red-600 dark:text-red-400 font-medium">{error}</p>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                {isProfileChanged && (
                  <button
                    type="button"
                    onClick={() => {
                      setForm({
                        firstName: account.firstName,
                        middleName: account.middleName,
                        lastName: account.lastName,
                      });
                      setProfileImageFile(null);
                      if (profileImageInputRef.current) {
                        profileImageInputRef.current.value = "";
                      }
                    }}
                    className="text-xs text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 px-3 py-2 rounded-xl transition cursor-pointer font-medium"
                  >
                    Reset
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSaving || isLoading || !isProfileChanged}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-4 py-2 rounded-xl text-xs shadow-sm shadow-amber-500/10 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isSaving ? "Saving..." : "Save Profile Changes"}
                </button>
              </div>
            </form>
          ) : null}
        </article>

        {/* Change Password Card */}
        <article className="rounded-xl border border-slate-300 dark:border-slate-800 bg-white shadow-sm shadow-slate-300/50 dark:border dark:bg-slate-900 dark:shadow-none p-6 transition-colors">
          <div className="pb-4 border-b border-slate-300 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 tracking-normal">
              Change Password
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 font-normal">
              Update your account password for security.
            </p>
          </div>

          <form className="mt-5 space-y-4" onSubmit={handleChangePasswordSubmit}>
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">
                Current Password
              </label>
              <div className="relative">
                <input
                  type={showOldPassword ? "text" : "password"}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl px-4 py-2.5 pr-10 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
                  placeholder="Enter current password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowOldPassword(!showOldPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                >
                  {showOldPassword ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? "text" : "password"}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl px-4 py-2.5 pr-10 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
                  placeholder="At least 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                >
                  {showNewPassword ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl px-4 py-2.5 pr-10 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                >
                  {showConfirmPassword ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
              </div>
            </div>

            {passwordMessage && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">{passwordMessage}</p>
            )}
            {passwordError && (
              <p className="text-xs text-red-600 dark:text-red-400 font-medium">{passwordError}</p>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={
                  isChangingPassword ||
                  isLoading ||
                  !oldPassword.trim() ||
                  newPassword.length < 8 ||
                  newPassword !== confirmPassword
                }
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-4 py-2 rounded-xl text-xs shadow-sm shadow-amber-500/10 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
              >
                {isChangingPassword ? "Updating..." : "Update Password"}
              </button>
            </div>
          </form>
        </article>
      </section>

      {/* Profile Image Modal */}
      {isProfileImageMenuOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="profile-image-menu-title"
          onClick={() => {
            setIsProfileImageMenuOpen(false);
            setIsFullImageOpen(false);
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-300 dark:border-slate-800 px-6 py-4">
              <h3
                id="profile-image-menu-title"
                className="text-sm font-semibold text-slate-900 dark:text-slate-100"
              >
                Manage Profile Picture
              </h3>
              <button
                type="button"
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                onClick={() => {
                  setIsProfileImageMenuOpen(false);
                  setIsFullImageOpen(false);
                }}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </button>
            </div>

            <div className="p-6 space-y-3">
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950/60 px-4 py-3.5 text-left text-slate-800 dark:text-slate-200 transition hover:border-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-800/40 cursor-pointer"
                onClick={() => {
                  setIsFullImageOpen(true);
                  setIsProfileImageMenuOpen(false);
                }}
              >
                <div>
                  <span className="block text-sm font-medium">View full photo</span>
                  <span className="block text-xs text-slate-500">
                    Open a larger preview of your current photo
                  </span>
                </div>
                <span className="text-slate-400 text-sm">↗</span>
              </button>

              <button
                type="button"
                className="flex w-full items-center justify-between rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950/60 px-4 py-3.5 text-left text-slate-800 dark:text-slate-200 transition hover:border-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-800/40 cursor-pointer"
                onClick={() => {
                  profileImageInputRef.current?.click();
                  setIsProfileImageMenuOpen(false);
                }}
              >
                <div>
                  <span className="block text-sm font-medium">Upload new photo</span>
                  <span className="block text-xs text-slate-500">
                    Select a PNG, JPG, or WEBP file from your device
                  </span>
                </div>
                <span className="text-slate-400 text-sm">✎</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Image Preview Modal */}
      {isFullImageOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 px-4 py-6 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          onClick={() => setIsFullImageOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-300 dark:border-slate-800 px-6 py-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {account?.fullName ?? "Profile Photo"}
              </h3>
              <button
                type="button"
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                onClick={() => setIsFullImageOpen(false)}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </button>
            </div>

            <div className="p-6">
              <div className="flex items-center justify-center overflow-hidden rounded-xl border border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 max-h-[60vh]">
                {displayedProfileImage ? (
                  <img
                    src={displayedProfileImage}
                    alt={account?.fullName ?? "Profile picture"}
                    className="max-h-[60vh] w-full object-contain"
                  />
                ) : (
                  <div className="flex h-64 w-full items-center justify-center text-sm font-medium text-slate-500">
                    No profile picture available
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
