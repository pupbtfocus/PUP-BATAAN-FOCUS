"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  buildFacultyFullName,
  buildFacultyInitials,
} from "@/lib/faculty-profile";

type FacultyAccountResponse = {
  profileId: string;
  firstName: string;
  middleName: string;
  lastName: string;
  fullName: string;
  email: string;
  profileImageUrl: string | null;
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

  const fullNamePreview = buildFacultyFullName({
    firstName: form.firstName,
    middleName: form.middleName,
    lastName: form.lastName,
  });

  const displayedProfileImage =
    profileImagePreviewUrl ?? account?.profileImageUrl;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => void refreshAccount()}
          disabled={isLoading}
        >
          {isLoading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-2xl border border-slate-700 bg-slate-900/90 p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.18em] text-amber-300">
            Profile
          </p>
          {isLoading ? (
            <p className="mt-4 text-sm text-slate-400">Loading profile...</p>
          ) : error ? (
            <p className="mt-4 text-sm text-red-400">{error}</p>
          ) : account ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Profile Picture
                </p>
                <button
                  type="button"
                  onClick={() => setIsProfileImageMenuOpen(true)}
                  className="group relative flex h-36 w-36 items-center justify-center overflow-hidden rounded-3xl border border-slate-700 bg-slate-950 text-3xl font-semibold text-amber-300 shadow-inner transition hover:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                  aria-label="Open profile picture options"
                >
                  {displayedProfileImage ? (
                    <img
                      src={displayedProfileImage}
                      alt={account.fullName}
                      className="h-full w-full object-cover transition duration-200 group-hover:blur-sm"
                    />
                  ) : (
                    <span>{buildFacultyInitials(account.fullName)}</span>
                  )}
                  <span className="absolute inset-0 flex items-end justify-center bg-slate-950/0 px-3 pb-3 text-xs font-medium text-transparent transition group-hover:bg-slate-950/40 group-hover:text-white">
                    Click to manage image
                  </span>
                </button>
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
                {profileImageFile ? (
                  <p className="text-xs text-amber-300">
                    New image selected. Save profile changes to upload it.
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-slate-100">
                  {account.fullName}
                </h3>
                <p className="text-sm text-slate-400">{account.email}</p>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  Faculty account
                </p>
              </div>
            </div>
          ) : null}
        </article>

        <article className="rounded-2xl border border-slate-700 bg-slate-900/90 p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.18em] text-amber-300">
            Change Password
          </p>
          <div className="mt-4 space-y-3">
            <h3 className="text-lg font-semibold text-slate-100">
              Update your password separately
            </h3>
            <p className="text-sm leading-6 text-slate-400">
              Open the dedicated password page to update your password securely.
            </p>
            <Button
              type="button"
              className="w-full sm:w-auto"
              onClick={() => router.push("/auth/change-password")}
            >
              Change Password
            </Button>
          </div>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-700 bg-slate-900/90 p-5 shadow-sm lg:col-span-2">
          <p className="text-xs uppercase tracking-[0.18em] text-amber-300">
            Account Details
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label
                className="text-xs uppercase tracking-[0.18em] text-slate-400"
                htmlFor="facultyFullName"
              >
                Full Name
              </label>
              <input
                id="facultyFullName"
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-slate-300 outline-none"
                value={account?.fullName ?? ""}
                readOnly
              />
            </div>
            <div>
              <label
                className="text-xs uppercase tracking-[0.18em] text-slate-400"
                htmlFor="facultyEmail"
              >
                Email
              </label>
              <input
                id="facultyEmail"
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-slate-300 outline-none"
                value={account?.email ?? ""}
                readOnly
              />
            </div>
          </div>
        </article>
      </section>

      {isProfileImageMenuOpen ? (
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
            className="w-full max-w-lg rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-700 px-6 py-5">
              <div>
                <p className="text-sm uppercase tracking-[0.22em] text-amber-300">
                  Profile Picture
                </p>
                <h3
                  id="profile-image-menu-title"
                  className="mt-2 text-xl font-semibold text-slate-100"
                >
                  Manage your image
                </h3>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setIsProfileImageMenuOpen(false);
                  setIsFullImageOpen(false);
                }}
              >
                Close
              </Button>
            </div>

            <div className="space-y-4 px-6 py-6">
              {isFullImageOpen ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-center overflow-hidden rounded-3xl border border-slate-700 bg-slate-950">
                    {displayedProfileImage ? (
                      <img
                        src={displayedProfileImage}
                        alt={account?.fullName ?? "Profile picture"}
                        className="max-h-[70vh] w-full object-contain"
                      />
                    ) : (
                      <div className="flex h-80 w-full items-center justify-center text-2xl font-semibold text-slate-500">
                        No profile picture available
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setIsFullImageOpen(false)}
                    >
                      Back
                    </Button>
                    <Button
                      type="button"
                      onClick={() => {
                        profileImageInputRef.current?.click();
                      }}
                    >
                      Change Image
                    </Button>
                  </div>
                </div>
              ) : (
                <ul className="space-y-3">
                  <li>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4 text-left text-slate-100 transition hover:border-amber-400 hover:bg-slate-900"
                      onClick={() => setIsFullImageOpen(true)}
                    >
                      <span>
                        <span className="block font-semibold">
                          View image in full
                        </span>
                        <span className="block text-sm text-slate-400">
                          Open a larger preview of the current photo.
                        </span>
                      </span>
                      <span className="text-amber-300">↗</span>
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4 text-left text-slate-100 transition hover:border-amber-400 hover:bg-slate-900"
                      onClick={() => {
                        profileImageInputRef.current?.click();
                        setIsProfileImageMenuOpen(false);
                      }}
                    >
                      <span>
                        <span className="block font-semibold">
                          Change image
                        </span>
                        <span className="block text-sm text-slate-400">
                          Upload a new profile picture.
                        </span>
                      </span>
                      <span className="text-amber-300">✎</span>
                    </button>
                  </li>
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <section className="grid gap-4">
        <article className="rounded-2xl border border-slate-700 bg-slate-900/90 p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.18em] text-amber-300">
            Edit Name
          </p>
          <form className="mt-4 space-y-4" onSubmit={handleSaveName}>
            <div className="grid gap-4 md:grid-cols-3">
              <label className="space-y-2 text-sm text-slate-300">
                <span className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  First Name
                </span>
                <input
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none focus:border-amber-400"
                  value={form.firstName}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      firstName: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="space-y-2 text-sm text-slate-300">
                <span className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Middle Name
                </span>
                <input
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none focus:border-amber-400"
                  value={form.middleName}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      middleName: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="space-y-2 text-sm text-slate-300">
                <span className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Last Name
                </span>
                <input
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none focus:border-amber-400"
                  value={form.lastName}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      lastName: event.target.value,
                    }))
                  }
                />
              </label>
            </div>

            <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-400">
              Preview: <span className="text-slate-100">{fullNamePreview}</span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={isSaving || isLoading}>
                {isSaving ? "Saving..." : "Save Profile Changes"}
              </Button>
              {message ? (
                <p className="text-sm text-emerald-300">{message}</p>
              ) : null}
              {error && !isLoading ? (
                <p className="text-sm text-red-400">{error}</p>
              ) : null}
            </div>
          </form>
        </article>
      </section>
    </div>
  );
}
