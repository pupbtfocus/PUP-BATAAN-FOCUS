"use client";

import React, { FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { BrandMark } from "@/components/shared/brand-mark";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { isValidEmailAddress } from "@/lib/validation/email";
import { ROLE, ROLE_LABEL, type AppRole } from "@/config/roles";

const DASHBOARD_IMAGES = [
  "/images/attachments/IMG_9399.jpeg",
  "/images/attachments/IMG_9402.jpeg",
];

// Minimal local types to satisfy TypeScript in this component.
type AccountViewRole = "all" | string;

type SettingsOption = "profile" | "password";

interface AdminAccount {
  id?: string;
  profile_id: string;
  full_name: string;
  email: string;
  profileImageUrl?: string | null;
  profile?: {
    firstName?: string | null;
    middleName?: string | null;
    lastName?: string | null;
    fullName?: string | null;
  } | null;
  role: AppRole;
  is_active: boolean;
  department?: string | null;
  permissions?: string[];
}

interface AdminDetails {
  profile_id: string;
  full_name?: string | null;
  email?: string | null;
  role?: AppRole | null;
  is_active?: boolean;
  department?: string | null;
  permissions?: string[];
  created_at?: string | null;
  updated_at?: string | null;
  metadata?: Record<string, unknown> | null;
}

type SuperAdminAccountResult = {
  account?: { fullName?: string; email?: string } | null;
  error?: string | null;
  details?: AdminDetails | null;
  admins?: AdminAccount[];
};

type CreateAdminResult = {
  success?: boolean;
  error?: string | null;
  sent?: boolean;
  sendError?: string | null;
  link?: string | null;
  user?: { email?: string; fullName?: string } | null;
};

function buildAdminFullName(input: {
  firstName?: string;
  middleName?: string;
  lastName?: string;
}) {
  return [input.firstName, input.middleName, input.lastName]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(" ");
}

export function SuperAdminDashboard({
  adminName,
}: {
  adminName?: string | null;
}) {
  const [adminAccounts, setAdminAccounts] = useState<AdminAccount[]>([]);
  const [accountViewRole, setAccountViewRole] =
    useState<AccountViewRole>("all");
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [accountActionError, setAccountActionError] = useState<string | null>(
    null,
  );
  const [accountActionSuccess, setAccountActionSuccess] = useState<
    string | null
  >(null);
  const [loadingAdminIds, setLoadingAdminIds] = useState<Set<string>>(
    new Set(),
  );
  const [adminDetails, setAdminDetails] = useState<AdminDetails | null>(null);
  const [isLoadingAdminDetails, setIsLoadingAdminDetails] = useState(false);
  const [adminDetailsOpen, setAdminDetailsOpen] = useState(false);
  const [adminDetailsEditable, setAdminDetailsEditable] = useState(false);
  const [settingsFullName, setSettingsFullName] = useState("");
  const [settingsEmail, setSettingsEmail] = useState("");
  const [activeSettingsOption, setActiveSettingsOption] =
    useState<SettingsOption>("profile");
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);
  const [settingsPassword, setSettingsPassword] = useState("");
  const [settingsConfirmPassword, setSettingsConfirmPassword] = useState("");
  const [settingsOldPassword, setSettingsOldPassword] = useState("");
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  const [activeSection, setActiveSection] = useState<
    "dashboard" | "accounts" | "settings"
  >("dashboard");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [createAdminModalOpen, setCreateAdminModalOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteModalMessage, setInviteModalMessage] = useState("");
  const [inviteWasSent, setInviteWasSent] = useState(false);
  const [createAdminFirstName, setCreateAdminFirstName] = useState("");
  const [createAdminMiddleName, setCreateAdminMiddleName] = useState("");
  const [createAdminLastName, setCreateAdminLastName] = useState("");
  const [createAdminProfileImage, setCreateAdminProfileImage] =
    useState<File | null>(null);
  const [createAdminProfileImagePreview, setCreateAdminProfileImagePreview] =
    useState<string | null>(null);

  function openCreateAdminModal() {
    setError(null);
    setSuccess(null);
    setCreateAdminFirstName("");
    setCreateAdminMiddleName("");
    setCreateAdminLastName("");
    setCreateAdminProfileImage(null);
    setCreateAdminProfileImagePreview(null);
    setEmail("");
    setCreateAdminModalOpen(true);
  }

  function closeCreateAdminModal() {
    setCreateAdminModalOpen(false);
    setIsSubmitting(false);
    setError(null);
    setSuccess(null);
    if (createAdminProfileImagePreview) {
      URL.revokeObjectURL(createAdminProfileImagePreview);
    }
    setCreateAdminProfileImage(null);
    setCreateAdminProfileImagePreview(null);
  }

  async function loadAdminAccounts() {
    try {
      setIsLoadingAccounts(true);
      setAccountsError(null);

      const response = await fetch("/api/super-admin/admin/list");
      if (!response.ok) {
        setAccountsError("Failed to load admin accounts");
        return;
      }

      const data = await response.json();
      setAdminAccounts(data.admins || []);
    } catch {
      setAccountsError("Error loading admin accounts");
    } finally {
      setIsLoadingAccounts(false);
    }
  }

  async function loadAccountSettings() {
    try {
      setIsLoadingSettings(true);
      setSettingsError(null);

      const response = await fetch("/api/super-admin/account");
      const data = (await response.json()) as SuperAdminAccountResult;

      if (!response.ok || !data.account) {
        setSettingsError(data.error ?? "Failed to load account settings");
        return;
      }

      setSettingsFullName(data.account.fullName ?? "");
      setSettingsEmail(data.account.email ?? "");
    } catch {
      setSettingsError("Error loading account settings");
    } finally {
      setIsLoadingSettings(false);
    }
  }

  async function refreshCurrentPanel() {
    if (activeSection === "accounts") {
      await loadAdminAccounts();
      return;
    }

    if (activeSection === "settings") {
      await loadAccountSettings();
    }
  }

  useEffect(() => {
    void loadAdminAccounts();
  }, []);

  useEffect(() => {
    void loadAccountSettings();
  }, []);

  const activeAccounts = useMemo(
    () => adminAccounts.filter((admin) => admin.is_active),
    [adminAccounts],
  );

  const adminRoleAccounts = useMemo(
    () => adminAccounts.filter((admin) => admin.role === ROLE.ADMIN),
    [adminAccounts],
  );

  const superAdminAccounts = useMemo(
    () => adminAccounts.filter((admin) => admin.role === ROLE.SUPER_ADMIN),
    [adminAccounts],
  );
  const visibleAccountGroups = useMemo(() => {
    if (accountViewRole === "all") {
      return [
        {
          key: ROLE.ADMIN,
          title: "Admin Accounts",
          accounts: adminRoleAccounts,
          emptyMessage: "No admin accounts found.",
        },
        {
          key: ROLE.SUPER_ADMIN,
          title: "Super Admin Accounts",
          accounts: superAdminAccounts,
          emptyMessage: "No super admin accounts found.",
        },
      ];
    }

    return [
      {
        key: accountViewRole,
        title:
          accountViewRole === ROLE.ADMIN
            ? "Admin Accounts"
            : "Super Admin Accounts",
        accounts:
          accountViewRole === ROLE.ADMIN
            ? adminRoleAccounts
            : superAdminAccounts,
        emptyMessage:
          accountViewRole === ROLE.ADMIN
            ? "No admin accounts found."
            : "No super admin accounts found.",
      },
    ];
  }, [accountViewRole, adminRoleAccounts, superAdminAccounts]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    const firstName = createAdminFirstName.trim();
    const middleName = createAdminMiddleName.trim();
    const lastName = createAdminLastName.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const fullName = buildAdminFullName({
      firstName,
      middleName,
      lastName,
    });

    if (!firstName || !lastName) {
      setError("First name and last name are required.");
      setIsSubmitting(false);
      return;
    }

    if (!fullName) {
      setError("Please provide the admin name details.");
      setIsSubmitting(false);
      return;
    }

    if (!isValidEmailAddress(normalizedEmail)) {
      setError("Please provide a real email address.");
      setIsSubmitting(false);
      return;
    }

    try {
      const body = new FormData();
      body.append("firstName", firstName);
      body.append("middleName", middleName);
      body.append("lastName", lastName);
      body.append("email", normalizedEmail);

      if (createAdminProfileImage) {
        body.append("profileImage", createAdminProfileImage);
      }

      const response = await fetch("/api/super-admin/admin/create", {
        method: "POST",
        body,
      });

      const data = (await response.json()) as CreateAdminResult;

      if (!response.ok) {
        setError(data.error ?? "Failed to send admin invite");
        setIsSubmitting(false);
        return;
      }

      const invitedEmail = data.user?.email ?? normalizedEmail;
      setInviteWasSent(Boolean(data.sent));
      const inviteMessage = data.sent
        ? `Invitation email sent to ${invitedEmail}. Please ask them to verify their email and check their inbox.`
        : data.link
          ? `Invite link generated for ${invitedEmail}. Email delivery failed: ${data.sendError ?? "SMTP is not available"}\n\n${data.link}`
          : `Invite could not be sent for ${invitedEmail}.`;

      setInviteModalMessage(inviteMessage);
      setInviteModalOpen(true);
      setSuccess(inviteMessage);
      setCreateAdminModalOpen(false);
      setCreateAdminFirstName("");
      setCreateAdminMiddleName("");
      setCreateAdminLastName("");
      if (createAdminProfileImagePreview) {
        URL.revokeObjectURL(createAdminProfileImagePreview);
      }
      setCreateAdminProfileImage(null);
      setCreateAdminProfileImagePreview(null);
      setEmail("");
      void (async () => {
        try {
          await loadAdminAccounts();
        } catch {
          // ignore refresh failure and keep the success state
        }
      })();
      setIsSubmitting(false);
    } catch {
      setError("Unexpected error while creating admin account");
      setIsSubmitting(false);
    }
  }

  async function onSettingsSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSettingsError(null);
    setSettingsSuccess(null);
    setIsSavingSettings(true);

    try {
      const response = await fetch("/api/super-admin/account", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: settingsFullName,
          email: settingsEmail,
        }),
      });

      const data = (await response.json()) as SuperAdminAccountResult;

      if (!response.ok) {
        setSettingsError(data.error ?? "Failed to update account settings");
        setIsSavingSettings(false);
        return;
      }

      setSettingsSuccess("Super Admin account updated successfully.");
      if (data.account) {
        setSettingsFullName(data.account.fullName ?? "");
        setSettingsEmail(data.account.email ?? "");
      }
      setIsSavingSettings(false);
    } catch {
      setSettingsError("Unexpected error while updating account settings");
      setIsSavingSettings(false);
    }
  }

  async function onPasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!settingsOldPassword.trim()) {
      setPasswordError("Old password is required.");
      return;
    }

    if (settingsPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters.");
      return;
    }

    if (settingsPassword !== settingsConfirmPassword) {
      setPasswordError("Password confirmation does not match.");
      return;
    }

    setIsSavingPassword(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const currentEmail = user?.email ?? "";
      if (!currentEmail) {
        setPasswordError("Unable to resolve current account email.");
        setIsSavingPassword(false);
        return;
      }

      const { error: oldPasswordError } =
        await supabase.auth.signInWithPassword({
          email: currentEmail,
          password: settingsOldPassword,
        });

      if (oldPasswordError) {
        setPasswordError("Old password is incorrect.");
        setIsSavingPassword(false);
        return;
      }

      const response = await fetch("/api/super-admin/account", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          oldPassword: settingsOldPassword,
          password: settingsPassword,
        }),
      });

      const data = (await response.json()) as SuperAdminAccountResult;

      if (!response.ok) {
        setPasswordError(data.error ?? "Failed to update password");
        setIsSavingPassword(false);
        return;
      }

      setPasswordSuccess("Password updated successfully.");
      setSettingsOldPassword("");
      setSettingsPassword("");
      setSettingsConfirmPassword("");
      setIsSavingPassword(false);
    } catch {
      setPasswordError("Unexpected error while updating password");
      setIsSavingPassword(false);
    }
  }

  async function onDeactivateAdmin(profileId: string) {
    setLoadingAdminIds((prev) => new Set(prev).add(profileId));
    setAccountActionError(null);
    setAccountActionSuccess(null);

    try {
      const response = await fetch("/api/super-admin/admin/deactivate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId }),
      });

      const data = await response.json();
      if (!response.ok) {
        setAccountActionError(
          data.error ?? "Failed to deactivate admin account",
        );
        return;
      }

      setAccountActionSuccess("Admin account deactivated successfully.");
      await loadAdminAccounts();
    } catch {
      setAccountActionError(
        "Unexpected error while deactivating admin account.",
      );
    } finally {
      setLoadingAdminIds((prev) => {
        const next = new Set(prev);
        next.delete(profileId);
        return next;
      });
    }
  }

  async function onActivateAdmin(profileId: string) {
    setLoadingAdminIds((prev) => new Set(prev).add(profileId));
    setAccountActionError(null);
    setAccountActionSuccess(null);

    try {
      const response = await fetch("/api/super-admin/admin/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId }),
      });

      const data = await response.json();
      if (!response.ok) {
        setAccountActionError(data.error ?? "Failed to activate admin account");
        return;
      }

      setAccountActionSuccess("Admin account activated successfully.");
      await loadAdminAccounts();
    } catch {
      setAccountActionError("Unexpected error while activating admin account.");
    } finally {
      setLoadingAdminIds((prev) => {
        const next = new Set(prev);
        next.delete(profileId);
        return next;
      });
    }
  }

  async function onDeleteAdmin(profileId: string) {
    const shouldDelete = window.confirm(
      "Are you sure you want to delete this admin account?",
    );

    if (!shouldDelete) {
      return;
    }

    setLoadingAdminIds((prev) => new Set(prev).add(profileId));
    setAccountActionError(null);
    setAccountActionSuccess(null);

    try {
      const response = await fetch("/api/super-admin/admin/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId }),
      });

      const data = await response.json();
      if (!response.ok) {
        setAccountActionError(data.error ?? "Failed to delete admin account");
        return;
      }

      setAccountActionSuccess("Admin account deleted successfully.");
      await loadAdminAccounts();
    } catch {
      setAccountActionError("Unexpected error while deleting admin account.");
    } finally {
      setLoadingAdminIds((prev) => {
        const next = new Set(prev);
        next.delete(profileId);
        return next;
      });
    }
  }

  async function onViewAdminDetails(profileId: string) {
    // open details in read-only mode
    setAdminDetailsEditable(false);
    setIsLoadingAdminDetails(true);
    setAdminDetailsOpen(true);
    setAdminDetails(null);

    try {
      const response = await fetch(
        `/api/super-admin/admin/details?profileId=${encodeURIComponent(profileId)}`,
      );
      const data = await response.json();

      if (!response.ok) {
        setAccountActionError(data.error ?? "Failed to load admin details");
        setAdminDetailsOpen(false);
        return;
      }

      setAdminDetails(data.details ?? null);
    } catch {
      setAccountActionError("Unexpected error while loading admin details.");
      setAdminDetailsOpen(false);
    } finally {
      setIsLoadingAdminDetails(false);
    }
  }

  async function onEditAdmin(profileId: string) {
    setAdminDetailsEditable(true);
    setIsLoadingAdminDetails(true);
    setAdminDetailsOpen(true);
    setAdminDetails(null);

    try {
      const response = await fetch(
        `/api/super-admin/admin/details?profileId=${encodeURIComponent(
          profileId,
        )}`,
      );
      const data = await response.json();

      if (!response.ok) {
        setAccountActionError(data.error ?? "Failed to load admin details");
        setAdminDetailsOpen(false);
        return;
      }

      setAdminDetails(data.details ?? null);
    } catch {
      setAccountActionError("Unexpected error while loading admin details.");
      setAdminDetailsOpen(false);
    } finally {
      setIsLoadingAdminDetails(false);
    }
  }

  // removed: edit flow — details are view-only

  function renderAccountCards(accounts: AdminAccount[]) {
    if (!accounts.length) {
      return null;
    }

    return accounts.map((admin) => (
      <div
        key={admin.id}
        className="rounded-xl border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950/80 p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              {admin.profileImageUrl ? (
                <img
                  src={admin.profileImageUrl}
                  alt={admin.full_name}
                  className="h-12 w-12 rounded-full border border-slate-700 object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {admin.full_name
                    .split(" ")
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((part) => part[0])
                    .join("")
                    .toUpperCase()}
                </div>
              )}
              <div>
                <p className="font-semibold text-slate-800 dark:text-slate-100">
                  {admin.full_name}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{admin.email}</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 px-3 py-1 text-xs text-slate-700 dark:text-slate-300">
              {ROLE_LABEL[admin.role]}
            </span>
            <span
              className={`rounded-full border px-3 py-1 text-xs ${
                admin.is_active
                  ? "border-emerald-700 bg-emerald-950/40 text-emerald-300"
                  : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 text-slate-500 dark:text-slate-400"
              }`}
            >
              {admin.is_active ? "Active" : "Inactive"}
            </span>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
          {admin.department ? (
            <span>Department: {admin.department}</span>
          ) : null}
          {admin.permissions && admin.permissions.length > 0 ? (
            <span>Permissions: {admin.permissions.length}</span>
          ) : null}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {admin.role !== ROLE.SUPER_ADMIN ? (
            admin.is_active ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onDeactivateAdmin(admin.profile_id)}
                disabled={loadingAdminIds.has(admin.profile_id)}
                className="text-[#7a0000] dark:text-amber-300 hover:text-amber-200"
              >
                {loadingAdminIds.has(admin.profile_id)
                  ? "Deactivating..."
                  : "Deactivate"}
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onActivateAdmin(admin.profile_id)}
                disabled={loadingAdminIds.has(admin.profile_id)}
                className="text-emerald-300 hover:text-emerald-200"
              >
                {loadingAdminIds.has(admin.profile_id)
                  ? "Activating..."
                  : "Activate"}
              </Button>
            )
          ) : null}
          {admin.role === ROLE.ADMIN ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onEditAdmin(admin.profile_id)}
              className="text-blue-300 hover:text-blue-200"
            >
              Edit
            </Button>
          ) : null}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onViewAdminDetails(admin.profile_id)}
            className="text-blue-300 hover:text-blue-200"
          >
            View Details
          </Button>
          {admin.role !== ROLE.SUPER_ADMIN ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onDeleteAdmin(admin.profile_id)}
              disabled={loadingAdminIds.has(admin.profile_id)}
              className="text-red-300 hover:text-red-200"
            >
              Delete
            </Button>
          ) : null}
        </div>
      </div>
    ));
  }

  return (
    <div className="relative flex min-h-full w-full items-stretch gap-0">
      <aside className="fixed left-0 top-16 h-[calc(100vh-4rem)] w-72 overflow-y-auto rounded-r-2xl border border-l-0 border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 p-5 shadow-lg">
        <div className="my-6 rounded-xl bg-[var(--card)] p-4 text-[var(--accent)] flex flex-col items-center">
          <p className="mt-2 font-semibold text-white text-center">
            {adminName ?? "Super Admin"}
          </p>

          <div className="my-2 h-px w-full bg-slate-700" />

          <p className="mt-1 text-xs uppercase tracking-[0.12em] text-[var(--accent)] text-center">
            Super Admin
          </p>
        </div>

        <nav className="mt-6 space-y-2">
          <SidebarButton
            active={activeSection === "dashboard"}
            title="Dashboard"
            onClick={() => setActiveSection("dashboard")}
          />
          <SidebarButton
            active={activeSection === "accounts"}
            title="Admin Accounts"
            onClick={() => setActiveSection("accounts")}
          />
          <SidebarButton
            active={activeSection === "settings"}
            title="Settings"
            onClick={() => setActiveSection("settings")}
          />
        </nav>
      </aside>

      <div className="ml-72 flex min-h-full w-[calc(100%-18rem)] flex-col">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-l border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 shadow-lg">
          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            {activeSection === "dashboard" ? (
              <article className="relative -m-6 h-[calc(100vh-4rem)] w-[calc(100%+3rem)] overflow-hidden p-0">
                <div className="relative h-full overflow-hidden bg-[#4d0000]/80">
                  <Image
                    src={DASHBOARD_IMAGES[0]}
                    alt="PUP Bataan login background"
                    fill
                    sizes="100vw"
                    className="object-cover"
                    style={{ animation: "backgroundFadeA 16s infinite linear" }}
                  />
                  <Image
                    src={DASHBOARD_IMAGES[1]}
                    alt="PUP Bataan login background"
                    fill
                    sizes="100vw"
                    className="object-cover"
                    style={{ animation: "backgroundFadeB 16s infinite linear" }}
                  />
                  {/* removed red overlay */}

                  <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
                    <BrandMark size={90} className="rounded-full" />
                    <p className="mt-4 text-xs uppercase tracking-[0.28em] text-[#ffd700]">
                      Polytechnic University of the Philippines - Bataan Campus
                    </p>
                    <h3 className="mt-2 text-3xl font-bold tracking-tight text-[#fff8e7]">
                      PUP FOCUS
                    </h3>
                  </div>
                </div>
              </article>
            ) : null}

            {activeSection === "accounts" ? (
              <article className="p-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="inline-block w-max rounded-xl border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950 px-4 py-2">
                    <h3 className="text-lg font-semibold text-[#7a0000] dark:text-amber-300">
                      Admin Accounts
                    </h3>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => void refreshCurrentPanel()}
                    disabled={isLoadingAccounts}
                  >
                    {isLoadingAccounts ? "Refreshing..." : "Refresh"}
                  </Button>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <InfoCard
                    label="Total Accounts"
                    value={String(adminAccounts.length)}
                  />
                  <InfoCard
                    label="Active Accounts"
                    value={String(activeAccounts.length)}
                  />
                  <InfoCard
                    label="Admin Accounts"
                    value={String(adminRoleAccounts.length)}
                  />
                  <InfoCard
                    label="Super Admin Accounts"
                    value={String(superAdminAccounts.length)}
                  />
                </div>

                <div className="mt-6 rounded-2xl border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950/50 p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                        Account Directory
                      </h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <select
                        id="accountRoleFilter"
                        value={accountViewRole}
                        onChange={(event) =>
                          setAccountViewRole(
                            event.target.value as AccountViewRole,
                          )
                        }
                        className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 outline-none transition focus:border-amber-400"
                      >
                        <option value="all">All Accounts</option>
                        <option value={ROLE.ADMIN}>Admin Accounts</option>
                        <option value={ROLE.SUPER_ADMIN}>
                          Super Admin Accounts
                        </option>
                      </select>
                      <Button type="button" onClick={openCreateAdminModal}>
                        Create Admin
                      </Button>
                    </div>
                  </div>

                  {accountsError ? (
                    <p className="mt-4 text-sm text-red-300">{accountsError}</p>
                  ) : null}
                  {accountActionError ? (
                    <p className="mt-4 text-sm text-red-300">
                      {accountActionError}
                    </p>
                  ) : null}
                  {accountActionSuccess ? (
                    <p className="mt-4 text-sm text-emerald-300">
                      {accountActionSuccess}
                    </p>
                  ) : null}

                  <div className="mt-4 space-y-6">
                    {isLoadingAccounts ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Loading account directory...
                      </p>
                    ) : (
                      visibleAccountGroups.map((group) => (
                        <section
                          key={group.key}
                          className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <h4 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                              {group.title}
                            </h4>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {group.accounts.length} account
                              {group.accounts.length === 1 ? "" : "s"}
                            </span>
                          </div>

                          <div className="mt-3 space-y-3">
                            {group.accounts.length ? (
                              renderAccountCards(group.accounts)
                            ) : (
                              <p className="text-sm text-slate-500 dark:text-slate-400">
                                {group.emptyMessage}
                              </p>
                            )}
                          </div>
                        </section>
                      ))
                    )}
                  </div>
                </div>
              </article>
            ) : null}

            {activeSection === "settings" ? (
              <article className="p-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="inline-block w-max rounded-xl border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950 px-4 py-2">
                    <h3 className="text-lg font-semibold text-[#7a0000] dark:text-amber-300">
                      Settings
                    </h3>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => void refreshCurrentPanel()}
                    disabled={isLoadingSettings}
                  >
                    {isLoadingSettings ? "Refreshing..." : "Refresh"}
                  </Button>
                </div>

                <section className="mt-6 grid gap-4 lg:grid-cols-[260px_1fr]">
                  <div className="space-y-2 rounded-2xl border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950/50 p-3">
                    <SettingsOptionButton
                      active={activeSettingsOption === "profile"}
                      title="Account Profile"
                      description="Update username and email"
                      onClick={() => setActiveSettingsOption("profile")}
                    />
                    <SettingsOptionButton
                      active={activeSettingsOption === "password"}
                      title="Password"
                      description="Change super admin password"
                      onClick={() => setActiveSettingsOption("password")}
                    />
                  </div>

                  <div className="rounded-2xl border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950/50 p-6">
                    {activeSettingsOption === "profile" ? (
                      isLoadingSettings ? (
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          Loading account settings...
                        </p>
                      ) : (
                        <form className="space-y-4" onSubmit={onSettingsSubmit}>
                          <div>
                            <label
                              className="block text-sm font-medium text-slate-200"
                              htmlFor="settingsFullName"
                            >
                              Username / Full Name
                            </label>
                            <input
                              id="settingsFullName"
                              type="text"
                              value={settingsFullName}
                              onChange={(event) =>
                                setSettingsFullName(event.target.value)
                              }
                              required
                              placeholder="Enter full name"
                              className="mt-2 w-full rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 px-4 py-3 text-sm text-slate-800 dark:text-slate-100 outline-none ring-amber-300/30 placeholder:text-slate-500 focus:ring"
                            />
                          </div>

                          <div>
                            <label
                              className="block text-sm font-medium text-slate-200"
                              htmlFor="settingsEmail"
                            >
                              Email Address
                            </label>
                            <input
                              id="settingsEmail"
                              type="email"
                              value={settingsEmail}
                              onChange={(event) =>
                                setSettingsEmail(event.target.value)
                              }
                              required
                              placeholder="Enter email address"
                              className="mt-2 w-full rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 px-4 py-3 text-sm text-slate-800 dark:text-slate-100 outline-none ring-amber-300/30 placeholder:text-slate-500 focus:ring"
                            />
                          </div>

                          {settingsError ? (
                            <p className="text-sm text-red-300">
                              {settingsError}
                            </p>
                          ) : null}
                          {settingsSuccess ? (
                            <p className="text-sm text-emerald-300">
                              {settingsSuccess}
                            </p>
                          ) : null}

                          <div className="flex justify-center pt-1">
                            <Button
                              className="px-5 py-2"
                              type="submit"
                              disabled={isSavingSettings}
                            >
                              {isSavingSettings
                                ? "Saving..."
                                : "Update Account"}
                            </Button>
                          </div>
                        </form>
                      )
                    ) : (
                      <form className="space-y-4" onSubmit={onPasswordSubmit}>
                        <div>
                          <label
                            className="block text-sm font-medium text-slate-200"
                            htmlFor="settingsOldPassword"
                          >
                            Old Password
                          </label>
                          <div className="relative mt-2">
                            <input
                              id="settingsOldPassword"
                              type={showOldPassword ? "text" : "password"}
                              value={settingsOldPassword}
                              onChange={(event) =>
                                setSettingsOldPassword(event.target.value)
                              }
                              required
                              placeholder="Enter current password"
                              className="w-full rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 px-4 py-3 pr-12 text-sm text-slate-800 dark:text-slate-100 outline-none ring-amber-300/30 placeholder:text-slate-500 focus:ring"
                            />
                            <PasswordToggleButton
                              shown={showOldPassword}
                              onClick={() => setShowOldPassword((s) => !s)}
                            />
                          </div>
                        </div>

                        <div>
                          <label
                            className="block text-sm font-medium text-slate-200"
                            htmlFor="settingsPassword"
                          >
                            New Password
                          </label>
                          <div className="relative mt-2">
                            <input
                              id="settingsPassword"
                              type={showNewPassword ? "text" : "password"}
                              value={settingsPassword}
                              onChange={(event) =>
                                setSettingsPassword(event.target.value)
                              }
                              required
                              minLength={8}
                              placeholder="Minimum 8 characters"
                              className="w-full rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 px-4 py-3 pr-12 text-sm text-slate-800 dark:text-slate-100 outline-none ring-amber-300/30 placeholder:text-slate-500 focus:ring"
                            />
                            <PasswordToggleButton
                              shown={showNewPassword}
                              onClick={() => setShowNewPassword((s) => !s)}
                            />
                          </div>
                        </div>

                        <div>
                          <label
                            className="block text-sm font-medium text-slate-200"
                            htmlFor="settingsConfirmPassword"
                          >
                            Confirm New Password
                          </label>
                          <div className="relative mt-2">
                            <input
                              id="settingsConfirmPassword"
                              type={showConfirmPassword ? "text" : "password"}
                              value={settingsConfirmPassword}
                              onChange={(event) =>
                                setSettingsConfirmPassword(event.target.value)
                              }
                              required
                              minLength={8}
                              placeholder="Retype new password"
                              className="w-full rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 px-4 py-3 pr-12 text-sm text-slate-800 dark:text-slate-100 outline-none ring-amber-300/30 placeholder:text-slate-500 focus:ring"
                            />
                            <PasswordToggleButton
                              shown={showConfirmPassword}
                              onClick={() => setShowConfirmPassword((s) => !s)}
                            />
                          </div>
                        </div>

                        {passwordError ? (
                          <p className="text-sm text-red-300">
                            {passwordError}
                          </p>
                        ) : null}
                        {passwordSuccess ? (
                          <p className="text-sm text-emerald-300">
                            {passwordSuccess}
                          </p>
                        ) : null}

                        <div className="flex justify-center pt-1">
                          <Button
                            className="px-5 py-2"
                            type="submit"
                            disabled={isSavingPassword}
                          >
                            {isSavingPassword ? "Saving..." : "Update Password"}
                          </Button>
                        </div>
                      </form>
                    )}
                  </div>
                </section>
              </article>
            ) : null}
          </div>
        </div>
      </div>

      {createAdminModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-[rgba(255,215,0,0.18)] bg-[#4d0000]/95 p-6 shadow-2xl shadow-black/30 backdrop-blur">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-[#ffd700]">
                  Super Admin
                </p>
                <h3 className="mt-2 text-xl font-semibold text-[#fff8e7]">
                  Create Admin Account
                </h3>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={closeCreateAdminModal}
              >
                Close
              </Button>
            </div>

            <div className="mt-5 rounded-xl border border-[rgba(255,215,0,0.18)] bg-[#3b0000]/70 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-[#ffd700]">
                Profile
              </p>
              <p className="mt-2 text-sm text-[#fff8e7]">
                Super Admin account profile
              </p>
            </div>

            <form className="mt-6 space-y-4" onSubmit={onSubmit}>
              <div>
                <label
                  className="block text-sm font-medium text-[#fff8e7]"
                  htmlFor="profileImage"
                >
                  Profile Image
                </label>
                <input
                  id="profileImage"
                  type="file"
                  accept="image/*"
                  className="mt-2 w-full rounded-xl border border-[rgba(255,215,0,0.18)] bg-[#3b0000] px-4 py-3 text-sm text-[#fff8e7] outline-none file:mr-3 file:rounded-md file:border-0 file:bg-[#ffd700] file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-[#3b0000] focus:ring focus:ring-[#ffd700]/40"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setCreateAdminProfileImage(file);
                    if (createAdminProfileImagePreview) {
                      URL.revokeObjectURL(createAdminProfileImagePreview);
                    }
                    setCreateAdminProfileImagePreview(
                      file ? URL.createObjectURL(file) : null,
                    );
                  }}
                />
                <p className="mt-1 text-xs text-[#d8b882]">
                  Upload a square image for the admin profile.
                </p>
                {createAdminProfileImagePreview ? (
                  <div className="mt-3 flex items-center gap-3 rounded-xl border border-[rgba(255,215,0,0.18)] bg-[#3b0000]/80 p-3">
                    <img
                      src={createAdminProfileImagePreview}
                      alt="Selected profile preview"
                      className="h-16 w-16 rounded-full border border-[rgba(255,215,0,0.18)] object-cover"
                    />
                    <div className="min-w-0">
                      <p className="text-sm text-[#fff8e7]">Selected image</p>
                      <p className="truncate text-xs text-[#d8b882]">
                        {createAdminProfileImage?.name ?? "Preview available"}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label
                    className="block text-sm font-medium text-[#fff8e7]"
                    htmlFor="firstName"
                  >
                    First Name
                  </label>
                  <input
                    id="firstName"
                    type="text"
                    value={createAdminFirstName}
                    onChange={(event) =>
                      setCreateAdminFirstName(event.target.value)
                    }
                    required
                    placeholder="Juan"
                    className="mt-2 w-full rounded-xl border border-[rgba(255,215,0,0.18)] bg-[#3b0000] px-4 py-3 text-sm text-[#fff8e7] outline-none ring-[#ffd700]/40 placeholder:text-[#d8b882] focus:ring"
                  />
                </div>

                <div>
                  <label
                    className="block text-sm font-medium text-[#fff8e7]"
                    htmlFor="middleName"
                  >
                    Middle Name
                  </label>
                  <input
                    id="middleName"
                    type="text"
                    value={createAdminMiddleName}
                    onChange={(event) =>
                      setCreateAdminMiddleName(event.target.value)
                    }
                    placeholder="Santos"
                    className="mt-2 w-full rounded-xl border border-[rgba(255,215,0,0.18)] bg-[#3b0000] px-4 py-3 text-sm text-[#fff8e7] outline-none ring-[#ffd700]/40 placeholder:text-[#d8b882] focus:ring"
                  />
                </div>

                <div>
                  <label
                    className="block text-sm font-medium text-[#fff8e7]"
                    htmlFor="lastName"
                  >
                    Last Name
                  </label>
                  <input
                    id="lastName"
                    type="text"
                    value={createAdminLastName}
                    onChange={(event) =>
                      setCreateAdminLastName(event.target.value)
                    }
                    required
                    placeholder="Dela Cruz"
                    className="mt-2 w-full rounded-xl border border-[rgba(255,215,0,0.18)] bg-[#3b0000] px-4 py-3 text-sm text-[#fff8e7] outline-none ring-[#ffd700]/40 placeholder:text-[#d8b882] focus:ring"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-[rgba(255,215,0,0.18)] bg-[#3b0000]/70 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-[#ffd700]">
                  Full Name Preview
                </p>
                <p className="mt-2 text-sm text-[#fff8e7]">
                  {buildAdminFullName({
                    firstName: createAdminFirstName,
                    middleName: createAdminMiddleName,
                    lastName: createAdminLastName,
                  }) || "Enter the name parts above"}
                </p>
              </div>

              <div>
                <label
                  className="block text-sm font-medium text-[#fff8e7]"
                  htmlFor="email"
                >
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  placeholder="admin@pup-focus.local"
                  className="mt-2 w-full rounded-xl border border-[rgba(255,215,0,0.18)] bg-[#3b0000] px-4 py-3 text-sm text-[#fff8e7] outline-none ring-[#ffd700]/40 placeholder:text-[#d8b882] focus:ring"
                />
              </div>

              {/* Temporary password removed from create UI — invite-only flow */}

              {error ? <p className="text-sm text-red-300">{error}</p> : null}
              {success ? (
                <p className="text-sm text-[#ffd700]">{success}</p>
              ) : null}

              <div className="flex justify-center pt-1">
                <Button
                  className="px-5 py-2"
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Creating Admin..." : "Create Admin Account"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {adminDetailsOpen ? (
        <AdminDetailsModal
          details={adminDetails}
          isLoading={isLoadingAdminDetails}
          onClose={() => setAdminDetailsOpen(false)}
          onSaved={() => void loadAdminAccounts()}
          editable={adminDetailsEditable}
        />
      ) : null}

      {inviteModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[rgba(255,215,0,0.18)] bg-[#4d0000]/95 p-6 shadow-2xl shadow-black/30 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.28em] text-[#ffd700]">
              {inviteWasSent ? "Invitation Sent" : "Invite Link Generated"}
            </p>
            <h3 className="mt-3 text-xl font-semibold text-[#fff8e7]">
              {inviteWasSent
                ? "Email sent successfully"
                : "Email delivery failed"}
            </h3>
            <p className="mt-3 whitespace-pre-wrap text-sm text-[#f3d9b3]">
              {inviteModalMessage}
            </p>

            <div className="mt-6 flex justify-end">
              <Button type="button" onClick={() => setInviteModalOpen(false)}>
                OK
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SidebarButton({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean;
  title: string;
  description?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl border px-4 py-3 text-left transition ${
        active
          ? "border-amber-400 bg-amber-400/10"
          : "border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950/60 hover:border-slate-500"
      }`}
    >
      <p
        className={`font-semibold ${active ? "text-[#7a0000] dark:text-amber-300" : "text-slate-800 dark:text-slate-100"}`}
      >
        {title}
      </p>
      {description ? (
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
      ) : null}
    </button>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950/70 p-5">
      <p className="mt-0 text-xs uppercase tracking-[0.28em] text-[#ffd700]">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-slate-800 dark:text-slate-100">{value}</p>
    </div>
  );
}

function SettingsOptionButton({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl border px-4 py-3 text-left transition ${
        active
          ? "border-amber-400 bg-amber-400/10"
          : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/60 hover:border-slate-500"
      }`}
    >
      <p className="font-semibold text-slate-800 dark:text-slate-100">{title}</p>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
    </button>
  );
}

function PasswordToggleButton({
  shown,
  onClick,
}: {
  shown: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={shown ? "Hide password" : "Show password"}
      onClick={onClick}
      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-[rgba(255,255,255,0.18)] bg-[rgba(255,255,255,0.06)] p-1.5 text-white"
    >
      {shown ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="#fff"
          aria-hidden
        >
          <g clipPath="url(#clip0_4418_8295)">
            <path
              d="M21.25 9.14969C18.94 5.51969 15.56 3.42969 12 3.42969C10.22 3.42969 8.49 3.94969 6.91 4.91969C5.33 5.89969 3.91 7.32969 2.75 9.14969C1.75 10.7197 1.75 13.2697 2.75 14.8397C5.06 18.4797 8.44 20.5597 12 20.5597C13.78 20.5597 15.51 20.0397 17.09 19.0697C18.67 18.0897 20.09 16.6597 21.25 14.8397C22.25 13.2797 22.25 10.7197 21.25 9.14969ZM12 16.0397C9.76 16.0397 7.96 14.2297 7.96 11.9997C7.96 9.76969 9.76 7.95969 12 7.95969C14.24 7.95969 16.04 9.76969 16.04 11.9997C16.04 14.2297 14.24 16.0397 12 16.0397Z"
              fill="white"
              style={{ fill: "var(--fillg)" }}
            />
            <path
              d="M11.9999 9.14062C10.4299 9.14062 9.1499 10.4206 9.1499 12.0006C9.1499 13.5706 10.4299 14.8506 11.9999 14.8506C13.5699 14.8506 14.8599 13.5706 14.8599 12.0006C14.8599 10.4306 13.5699 9.14062 11.9999 9.14062Z"
              fill="white"
              style={{ fill: "var(--fillg)" }}
            />
          </g>
          <defs>
            <clipPath id="clip0_4418_8295">
              <rect width="24" height="24" fill="white" />
            </clipPath>
          </defs>
        </svg>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
        >
          <g clipPath="url(#clip0_4418_9538)">
            <path
              d="M14.53 9.46992L9.47004 14.5299C8.82004 13.8799 8.42004 12.9899 8.42004 11.9999C8.42004 10.0199 10.02 8.41992 12 8.41992C12.99 8.41992 13.88 8.81992 14.53 9.46992Z"
              stroke="#fff"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M17.82 5.77047C16.07 4.45047 14.07 3.73047 12 3.73047C8.46997 3.73047 5.17997 5.81047 2.88997 9.41047C1.98997 10.8205 1.98997 13.1905 2.88997 14.6005C3.67997 15.8405 4.59997 16.9105 5.59997 17.7705"
              stroke="#fff"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M8.42004 19.5297C9.56004 20.0097 10.77 20.2697 12 20.2697C15.53 20.2697 18.82 18.1897 21.11 14.5897C22.01 13.1797 22.01 10.8097 21.11 9.39969C20.78 8.87969 20.42 8.38969 20.05 7.92969"
              stroke="#fff"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M15.5099 12.6992C15.2499 14.1092 14.0999 15.2592 12.6899 15.5192"
              stroke="#fff"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M9.47 14.5293L2 21.9993"
              stroke="#fff"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M22 2L14.53 9.47"
              stroke="#fff"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
          <defs>
            <clipPath id="clip0_4418_9538">
              <rect width="24" height="24" fill="white" />
            </clipPath>
          </defs>
        </svg>
      )}
    </button>
  );
}

function AdminDetailsModal({
  details,
  isLoading,
  onClose,
  onSaved,
  editable,
}: {
  details: AdminDetails | null;
  isLoading: boolean;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
  editable?: boolean;
}) {
  const [fullName, setFullName] = useState(details?.full_name ?? "");
  const [email, setEmail] = useState(details?.email ?? "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const canEdit = Boolean(editable) && details?.role !== ROLE.SUPER_ADMIN;

  useEffect(() => {
    setFullName(details?.full_name ?? "");
    setEmail(details?.email ?? "");
    setPassword("");
    setError(null);
    setSuccess(null);
    setShowPassword(false);
  }, [details]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!details?.profile_id) {
      setError("Admin details are not available.");
      return;
    }

    if (!canEdit) {
      setError("Super admin accounts are view-only.");
      return;
    }

    if (!fullName.trim() || !email.trim()) {
      setError("Full name and email are required.");
      return;
    }

    if (password && password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("/api/super-admin/admin/details", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          profileId: details.profile_id,
          fullName,
          email,
          ...(password ? { password } : {}),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Failed to update admin details");
        setIsSaving(false);
        return;
      }

      setSuccess("Admin account updated successfully.");
      setPassword("");
      if (data.details) {
        setFullName(data.details.full_name ?? fullName);
        setEmail(data.details.email ?? email);
      }
      await onSaved();
      setIsSaving(false);
    } catch {
      setError("Unexpected error while updating admin details.");
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950 p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            {canEdit ? "Edit Admin Account" : "View Admin Account"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-slate-700 dark:text-slate-300 hover:bg-slate-800"
          >
            X
          </button>
        </div>

        {isLoading ? (
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Loading details...</p>
        ) : details ? (
          canEdit ? (
            <form className="mt-4 space-y-4" onSubmit={onSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label
                    className="block text-sm font-medium text-slate-200"
                    htmlFor="adminFullName"
                  >
                    Full Name
                  </label>
                  <input
                    id="adminFullName"
                    type="text"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    readOnly={!canEdit}
                    disabled={!canEdit}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 px-4 py-3 text-sm text-slate-800 dark:text-slate-100 outline-none ring-amber-300/30 placeholder:text-slate-500 focus:ring"
                  />
                </div>

                <div>
                  <label
                    className="block text-sm font-medium text-slate-200"
                    htmlFor="adminEmail"
                  >
                    Email Address
                  </label>
                  <input
                    id="adminEmail"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    readOnly={!canEdit}
                    disabled={!canEdit}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 px-4 py-3 text-sm text-slate-800 dark:text-slate-100 outline-none ring-amber-300/30 placeholder:text-slate-500 focus:ring"
                  />
                </div>
              </div>

              <div>
                <label
                  className="block text-sm font-medium text-slate-200"
                  htmlFor="adminPassword"
                >
                  New Password
                </label>
                <div className="relative mt-2">
                  <input
                    id="adminPassword"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={!canEdit}
                    minLength={8}
                    placeholder="Leave blank to keep current password"
                    className="w-full rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 px-4 py-3 pr-12 text-sm text-slate-800 dark:text-slate-100 outline-none ring-amber-300/30 placeholder:text-slate-500 focus:ring"
                  />
                  <PasswordToggleButton
                    shown={showPassword}
                    onClick={() => setShowPassword((value) => !value)}
                  />
                </div>
              </div>

              <div className="grid gap-2 text-sm text-slate-500 dark:text-slate-400 md:grid-cols-2">
                <p>
                  <span className="text-slate-500">Role:</span>{" "}
                  {details.role ? ROLE_LABEL[details.role as AppRole] : "Admin"}
                </p>
                <p>
                  <span className="text-slate-500">Status:</span>{" "}
                  {details.is_active ? "Active" : "Inactive"}
                </p>
                {details.department ? (
                  <p>
                    <span className="text-slate-500">Department:</span>{" "}
                    {details.department}
                  </p>
                ) : null}
                {details.permissions && details.permissions.length > 0 ? (
                  <p>
                    <span className="text-slate-500">Permissions:</span>{" "}
                    {details.permissions.length}
                  </p>
                ) : null}
              </div>

              {error ? <p className="text-sm text-red-300">{error}</p> : null}
              {success ? (
                <p className="text-sm text-emerald-300">{success}</p>
              ) : null}

              <div className="flex flex-wrap justify-between gap-3 pt-2">
                <div className="text-xs text-slate-500">
                  Created{" "}
                  {details.created_at
                    ? new Date(details.created_at).toLocaleString()
                    : "Unknown"}
                  {details.updated_at
                    ? ` • Updated ${new Date(details.updated_at).toLocaleString()}`
                    : ""}
                </div>
                <div className="flex gap-3">
                  <Button type="button" variant="secondary" onClick={onClose}>
                    Close
                  </Button>
                  {canEdit ? (
                    <Button type="submit" disabled={isSaving}>
                      {isSaving ? "Saving..." : "Save Changes"}
                    </Button>
                  ) : null}
                </div>
              </div>
            </form>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-slate-200">
                    Full Name
                  </p>
                  <p className="mt-2 text-sm text-slate-800 dark:text-slate-100">
                    {details.full_name}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-200">
                    Email Address
                  </p>
                  <p className="mt-2 text-sm text-slate-800 dark:text-slate-100">{details.email}</p>
                </div>
              </div>

              <div className="grid gap-2 text-sm text-slate-500 dark:text-slate-400 md:grid-cols-2">
                <p>
                  <span className="text-slate-500">Role:</span>{" "}
                  {details.role ? ROLE_LABEL[details.role as AppRole] : "Admin"}
                </p>
                <p>
                  <span className="text-slate-500">Status:</span>{" "}
                  {details.is_active ? "Active" : "Inactive"}
                </p>
                {details.department ? (
                  <p>
                    <span className="text-slate-500">Department:</span>{" "}
                    {details.department}
                  </p>
                ) : null}
                {details.permissions && details.permissions.length > 0 ? (
                  <p>
                    <span className="text-slate-500">Permissions:</span>{" "}
                    {details.permissions.length}
                  </p>
                ) : null}
              </div>

              {details.metadata &&
              !(
                typeof details.metadata === "object" &&
                Object.keys(details.metadata).length === 1 &&
                (details.metadata as any).is_active === true
              ) ? (
                <div>
                  <p className="text-sm font-medium text-slate-200">Metadata</p>
                  <pre className="mt-2 max-h-40 overflow-auto rounded-md bg-slate-900 p-3 text-xs text-slate-200">
                    {JSON.stringify(details.metadata, null, 2)}
                  </pre>
                </div>
              ) : null}

              <div className="flex flex-wrap justify-between gap-3 pt-2">
                <div className="text-xs text-slate-500">
                  Created{" "}
                  {details.created_at
                    ? new Date(details.created_at).toLocaleString()
                    : "Unknown"}
                  {details.updated_at
                    ? ` • Updated ${new Date(details.updated_at).toLocaleString()}`
                    : ""}
                </div>
                <div className="flex gap-3">
                  <Button type="button" variant="secondary" onClick={onClose}>
                    Close
                  </Button>
                </div>
              </div>
            </div>
          )
        ) : (
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">No details available.</p>
        )}
      </div>
    </div>
  );
}
