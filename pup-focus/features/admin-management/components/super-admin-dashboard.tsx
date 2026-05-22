"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Image from "next/image";
import { BrandMark } from "@/components/shared/brand-mark";
import { Button } from "@/components/ui/button";
import { ROLE_LABEL, type AppRole } from "@/config/roles";

type CreateAdminResult = {
  success?: boolean;
  error?: string;
  user?: {
    id: string;
    email: string;
    fullName: string;
  };
};

type SuperAdminSection = "dashboard" | "accounts" | "settings" | "create";

type AdminAccount = {
  id: string;
  full_name: string;
  email: string;
  department: string | null;
  is_active: boolean;
  created_at: string;
  permissions: string[] | null;
};

const DASHBOARD_IMAGES = [
  "/images/attachments/IMG_9399.jpeg",
  "/images/attachments/IMG_9402.jpeg",
];

export function SuperAdminDashboard() {
  const [activeSection, setActiveSection] =
    useState<SuperAdminSection>("dashboard");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [adminAccounts, setAdminAccounts] = useState<AdminAccount[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  const [accountsError, setAccountsError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAdmins() {
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

    loadAdmins();
  }, []);

  const activeAccounts = useMemo(
    () => adminAccounts.filter((admin) => admin.is_active),
    [adminAccounts],
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/super-admin/admin/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fullName, email, password }),
      });

      const data = (await response.json()) as CreateAdminResult;

      if (!response.ok) {
        setError(data.error ?? "Failed to create admin account");
        setIsSubmitting(false);
        return;
      }

      setSuccess(`Admin account created for ${data.user?.email ?? email}.`);
      setFullName("");
      setEmail("");
      setPassword("");
      setActiveSection("accounts");
      void (async () => {
        try {
          const refreshed = await fetch("/api/super-admin/admin/list");
          if (refreshed.ok) {
            const body = await refreshed.json();
            setAdminAccounts(body.admins || []);
          }
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

  return (
    <div className="relative flex min-h-full w-full items-stretch gap-0">
      <aside className="fixed left-0 top-16 h-[calc(100vh-4rem)] w-72 overflow-y-auto rounded-r-2xl border border-l-0 border-slate-700 bg-slate-900 p-5 shadow-lg">
        <p className="text-sm uppercase tracking-[0.22em] text-amber-300">
          Super Admin Workspace
        </p>
        <h2 className="mt-2 text-xl font-semibold text-slate-100">
          Control Panel
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Manage admin accounts, access, and system settings from one place.
        </p>

        <nav className="mt-6 space-y-2">
          <SidebarButton
            active={activeSection === "dashboard"}
            title="Dashboard"
            description="Branding and summary overview"
            onClick={() => setActiveSection("dashboard")}
          />
          <SidebarButton
            active={activeSection === "accounts"}
            title="Admin Accounts"
            description="View and create admin users"
            onClick={() => setActiveSection("accounts")}
          />
          <SidebarButton
            active={activeSection === "settings"}
            title="Settings"
            description="System and access configuration"
            onClick={() => setActiveSection("settings")}
          />
          <SidebarButton
            active={activeSection === "create"}
            title="Create Admin"
            description="Provision a new admin account"
            onClick={() => setActiveSection("create")}
          />
        </nav>
      </aside>

      <div className="ml-72 flex min-h-full w-[calc(100%-18rem)] flex-col">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-l border-slate-700 bg-slate-900 shadow-lg">
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
                  <div className="absolute inset-0 bg-[#4d0000]/70" />

                  <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
                    <BrandMark
                      size={90}
                      className="rounded-full shadow-lg shadow-black/20"
                    />
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
                <p className="text-sm uppercase tracking-[0.22em] text-amber-300">
                  Super Admin Workspace
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-100">
                  Admin Accounts
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  View existing admin accounts and create new ones.
                </p>

                <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <InfoCard
                    label="Total Admins"
                    value={String(adminAccounts.length)}
                  />
                  <InfoCard
                    label="Active Admins"
                    value={String(activeAccounts.length)}
                  />
                  <InfoCard
                    label="Role"
                    value={ROLE_LABEL["super_admin" as AppRole]}
                  />
                </div>

                <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-950/50 p-5">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="text-lg font-semibold text-slate-100">
                      Admin Directory
                    </h3>
                    <Button
                      type="button"
                      onClick={() => setActiveSection("create")}
                    >
                      Create Admin
                    </Button>
                  </div>

                  {accountsError ? (
                    <p className="mt-4 text-sm text-red-300">{accountsError}</p>
                  ) : null}

                  <div className="mt-4 space-y-3">
                    {isLoadingAccounts ? (
                      <p className="text-sm text-slate-400">
                        Loading admin accounts...
                      </p>
                    ) : adminAccounts.length ? (
                      adminAccounts.map((admin) => (
                        <div
                          key={admin.id}
                          className="rounded-xl border border-slate-700 bg-slate-950/80 p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="font-semibold text-slate-100">
                                {admin.full_name}
                              </p>
                              <p className="text-sm text-slate-400">
                                {admin.email}
                              </p>
                            </div>
                            <span
                              className={`rounded-full border px-3 py-1 text-xs ${
                                admin.is_active
                                  ? "border-emerald-700 bg-emerald-950/40 text-emerald-300"
                                  : "border-slate-700 bg-slate-900 text-slate-400"
                              }`}
                            >
                              {admin.is_active ? "Active" : "Inactive"}
                            </span>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-400">
                            <span>
                              Department: {admin.department ?? "Not set"}
                            </span>
                            <span>
                              Permissions: {admin.permissions?.length ?? 0}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-400">
                        No admin accounts found.
                      </p>
                    )}
                  </div>
                </div>
              </article>
            ) : null}

            {activeSection === "settings" ? (
              <article className="p-8">
                <p className="text-sm uppercase tracking-[0.22em] text-amber-300">
                  Super Admin Workspace
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-100">
                  Settings
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  System-level controls for admin access and account management.
                </p>

                <div className="mt-6 grid gap-4 lg:grid-cols-2">
                  <SettingCard
                    title="Account Provisioning"
                    description="Super Admin can create and monitor admin accounts."
                  />
                  <SettingCard
                    title="Access Policy"
                    description="Review active admins and keep permissions aligned with campus operations."
                  />
                  <SettingCard
                    title="Branding"
                    description="Dashboard and login visuals share the same PUP FOCUS styling."
                  />
                  <SettingCard
                    title="System Status"
                    description="Use this space for future system-wide toggles and maintenance controls."
                  />
                </div>
              </article>
            ) : null}

            {activeSection === "create" ? (
              <article className="p-8">
                <p className="text-sm uppercase tracking-[0.22em] text-amber-300">
                  Super Admin Workspace
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-100">
                  Create Admin Account
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  Provision a new admin user with a temporary password.
                </p>
                <section className="mt-6 rounded-2xl border border-[rgba(255,215,0,0.18)] bg-[#4d0000]/75 p-6 shadow-lg shadow-black/20 backdrop-blur">
                  <form className="space-y-4" onSubmit={onSubmit}>
                    <div>
                      <label
                        className="block text-sm font-medium text-[#fff8e7]"
                        htmlFor="fullName"
                      >
                        Full Name
                      </label>
                      <input
                        id="fullName"
                        type="text"
                        value={fullName}
                        onChange={(event) => setFullName(event.target.value)}
                        required
                        placeholder="Juan Dela Cruz"
                        className="mt-2 w-full rounded-xl border border-[rgba(255,215,0,0.18)] bg-[#3b0000] px-4 py-3 text-sm text-[#fff8e7] outline-none ring-[#ffd700]/40 placeholder:text-[#d8b882] focus:ring"
                      />
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

                    <div>
                      <label
                        className="block text-sm font-medium text-[#fff8e7]"
                        htmlFor="password"
                      >
                        Temporary Password
                      </label>
                      <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        required
                        minLength={8}
                        placeholder="Minimum 8 characters"
                        className="mt-2 w-full rounded-xl border border-[rgba(255,215,0,0.18)] bg-[#3b0000] px-4 py-3 text-sm text-[#fff8e7] outline-none ring-[#ffd700]/40 placeholder:text-[#d8b882] focus:ring"
                      />
                    </div>

                    {error ? (
                      <p className="text-sm text-red-300">{error}</p>
                    ) : null}
                    {success ? (
                      <p className="text-sm text-[#ffd700]">{success}</p>
                    ) : null}

                    <Button
                      className="w-full"
                      type="submit"
                      disabled={isSubmitting}
                    >
                      {isSubmitting
                        ? "Creating Admin..."
                        : "Create Admin Account"}
                    </Button>
                  </form>
                </section>
              </article>
            ) : null}
          </div>
        </div>
      </div>
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
          : "border-slate-700 bg-slate-950/60 hover:border-slate-500"
      }`}
    >
      <p className="font-semibold text-slate-100">{title}</p>
      <p className="mt-1 text-sm text-slate-400">{description}</p>
    </button>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-950/70 p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-100">{value}</p>
    </div>
  );
}

function SettingCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-5">
      <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
      <p className="mt-2 text-sm text-slate-400">{description}</p>
    </div>
  );
}
