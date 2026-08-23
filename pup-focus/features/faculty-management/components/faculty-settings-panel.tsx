"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  buildFacultyFullName,
  buildFacultyInitials,
  parseFullNameFallback,
} from "@/lib/faculty-profile";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff, RotateCw, X, Camera, Pencil } from "lucide-react";

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

export interface FacultySettingsPanelProps {
  initialFacultyName?: string | null;
  initialFacultyEmail?: string | null;
  initialDepartment?: string | null;
  initialAvatarUrl?: string | null;
  initialAccount?: Partial<FacultyAccountResponse> | null;
}

export function FacultySettingsPanel({
  initialFacultyName,
  initialFacultyEmail,
  initialDepartment,
  initialAvatarUrl,
  initialAccount,
}: FacultySettingsPanelProps = {}) {
  const router = useRouter();
  const profileImageInputRef = useRef<HTMLInputElement>(null);
  const firstNameInputRef = useRef<HTMLInputElement>(null);
  const middleNameInputRef = useRef<HTMLInputElement>(null);
  const lastNameInputRef = useRef<HTMLInputElement>(null);

  const [activeField, setActiveField] = useState<
    "firstName" | "middleName" | "lastName" | null
  >(null);

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

  // Synchronous, non-blocking initial state from session props
  const [account, setAccount] = useState<FacultyAccountResponse>(() => {
    const rawName =
      initialAccount?.fullName ?? initialFacultyName ?? "";
    const parsed = parseFullNameFallback(rawName);

    const firstName = initialAccount?.firstName || parsed.firstName;
    const middleName = initialAccount?.middleName || parsed.middleName;
    const lastName = initialAccount?.lastName || parsed.lastName;
    const fullName =
      initialAccount?.fullName ??
      initialFacultyName ??
      buildFacultyFullName({ firstName, middleName, lastName }) ??
      "";
    const email = initialAccount?.email ?? initialFacultyEmail ?? "";
    const profileImageUrl =
      initialAccount?.profileImageUrl ?? initialAvatarUrl ?? null;

    let programObj = initialAccount?.program ?? null;
    if (
      !programObj &&
      initialDepartment &&
      initialDepartment.trim() &&
      initialDepartment !== "Unassigned"
    ) {
      const parts = initialDepartment.split("—").map((s) => s.trim());
      programObj = {
        id: "",
        code: parts[0] || "",
        name: parts[1] || parts[0] || "",
      };
    }

    return {
      profileId: initialAccount?.profileId ?? "",
      firstName,
      middleName,
      lastName,
      fullName,
      email,
      profileImageUrl,
      program: programObj,
    };
  });

  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [profileImagePreviewUrl, setProfileImagePreviewUrl] = useState<
    string | null
  >(null);
  const [isProfileImageMenuOpen, setIsProfileImageMenuOpen] = useState(false);
  const [isFullImageOpen, setIsFullImageOpen] = useState(false);
  const [imageError, setImageError] = useState(false);

  const [form, setForm] = useState<NameFormState>(() => {
    const rawName =
      initialAccount?.fullName ?? initialFacultyName ?? "";
    const parsed = parseFullNameFallback(rawName);

    return {
      firstName: initialAccount?.firstName || parsed.firstName,
      middleName: initialAccount?.middleName || parsed.middleName,
      lastName: initialAccount?.lastName || parsed.lastName,
    };
  });

  const [isRefreshing, setIsRefreshing] = useState(false);
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

  const displayedProfileImage =
    profileImagePreviewUrl ?? account.profileImageUrl ?? initialAvatarUrl ?? null;

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

  useEffect(() => {
    let isMounted = true;

    // Fast client-side session hydration
    async function hydrateLocalSession() {
      try {
        const supabase = createClient();
        const result = await supabase.auth.getUser();
        const user = result.data?.user;
        if (!isMounted || !user) return;
        const meta = (user.user_metadata || {}) as Record<
          string,
          unknown
        >;
        const rawFullName =
          (meta.full_name as string) ||
          (user.user_metadata?.name as string) ||
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
          "Faculty";

        setAccount((prev) => {
          if (prev.email && prev.firstName && prev.lastName) return prev;
          return {
            profileId: prev.profileId || user.id,
            firstName: prev.firstName || metaFirst,
            middleName: prev.middleName || metaMiddle,
            lastName: prev.lastName || metaLast,
            fullName: prev.fullName || metaFull,
            email: prev.email || user.email || "",
            profileImageUrl:
              prev.profileImageUrl ||
              (meta.profile_image_url as string) ||
              null,
            program: prev.program || null,
          };
        });

        setForm((prev) => {
          if (prev.firstName || prev.lastName) return prev;
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

    // Silent background sync
    async function loadAccount() {
      try {
        const response = await fetch("/api/faculty/account");
        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as FacultyAccountResponse;
        if (!isMounted) {
          return;
        }

        setAccount(data);
        setForm((prev) => {
          // If user hasn't edited the fields yet, sync with authoritative server data
          const hasUserEdited =
            prev.firstName !== "" && prev.firstName !== data.firstName;
          if (hasUserEdited) return prev;

          return {
            firstName: data.firstName,
            middleName: data.middleName,
            lastName: data.lastName,
          };
        });
      } catch {
        // Silent background fetch
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
        email: account.email,
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
      setIsRefreshing(true);
      setError(null);
      const response = await fetch("/api/faculty/account");
      if (!response.ok) {
        return;
      }

      const data = (await response.json()) as FacultyAccountResponse;
      setAccount(data);
      setForm((prev) => {
        const hasUserEdited =
          prev.firstName !== "" && prev.firstName !== data.firstName;
        if (hasUserEdited) return prev;

        return {
          firstName: data.firstName,
          middleName: data.middleName,
          lastName: data.lastName,
        };
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

  const isProfileChanged =
    Boolean(profileImageFile) ||
    form.firstName !== account.firstName ||
    form.middleName !== account.middleName ||
    form.lastName !== account.lastName;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-slate-300 dark:border-slate-800 pb-4">
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
          disabled={isRefreshing}
          title="Refresh account details"
          className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white dark:border-slate-800 dark:bg-slate-900/60 p-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition disabled:opacity-50 cursor-pointer shadow-sm shadow-slate-300/50 dark:shadow-none"
        >
          <RotateCw className={`h-4 w-4 ${isRefreshing ? "animate-spin text-amber-500" : ""}`} />
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
                <div className="relative h-20 w-20 rounded-full border border-slate-300 dark:border-slate-700/80 bg-slate-100 dark:bg-slate-950 overflow-hidden flex items-center justify-center text-lg font-semibold text-slate-800 dark:text-slate-200 shadow-xs">
                  {/* Clean initials rendered immediately */}
                  <span className="select-none font-semibold text-slate-700 dark:text-slate-300">
                    {buildFacultyInitials(account.fullName || "Faculty")}
                  </span>

                  {displayedProfileImage && !imageError ? (
                    <img
                      src={displayedProfileImage}
                      alt={account.fullName || "Faculty"}
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
                  className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-md border-2 border-white dark:border-slate-900 transition-transform group-hover:scale-110 pointer-events-none"
                  aria-hidden="true"
                >
                  <Camera className="h-3.5 w-3.5" />
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {account.fullName || "Faculty Member"}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 truncate mt-0.5">
                  {account.email || "No email on record"}
                </p>
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
                <label
                  htmlFor="faculty-first-name"
                  className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block"
                >
                  First Name
                </label>
                <div className="relative flex items-center">
                  <input
                    id="faculty-first-name"
                    ref={firstNameInputRef}
                    readOnly={activeField !== "firstName"}
                    className={`w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-4 py-2.5 pr-16 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:outline-none focus-visible:outline-none transition-all ${
                      activeField === "firstName"
                        ? "border-amber-500 ring-2 ring-amber-500/80 dark:ring-amber-500/60"
                        : "border-slate-300 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-700 cursor-default"
                    }`}
                    value={form.firstName}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, firstName: e.target.value }))
                    }
                    onBlur={() => setActiveField(null)}
                    placeholder="First name"
                  />
                  <button
                    type="button"
                    onClick={() => handleFocusField("firstName", firstNameInputRef)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs text-slate-400 hover:text-amber-500 transition-colors cursor-pointer px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                    title="Edit First Name"
                    aria-label="Edit First Name"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    <span>Edit</span>
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="faculty-middle-name"
                  className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block"
                >
                  Middle Name
                </label>
                <div className="relative flex items-center">
                  <input
                    id="faculty-middle-name"
                    ref={middleNameInputRef}
                    readOnly={activeField !== "middleName"}
                    className={`w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-4 py-2.5 pr-16 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:outline-none focus-visible:outline-none transition-all ${
                      activeField === "middleName"
                        ? "border-amber-500 ring-2 ring-amber-500/80 dark:ring-amber-500/60"
                        : "border-slate-300 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-700 cursor-default"
                    }`}
                    value={form.middleName}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, middleName: e.target.value }))
                    }
                    onBlur={() => setActiveField(null)}
                    placeholder="Middle name"
                  />
                  <button
                    type="button"
                    onClick={() => handleFocusField("middleName", middleNameInputRef)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs text-slate-400 hover:text-amber-500 transition-colors cursor-pointer px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                    title="Edit Middle Name"
                    aria-label="Edit Middle Name"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    <span>Edit</span>
                  </button>
                </div>
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="faculty-last-name"
                  className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block"
                >
                  Last Name
                </label>
                <div className="relative flex items-center">
                  <input
                    id="faculty-last-name"
                    ref={lastNameInputRef}
                    readOnly={activeField !== "lastName"}
                    className={`w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-4 py-2.5 pr-16 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:outline-none focus-visible:outline-none transition-all ${
                      activeField === "lastName"
                        ? "border-amber-500 ring-2 ring-amber-500/80 dark:ring-amber-500/60"
                        : "border-slate-300 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-700 cursor-default"
                    }`}
                    value={form.lastName}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, lastName: e.target.value }))
                    }
                    onBlur={() => setActiveField(null)}
                    placeholder="Last name"
                  />
                  <button
                    type="button"
                    onClick={() => handleFocusField("lastName", lastNameInputRef)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs text-slate-400 hover:text-amber-500 transition-colors cursor-pointer px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                    title="Edit Last Name"
                    aria-label="Edit Last Name"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    <span>Edit</span>
                  </button>
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">
                  Email Address
                </label>
                <input
                  className="w-full bg-slate-100 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-400 cursor-not-allowed rounded-xl px-4 py-2.5 text-xs font-medium"
                  value={account.email || ""}
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
                      : initialDepartment && initialDepartment.trim()
                        ? initialDepartment
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
                disabled={isSaving || !isProfileChanged}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-4 py-2 rounded-xl text-xs shadow-sm shadow-amber-500/10 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
              >
                {isSaving ? "Saving..." : "Save Profile Changes"}
              </button>
            </div>
          </form>
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
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="Enter current password"
                />
                <button
                  type="button"
                  onClick={() => setShowOldPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                >
                  {showOldPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
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
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                >
                  {showNewPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
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
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {passwordMessage && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">{passwordMessage}</p>
            )}
            {passwordError && (
              <p className="text-xs text-red-600 dark:text-red-400 font-medium">{passwordError}</p>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={isChangingPassword}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-4 py-2 rounded-xl text-xs shadow-sm shadow-amber-500/10 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
              >
                {isChangingPassword ? "Updating..." : "Update Password"}
              </button>
            </div>
          </form>
        </article>
      </section>

      {/* Profile Image Action Modal */}
      {isProfileImageMenuOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsProfileImageMenuOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-300 dark:border-slate-800 px-6 py-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Profile Photo Options
              </h3>
              <button
                type="button"
                onClick={() => setIsProfileImageMenuOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6 space-y-3">
              <button
                type="button"
                onClick={() => {
                  setIsProfileImageMenuOpen(false);
                  profileImageInputRef.current?.click();
                }}
                className="flex w-full items-center justify-between rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950/60 px-4 py-3.5 text-left text-slate-800 dark:text-slate-200 transition hover:border-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-800/40 cursor-pointer"
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
                  className="flex w-full items-center justify-between rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950/60 px-4 py-3.5 text-left text-slate-800 dark:text-slate-200 transition hover:border-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-800/40 cursor-pointer"
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
            className="w-full max-w-lg rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-300 dark:border-slate-800 px-6 py-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                {account.fullName || "Profile Photo"}
              </h3>
              <button
                type="button"
                onClick={() => setIsFullImageOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6 flex items-center justify-center">
              <div className="flex items-center justify-center overflow-hidden rounded-xl border border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 max-h-[60vh]">
                <img
                  src={displayedProfileImage}
                  alt={account.fullName || "Profile"}
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
