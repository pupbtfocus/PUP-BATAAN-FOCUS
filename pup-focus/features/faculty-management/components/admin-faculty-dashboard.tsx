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
type SemesterOption = "1st Semester" | "2nd Semester";

type AdminSection = "add" | "faculty" | "requirements" | "details";

type FacultyAccount = {
  id: string;
  fullName: string;
  email: string;
  is_active: boolean;
  created_at: string;
  requirementStatus: Record<RequirementCode, RequirementStatus>;
};

const SEMESTER_OPTIONS: SemesterOption[] = ["1st Semester", "2nd Semester"];

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
  const [loadingFacultyIds, setLoadingFacultyIds] = useState<Set<string>>(
    new Set(),
  );
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [detailsFacultyId, setDetailsFacultyId] = useState<string | null>(null);

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

  async function onDeactivateFaculty(facultyId: string) {
    setLoadingFacultyIds((prev) => new Set(prev).add(facultyId));

    try {
      const response = await fetch("/api/admin/faculty/deactivate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facultyProfileId: facultyId }),
      });

      if (response.ok) {
        setFacultyAccounts((prev) =>
          prev.map((faculty) =>
            faculty.id === facultyId
              ? { ...faculty, is_active: false }
              : faculty,
          ),
        );
        // Refresh from database
        await loadFacultyFromDatabase();
      }
    } catch (error) {
      console.error("Error deactivating faculty:", error);
    } finally {
      setLoadingFacultyIds((prev) => {
        const next = new Set(prev);
        next.delete(facultyId);
        return next;
      });
    }
  }

  async function onActivateFaculty(facultyId: string) {
    setLoadingFacultyIds((prev) => new Set(prev).add(facultyId));

    try {
      const response = await fetch("/api/admin/faculty/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facultyProfileId: facultyId }),
      });

      if (response.ok) {
        setFacultyAccounts((prev) =>
          prev.map((faculty) =>
            faculty.id === facultyId
              ? { ...faculty, is_active: true }
              : faculty,
          ),
        );
        // Refresh from database
        await loadFacultyFromDatabase();
      }
    } catch (error) {
      console.error("Error activating faculty:", error);
    } finally {
      setLoadingFacultyIds((prev) => {
        const next = new Set(prev);
        next.delete(facultyId);
        return next;
      });
    }
  }

  return (
    <div className="grid items-stretch gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="h-full rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-lg">
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

      <div>
        <section className="h-full rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-lg">
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
              onViewDetails={(facultyId) => {
                setDetailsFacultyId(facultyId);
                setDetailsModalOpen(true);
              }}
              onActivate={onActivateFaculty}
              onDeactivate={onDeactivateFaculty}
              loadingFacultyIds={loadingFacultyIds}
            />
          ) : null}

          {activeSection === "requirements" ? (
            <RequirementsPanel
              facultyAccounts={facultyAccounts}
              selectedFaculty={selectedFaculty}
              onSelectFaculty={setSelectedFacultyId}
            />
          ) : null}
        </section>

        {detailsModalOpen && detailsFacultyId && (
          <FacultyDetailsModal
            facultyId={detailsFacultyId}
            facultyAccounts={facultyAccounts}
            onClose={() => setDetailsModalOpen(false)}
          />
        )}
      </div>
    </div>
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
    <div className="flex h-full flex-col">
      <h2 className="text-lg font-semibold">Add Faculty Account</h2>
      <p className="mt-1 text-sm text-slate-400">
        Create a new faculty account with email and password.
      </p>

      <form
        className="mt-4 flex flex-1 flex-col gap-3"
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

        <Button className="mt-auto w-full" type="submit" disabled={isCreating}>
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
  onViewDetails,
  onActivate,
  onDeactivate,
  loadingFacultyIds,
}: {
  facultyAccounts: FacultyAccount[];
  isLoading: boolean;
  onSelectFaculty: (facultyId: string) => void;
  onDeleteFaculty: (facultyId: string) => void;
  onViewDetails: (facultyId: string) => void;
  onActivate: (facultyId: string) => void;
  onDeactivate: (facultyId: string) => void;
  loadingFacultyIds: Set<string>;
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
                <div className="flex items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => onSelectFaculty(faculty.id)}
                    className="text-left flex-1 min-w-0"
                  >
                    <p className="font-medium truncate">{faculty.fullName}</p>
                    <p className="text-sm text-slate-400 truncate">
                      {faculty.email}
                    </p>
                  </button>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {faculty.is_active ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onDeactivate(faculty.id)}
                        disabled={loadingFacultyIds.has(faculty.id)}
                        className="text-amber-300 hover:text-amber-200"
                      >
                        {loadingFacultyIds.has(faculty.id)
                          ? "Deactivating..."
                          : "Deactivate"}
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onActivate(faculty.id)}
                        disabled={loadingFacultyIds.has(faculty.id)}
                        className="text-green-400 hover:text-green-300"
                      >
                        {loadingFacultyIds.has(faculty.id)
                          ? "Activating..."
                          : "Activate"}
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onViewDetails(faculty.id)}
                      className="text-blue-400 hover:text-blue-300"
                    >
                      View Details
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onDeleteFaculty(faculty.id)}
                      className="text-red-400 hover:text-red-300"
                    >
                      Delete
                    </Button>
                  </div>
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
}: {
  facultyAccounts: FacultyAccount[];
  selectedFaculty: FacultyAccount | null;
  onSelectFaculty: (facultyId: string) => void;
}) {
  const [academicYear, setAcademicYear] = useState("");
  const [semester, setSemester] = useState<SemesterOption>("1st Semester");
  const [availableAcademicYears, setAvailableAcademicYears] = useState<
    string[]
  >([]);
  const [verificationStatus, setVerificationStatus] = useState<Record<
    RequirementCode,
    RequirementStatus
  > | null>(null);
  const [isLoadingVerification, setIsLoadingVerification] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(
    null,
  );
  const [isModalOpen, setIsModalOpen] = useState(false);

  async function fetchVerificationStatus(
    selectedFacultyId: string,
    selectedAcademicYear?: string,
    selectedSemester?: SemesterOption,
  ) {
    setIsLoadingVerification(true);
    setVerificationError(null);

    try {
      const params = new URLSearchParams({
        facultyId: selectedFacultyId,
      });

      if (selectedAcademicYear) {
        params.set("academicYear", selectedAcademicYear);
      }

      if (selectedSemester) {
        params.set("semester", selectedSemester);
      }

      const response = await fetch(
        `/api/admin/faculty/requirements/verification?${params.toString()}`,
      );

      if (!response.ok) {
        throw new Error("Failed to load verification requirements.");
      }

      const data = await response.json();
      const years: string[] = data.availableAcademicYears ?? [];
      const selectedYear = data.selectedAcademicYear ?? "";
      const selectedSem =
        (data.selectedSemester as SemesterOption | undefined) ?? "1st Semester";

      setAvailableAcademicYears(years);
      setAcademicYear(selectedYear);
      setSemester(selectedSem);
      setVerificationStatus(data.requirementStatus ?? null);
    } catch (error) {
      setVerificationError(
        "Unable to load requirements for the selected filter.",
      );
      setVerificationStatus(null);
    } finally {
      setIsLoadingVerification(false);
    }
  }

  useEffect(() => {
    if (!selectedFaculty) {
      setAvailableAcademicYears([]);
      setAcademicYear("");
      setSemester("1st Semester");
      setVerificationStatus(null);
      setVerificationError(null);
      return;
    }

    fetchVerificationStatus(selectedFaculty.id);
  }, [selectedFaculty]);

  async function onOpenModal() {
    if (!selectedFaculty || !academicYear) {
      return;
    }

    await fetchVerificationStatus(selectedFaculty.id, academicYear, semester);
    setIsModalOpen(true);
  }

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

      {facultyAccounts.length > 0 ? (
        <div className="mt-4 space-y-3">
          {selectedFaculty ? (
            <div className="rounded-xl border border-slate-700 bg-slate-950 p-4 text-sm">
              <p>
                <span className="text-slate-400">Selected Faculty:</span>{" "}
                {selectedFaculty.fullName}
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-700 bg-slate-950 p-4 text-sm text-slate-300">
              Select a faculty account, then choose S.Y. and semester to view
              only that term's requirements.
            </div>
          )}

          <div className="rounded-xl border border-slate-700 bg-slate-950 p-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label
                  className="text-sm text-slate-300"
                  htmlFor="facultyFilter"
                >
                  Faculty
                </label>
                <select
                  id="facultyFilter"
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:ring focus:ring-amber-300/30"
                  value={selectedFaculty?.id ?? ""}
                  onChange={(event) => onSelectFaculty(event.target.value)}
                >
                  <option value="">Select faculty</option>
                  {facultyAccounts.map((faculty) => (
                    <option key={faculty.id} value={faculty.id}>
                      {faculty.fullName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  className="text-sm text-slate-300"
                  htmlFor="academicYearFilter"
                >
                  School Year
                </label>
                <select
                  id="academicYearFilter"
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:ring focus:ring-amber-300/30"
                  value={academicYear}
                  onChange={(event) => setAcademicYear(event.target.value)}
                >
                  {availableAcademicYears.length === 0 ? (
                    <option value="">No school year found</option>
                  ) : null}

                  {availableAcademicYears.map((year) => (
                    <option key={year} value={year}>
                      S.Y. {year}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  className="text-sm text-slate-300"
                  htmlFor="semesterFilter"
                >
                  Semester
                </label>
                <select
                  id="semesterFilter"
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:ring focus:ring-amber-300/30"
                  value={semester}
                  onChange={(event) =>
                    setSemester(event.target.value as SemesterOption)
                  }
                >
                  {SEMESTER_OPTIONS.map((term) => (
                    <option key={term} value={term}>
                      {term}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {verificationError ? (
              <p className="mt-3 rounded-md border border-red-700 bg-red-950/20 px-3 py-2 text-sm text-red-300">
                {verificationError}
              </p>
            ) : null}

            <div className="mt-4 flex justify-end">
              <Button
                type="button"
                disabled={
                  !selectedFaculty || !academicYear || isLoadingVerification
                }
                onClick={onOpenModal}
              >
                {isLoadingVerification
                  ? "Loading requirements..."
                  : "Open Verification Modal"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {isModalOpen && selectedFaculty ? (
        <RequirementsVerificationModal
          facultyName={selectedFaculty.fullName}
          academicYear={academicYear}
          semester={semester}
          requirementStatus={verificationStatus}
          onClose={() => setIsModalOpen(false)}
        />
      ) : null}
    </div>
  );
}

function RequirementsVerificationModal({
  facultyName,
  academicYear,
  semester,
  requirementStatus,
  onClose,
}: {
  facultyName: string;
  academicYear: string;
  semester: SemesterOption;
  requirementStatus: Record<RequirementCode, RequirementStatus> | null;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-slate-700 bg-slate-950 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Requirements Verification</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200"
            aria-label="Close modal"
          >
            X
          </button>
        </div>

        <p className="text-sm text-slate-300">
          <span className="text-slate-400">Faculty:</span> {facultyName}
        </p>
        <p className="text-sm text-slate-300">
          <span className="text-slate-400">Filter:</span> S.Y. {academicYear} -{" "}
          {semester}
        </p>

        <div className="mt-4 space-y-2">
          {DEFAULT_REQUIREMENTS.map((code) => {
            const status = requirementStatus?.[code] ?? "not_submitted";
            return (
              <div
                key={code}
                className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
              >
                <p className="text-sm text-slate-300">
                  {REQUIREMENT_LABEL[code]}
                </p>
                <span
                  className={`rounded px-2 py-1 text-xs ${
                    status === "validated"
                      ? "bg-green-900/30 text-green-400"
                      : status === "uploaded"
                        ? "bg-yellow-900/30 text-yellow-400"
                        : "bg-red-900/30 text-red-400"
                  }`}
                >
                  {statusLabel(status)}
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex justify-end">
          <Button onClick={onClose} variant="secondary">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

function FacultyDetailsModal({
  facultyId,
  facultyAccounts,
  onClose,
}: {
  facultyId: string;
  facultyAccounts: FacultyAccount[];
  onClose: () => void;
}) {
  const selectedFaculty = facultyAccounts.find((f) => f.id === facultyId);

  if (!selectedFaculty) {
    return null;
  }

  const createdDate = new Date(selectedFaculty.created_at);
  const formattedDate = createdDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-slate-700 bg-slate-950 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Faculty Details</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <article className="rounded-xl border border-slate-700 bg-slate-900 p-4">
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-slate-500">
                  Full Name
                </p>
                <p className="text-sm text-slate-200">
                  {selectedFaculty.fullName}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-500">Email</p>
                <p className="text-sm text-slate-200">
                  {selectedFaculty.email}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-500">
                  Account Status
                </p>
                <p
                  className={`text-sm ${
                    selectedFaculty.is_active
                      ? "text-green-400"
                      : "text-red-400"
                  }`}
                >
                  {selectedFaculty.is_active ? "Active" : "Inactive"}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-500">
                  Created Date
                </p>
                <p className="text-sm text-slate-200">{formattedDate}</p>
              </div>
            </div>
          </article>

          <article className="rounded-xl border border-slate-700 bg-slate-900 p-4">
            <h3 className="font-semibold mb-3">Compliance Requirements</h3>
            <div className="space-y-2">
              {Object.entries(selectedFaculty.requirementStatus).map(
                ([code, status]) => (
                  <div key={code} className="flex items-center justify-between">
                    <p className="text-sm text-slate-400">{code}</p>
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        status === "validated"
                          ? "bg-green-900/30 text-green-400"
                          : status === "uploaded"
                            ? "bg-yellow-900/30 text-yellow-400"
                            : "bg-red-900/30 text-red-400"
                      }`}
                    >
                      {statusLabel(status)}
                    </span>
                  </div>
                ),
              )}
            </div>
          </article>
        </div>

        <div className="mt-6 flex justify-end">
          <Button
            onClick={onClose}
            variant="secondary"
            className="text-slate-400 hover:text-slate-200"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
