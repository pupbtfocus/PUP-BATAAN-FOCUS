"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  REQUIREMENT_LABEL,
  DEFAULT_REQUIREMENTS,
  type RequirementCode,
} from "@/config/compliance";
import {
  facultyAccountSchema,
  type FacultyAccountFormInput,
} from "@/features/faculty-management/schemas/faculty-account.schema";

type RequirementStatus = "not_submitted" | "uploaded" | "validated";

type AdminSection = "add" | "faculty" | "requirements";

type FacultyAccount = {
  id: string;
  fullName: string;
  email: string;
  requirementStatus: Record<RequirementCode, RequirementStatus>;
};

function buildInitialRequirementStatus(): Record<
  RequirementCode,
  RequirementStatus
> {
  return DEFAULT_REQUIREMENTS.reduce(
    (acc, requirementCode) => {
      acc[requirementCode] = "not_submitted";
      return acc;
    },
    {} as Record<RequirementCode, RequirementStatus>,
  );
}

function statusLabel(status: RequirementStatus): string {
  if (status === "not_submitted") {
    return "Not Submitted";
  }

  if (status === "uploaded") {
    return "Uploaded - For Validation";
  }

  return "Validated by Admin";
}

export function AdminFacultyDashboard() {
  const [facultyAccounts, setFacultyAccounts] = useState<FacultyAccount[]>([]);
  const [selectedFacultyId, setSelectedFacultyId] = useState<string | null>(
    null,
  );
  const [activeSection, setActiveSection] = useState<AdminSection>("add");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadFacultyFromDatabase();
  }, []);

  async function loadFacultyFromDatabase() {
    try {
      setIsLoading(true);
      const response = await fetch("/api/admin/faculty/list");
      if (response.ok) {
        const data = await response.json();
        setFacultyAccounts(data.faculty || []);
      }
    } catch (error) {
      // Error handled by UI state
    } finally {
      setIsLoading(false);
    }
  }

  const form = useForm<FacultyAccountFormInput>({
    resolver: zodResolver(facultyAccountSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
    },
  });

  const selectedFaculty = useMemo(
    () =>
      facultyAccounts.find((faculty) => faculty.id === selectedFacultyId) ??
      null,
    [facultyAccounts, selectedFacultyId],
  );

  const metrics = useMemo(() => {
    const totalFaculty = facultyAccounts.length;
    const totalUploads = facultyAccounts.reduce((sum, faculty) => {
      const uploaded = Object.values(faculty.requirementStatus).filter(
        (status) => status !== "not_submitted",
      ).length;
      return sum + uploaded;
    }, 0);
    const totalValidated = facultyAccounts.reduce((sum, faculty) => {
      const validated = Object.values(faculty.requirementStatus).filter(
        (status) => status === "validated",
      ).length;
      return sum + validated;
    }, 0);

    return {
      totalFaculty,
      totalUploads,
      totalValidated,
    };
  }, [facultyAccounts]);

  async function onAddFaculty(input: FacultyAccountFormInput) {
    setIsCreating(true);
    setCreateError(null);
    setCreateSuccess(null);

    try {
      const response = await fetch("/api/admin/faculty/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: input.fullName,
          email: input.email,
          password: input.password,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setCreateError(errorData.error || "Failed to create faculty account");
        setIsCreating(false);
        return;
      }

      setCreateSuccess(
        `Faculty account created successfully for ${input.email}`,
      );
      form.reset({ fullName: "", email: "", password: "" });

      // Refresh faculty list from database
      await loadFacultyFromDatabase();
    } catch (error) {
      setCreateError("An error occurred while creating the faculty account");
    } finally {
      setIsCreating(false);
    }
  }

  async function onDeleteFaculty(facultyId: string) {
    try {
      const response = await fetch("/api/admin/faculty/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facultyProfileId: facultyId }),
      });

      if (response.ok) {
        setFacultyAccounts((prev) =>
          prev.filter((faculty) => faculty.id !== facultyId),
        );
        if (selectedFacultyId === facultyId) {
          setSelectedFacultyId(null);
        }
        // Refresh from database
        await loadFacultyFromDatabase();
      }
    } catch (error) {
      // Error handled by UI state
    }
  }

  function updateRequirementStatus(
    facultyId: string,
    requirementCode: RequirementCode,
    status: RequirementStatus,
  ) {
    setFacultyAccounts((prev) =>
      prev.map((faculty) => {
        if (faculty.id !== facultyId) {
          return faculty;
        }

        return {
          ...faculty,
          requirementStatus: {
            ...faculty.requirementStatus,
            [requirementCode]: status,
          },
        };
      }),
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-lg">
        <p className="text-sm uppercase tracking-[0.22em] text-amber-300">
          Admin Workspace
        </p>
        <h2 className="mt-2 text-xl font-semibold text-slate-100">
          Faculty Control Panel
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Manage accounts, assignments, and requirement validation from one
          panel.
        </p>

        <nav className="mt-6 space-y-2">
          <SidebarButton
            active={activeSection === "add"}
            title="Add Faculty"
            description="Create faculty account and assign program"
            onClick={() => setActiveSection("add")}
          />
          <SidebarButton
            active={activeSection === "faculty"}
            title="Faculty List"
            description="View and delete faculty accounts"
            onClick={() => setActiveSection("faculty")}
          />
          <SidebarButton
            active={activeSection === "requirements"}
            title="Requirements Verification"
            description="Validate curriculum-based uploads"
            onClick={() => setActiveSection("requirements")}
          />
        </nav>
      </aside>

      <div className="space-y-6">
        <section className="grid gap-4 md:grid-cols-3">
          <StatCard
            label="Faculty Accounts"
            value={String(metrics.totalFaculty)}
          />
          <StatCard
            label="Uploaded Requirements"
            value={String(metrics.totalUploads)}
          />
          <StatCard
            label="Validated Requirements"
            value={String(metrics.totalValidated)}
          />
        </section>

        <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-lg">
          {activeSection === "add" ? (
            <AddFacultyPanel
              form={form}
              onAddFaculty={onAddFaculty}
              isCreating={isCreating}
              createError={createError}
              createSuccess={createSuccess}
            />
          ) : null}

          {activeSection === "faculty" ? (
            <FacultyListPanel
              facultyAccounts={facultyAccounts}
              isLoading={isLoading}
              onSelectFaculty={setSelectedFacultyId}
              onDeleteFaculty={onDeleteFaculty}
            />
          ) : null}

          {activeSection === "requirements" ? (
            <RequirementsPanel
              facultyAccounts={facultyAccounts}
              selectedFaculty={selectedFaculty}
              onSelectFaculty={setSelectedFacultyId}
              onUpdateStatus={updateRequirementStatus}
            />
          ) : null}
        </section>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-lg border border-slate-700 bg-slate-900 p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </article>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="mt-1 text-xs text-red-400">{message}</p>;
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

function AddFacultyPanel({
  form,
  onAddFaculty,
  isCreating,
  createError,
  createSuccess,
}: {
  form: ReturnType<typeof useForm<FacultyAccountFormInput>>;
  onAddFaculty: (input: FacultyAccountFormInput) => void;
  isCreating: boolean;
  createError: string | null;
  createSuccess: string | null;
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold">Add Faculty Account</h2>
      <p className="mt-1 text-sm text-slate-400">
        Create a new faculty account with email and password.
      </p>

      <form
        className="mt-4 space-y-3"
        onSubmit={form.handleSubmit(onAddFaculty)}
      >
        <div>
          <label className="text-sm text-slate-300" htmlFor="fullName">
            Full Name
          </label>
          <input
            id="fullName"
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:ring focus:ring-amber-300/30"
            placeholder="Juan Dela Cruz"
            {...form.register("fullName")}
          />
          <FieldError message={form.formState.errors.fullName?.message} />
        </div>

        <div>
          <label className="text-sm text-slate-300" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:ring focus:ring-amber-300/30"
            placeholder="faculty@pup.edu.ph"
            {...form.register("email")}
          />
          <FieldError message={form.formState.errors.email?.message} />
        </div>

        <div>
          <label className="text-sm text-slate-300" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:ring focus:ring-amber-300/30"
            placeholder="Min. 8 characters"
            {...form.register("password")}
          />
          <FieldError message={form.formState.errors.password?.message} />
        </div>

        {createError ? (
          <p className="rounded-md border border-red-700 bg-red-950/20 px-3 py-2 text-sm text-red-300">
            {createError}
          </p>
        ) : null}

        {createSuccess ? (
          <p className="rounded-md border border-emerald-700 bg-emerald-950/20 px-3 py-2 text-sm text-emerald-300">
            {createSuccess}
          </p>
        ) : null}

        <Button className="w-full" type="submit" disabled={isCreating}>
          {isCreating ? "Creating account..." : "Add Faculty Account"}
        </Button>
      </form>
    </div>
  );
}

function FacultyListPanel({
  facultyAccounts,
  isLoading,
  onSelectFaculty,
  onDeleteFaculty,
}: {
  facultyAccounts: FacultyAccount[];
  isLoading: boolean;
  onSelectFaculty: (facultyId: string) => void;
  onDeleteFaculty: (facultyId: string) => void;
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold">Faculty List</h2>
      <p className="mt-1 text-sm text-slate-400">
        View all faculty accounts and select one to inspect requirements.
      </p>

      <div className="mt-4 space-y-3">
        {isLoading ? (
          <p className="rounded-md border border-dashed border-slate-700 px-4 py-6 text-sm text-slate-400">
            Loading faculty accounts...
          </p>
        ) : null}

        {!isLoading && facultyAccounts.length === 0 ? (
          <p className="rounded-md border border-dashed border-slate-700 px-4 py-6 text-sm text-slate-400">
            No faculty accounts yet. Add one from the sidebar.
          </p>
        ) : null}

        {!isLoading && facultyAccounts.length > 0
          ? facultyAccounts.map((faculty) => (
              <div
                key={faculty.id}
                className="rounded-xl border border-slate-700 bg-slate-950 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => onSelectFaculty(faculty.id)}
                    className="text-left"
                  >
                    <p className="font-medium">{faculty.fullName}</p>
                    <p className="text-sm text-slate-400">{faculty.email}</p>
                  </button>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onDeleteFaculty(faculty.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))
          : null}
      </div>
    </div>
  );
}

function RequirementsPanel({
  facultyAccounts,
  selectedFaculty,
  onSelectFaculty,
  onUpdateStatus,
}: {
  facultyAccounts: FacultyAccount[];
  selectedFaculty: FacultyAccount | null;
  onSelectFaculty: (facultyId: string) => void;
  onUpdateStatus: (
    facultyId: string,
    requirementCode: RequirementCode,
    status: RequirementStatus,
  ) => void;
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold">
        Faculty Requirements Verification
      </h2>
      <p className="mt-1 text-sm text-slate-400">
        Choose a faculty account and verify curriculum-based uploads here.
      </p>

      {facultyAccounts.length === 0 ? (
        <p className="mt-4 rounded-md border border-dashed border-slate-700 px-4 py-6 text-sm text-slate-400">
          Add faculty accounts first, then verify their required uploads.
        </p>
      ) : null}

      {facultyAccounts.length > 0 && !selectedFaculty ? (
        <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950 p-4 text-sm text-slate-300">
          Select a faculty account from the list to see and verify requirements.
        </div>
      ) : null}

      {selectedFaculty ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-slate-700 bg-slate-950 p-4 text-sm">
            <p>
              <span className="text-slate-400">Selected Faculty:</span>{" "}
              {selectedFaculty.fullName}
            </p>
          </div>

          {DEFAULT_REQUIREMENTS.map((requirementCode) => {
            const status = selectedFaculty.requirementStatus[requirementCode];
            return (
              <article
                key={requirementCode}
                className="rounded-xl border border-slate-700 bg-slate-950 p-4"
              >
                <p className="font-medium">
                  {REQUIREMENT_LABEL[requirementCode]}
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  Status: {statusLabel(status)}
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={status !== "not_submitted"}
                    onClick={() =>
                      onUpdateStatus(
                        selectedFaculty.id,
                        requirementCode,
                        "uploaded",
                      )
                    }
                  >
                    Mark Uploaded
                  </Button>
                  <Button
                    size="sm"
                    disabled={status !== "uploaded"}
                    onClick={() =>
                      onUpdateStatus(
                        selectedFaculty.id,
                        requirementCode,
                        "validated",
                      )
                    }
                  >
                    Validate as Admin
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      onUpdateStatus(
                        selectedFaculty.id,
                        requirementCode,
                        "not_submitted",
                      )
                    }
                  >
                    Reset
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
